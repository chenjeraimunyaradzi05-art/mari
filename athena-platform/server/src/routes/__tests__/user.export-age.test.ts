/**
 * GET /api/users/me/export, the older of the two downloads of a member's data,
 * has to carry her date of birth. It reads the account through an explicit list
 * of columns, and the age she gave us (and whether a document check confirmed
 * it) is personal information held about her like any other, so a column added
 * for the age gate has to be added to that list as well.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => {
  const dedicated: Record<string, any> = {
    user: { findUnique: jest.fn() },
    profile: { findUnique: jest.fn(async () => null) },
    auditLog: { create: jest.fn(async () => ({})) },
  };
  const prisma = new Proxy(dedicated, {
    get: (target, name: string) => {
      if (!(name in target)) target[name] = { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) };
      return target[name];
    },
  });
  return { prisma };
});

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'her', role: 'USER', email: 'her@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/opensearch', () => ({
  initializeOpenSearch: jest.fn(),
  indexDocument: jest.fn(),
  deleteDocument: jest.fn(),
  IndexNames: { USERS: 'users' },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

beforeEach(() => {
  jest.clearAllMocks();
  prisma.auditLog.create.mockResolvedValue({});
  prisma.profile.findUnique.mockResolvedValue(null);
});

describe('GET /api/users/me/export', () => {
  it('asks for her date of birth and the document-check stamp, and hands both back', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'her',
      email: 'her@example.com',
      dateOfBirth: '1991-03-14T00:00:00.000Z',
      ageVerifiedAt: '2026-09-20T02:00:00.000Z',
    });

    const res = await request(app).get('/api/users/me/export').expect(200);

    const select = prisma.user.findUnique.mock.calls[0][0].select;
    expect(select.dateOfBirth).toBe(true);
    expect(select.ageVerifiedAt).toBe(true);
    expect(res.body.data.user).toMatchObject({
      dateOfBirth: '1991-03-14T00:00:00.000Z',
      ageVerifiedAt: '2026-09-20T02:00:00.000Z',
    });
  });

  it('never asks for a credential', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', email: 'her@example.com' });

    await request(app).get('/api/users/me/export').expect(200);

    const select = prisma.user.findUnique.mock.calls[0][0].select;
    for (const secret of ['passwordHash', 'twoFactorSecret', 'twoFactorRecoveryCodes']) {
      expect(select[secret]).toBeUndefined();
    }
  });
});
