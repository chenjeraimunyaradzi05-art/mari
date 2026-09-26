import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    organizationMember: { findUnique: jest.fn() },
    jobApplication: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
    job: { findMany: jest.fn() },
    notification: { create: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'recruiter-1', role: 'EMPLOYER', email: 'r@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const ORG = 'org-1';

describe('Employer applicant pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm1', organizationId: ORG, userId: 'recruiter-1', role: 'ADMIN', canPostJobs: true, acceptedAt: new Date('2026-01-05T00:00:00.000Z') });
    prisma.jobApplication.groupBy.mockResolvedValue([]);
    prisma.job.findMany.mockResolvedValue([]);
  });

  it('lists applications as a plain array, with the candidate’s face and headline', async () => {
    prisma.jobApplication.findMany.mockResolvedValue([
      {
        id: 'a1',
        status: 'PENDING',
        coverLetter: 'Hello',
        resumeUrl: '/api/media/local/resumes/u1/cv.pdf',
        appliedAt: new Date(),
        user: { id: 'u1', firstName: 'Mei', lastName: 'Chen', email: 'mei@example.com', avatar: null, headline: 'Product lead' },
        job: { id: 'j1', title: 'Head of Product', slug: 'head-of-product' },
      },
    ]);
    prisma.jobApplication.count.mockResolvedValue(1);

    const res = await request(app).get(`/api/employer/organizations/${ORG}/applications`).expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].user).toMatchObject({ firstName: 'Mei', headline: 'Product lead' });
    const select = prisma.jobApplication.findMany.mock.calls[0][0].include.user.select;
    expect(select).toMatchObject({ avatar: true, headline: true });
    expect(res.body.pagination.total).toBe(1);
  });

  it('refuses someone who is not on the organisation', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    await request(app).get(`/api/employer/organizations/${ORG}/applications`).expect(403);
    expect(prisma.jobApplication.findMany).not.toHaveBeenCalled();
  });

  it('moves a candidate between stages and tells them, but cannot accept an offer on their behalf', async () => {
    prisma.jobApplication.findUnique.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      status: 'SHORTLISTED',
      job: { id: 'j1', title: 'Head of Product', organizationId: ORG },
    });
    prisma.jobApplication.update.mockResolvedValue({ id: 'a1', status: 'INTERVIEW' });
    prisma.notification.create.mockResolvedValue({});

    await request(app).patch('/api/employer/applications/a1/status').send({ status: 'INTERVIEW' }).expect(200);
    expect(prisma.jobApplication.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { status: 'INTERVIEW' } });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'u1', link: '/dashboard/applications' });

    // Accepting is the candidate's move, not the employer's.
    const refused = await request(app).patch('/api/employer/applications/a1/status').send({ status: 'ACCEPTED' });
    expect([400, 422]).toContain(refused.status);
  });

  it('sends stage counts and the job list from the whole set, not from the page', async () => {
    prisma.jobApplication.findMany.mockResolvedValue([]);
    prisma.jobApplication.count.mockResolvedValue(240);
    prisma.jobApplication.groupBy.mockImplementation(async ({ by }: any) =>
      by[0] === 'status'
        ? [
            { status: 'PENDING', _count: { _all: 200 } },
            { status: 'INTERVIEW', _count: { _all: 40 } },
          ]
        : [{ jobId: 'j1', _count: { _all: 240 } }]
    );
    prisma.job.findMany.mockResolvedValue([{ id: 'j1', title: 'Head of Product' }]);

    const res = await request(app).get(`/api/employer/organizations/${ORG}/applications?limit=100`).expect(200);

    expect(res.body.pagination).toMatchObject({ total: 240, limit: 100, pages: 3 });
    expect(res.body.summary.byStatus).toEqual({ PENDING: 200, INTERVIEW: 40 });
    expect(res.body.summary.jobs).toEqual([{ id: 'j1', title: 'Head of Product', count: 240 }]);
  });

  it('will not let a pending invitee move a candidate before she has joined', async () => {
    prisma.jobApplication.findUnique.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      status: 'PENDING',
      job: { id: 'j1', title: 'Head of Product', organizationId: ORG, postedById: 'someone-else' },
    });
    // The invite route creates this row with RECRUITER defaults the moment an
    // owner types her address; until she accepts it grants nothing.
    prisma.organizationMember.findUnique.mockResolvedValue({
      id: 'm2', organizationId: ORG, userId: 'recruiter-1', role: 'RECRUITER', canPostJobs: true, acceptedAt: null,
    });

    await request(app).patch('/api/employer/applications/a1/status').send({ status: 'REVIEWED' }).expect(403);
    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('will not let a VIEWER move a candidate', async () => {
    prisma.jobApplication.findUnique.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      status: 'PENDING',
      job: { id: 'j1', title: 'Head of Product', organizationId: ORG, postedById: 'recruiter-1' },
    });
    // She posted the listing once, but she is a VIEWER now: posting it is not
    // a permission that lasts for ever.
    prisma.organizationMember.findUnique.mockResolvedValue({
      id: 'm3', organizationId: ORG, userId: 'recruiter-1', role: 'VIEWER', canPostJobs: false, acceptedAt: new Date(),
    });

    await request(app).patch('/api/employer/applications/a1/status').send({ status: 'REVIEWED' }).expect(403);
    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
  });
});
