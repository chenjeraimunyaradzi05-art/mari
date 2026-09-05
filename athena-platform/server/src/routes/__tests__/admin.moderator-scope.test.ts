import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    contentReport: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    user: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0), findUnique: jest.fn(), update: jest.fn() },
    appeal: { findMany: jest.fn(async () => []) },
    auditLog: { create: jest.fn() },
  },
}));

// The real requireRole, with the caller's role taken from a header.
jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'me', role: req.headers['x-test-role'] || 'USER', email: 'me@athena.com', persona: 'EARLY_CAREER' };
      next();
    },
    optionalAuth: (req: any, _res: any, next: any) => {
      if (req.headers['x-test-role']) req.user = { id: 'me', role: req.headers['x-test-role'], email: 'me@athena.com', persona: 'EARLY_CAREER' };
      next();
    },
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const as = (role: string) => ({ 'x-test-role': role });

describe('Moderator scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('a moderator works the report queue', async () => {
    await request(app).get('/api/admin/moderation/reports').set(as('MODERATOR')).expect(200);
    await request(app).get('/api/appeals').set(as('MODERATOR')).expect(200);
  });

  it('a moderator is kept out of the rest of admin', async () => {
    await request(app).get('/api/admin/users').set(as('MODERATOR')).expect(403);
    await request(app).get('/api/admin/stats').set(as('MODERATOR')).expect(403);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('a member reaches none of it', async () => {
    await request(app).get('/api/admin/moderation/reports').set(as('USER')).expect(403);
    await request(app).get('/api/appeals').set(as('USER')).expect(403);
  });

  it('an admin may set a known role, not an unknown one, and not their own', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u2', role: 'USER', email: 'u2@athena.com' });
    prisma.user.update.mockResolvedValue({ id: 'u2', role: 'MODERATOR' });
    prisma.auditLog.create.mockResolvedValue({});

    await request(app).patch('/api/admin/users/u2').set(as('ADMIN')).send({ role: 'MODERATOR' }).expect(200);
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ role: 'MODERATOR' });

    await request(app).patch('/api/admin/users/u2').set(as('ADMIN')).send({ role: 'OVERLORD' }).expect(400);
    await request(app).patch('/api/admin/users/me').set(as('ADMIN')).send({ role: 'USER' }).expect(400);
  });
});
