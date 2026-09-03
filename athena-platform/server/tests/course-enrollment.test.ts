import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Enrolment is the learner's entry point into everything under /dashboard/learn,
// so this covers who may enrol, that enrolling twice is safe, and that the
// learner's own list comes back in the shape the client reads.
//
// It replaces a hand-run ts-node script that needed a live database and an API
// listening on port 5000, so it never ran in CI. Jest collected it, found no
// `it()` and reported the suite as failing.

jest.mock('../src/utils/prisma', () => ({
  prisma: {
    course: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    courseEnrollment: { upsert: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
  },
}));

// Unauthenticated requests still have to be rejected, so this mock honours the
// header rather than signing everybody in.
jest.mock('../src/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    const id = req.headers['x-test-user'];
    if (!id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    req.user = { id, role: req.headers['x-test-role'] || 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) {
      req.user = {
        id: req.headers['x-test-user'],
        role: req.headers['x-test-role'] || 'USER',
        email: 'u@athena.com',
      };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../src/index';
import { prisma as prismaTyped } from '../src/utils/prisma';

const prisma: any = prismaTyped;

const LEARNER = 'learner-1';
const COURSE = 'course-1';

const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });

describe('Enrolling in a course', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.course.findUnique as any).mockResolvedValue({ id: COURSE, isActive: true });
    (prisma.courseEnrollment.upsert as any).mockImplementation(async (args: any) => ({
      id: 'enr-1',
      userId: LEARNER,
      courseId: COURSE,
      progress: 0,
      ...args.create,
    }));
  });

  it('requires authentication', async () => {
    await request(app).post(`/api/courses/${COURSE}/enroll`).expect(401);

    expect(prisma.courseEnrollment.upsert).not.toHaveBeenCalled();
  });

  it('creates the enrolment for the signed-in learner', async () => {
    const res = await request(app)
      .post(`/api/courses/${COURSE}/enroll`)
      .set(as(LEARNER))
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.courseId).toBe(COURSE);

    expect((prisma.courseEnrollment.upsert as any).mock.calls[0][0]).toMatchObject({
      where: { userId_courseId: { userId: LEARNER, courseId: COURSE } },
      create: { userId: LEARNER, courseId: COURSE },
    });
  });

  it('is idempotent — re-enrolling touches the row instead of failing', async () => {
    await request(app).post(`/api/courses/${COURSE}/enroll`).set(as(LEARNER)).expect(201);
    await request(app).post(`/api/courses/${COURSE}/enroll`).set(as(LEARNER)).expect(201);

    // An upsert, not a create, is what makes the second click safe: the unique
    // (userId, courseId) constraint would otherwise throw.
    expect(prisma.courseEnrollment.upsert).toHaveBeenCalledTimes(2);
    const second = (prisma.courseEnrollment.upsert as any).mock.calls[1][0];
    expect(second.update.updatedAt).toBeInstanceOf(Date);
  });

  it('404s for a course that does not exist', async () => {
    (prisma.course.findUnique as any).mockResolvedValue(null);

    await request(app).post(`/api/courses/${COURSE}/enroll`).set(as(LEARNER)).expect(404);

    expect(prisma.courseEnrollment.upsert).not.toHaveBeenCalled();
  });

  it('404s for a retired course rather than enrolling into it', async () => {
    (prisma.course.findUnique as any).mockResolvedValue({ id: COURSE, isActive: false });

    await request(app).post(`/api/courses/${COURSE}/enroll`).set(as(LEARNER)).expect(404);

    expect(prisma.courseEnrollment.upsert).not.toHaveBeenCalled();
  });
});

describe('The learner’s own courses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires authentication', async () => {
    await request(app).get('/api/courses/me').expect(401);
  });

  it('is not read as a course slug', async () => {
    (prisma.courseEnrollment.findMany as any).mockResolvedValue([]);

    await request(app).get('/api/courses/me').set(as(LEARNER)).expect(200);

    // `/:slug` is declared after `/me`; if that order ever flips this fails.
    expect(prisma.courseEnrollment.findMany).toHaveBeenCalled();
    expect(prisma.course.findUnique).not.toHaveBeenCalled();
  });

  it('returns the courses themselves with progress attached, not the join rows', async () => {
    (prisma.courseEnrollment.findMany as any).mockResolvedValue([
      {
        id: 'enr-1',
        progress: 40,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        course: { id: COURSE, title: 'Intro to Trades', organization: { id: 'org-1' } },
      },
    ]);

    const res = await request(app).get('/api/courses/me').set(as(LEARNER)).expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: COURSE,
      title: 'Intro to Trades',
      enrollment: { id: 'enr-1', progress: 40 },
    });
  });

  it('lists most recently touched first and only for the caller', async () => {
    (prisma.courseEnrollment.findMany as any).mockResolvedValue([]);

    await request(app).get('/api/courses/me').set(as(LEARNER)).expect(200);

    expect((prisma.courseEnrollment.findMany as any).mock.calls[0][0]).toMatchObject({
      where: { userId: LEARNER },
      orderBy: { updatedAt: 'desc' },
    });
  });
});
