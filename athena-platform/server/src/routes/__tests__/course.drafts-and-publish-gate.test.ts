import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Four holes in the course routes, each held shut here.
 *
 * - A draft was served to anyone with its slug: description, fee and the whole
 *   outline, one guessable URL from an anonymous caller.
 * - The "publish needs a lesson" rule lived on the PATCH alone, so deleting
 *   the last lesson (or its module) left an empty course live.
 * - Renaming a course rewrote every certificate already issued for it, because
 *   the public check read the title live. Each certificate now keeps its own
 *   copy, so a rename is allowed and changes nothing a certificate says.
 * - The learner's own wallet named ATHENA as the issuer of a certificate the
 *   public check said a provider had issued.
 * - An invitation nobody had accepted opened the builder and every draft.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    course: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(async ({ data }: any) => ({ id: 'c1', ...data })),
      count: jest.fn(async () => 0),
      groupBy: jest.fn(async () => []),
    },
    organizationMember: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    courseModule: { findUnique: jest.fn(), delete: jest.fn(async () => ({})) },
    courseLesson: {
      count: jest.fn(async () => 0),
      findUnique: jest.fn(),
      create: jest.fn(async ({ data }: any) => ({ id: 'l-new', ...data })),
      update: jest.fn(async ({ data }: any) => ({ id: 'l1', ...data })),
      delete: jest.fn(async () => ({})),
      findMany: jest.fn(async () => []),
    },
    courseEnrollment: { findUnique: jest.fn(async () => null) },
    // Read when a learner opens a course with a provider and a fee: the lessons
    // wait for the provider to confirm her place (see course.admission.test.ts).
    educationApplication: { findMany: jest.fn(async () => []) },
    lessonProgress: { findMany: jest.fn(async () => []) },
    courseCertificate: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    auditLog: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../middleware/auth', () => {
  const userFrom = (req: any) =>
    req.headers['x-test-user'] ? { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' } : null;
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
const as = (userId: string, role?: string) => ({ 'x-test-user': userId, ...(role ? { 'x-test-role': role } : {}) });

const draft = {
  id: 'c1',
  slug: 'founding-a-business',
  title: 'Founding a business',
  description: 'Unannounced',
  cost: 900,
  isActive: false,
  organizationId: 'org1',
  organization: { id: 'org1', name: 'Northside TAFE' },
  modules: [{ id: 'm1', title: 'Week 1', lessons: [{ id: 'l1', title: 'Pricing', isPreview: false, content: 'x', videoUrl: null, resourceUrl: null }] }],
};

describe('Courses: drafts, the publish gate, certificates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organizationMember.findUnique.mockImplementation(async ({ where }: any) =>
      where.organizationId_userId.userId === 'teacher' ? { id: 'm1', acceptedAt: new Date('2026-01-01') } : null
    );
    prisma.courseEnrollment.findUnique.mockResolvedValue(null);
    // The rename runs in a transaction; the mock hands the callback the same
    // client, so the calls it makes are the ones the test reads.
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
  });

  describe('a pending invitation is not a membership', () => {
    it('treats someone who has not accepted as a stranger to the draft and the builder', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm2', acceptedAt: null });
      prisma.course.findFirst.mockResolvedValue(draft);
      prisma.course.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'org1', title: 'Founding a business', isActive: false });
      await request(app).get('/api/courses/founding-a-business').set(as('invitee')).expect(404);
      await request(app).get('/api/courses/c1/builder').set(as('invitee')).expect(403);
      await request(app).patch('/api/courses/c1').set(as('invitee')).send({ description: 'Mine now' }).expect(403);
      expect(prisma.course.update).not.toHaveBeenCalled();
    });
  });

  describe('a draft is not public', () => {
    it('answers 404 to an anonymous caller and to a stranger who has the slug', async () => {
      prisma.course.findFirst.mockResolvedValue(draft);
      await request(app).get('/api/courses/founding-a-business').expect(404);
      await request(app).get('/api/courses/founding-a-business').set(as('stranger')).expect(404);
    });

    it('is shown to the provider’s team and to staff', async () => {
      prisma.course.findFirst.mockResolvedValue(draft);
      const team = await request(app).get('/api/courses/founding-a-business').set(as('teacher')).expect(200);
      expect(team.body.data.canEdit).toBe(true);
      await request(app).get('/api/courses/founding-a-business').set(as('staff', 'ADMIN')).expect(200);
    });

    it('stays open to a learner who enrolled while it was live', async () => {
      prisma.course.findFirst.mockResolvedValue(draft);
      prisma.courseEnrollment.findUnique.mockResolvedValue({ id: 'e1', progress: 40 });
      const res = await request(app).get('/api/courses/founding-a-business').set(as('learner')).expect(200);
      expect(res.body.data.enrollment).toEqual({ id: 'e1', progress: 40 });
    });

    it('a published course is still public', async () => {
      prisma.course.findFirst.mockResolvedValue({ ...draft, isActive: true });
      await request(app).get('/api/courses/founding-a-business').expect(200);
    });
  });

  describe('a published course keeps a lesson', () => {
    it('refuses to delete the last lesson of a live course, and allows it on a draft', async () => {
      prisma.courseLesson.findUnique.mockResolvedValue({ id: 'l1', module: { courseId: 'c1' } });
      prisma.courseLesson.count.mockResolvedValue(1);

      prisma.course.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'org1', title: 'Founding a business', isActive: true });
      await request(app).delete('/api/courses/c1/lessons/l1').set(as('teacher')).expect(409);
      expect(prisma.courseLesson.delete).not.toHaveBeenCalled();

      prisma.course.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'org1', title: 'Founding a business', isActive: false });
      await request(app).delete('/api/courses/c1/lessons/l1').set(as('teacher')).expect(200);
      expect(prisma.courseLesson.delete).toHaveBeenCalled();
    });

    it('refuses to delete a module that holds every lesson of a live course', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'org1', title: 'Founding a business', isActive: true });
      prisma.courseModule.findUnique.mockResolvedValue({ id: 'm1', courseId: 'c1' });
      // Three lessons in the course, all three in this module.
      prisma.courseLesson.count.mockImplementation(async ({ where }: any) => (where.moduleId ? 3 : 3));
      await request(app).delete('/api/courses/c1/modules/m1').set(as('teacher')).expect(409);
      expect(prisma.courseModule.delete).not.toHaveBeenCalled();

      // Another module still has lessons: fine.
      prisma.courseLesson.count.mockImplementation(async ({ where }: any) => (where.moduleId ? 1 : 3));
      await request(app).delete('/api/courses/c1/modules/m1').set(as('teacher')).expect(200);
      expect(prisma.courseModule.delete).toHaveBeenCalled();
    });

    it('turns a lesson length that is not a whole number of minutes into a 400, not a 500', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'org1', title: 'x', isActive: false });
      prisma.courseModule.findUnique.mockResolvedValue({ id: 'm1', courseId: 'c1' });
      for (const durationMinutes of ['twelve', 12.5, -3, 100000, { minutes: 3 }]) {
        await request(app)
          .post('/api/courses/c1/modules/m1/lessons')
          .set(as('teacher'))
          .send({ title: 'Pricing', durationMinutes })
          .expect(400);
      }
      expect(prisma.courseLesson.create).not.toHaveBeenCalled();

      const ok = await request(app)
        .post('/api/courses/c1/modules/m1/lessons')
        .set(as('teacher'))
        .send({ title: 'Pricing', durationMinutes: '15' })
        .expect(201);
      expect(ok.body.data.durationMinutes).toBe(15);
    });
  });

  describe('an issued certificate keeps the name it was earned under', () => {
    it('lets a course with issued certificates be renamed, after giving any certificate without its own copy the old name', async () => {
      prisma.course.findUnique.mockImplementation(async ({ select }: any) =>
        select?.organization
          ? { title: 'Bookkeeping Foundations', providerName: null, organization: { name: 'Northside TAFE' } }
          : { id: 'c1', organizationId: 'org1', title: 'Bookkeeping Foundations', isActive: true }
      );

      await request(app).patch('/api/courses/c1').set(as('teacher')).send({ title: 'Advanced Financial Management' }).expect(200);

      // Only rows with nothing of their own are touched, and they get the name
      // they were earned under — before the rename, in the same transaction.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.courseCertificate.updateMany).toHaveBeenCalledWith({
        where: { courseId: 'c1', courseTitle: null },
        data: { courseTitle: 'Bookkeeping Foundations' },
      });
      expect(prisma.courseCertificate.updateMany).toHaveBeenCalledWith({
        where: { courseId: 'c1', issuerName: null },
        data: { issuerName: 'Northside TAFE' },
      });
      const renameOrder = prisma.course.update.mock.invocationCallOrder[0];
      for (const order of prisma.courseCertificate.updateMany.mock.invocationCallOrder) {
        expect(order).toBeLessThan(renameOrder);
      }
      expect(prisma.course.update.mock.calls[0][0].data.title).toBe('Advanced Financial Management');
    });

    it('leaves the certificates alone when nothing that names the course changes', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'org1', title: 'Old', isActive: false });
      await request(app).patch('/api/courses/c1').set(as('teacher')).send({ description: 'Updated outline' }).expect(200);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.courseCertificate.updateMany).not.toHaveBeenCalled();
    });

    it('shows the learner what her certificate says, not what the course is called today', async () => {
      prisma.courseCertificate.findMany.mockResolvedValue([
        {
          id: 'cert1',
          code: 'ABCDE12345',
          issuedAt: new Date('2026-09-01'),
          courseTitle: 'Bookkeeping Foundations',
          issuerName: 'Northside TAFE',
          course: {
            id: 'c1',
            title: 'Advanced Financial Management',
            slug: 'founding',
            providerName: 'Somebody Else',
            type: 'short_course',
            durationMonths: 1,
            isActive: false,
            organization: { name: 'Renamed Org' },
          },
        },
        {
          id: 'cert2',
          code: 'FFFFF00000',
          issuedAt: new Date('2026-08-01'),
          courseTitle: null,
          issuerName: null,
          course: { id: 'c2', title: 'Founding', slug: 'f', providerName: null, type: null, durationMonths: null, isActive: true, organization: { name: 'Northside TAFE' } },
        },
        {
          id: 'cert3',
          code: 'EEEEE00000',
          issuedAt: new Date('2026-07-01'),
          courseTitle: null,
          issuerName: null,
          course: { id: 'c3', title: 'Staff course', slug: 'staff', providerName: null, type: null, durationMonths: null, isActive: true, organization: null },
        },
      ]);
      const res = await request(app).get('/api/courses/me/certificates').set(as('learner')).expect(200);
      expect(res.body.data[0]).toMatchObject({
        provider: 'Northside TAFE',
        course: { title: 'Bookkeeping Foundations', listed: false, listedAs: 'Advanced Financial Management' },
      });
      // A row with no copy of its own falls back to the course, named the way
      // the public check names it.
      expect(res.body.data.map((c: any) => c.provider)).toEqual(['Northside TAFE', 'Northside TAFE', 'ATHENA']);
      expect(res.body.data[1].course.listedAs).toBeNull();
    });
  });

  describe('taking a course down', () => {
    it('records the staff member who unpublished a provider’s course, and tells the provider’s team', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'org1', title: 'Founding a business', isActive: true });
      prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'teacher' }]);

      await request(app).patch('/api/courses/c1').set(as('staff', 'ADMIN')).send({ isActive: false }).expect(200);

      expect(prisma.course.update.mock.calls[0][0].data).toEqual({ isActive: false });
      const audit = prisma.auditLog.create.mock.calls[0][0].data;
      expect(audit.metadata).toMatchObject({ adminAction: 'COURSE_UNPUBLISHED', resourceId: 'c1' });
      // Only accepted members who can manage listings are told.
      expect(prisma.organizationMember.findMany.mock.calls[0][0].where).toMatchObject({
        organizationId: 'org1',
        acceptedAt: { not: null },
      });
    });
  });

  describe('the learning hub’s totals', () => {
    it('are counted across the whole published catalogue', async () => {
      prisma.course.count.mockImplementation(async ({ where }: any) => {
        if (where.cost === 0) return 7;
        if (where.OR) return 2;
        return 40;
      });
      prisma.course.groupBy.mockImplementation(async ({ by }: any) =>
        by[0] === 'organizationId' ? [{ organizationId: 'a' }, { organizationId: 'b' }, { organizationId: 'c' }] : [{ providerName: 'TAFE QLD' }]
      );
      const res = await request(app).get('/api/courses/stats').expect(200);
      expect(res.body.data).toEqual({ courses: 40, providers: 4, withOutcomes: 2, free: 7 });
      for (const call of prisma.course.count.mock.calls) {
        expect(call[0].where.isActive).toBe(true);
      }
    });
  });
});
