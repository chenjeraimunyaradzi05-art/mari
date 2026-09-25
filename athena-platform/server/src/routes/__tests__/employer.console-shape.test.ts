import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    organizationMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    jobApplication: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    job: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'owner-1', role: 'USER', email: 'owner-1@example.com' };
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

const prisma: any = prismaTyped;

/**
 * Every one of these tests failed to exist when the employer console shipped,
 * which is why four separate pages spent months rendering an empty state over a
 * full response. They assert the response shape the console reads, not just
 * that the handler answers 200.
 */
const asMember = (overrides: Record<string, unknown> = {}) => {
  prisma.organizationMember.findUnique.mockImplementation(async () => ({
    id: 'mem-owner',
    organizationId: 'org-A',
    userId: 'owner-1',
    role: 'OWNER',
    canPostJobs: false,
    canManageTeam: false,
    canViewAnalytics: true,
    // A membership row with no acceptedAt is a pending invitation, and
    // requireOrgAccess refuses those; the console's own members have
    // accepted.
    acceptedAt: new Date('2026-01-05T00:00:00.000Z'),
    ...overrides,
  }));
};

describe('GET /employer/organizations/:orgId/team', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asMember();
    prisma.organizationMember.findMany.mockResolvedValue([
      {
        id: 'mem-owner',
        role: 'OWNER',
        canPostJobs: true,
        canManageTeam: true,
        canViewAnalytics: true,
        invitedAt: new Date('2026-01-05T00:00:00.000Z'),
        acceptedAt: new Date('2026-01-05T00:00:00.000Z'),
        user: {
          id: 'owner-1',
          firstName: 'Ada',
          lastName: 'Nguyen',
          email: 'ada@example.com',
          avatar: null,
        },
      },
    ]);
  });

  it('returns the members under a named key, not as a bare array', async () => {
    const res = await request(app).get('/api/employer/organizations/org-A/team');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.members)).toBe(true);
    expect(res.body.data.members).toHaveLength(1);
  });

  it('groups each member permissions and dates the row from invitedAt', async () => {
    const res = await request(app).get('/api/employer/organizations/org-A/team');

    expect(res.body.data.members[0].permissions).toEqual({
      canPostJobs: true,
      canManageTeam: true,
      canViewAnalytics: true,
    });
    expect(res.body.data.members[0].createdAt).toBe('2026-01-05T00:00:00.000Z');
  });

  it('tells an owner she may manage the team even when her flag was never set', async () => {
    const res = await request(app).get('/api/employer/organizations/org-A/team');

    expect(res.body.data.currentUserPermissions.canManageTeam).toBe(true);
    expect(res.body.data.currentUserPermissions.canPostJobs).toBe(true);
  });

  it('does not offer team management to a recruiter without the flag', async () => {
    asMember({ role: 'RECRUITER', canManageTeam: false, canPostJobs: true });

    const res = await request(app).get('/api/employer/organizations/org-A/team');

    expect(res.body.data.currentUserPermissions.canManageTeam).toBe(false);
  });
});

describe('GET /employer/organizations/:orgId/analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asMember();
    prisma.jobApplication.count.mockResolvedValue(0);
    prisma.jobApplication.groupBy.mockResolvedValue([]);
    prisma.jobApplication.findMany.mockResolvedValue([]);
    prisma.job.aggregate.mockResolvedValue({ _sum: { viewCount: 0 } });
    prisma.job.findMany.mockResolvedValue([]);
  });

  it('sends the trends the console reads, with an undated view total', async () => {
    prisma.job.aggregate.mockResolvedValue({ _sum: { viewCount: 420 } });

    const res = await request(app).get('/api/employer/organizations/org-A/analytics');

    expect(res.status).toBe(200);
    expect(res.body.data.trends.views).toEqual({ current: 420, previous: null, change: null });
  });

  it('reports no percentage change when the previous window held nothing', async () => {
    prisma.jobApplication.count.mockImplementation(async ({ where }: any) => {
      if (where.status === 'ACCEPTED') return 0;
      return where.appliedAt?.lt ? 0 : 7;
    });

    const res = await request(app).get('/api/employer/organizations/org-A/analytics');

    expect(res.body.data.trends.applications).toEqual({ current: 7, previous: 0, change: null });
  });

  it('sends conversionRate as a number so the console can format it', async () => {
    prisma.job.findMany.mockResolvedValue([
      { id: 'job-1', title: 'Field Technician', viewCount: 200, applicationCount: 25 },
    ]);

    const res = await request(app).get('/api/employer/organizations/org-A/analytics');

    expect(res.body.data.topJobs[0].conversionRate).toBe(12.5);
  });

  it('leaves the funnel empty rather than drawing stages over no applications', async () => {
    const res = await request(app).get('/api/employer/organizations/org-A/analytics');

    expect(res.body.data.applicationFunnel).toEqual([]);
    expect(res.body.data.timeToHire).toBeNull();
  });

  it('orders the funnel by pipeline stage and shares out the percentages', async () => {
    prisma.jobApplication.groupBy.mockResolvedValue([
      { status: 'ACCEPTED', _count: 1 },
      { status: 'PENDING', _count: 3 },
    ]);

    const res = await request(app).get('/api/employer/organizations/org-A/analytics');

    const funnel = res.body.data.applicationFunnel;
    expect(funnel[0]).toEqual({ stage: 'Applied', count: 3, percentage: 75 });
    expect(funnel.find((stage: any) => stage.stage === 'Offer accepted')).toEqual({
      stage: 'Offer accepted',
      count: 1,
      percentage: 25,
    });
  });

  it('refuses a window that is not a number instead of querying on an invalid date', async () => {
    const res = await request(app).get('/api/employer/organizations/org-A/analytics?days=whenever');

    expect(res.status).toBe(400);
    expect(prisma.jobApplication.count).not.toHaveBeenCalled();
  });

  it('refuses analytics to a member without the flag', async () => {
    asMember({ role: 'RECRUITER', canViewAnalytics: false });

    const res = await request(app).get('/api/employer/organizations/org-A/analytics');

    expect(res.status).toBe(403);
  });
});
