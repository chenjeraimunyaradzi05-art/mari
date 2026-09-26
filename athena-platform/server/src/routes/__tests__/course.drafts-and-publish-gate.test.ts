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
 *   the public check reads the title live.
 * - The learner's own wallet named ATHENA as the issuer of a certificate the
 *   public check said a provider had issued.
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
    organizationMember: { findUnique: jest.fn() },
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
    lessonProgress: { findMany: jest.fn(async () => []) },
    courseCertificate: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
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
      where.organizationId_userId.userId === 'teacher' ? { id: 'm1' } : null
    );
    prisma.courseEnrollment.findUnique.mockResolvedValue(null);
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
    it('refuses to rename a course that has issued certificates', async () => {
      prisma.course.findUnique.mockImplementation(async ({ select }: any) =>
        select?._count
          ? { title: 'Bookkeeping Foundations', providerName: null, _count: { certificates: 4 } }
          : { id: 'c1', organizationId: 'org1', title: 'Bookkeeping Foundations', isActive: true }
      );
      const res = await request(app).patch('/api/courses/c1').set(as('teacher')).send({ title: 'Advanced Financial Management' }).expect(409);
      expect(res.body.message ?? res.body.error).toMatch(/4 certificates/);
      await request(app).patch('/api/courses/c1').set(as('teacher')).send({ providerName: 'Someone else' }).expect(409);
      expect(prisma.course.update).not.toHaveBeenCalled();

      // Re-sending the same title is not a rename, and other fields still save.
      await request(app)
        .patch('/api/courses/c1')
        .set(as('teacher'))
        .send({ title: 'Bookkeeping Foundations', description: 'Updated outline' })
        .expect(200);
    });

    it('renames freely while no certificate exists', async () => {
      prisma.course.findUnique.mockImplementation(async ({ select }: any) =>
        select?._count
          ? { title: 'Old', providerName: null, _count: { certificates: 0 } }
          : { id: 'c1', organizationId: 'org1', title: 'Old', isActive: false }
      );
      await request(app).patch('/api/courses/c1').set(as('teacher')).send({ title: 'New' }).expect(200);
      expect(prisma.course.update.mock.calls[0][0].data.title).toBe('New');
    });

    it('names the provider organisation in the learner’s own wallet, as the public check does', async () => {
      prisma.courseCertificate.findMany.mockResolvedValue([
        {
          id: 'cert1',
          code: 'ABCDE12345',
          issuedAt: new Date('2026-09-01'),
          course: { id: 'c1', title: 'Founding', slug: 'founding', providerName: null, type: 'short_course', durationMonths: 1, organization: { name: 'Northside TAFE' } },
        },
        {
          id: 'cert2',
          code: 'FFFFF00000',
          issuedAt: new Date('2026-08-01'),
          course: { id: 'c2', title: 'Staff course', slug: 'staff', providerName: null, type: null, durationMonths: null, organization: null },
        },
      ]);
      const res = await request(app).get('/api/courses/me/certificates').set(as('learner')).expect(200);
      expect(res.body.data.map((c: any) => c.provider)).toEqual(['Northside TAFE', 'ATHENA']);
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
