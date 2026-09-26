import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * POST /api/education/applications took whatever arrived: an intake date of
 * "tomorrow" became Invalid Date and a 500, notes had no limit, the same course
 * could be applied for five times, and nobody was told anything — not the
 * provider when an application arrived, not the applicant when it was decided.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    organization: { findUnique: jest.fn() },
    course: { findUnique: jest.fn(), findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    educationApplication: {
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(),
      create: jest.fn(async ({ data }: any) => ({ id: 'app-new', ...data })),
      update: jest.fn(),
      groupBy: jest.fn(async () => []),
    },
    courseEnrollment: { aggregate: jest.fn(), count: jest.fn(async () => 0) },
    organizationMember: {
      findUnique: jest.fn(async () => ({ role: 'OWNER', canPostJobs: true, canViewAnalytics: true })),
      findMany: jest.fn(async () => [{ userId: 'provider-staff-1' }, { userId: 'provider-staff-2' }]),
    },
  },
}));

// The class is exported too: other modules construct their own instance at
// import time, and a mock without it fails before any test runs.
jest.mock('../../services/notification.service', () => {
  const notify = jest.fn(async () => undefined);
  return { notificationService: { notify }, NotificationService: jest.fn().mockImplementation(() => ({ notify })) };
});

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'applicant-1', role: 'USER', email: 'member@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { notificationService as notificationTyped } from '../../services/notification.service';

const prisma: any = prismaTyped;
const notificationService: any = notificationTyped;

describe('Education applications: what comes in, and who hears about it', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', type: 'tafe', name: 'Northside TAFE' });
    prisma.course.findUnique.mockResolvedValue({ id: 'course-1', organizationId: 'org-1', isActive: true, title: 'Cert III in Accounts' });
    prisma.educationApplication.findFirst.mockResolvedValue(null);
  });

  it('turns an intake date that is not a date, or an overlong note, into a 400', async () => {
    await request(app).post('/api/education/applications').send({ organizationId: 'org-1', intakeDate: 'tomorrow' }).expect(400);
    await request(app)
      .post('/api/education/applications')
      .send({ organizationId: 'org-1', notes: 'x'.repeat(2001) })
      .expect(400);
    await request(app).post('/api/education/applications').send({}).expect(400);
    expect(prisma.educationApplication.create).not.toHaveBeenCalled();
  });

  it('takes a real application, and tells the people who can decide it', async () => {
    const res = await request(app)
      .post('/api/education/applications')
      .send({ organizationId: 'org-1', courseId: 'course-1', intakeDate: '2027-02-15', notes: '  Part-time please  ' })
      .expect(201);

    const data = prisma.educationApplication.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 'applicant-1', organizationId: 'org-1', courseId: 'course-1', notes: 'Part-time please' });
    expect(data.intakeDate.toISOString().slice(0, 10)).toBe('2027-02-15');
    expect(res.body.data.id).toBe('app-new');

    // Only members with the recruiting flag or an owner/admin role are asked for.
    expect(prisma.organizationMember.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'org-1' });
    expect(notificationService.notify.mock.calls.map((c: any) => c[0].userId)).toEqual(['provider-staff-1', 'provider-staff-2']);
    // The provider's notice does not name the applicant.
    expect(notificationService.notify.mock.calls[0][0].message).not.toMatch(/applicant-1|member@example.com/);
  });

  it('refuses a second open application for the same course, and allows one after a withdrawal', async () => {
    prisma.educationApplication.findFirst.mockResolvedValue({ id: 'app-1', status: 'IN_REVIEW' });
    await request(app).post('/api/education/applications').send({ organizationId: 'org-1', courseId: 'course-1' }).expect(409);
    expect(prisma.educationApplication.create).not.toHaveBeenCalled();

    // The duplicate check only looks at open applications.
    const where = prisma.educationApplication.findFirst.mock.calls[0][0].where;
    expect(where.status.in).toEqual(['SUBMITTED', 'IN_REVIEW', 'ACCEPTED']);

    prisma.educationApplication.findFirst.mockResolvedValue(null);
    await request(app).post('/api/education/applications').send({ organizationId: 'org-1', courseId: 'course-1' }).expect(201);
  });

  it('tells the applicant when the provider decides, in the app, and only when the status really changes', async () => {
    prisma.educationApplication.findUnique.mockImplementation(async ({ select }: any) =>
      select?.organization
        ? { programName: null, organization: { name: 'Northside TAFE' }, course: { title: 'Cert III in Accounts' } }
        : { id: 'app-1', organizationId: 'org-1', status: 'SUBMITTED' }
    );
    prisma.educationApplication.update.mockResolvedValue({ id: 'app-1', userId: 'applicant-1', status: 'ACCEPTED' });

    await request(app)
      .patch('/api/education/providers/org-1/applications/app-1')
      .set('x-test-user', 'provider-staff-1')
      .send({ status: 'ACCEPTED' })
      .expect(200);
    expect(notificationService.notify).toHaveBeenCalledTimes(1);
    expect(notificationService.notify.mock.calls[0][0]).toMatchObject({
      userId: 'applicant-1',
      title: 'Your application was accepted',
      channels: ['in-app'],
    });

    notificationService.notify.mockClear();
    prisma.educationApplication.findUnique.mockImplementation(async () => ({ id: 'app-1', organizationId: 'org-1', status: 'ACCEPTED' }));
    await request(app)
      .patch('/api/education/providers/org-1/applications/app-1')
      .set('x-test-user', 'provider-staff-1')
      .send({ status: 'ACCEPTED' })
      .expect(200);
    expect(notificationService.notify).not.toHaveBeenCalled();
  });

  it('works out the outcomes figures in the database', async () => {
    prisma.educationApplication.groupBy.mockResolvedValue([
      { status: 'SUBMITTED', _count: { _all: 3 } },
      { status: 'ACCEPTED', _count: { _all: 2 } },
    ]);
    prisma.course.count.mockResolvedValue(4);
    prisma.courseEnrollment.aggregate.mockResolvedValue({ _count: { _all: 10 }, _avg: { progress: 42.6 } });
    prisma.courseEnrollment.count.mockResolvedValue(3);

    const res = await request(app).get('/api/education/providers/org-1/outcomes').set('x-test-user', 'provider-staff-1').expect(200);
    expect(res.body.data).toEqual({
      applications: { total: 5, byStatus: { SUBMITTED: 3, ACCEPTED: 2 } },
      enrollments: { total: 10, completed: 3, completionRate: 30, avgProgress: 43 },
      courses: { total: 4 },
    });
  });
});
