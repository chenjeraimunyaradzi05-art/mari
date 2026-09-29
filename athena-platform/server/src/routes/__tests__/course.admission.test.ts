import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * A provider who put a course with a fee on ATHENA was giving it away:
 * enrolling opened every lesson and finishing them issued a certificate in the
 * provider's name, while the page said the fee "is arranged with the
 * provider". These tests hold the rule that replaced it. On a course with a
 * provider and a fee the previews stay open to everyone and the rest waits
 * for the provider to confirm her place; asking for one is a choice she makes
 * on a button that says her name and email go to the provider; a free course
 * opens on enrolment as it always did; and nobody who had the lessons before
 * the rule came in loses them.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    course: { findUnique: jest.fn(), findFirst: jest.fn() },
    courseEnrollment: {
      findUnique: jest.fn(async () => null),
      upsert: jest.fn(async () => ({})),
      update: jest.fn(async () => ({})),
    },
    educationApplication: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organizationMember: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    courseLesson: { findMany: jest.fn(async () => []), findUnique: jest.fn() },
    lessonProgress: { findMany: jest.fn(async () => []), upsert: jest.fn(async () => ({})) },
    courseCertificate: { findUnique: jest.fn(async () => null), create: jest.fn() },
    auditLog: { create: jest.fn(async () => ({})) },
  },
}));

jest.mock('../../services/notification.service', () => {
  const notify = jest.fn(async () => undefined);
  return { notificationService: { notify }, NotificationService: jest.fn().mockImplementation(() => ({ notify })) };
});

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
import { notificationService as notificationTyped } from '../../services/notification.service';
import { ADMISSION_REQUIRED_FROM, accessFrom } from '../course.routes';

const prisma: any = prismaTyped;
const notificationService: any = notificationTyped;
const as = (userId: string, role?: string) => ({ 'x-test-user': userId, ...(role ? { 'x-test-role': role } : {}) });

const afterRule = new Date(ADMISSION_REQUIRED_FROM.getTime() + 24 * 60 * 60 * 1000);
const beforeRule = new Date(ADMISSION_REQUIRED_FROM.getTime() - 24 * 60 * 60 * 1000);

const paidCourse = {
  id: 'c1',
  slug: 'bookkeeping-foundations',
  title: 'Bookkeeping Foundations',
  description: 'Twelve weeks of the basics.',
  cost: 1200,
  isActive: true,
  providerName: null,
  organizationId: 'org1',
  organization: { id: 'org1', name: 'Northside TAFE' },
  modules: [
    {
      id: 'm1',
      title: 'Week 1',
      lessons: [
        { id: 'l1', title: 'Welcome', isPreview: true, content: 'Hello', videoUrl: null, resourceUrl: null },
        { id: 'l2', title: 'Ledgers', isPreview: false, content: 'The paid part', videoUrl: null, resourceUrl: null },
      ],
    },
  ],
};

describe('accessFrom', () => {
  const gated = { organizationId: 'org1', cost: 1200 };
  const enrolledNow = { createdAt: afterRule };

  it('opens a free course on enrolment, and a course ATHENA runs itself', () => {
    expect(accessFrom({ course: { organizationId: 'org1', cost: 0 }, enrollment: enrolledNow, applications: [], canEdit: false })).toMatchObject({
      requiresAdmission: false,
      lessonsOpen: true,
      reason: 'OPEN_COURSE',
    });
    expect(accessFrom({ course: { organizationId: null, cost: 500 }, enrollment: enrolledNow, applications: [], canEdit: false }).lessonsOpen).toBe(true);
    expect(accessFrom({ course: { organizationId: 'org1', cost: null }, enrollment: enrolledNow, applications: [], canEdit: false }).lessonsOpen).toBe(true);
  });

  it('keeps a paid provider course closed to an enrolled learner the provider has not admitted', () => {
    expect(accessFrom({ course: gated, enrollment: enrolledNow, applications: [], canEdit: false })).toMatchObject({
      requiresAdmission: true,
      lessonsOpen: false,
      admitted: false,
      reason: 'NOT_REQUESTED',
    });
    const waiting = accessFrom({
      course: gated,
      enrollment: enrolledNow,
      applications: [{ id: 'a1', status: 'SUBMITTED', submittedAt: afterRule }],
      canEdit: false,
    });
    expect(waiting).toMatchObject({ lessonsOpen: false, reason: 'AWAITING_PROVIDER', place: { applicationId: 'a1', status: 'SUBMITTED' } });
    const turnedDown = accessFrom({
      course: gated,
      enrollment: enrolledNow,
      applications: [{ id: 'a1', status: 'REJECTED', submittedAt: afterRule }],
      canEdit: false,
    });
    expect(turnedDown).toMatchObject({ lessonsOpen: false, reason: 'NOT_OFFERED' });
  });

  it('opens it once the provider accepts, even after an earlier refusal', () => {
    const access = accessFrom({
      course: gated,
      enrollment: enrolledNow,
      applications: [
        { id: 'a1', status: 'REJECTED', submittedAt: new Date('2026-10-01') },
        { id: 'a2', status: 'ACCEPTED', submittedAt: new Date('2026-09-28') },
      ],
      canEdit: false,
    });
    expect(access).toMatchObject({ lessonsOpen: true, admitted: true, reason: 'ADMITTED', place: { applicationId: 'a2' } });
  });

  it('leaves the lessons with a learner who enrolled before the rule came in', () => {
    expect(accessFrom({ course: gated, enrollment: { createdAt: beforeRule }, applications: [], canEdit: false })).toMatchObject({
      lessonsOpen: true,
      reason: 'ENROLLED_BEFORE_RULE',
    });
  });

  it('always opens it to the provider’s own team', () => {
    expect(accessFrom({ course: gated, enrollment: null, applications: [], canEdit: true })).toMatchObject({ lessonsOpen: true, reason: 'EDITOR' });
  });
});

describe('A course with a provider and a fee', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.course.findFirst.mockResolvedValue(paidCourse);
    prisma.course.findUnique.mockResolvedValue(paidCourse);
    prisma.courseEnrollment.findUnique.mockResolvedValue(null);
    prisma.courseEnrollment.upsert.mockResolvedValue({ id: 'e1', userId: 'learner', courseId: 'c1', progress: 0, createdAt: afterRule, updatedAt: afterRule });
    prisma.educationApplication.findMany.mockResolvedValue([]);
    prisma.educationApplication.findFirst.mockResolvedValue(null);
    prisma.educationApplication.create.mockResolvedValue({ id: 'a1', status: 'SUBMITTED', submittedAt: afterRule });
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    prisma.organizationMember.findMany.mockResolvedValue([{ userId: 'admissions-1' }]);
  });

  it('shows an enrolled learner the previews and keeps the rest closed until her place is confirmed', async () => {
    prisma.courseEnrollment.findUnique.mockResolvedValue({ id: 'e1', progress: 0, createdAt: afterRule });

    const res = await request(app).get('/api/courses/bookkeeping-foundations').set(as('learner')).expect(200);

    const [welcome, ledgers] = res.body.data.modules[0].lessons;
    expect(welcome).toMatchObject({ content: 'Hello', locked: false });
    expect(ledgers).toMatchObject({ content: null, locked: true });
    expect(res.body.data.access).toMatchObject({ requiresAdmission: true, lessonsOpen: false, reason: 'NOT_REQUESTED' });
  });

  it('opens the lessons on the course page once the provider has accepted her', async () => {
    prisma.courseEnrollment.findUnique.mockResolvedValue({ id: 'e1', progress: 0, createdAt: afterRule });
    prisma.educationApplication.findMany.mockResolvedValue([{ id: 'a1', status: 'ACCEPTED', submittedAt: afterRule, courseId: 'c1' }]);

    const res = await request(app).get('/api/courses/bookkeeping-foundations').set(as('learner')).expect(200);

    expect(res.body.data.modules[0].lessons[1]).toMatchObject({ content: 'The paid part', locked: false });
    expect(res.body.data.access.reason).toBe('ADMITTED');
  });

  it('asks the provider for a place only when she chose to, and tells the people who decide', async () => {
    const quiet = await request(app).post('/api/courses/c1/enroll').set(as('learner')).send({}).expect(201);
    expect(prisma.educationApplication.create).not.toHaveBeenCalled();
    expect(quiet.body.data.access).toMatchObject({ lessonsOpen: false, reason: 'NOT_REQUESTED' });

    prisma.educationApplication.findMany.mockResolvedValue([{ id: 'a1', status: 'SUBMITTED', submittedAt: afterRule, courseId: 'c1' }]);
    const asked = await request(app).post('/api/courses/c1/enroll').set(as('learner')).send({ requestPlace: true }).expect(201);

    expect(prisma.educationApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'learner', organizationId: 'org1', courseId: 'c1' }) })
    );
    expect(asked.body.data.access.reason).toBe('AWAITING_PROVIDER');
    const notice = notificationService.notify.mock.calls[0][0];
    expect(notice.userId).toBe('admissions-1');
    expect(notice.message).toContain('Accepting it opens the course');
    expect(notice.link).toBe('/employer/organizations/org1/education/applications');
  });

  it('does not file a second request while one is open', async () => {
    prisma.educationApplication.findFirst.mockResolvedValue({ id: 'a1', status: 'IN_REVIEW', submittedAt: afterRule });

    await request(app).post('/api/courses/c1/enroll').set(as('learner')).send({ requestPlace: true }).expect(201);

    expect(prisma.educationApplication.create).not.toHaveBeenCalled();
    expect(notificationService.notify).not.toHaveBeenCalled();
  });

  it('never files a request on a free course, whatever the body says', async () => {
    prisma.course.findUnique.mockResolvedValue({ ...paidCourse, cost: 0 });

    const res = await request(app).post('/api/courses/c1/enroll').set(as('learner')).send({ requestPlace: true }).expect(201);

    expect(prisma.educationApplication.create).not.toHaveBeenCalled();
    expect(res.body.data.access).toMatchObject({ requiresAdmission: false, lessonsOpen: true });
  });

  it('keeps the classroom shut, with the reason, until the provider confirms her place', async () => {
    prisma.courseEnrollment.findUnique.mockResolvedValue({ id: 'e1', progress: 0, createdAt: afterRule });
    prisma.educationApplication.findMany.mockResolvedValue([{ id: 'a1', status: 'IN_REVIEW', submittedAt: afterRule, courseId: 'c1' }]);

    const shut = await request(app).get('/api/courses/c1/classroom').set(as('learner')).expect(403);
    expect(shut.body.message || shut.body.error).toContain('Northside TAFE has not confirmed your place yet');

    prisma.educationApplication.findMany.mockResolvedValue([{ id: 'a1', status: 'ACCEPTED', submittedAt: afterRule, courseId: 'c1' }]);
    const open = await request(app).get('/api/courses/c1/classroom').set(as('learner')).expect(200);
    expect(open.body.data.access.reason).toBe('ADMITTED');
  });

  it('will not tick off, or certify, a lesson for a learner the provider has not admitted', async () => {
    prisma.courseEnrollment.findUnique.mockResolvedValue({ id: 'e1', createdAt: afterRule });
    prisma.courseLesson.findUnique.mockResolvedValue({ id: 'l2', module: { courseId: 'c1' } });

    await request(app).post('/api/courses/c1/lessons/l2/complete').set(as('learner')).expect(403);

    expect(prisma.lessonProgress.upsert).not.toHaveBeenCalled();
    expect(prisma.courseCertificate.create).not.toHaveBeenCalled();
  });

  it('tells the provider’s builder that its lessons wait for her team to confirm a place', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm1', acceptedAt: new Date('2026-01-01') });

    const paid = await request(app).get('/api/courses/c1/builder').set(as('teacher')).expect(200);
    expect(paid.body.data.lessonsWaitForProvider).toBe(true);

    prisma.course.findUnique.mockResolvedValue({ ...paidCourse, cost: null });
    const free = await request(app).get('/api/courses/c1/builder').set(as('teacher')).expect(200);
    expect(free.body.data.lessonsWaitForProvider).toBe(false);
  });

  it('lets a learner who enrolled before the rule carry on', async () => {
    prisma.courseEnrollment.findUnique.mockResolvedValue({ id: 'e1', createdAt: beforeRule });
    prisma.courseLesson.findUnique.mockResolvedValue({ id: 'l2', module: { courseId: 'c1' } });
    prisma.courseLesson.findMany.mockResolvedValue([{ id: 'l1' }, { id: 'l2' }]);
    prisma.lessonProgress.findMany.mockResolvedValue([{ lessonId: 'l2' }]);

    const res = await request(app).post('/api/courses/c1/lessons/l2/complete').set(as('learner')).expect(200);

    expect(res.body.data).toMatchObject({ completed: 1, total: 2 });
  });
});

describe('The provider’s decision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organizationMember.findUnique.mockResolvedValue({ role: 'OWNER', canPostJobs: true, acceptedAt: new Date('2026-01-01') });
    prisma.educationApplication.findUnique.mockImplementation(async ({ select }: any) =>
      select?.organization
        ? { programName: null, organization: { name: 'Northside TAFE' }, course: { title: 'Bookkeeping Foundations' } }
        : { id: 'a1', organizationId: 'org1', status: 'SUBMITTED' }
    );
    prisma.educationApplication.update.mockResolvedValue({ id: 'a1', userId: 'learner', courseId: 'c1', status: 'ACCEPTED' });
    prisma.course.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'org1', cost: 1200 });
  });

  it('accepting a place on a paid course enrols her and tells her the lessons are open', async () => {
    await request(app)
      .patch('/api/education/providers/org1/applications/a1')
      .set(as('admissions-1'))
      .send({ status: 'ACCEPTED' })
      .expect(200);

    expect(prisma.courseEnrollment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_courseId: { userId: 'learner', courseId: 'c1' } } })
    );
    const notice = notificationService.notify.mock.calls[0][0];
    expect(notice).toMatchObject({ userId: 'learner', title: 'Your place is confirmed', link: '/dashboard/learn/c1' });
    expect(notice.message).toContain('The lessons are open');
  });

  it('accepting on a free course is the ordinary acceptance', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'c1', organizationId: 'org1', cost: 0 });

    await request(app)
      .patch('/api/education/providers/org1/applications/a1')
      .set(as('admissions-1'))
      .send({ status: 'ACCEPTED' })
      .expect(200);

    expect(prisma.courseEnrollment.upsert).not.toHaveBeenCalled();
    expect(notificationService.notify.mock.calls[0][0].title).toBe('Your application was accepted');
  });

  it('marks, in the provider’s list, which acceptances open a course', async () => {
    prisma.educationApplication.findMany.mockResolvedValue([
      { id: 'a1', course: { id: 'c1', organizationId: 'org1', cost: 1200 } },
      { id: 'a2', course: { id: 'c2', organizationId: 'org1', cost: 0 } },
      { id: 'a3', course: null },
    ]);

    const res = await request(app).get('/api/education/providers/org1/applications').set(as('admissions-1')).expect(200);

    expect(res.body.data.map((a: any) => a.acceptingOpensLessons)).toEqual([true, false, false]);
  });
});
