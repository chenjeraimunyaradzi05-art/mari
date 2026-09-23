import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * PATCH /api/education/applications/:id guarded ownership and nothing else, so
 * an applicant could write ACCEPTED onto her own row and the provider's
 * dashboard would render it as the institution's decision. There was no
 * provider write at all — the read side had simply been built against one that
 * did not exist.
 *
 * These tests fix both ends in place: what the applicant may do, and who may
 * decide.
 */

const applications: Record<string, { id: string; userId: string; organizationId: string; status: string }> = {};
const memberships: Record<string, { role: string; canPostJobs: boolean; canViewAnalytics: boolean }> = {};

jest.mock('../../utils/prisma', () => ({
  prisma: {
    educationApplication: {
      findUnique: jest.fn(async ({ where }: any) => applications[where.id] ?? null),
      update: jest.fn(async ({ where, data }: any) => ({ ...applications[where.id], ...data })),
    },
    organizationMember: {
      findUnique: jest.fn(async ({ where }: any) => {
        const { organizationId, userId } = where.organizationId_userId;
        return memberships[`${organizationId}:${userId}`] ?? null;
      }),
    },
  },
}));

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

const prisma: any = prismaTyped;

describe('Education applications: who may decide one', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(applications)) delete applications[key];
    for (const key of Object.keys(memberships)) delete memberships[key];
    applications['app-1'] = { id: 'app-1', userId: 'applicant-1', organizationId: 'org-1', status: 'SUBMITTED' };
  });

  it('refuses the applicant who tries to accept herself', async () => {
    await request(app)
      .patch('/api/education/applications/app-1')
      .send({ status: 'ACCEPTED' })
      .expect(403);

    expect(prisma.educationApplication.update).not.toHaveBeenCalled();
  });

  it('lets the applicant withdraw, and keep her own notes', async () => {
    const res = await request(app)
      .patch('/api/education/applications/app-1')
      .send({ status: 'WITHDRAWN', notes: 'Taking the other offer.' })
      .expect(200);

    expect(res.body.data.status).toBe('WITHDRAWN');
    expect(prisma.educationApplication.update.mock.calls[0][0].data).toEqual({
      status: 'WITHDRAWN',
      notes: 'Taking the other offer.',
    });
  });

  it('will not let her withdraw a place she has already been offered', async () => {
    applications['app-1'].status = 'ACCEPTED';

    await request(app)
      .patch('/api/education/applications/app-1')
      .send({ status: 'WITHDRAWN' })
      .expect(400);

    expect(prisma.educationApplication.update).not.toHaveBeenCalled();
  });

  it('refuses a provider decision from someone with no membership', async () => {
    await request(app)
      .patch('/api/education/providers/org-1/applications/app-1')
      .set('x-test-user', 'stranger-1')
      .send({ status: 'ACCEPTED' })
      .expect(403);

    expect(prisma.educationApplication.update).not.toHaveBeenCalled();
  });

  it('refuses a provider decision from a VIEWER who can only read analytics', async () => {
    memberships['org-1:viewer-1'] = { role: 'VIEWER', canPostJobs: false, canViewAnalytics: true };

    await request(app)
      .patch('/api/education/providers/org-1/applications/app-1')
      .set('x-test-user', 'viewer-1')
      .send({ status: 'ACCEPTED' })
      .expect(403);

    expect(prisma.educationApplication.update).not.toHaveBeenCalled();
  });

  it('lets an admissions-capable member move SUBMITTED to ACCEPTED', async () => {
    memberships['org-1:staff-1'] = { role: 'RECRUITER', canPostJobs: true, canViewAnalytics: true };

    const res = await request(app)
      .patch('/api/education/providers/org-1/applications/app-1')
      .set('x-test-user', 'staff-1')
      .send({ status: 'ACCEPTED' })
      .expect(200);

    expect(res.body.data.status).toBe('ACCEPTED');
    expect(prisma.educationApplication.update.mock.calls[0][0].data).toEqual({ status: 'ACCEPTED' });
  });

  it('will not let one provider decide another provider’s application', async () => {
    memberships['org-2:staff-2'] = { role: 'OWNER', canPostJobs: false, canViewAnalytics: true };

    await request(app)
      .patch('/api/education/providers/org-2/applications/app-1')
      .set('x-test-user', 'staff-2')
      .send({ status: 'REJECTED' })
      .expect(404);

    expect(prisma.educationApplication.update).not.toHaveBeenCalled();
  });
});
