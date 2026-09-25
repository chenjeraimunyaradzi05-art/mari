/**
 * The catalogue's filters, and the figures a provider is allowed to publish
 * underneath them.
 *
 * `Course.studyMode` is a Json column, and the list route filtered it with
 * `{ has: ... }` — a filter Prisma only offers on a Postgres scalar list. The
 * query was rejected by the client before it reached the database, so every
 * choice in the Online / Part-time / Full-time dropdown on /dashboard/learn
 * came back a 500. The `where` in that route is typed `any`, so the compiler
 * had nothing to say about it either; these tests are what stands in for the
 * type the route gave up.
 *
 * The figures are the other half. `employmentRate` is an Int column that was
 * validated as a float, so 87.5 passed the 400 and failed as a 500; and the
 * `values: 'falsy'` escape that lets a provider clear a figure also let
 * `false` and `[]` through to a bare `Number()`, which wrote 0 — and the
 * public course page prints a 0 as "0% of graduates, as the provider reports".
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    course: {
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      findUnique: jest.fn(),
      create: jest.fn(async () => ({ id: 'new' })),
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

describe('Filtering the course catalogue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.course.findMany.mockResolvedValue([]);
    prisma.course.count.mockResolvedValue(0);
  });

  it('asks for a study mode the way a Json column can answer', async () => {
    await request(app).get('/api/courses?studyMode=online').expect(200);

    const { where } = prisma.course.findMany.mock.calls[0][0];
    expect(where.studyMode).toEqual({ array_contains: ['online'] });
    // `has` is the scalar-list filter. On this Json column Prisma refuses the
    // query outright, which is how the dropdown became a 500.
    expect(where.studyMode).not.toHaveProperty('has');
  });

  it('matches a study mode and a type however the caller capitalised them', async () => {
    await request(app).get('/api/courses?studyMode=Part-Time&type=Short_Course').expect(200);

    const { where } = prisma.course.findMany.mock.calls[0][0];
    expect(where.studyMode).toEqual({ array_contains: ['part-time'] });
    expect(where.type).toBe('short_course');
  });

  it('leaves the filters off when none was asked for', async () => {
    await request(app).get('/api/courses').expect(200);

    const { where } = prisma.course.findMany.mock.calls[0][0];
    expect(where).toEqual({ isActive: true });
  });

  // /certifications asks this question under the heading "Courses that issue a
  // certificate". A certificate is written when the last lesson is ticked off,
  // so the honest answer is the courses that have lessons here — it used to
  // ask for `type=certificate`, which is the provider's name for the
  // qualification and says nothing about whether anything can be completed.
  it('can be asked for only the courses whose lessons are on ATHENA', async () => {
    await request(app).get('/api/courses?withLessons=true').expect(200);

    const { where } = prisma.course.findMany.mock.calls[0][0];
    expect(where.modules).toEqual({ some: { lessons: { some: {} } } });
  });
});

describe('The figures and dates a provider publishes on a course', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.course.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'org1', title: 'Founding a business' });
    prisma.organizationMember.findUnique.mockImplementation(async ({ where }: any) =>
      where.organizationId_userId.userId === 'teacher' ? { id: 'm1' } : null
    );
    prisma.course.update.mockImplementation(async ({ data }: any) => ({ id: 'c1', ...data }));
  });

  // The column is an Int. A float passed the validator and then failed inside
  // Prisma, which reaches the provider as a 500 she can do nothing about.
  it('refuses a fractional employment rate rather than letting Prisma refuse it', async () => {
    const res = await request(app)
      .patch('/api/courses/c1')
      .set(asTeacher)
      .send({ employmentRate: 87.5 })
      .expect(400);

    expect(res.body.message).toMatch(/whole percentage/);
    expect(prisma.course.update).not.toHaveBeenCalled();
  });

  it('refuses a figure that is not a number instead of writing a nought nobody reported', async () => {
    await request(app).patch('/api/courses/c1').set(asTeacher).send({ employmentRate: false }).expect(400);
    await request(app).patch('/api/courses/c1').set(asTeacher).send({ avgStartingSalary: [] }).expect(400);
    await request(app).patch('/api/courses/c1').set(asTeacher).send({ cost: {} }).expect(400);
    expect(prisma.course.update).not.toHaveBeenCalled();
  });

  it('still takes a real nought, because a fee-free course costs nothing', async () => {
    await request(app).patch('/api/courses/c1').set(asTeacher).send({ cost: 0, employmentRate: 0 }).expect(200);
    expect(prisma.course.update.mock.calls[0][0].data).toMatchObject({ cost: 0, employmentRate: 0 });
  });

  it('stores study modes the way the catalogue filter looks for them', async () => {
    await request(app)
      .patch('/api/courses/c1')
      .set(asTeacher)
      .send({ studyMode: ['Online', ' Part-Time '] })
      .expect(200);

    expect(prisma.course.update.mock.calls[0][0].data.studyMode).toEqual(['online', 'part-time']);
  });

  it('lets a provider publish her intake dates, and refuses one that is not a date', async () => {
    await request(app)
      .patch('/api/courses/c1')
      .set(asTeacher)
      .send({ intakeDates: ['2026-02-16', '2026-07-20'] })
      .expect(200);

    expect(prisma.course.update.mock.calls[0][0].data.intakeDates).toEqual([
      '2026-02-16T00:00:00.000Z',
      '2026-07-20T00:00:00.000Z',
    ]);

    jest.clearAllMocks();
    prisma.course.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'org1', title: 'Founding a business' });
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm1' });

    await request(app).patch('/api/courses/c1').set(asTeacher).send({ intakeDates: ['next autumn'] }).expect(400);
    expect(prisma.course.update).not.toHaveBeenCalled();
  });
});

describe('Creating a course', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // uniqueSlug walks this until it finds a slug nobody holds.
    prisma.course.findUnique.mockResolvedValue(null);
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.course.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));
  });

  // A course created with "Online" was invisible to the "Online" pill for the
  // rest of its life, because the filter is an exact containment match and
  // only the PATCH lowercased what it stored.
  it('stores the study modes and the type lowercase, the way the filters read them', async () => {
    await request(app)
      .post('/api/courses')
      .set(asTeacher)
      .send({
        title: 'Foundations of Data',
        description: 'A short course.',
        organizationId: 'org1',
        type: 'short_course',
        studyMode: ['Online', 'Part-Time'],
      })
      .expect(201);

    expect(prisma.course.create.mock.calls[0][0].data).toMatchObject({
      type: 'short_course',
      studyMode: ['online', 'part-time'],
      isActive: false,
    });
  });

  it('refuses a study mode that is not a string', async () => {
    await request(app)
      .post('/api/courses')
      .set(asTeacher)
      .send({ title: 'Foundations of Data', description: 'A short course.', organizationId: 'org1', studyMode: [{}] })
      .expect(400);

    expect(prisma.course.create).not.toHaveBeenCalled();
  });
});
