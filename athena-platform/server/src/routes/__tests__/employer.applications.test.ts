import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    organizationMember: { findUnique: jest.fn() },
    jobApplication: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
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
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm1', organizationId: ORG, userId: 'recruiter-1', role: 'ADMIN' });
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
});
