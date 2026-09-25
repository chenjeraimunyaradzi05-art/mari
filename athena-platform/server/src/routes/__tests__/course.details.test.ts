/**
 * The course catalogue's search, and the route that turns a provider's draft
 * into a public listing.
 *
 * PATCH /api/courses/:courseId was the only write route in course.routes.ts
 * with no validator at all. It took `employmentRate: 9999` and printed it on
 * the public page as "9999% of graduates, as the provider reports"; it took a
 * free-text `type` and quietly removed the course from every filter on the
 * platform; and it flipped `isActive` without asking whether the course had
 * any lessons, so an empty course could be published for a learner to enrol in
 * and hold a nought-lesson enrolment. The rule about lessons existed — as a
 * `disabled` attribute on a button, which is not a rule.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    course: {
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      findUnique: jest.fn(),
      update: jest.fn(async () => ({})),
    },
    organizationMember: { findUnique: jest.fn() },
    courseLesson: { count: jest.fn(async () => 0) },
  },
}));

jest.mock('../../middleware/auth', () => {
  const userFrom = (req: any) =>
    req.headers['x-test-user']
      ? { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' }
      : null;
  return {
    authenticate: (req: any, res: any, next: any) => {
      const user = userFrom(req);
      if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      req.user = user;
      next();
    },
    optionalAuth: (req: any, _res: any, next: any) => {
      const user = userFrom(req);
      if (user) req.user = user;
      next();
    },
    requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
    requirePremium: (_req: any, _res: any, next: any) => next(),
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const asTeacher = { 'x-test-user': 'teacher' };

describe('Course catalogue search and the publish gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.course.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'org1', title: 'Founding a business' });
    prisma.organizationMember.findUnique.mockImplementation(async ({ where }: any) =>
      where.organizationId_userId.userId === 'teacher' ? { id: 'm1' } : null
    );
    prisma.course.update.mockImplementation(async ({ data }: any) => ({ id: 'c1', ...data }));
  });

  // Postgres `contains` without a mode is a case-sensitive LIKE, so a woman
  // typing "data" was told there was no "Graduate Certificate in Data Science".
  it('searches the catalogue without caring about capitals', async () => {
    await request(app).get('/api/courses?search=data').expect(200);

    const { where } = prisma.course.findMany.mock.calls[0][0];
    expect(where.OR).toEqual([
      { title: { contains: 'data', mode: 'insensitive' } },
      { description: { contains: 'data', mode: 'insensitive' } },
    ]);
  });

  it('refuses an employment rate that is not a proportion of graduates', async () => {
    const res = await request(app)
      .patch('/api/courses/c1')
      .set(asTeacher)
      .send({ employmentRate: 9999 })
      .expect(400);

    expect(res.body.message).toMatch(/between 0 and 100/);
    expect(prisma.course.update).not.toHaveBeenCalled();
  });

  it('refuses a negative starting salary and a salary that is not a number', async () => {
    await request(app).patch('/api/courses/c1').set(asTeacher).send({ avgStartingSalary: -1 }).expect(400);
    // A non-numeric string used to become NaN and reach Prisma as a 500.
    await request(app).patch('/api/courses/c1').set(asTeacher).send({ avgStartingSalary: 'lots' }).expect(400);
    expect(prisma.course.update).not.toHaveBeenCalled();
  });

  // The create form has always been a select of five values; the edit form was
  // a free-text box, and a provider who tidied "short_course" into "Short
  // Course" removed her own course from every type filter with no error.
  it('refuses a course type the catalogue does not filter on, and normalises the ones it does', async () => {
    const rejected = await request(app)
      .patch('/api/courses/c1')
      .set(asTeacher)
      .send({ type: 'Short Course' })
      .expect(400);
    expect(rejected.body.message).toMatch(/short_course/);

    await request(app).patch('/api/courses/c1').set(asTeacher).send({ type: 'short_course' }).expect(200);
    expect(prisma.course.update.mock.calls[0][0].data.type).toBe('short_course');
  });

  it('will not publish a course that has no lessons in it', async () => {
    prisma.courseLesson.count.mockResolvedValue(0);

    const res = await request(app).patch('/api/courses/c1').set(asTeacher).send({ isActive: true }).expect(400);

    expect(res.body.message).toMatch(/at least one lesson/);
    expect(prisma.course.update).not.toHaveBeenCalled();
    expect(prisma.courseLesson.count).toHaveBeenCalledWith({ where: { module: { courseId: 'c1' } } });
  });

  it('publishes a course that has lessons, and unpublishing never asks about them', async () => {
    prisma.courseLesson.count.mockResolvedValue(3);
    await request(app).patch('/api/courses/c1').set(asTeacher).send({ isActive: true }).expect(200);
    expect(prisma.course.update.mock.calls[0][0].data.isActive).toBe(true);

    jest.clearAllMocks();
    prisma.course.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'org1', title: 'Founding a business' });
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.course.update.mockImplementation(async ({ data }: any) => ({ id: 'c1', ...data }));

    // Taking a course down is always allowed: an empty course in the catalogue
    // is the thing being prevented, not an empty course out of it.
    await request(app).patch('/api/courses/c1').set(asTeacher).send({ isActive: false }).expect(200);
    expect(prisma.courseLesson.count).not.toHaveBeenCalled();
    expect(prisma.course.update.mock.calls[0][0].data.isActive).toBe(false);
  });

  it('still lets a provider clear a figure she has not published', async () => {
    await request(app)
      .patch('/api/courses/c1')
      .set(asTeacher)
      .send({ employmentRate: '', avgStartingSalary: null })
      .expect(200);

    expect(prisma.course.update.mock.calls[0][0].data).toMatchObject({
      employmentRate: null,
      avgStartingSalary: null,
    });
  });

  it('is still closed to someone who is not on the provider’s team', async () => {
    await request(app)
      .patch('/api/courses/c1')
      .set({ 'x-test-user': 'stranger' })
      .send({ title: 'Mine now' })
      .expect(403);
    expect(prisma.course.update).not.toHaveBeenCalled();
  });
});
