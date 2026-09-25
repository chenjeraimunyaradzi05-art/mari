import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    organizationMember: {
      findUnique: jest.fn(),
      delete: jest.fn(async () => ({})),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'manager-1', role: 'USER', email: 'manager-1@example.com' };
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
 * The middleware asks for the caller's membership by (organizationId, userId);
 * the handler asks for the target row by id. One mock answers both, told apart
 * by the shape of the where clause.
 */
const arrange = (target: { id: string; organizationId: string; role: string } | null) => {
  prisma.organizationMember.findUnique.mockImplementation(async ({ where }: any) => {
    if (where.organizationId_userId) {
      return {
        id: 'mem-caller',
        organizationId: where.organizationId_userId.organizationId,
        userId: where.organizationId_userId.userId,
        role: 'ADMIN',
        canManageTeam: true,
        acceptedAt: new Date('2026-01-05T00:00:00.000Z'),
      };
    }
    return target && where.id === target.id ? target : null;
  });
};

describe('Removing a team member stays inside the organisation named in the URL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('a membership row belonging to another organisation is reported as missing', async () => {
    arrange({ id: 'mem-foreign', organizationId: 'org-B', role: 'RECRUITER' });

    const res = await request(app).delete('/api/employer/organizations/org-A/team/mem-foreign');

    expect(res.status).toBe(404);
    expect(prisma.organizationMember.delete).not.toHaveBeenCalled();
  });

  it('a member of the named organisation can be removed', async () => {
    arrange({ id: 'mem-2', organizationId: 'org-A', role: 'RECRUITER' });

    const res = await request(app).delete('/api/employer/organizations/org-A/team/mem-2');

    expect(res.status).toBe(200);
    expect(prisma.organizationMember.delete).toHaveBeenCalledWith({ where: { id: 'mem-2' } });
  });

  it('the owner cannot be removed even from inside the organisation', async () => {
    arrange({ id: 'mem-owner', organizationId: 'org-A', role: 'OWNER' });

    const res = await request(app).delete('/api/employer/organizations/org-A/team/mem-owner');

    expect(res.status).toBe(400);
    expect(prisma.organizationMember.delete).not.toHaveBeenCalled();
  });
});
