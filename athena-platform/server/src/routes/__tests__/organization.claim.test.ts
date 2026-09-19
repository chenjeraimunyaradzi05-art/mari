import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Creating an organisation gives the creator the OWNER membership; claiming
// one nobody is staff of needs an address at its website's domain, or an admin.

const tx = {
  organization: { create: jest.fn(async ({ data }: any) => ({ id: 'org-new', ...data })) },
  organizationMember: { create: jest.fn(async ({ data }: any) => ({ id: 'm-new', ...data })) },
};

jest.mock('../../utils/prisma', () => ({
  prisma: {
    organization: {
      findUnique: jest.fn(),
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
    },
    organizationMember: {
      create: jest.fn(async ({ data }: any) => ({ id: 'm1', ...data })),
      findUnique: jest.fn(async () => null),
    },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  },
}));

jest.mock('../../middleware/auth', () => {
  const userFrom = (req: any) =>
    req.headers['x-test-user']
      ? { id: req.headers['x-test-user'], role: req.headers['x-test-role'] || 'USER', email: req.headers['x-test-email'] || `${req.headers['x-test-user']}@example.com` }
      : null;
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
const as = (userId: string, email?: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role, ...(email ? { 'x-test-email': email } : {}) });
const unowned = (website: string | null) => ({ id: 'org1', name: 'TAFE Queensland', slug: 'tafe-queensland', website, _count: { members: 0 } });

describe('Creating an organisation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('makes the creator its owner in the same transaction', async () => {
    const res = await request(app)
      .post('/api/organizations')
      .set(as('jane'))
      .send({ name: 'Byte Studio', type: 'company', website: 'https://byte.studio' })
      .expect(201);

    expect(res.body.data.id).toBe('org-new');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.organization.create.mock.calls[0][0].data).toMatchObject({ name: 'Byte Studio', type: 'company', country: 'Australia' });
    expect(tx.organizationMember.create.mock.calls[0][0].data).toMatchObject({ organizationId: 'org-new', userId: 'jane', role: 'OWNER', canPostJobs: true, canManageTeam: true });
  });
});

describe('Claiming an organisation nobody is staff of', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('needs an address at the organisation’s website domain', async () => {
    prisma.organization.findUnique.mockResolvedValue(unowned('https://www.tafeqld.edu.au/courses'));

    const refused = await request(app).post('/api/organizations/org1/claim').set(as('jane', 'jane@gmail.com')).expect(403);
    expect(refused.body.message ?? refused.body.error).toContain('tafeqld.edu.au');
    expect(prisma.organizationMember.create).not.toHaveBeenCalled();

    const res = await request(app).post('/api/organizations/org1/claim').set(as('jane', 'jane@tafeqld.edu.au')).expect(201);
    expect(prisma.organizationMember.create.mock.calls[0][0].data).toMatchObject({ organizationId: 'org1', userId: 'jane', role: 'OWNER', canManageTeam: true });
    expect(res.body.data.organization.slug).toBe('tafe-queensland');
  });

  it('accepts a subdomain of the website, and a website given without a scheme', async () => {
    prisma.organization.findUnique.mockResolvedValue(unowned('tafeqld.edu.au'));
    await request(app).post('/api/organizations/org1/claim').set(as('jane', 'jane@staff.tafeqld.edu.au')).expect(201);
    // A look-alike is not a subdomain.
    await request(app).post('/api/organizations/org1/claim').set(as('eve', 'eve@nottafeqld.edu.au')).expect(403);
  });

  it('refuses when the organisation already has staff', async () => {
    prisma.organization.findUnique.mockResolvedValue({ ...unowned('https://tafeqld.edu.au'), _count: { members: 2 } });
    await request(app).post('/api/organizations/org1/claim').set(as('jane', 'jane@tafeqld.edu.au')).expect(409);
    expect(prisma.organizationMember.create).not.toHaveBeenCalled();
  });

  it('refuses a member when there is no website to check her against, but not an admin', async () => {
    prisma.organization.findUnique.mockResolvedValue(unowned(null));
    await request(app).post('/api/organizations/org1/claim').set(as('jane', 'jane@tafeqld.edu.au')).expect(403);
    await request(app).post('/api/organizations/org1/claim').set(as('boss', 'boss@athena.com', 'ADMIN')).expect(201);
    expect(prisma.organizationMember.create.mock.calls[0][0].data).toMatchObject({ userId: 'boss', role: 'OWNER' });
  });

  it('is a 404 for an organisation that does not exist', async () => {
    prisma.organization.findUnique.mockResolvedValue(null);
    await request(app).post('/api/organizations/nope/claim').set(as('jane')).expect(404);
  });
});
