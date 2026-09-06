import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    course: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(async () => ({})), findMany: jest.fn(async () => []) },
    organizationMember: { findUnique: jest.fn() },
    courseModule: { count: jest.fn(async () => 0), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    courseLesson: { count: jest.fn(async () => 0), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn(async () => []) },
    courseEnrollment: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    lessonProgress: { upsert: jest.fn(async () => ({})), findMany: jest.fn(async () => []) },
    courseCertificate: { findUnique: jest.fn(async () => null), create: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => {
  const userFrom = (req: any) => (req.headers['x-test-user'] ? { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' } : null);
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

const course = { id: 'c1', organizationId: 'org1', title: 'Founding a business', slug: 'founding-a-business' };

describe('Course curriculum: builder, classroom, certificates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.course.findUnique.mockResolvedValue(course);
    // Only "teacher" is on the provider's team.
    prisma.organizationMember.findUnique.mockImplementation(async ({ where }: any) =>
      where.organizationId_userId.userId === 'teacher' ? { id: 'm1' } : null
    );
    prisma.courseCertificate.findUnique.mockResolvedValue(null);
  });

  it('only the provider’s team builds the course; modules and lessons take the next position', async () => {
    await request(app).post('/api/courses/c1/modules').set(as('stranger')).send({ title: 'Week 1' }).expect(403);

    prisma.courseModule.count.mockResolvedValue(2);
    prisma.courseModule.create.mockImplementation(async ({ data }: any) => ({ id: 'm-new', ...data }));
    const created = await request(app).post('/api/courses/c1/modules').set(as('teacher')).send({ title: 'Week 3' }).expect(201);
    expect(created.body.data).toMatchObject({ courseId: 'c1', title: 'Week 3', position: 2 });

    prisma.courseModule.findUnique.mockResolvedValue({ id: 'm-new', courseId: 'c1' });
    prisma.courseLesson.count.mockResolvedValue(1);
    prisma.courseLesson.create.mockImplementation(async ({ data }: any) => ({ id: 'l-new', ...data }));
    const lesson = await request(app)
      .post('/api/courses/c1/modules/m-new/lessons')
      .set(as('teacher'))
      .send({ title: 'Pricing', type: 'VIDEO', videoUrl: 'https://videos.example/pricing', durationMinutes: 12, isPreview: true })
      .expect(201);
    expect(lesson.body.data).toMatchObject({ moduleId: 'm-new', position: 1, type: 'VIDEO', isPreview: true, durationMinutes: 12 });

    // A module from another course cannot be reached through this one.
    prisma.courseModule.findUnique.mockResolvedValue({ id: 'm-other', courseId: 'c9' });
    await request(app).post('/api/courses/c1/modules/m-other/lessons').set(as('teacher')).send({ title: 'Sneaky' }).expect(404);
  });

  it('someone not enrolled sees the outline and the preview lessons, not the rest', async () => {
    prisma.course.findFirst.mockResolvedValue({
      ...course,
      organization: null,
      modules: [
        {
          id: 'm1',
          title: 'Week 1',
          lessons: [
            { id: 'l1', title: 'Welcome', isPreview: true, content: 'Hello', videoUrl: null, resourceUrl: null },
            { id: 'l2', title: 'Pricing', isPreview: false, content: 'Secret', videoUrl: 'https://v', resourceUrl: null },
          ],
        },
      ],
    });
    prisma.courseEnrollment.findUnique.mockResolvedValue(null);

    const anon = await request(app).get('/api/courses/founding-a-business').expect(200);
    const [welcome, pricing] = anon.body.data.modules[0].lessons;
    expect(welcome).toMatchObject({ content: 'Hello', locked: false });
    expect(pricing).toMatchObject({ content: null, videoUrl: null, locked: true });
    expect(anon.body.data.enrollment).toBeNull();

    prisma.courseEnrollment.findUnique.mockResolvedValue({ id: 'e1', progress: 50 });
    const learner = await request(app).get('/api/courses/founding-a-business').set(as('learner')).expect(200);
    expect(learner.body.data.modules[0].lessons[1]).toMatchObject({ content: 'Secret', locked: false });
    expect(learner.body.data.enrollment).toEqual({ id: 'e1', progress: 50 });
  });

  it('finishing a lesson updates progress, and the last lesson earns a certificate', async () => {
    prisma.courseEnrollment.findUnique.mockResolvedValue({ id: 'e1' });
    prisma.courseLesson.findUnique.mockResolvedValue({ id: 'l2', module: { courseId: 'c1' } });
    prisma.courseLesson.findMany.mockResolvedValue([{ id: 'l1' }, { id: 'l2' }]);

    prisma.lessonProgress.findMany.mockResolvedValue([{ lessonId: 'l1' }]);
    const half = await request(app).post('/api/courses/c1/lessons/l2/complete').set(as('learner')).expect(200);
    expect(half.body.data).toMatchObject({ total: 2, completed: 1, percent: 50, certificate: null });
    expect(prisma.courseEnrollment.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { progress: 50 } });
    expect(prisma.courseCertificate.create).not.toHaveBeenCalled();

    prisma.lessonProgress.findMany.mockResolvedValue([{ lessonId: 'l1' }, { lessonId: 'l2' }]);
    prisma.courseCertificate.create.mockImplementation(async ({ data }: any) => ({ code: data.code, issuedAt: new Date() }));
    const done = await request(app).post('/api/courses/c1/lessons/l2/complete').set(as('learner')).expect(200);
    expect(done.body.data.percent).toBe(100);
    expect(done.body.data.certificate.code).toMatch(/^[0-9A-F]{10}$/);
    expect(prisma.courseCertificate.create.mock.calls[0][0].data).toMatchObject({ courseId: 'c1', userId: 'learner' });

    // Not enrolled: nothing to tick.
    prisma.courseEnrollment.findUnique.mockResolvedValue(null);
    await request(app).post('/api/courses/c1/lessons/l2/complete').set(as('stranger')).expect(403);
  });

  it('a certificate code can be checked by anyone', async () => {
    prisma.courseCertificate.findUnique.mockResolvedValue({
      code: 'ABC123DEF4',
      issuedAt: new Date('2026-09-01T00:00:00Z'),
      course: { id: 'c1', title: 'Founding a business', slug: 'founding-a-business', providerName: null, organization: { name: 'TAFE Queensland' } },
      user: { firstName: 'Ana', lastName: 'Ruiz', displayName: null },
    });
    const res = await request(app).get('/api/courses/certificates/abc123def4').expect(200);
    expect(prisma.courseCertificate.findUnique.mock.calls[0][0].where).toEqual({ code: 'ABC123DEF4' });
    expect(res.body.data).toMatchObject({ code: 'ABC123DEF4', learner: 'Ana Ruiz', course: { provider: 'TAFE Queensland' } });

    prisma.courseCertificate.findUnique.mockResolvedValue(null);
    await request(app).get('/api/courses/certificates/nope').expect(404);
  });
});
