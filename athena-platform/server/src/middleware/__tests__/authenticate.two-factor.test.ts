import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../utils/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock('../../utils/jwt', () => ({
  verifyToken: jest.fn(),
}));
jest.mock('../../services/session.service', () => ({
  sessionService: { findActiveSessionByAccessToken: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { verifyToken } from '../../utils/jwt';
import { sessionService } from '../../services/session.service';
import { authenticate, isTwoFactorEnrolmentPath } from '../auth';
import { errorHandler } from '../errorHandler';

const prisma: any = prismaTyped;
const verify: any = verifyToken;
const sessions: any = sessionService;

function appWithInlineAdminRoute() {
  const app = express();
  // The shape of the forty-odd routes that check the role themselves.
  app.delete('/api/posts/:id', authenticate, (req: any, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'not yours' });
    res.json({ deleted: req.params.id });
  });
  app.get('/api/auth/2fa/status', authenticate, (req: any, res) => res.json({ user: req.user.id, session: req.user.sessionId }));
  app.get('/api/auth/me', authenticate, (req: any, res) => res.json({ user: req.user.id }));
  app.use(errorHandler);
  return app;
}

describe('A staff account without a second factor', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env = { ...env, NODE_ENV: 'test', STAFF_TWO_FACTOR_REQUIRED: 'true' };
    jest.clearAllMocks();
    verify.mockReturnValue({ userId: 'admin-1', email: 'a@athena.com', role: 'ADMIN', persona: 'EARLY_CAREER' });
    sessions.findActiveSessionByAccessToken.mockResolvedValue({ id: 'sess-1', userId: 'admin-1' });
  });
  afterEach(() => {
    process.env = env;
  });

  it('is refused on a route that checks the role inline, before the handler runs', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', email: 'a@athena.com', role: 'ADMIN', persona: 'EARLY_CAREER', isSuspended: false, twoFactorEnabled: false });
    const res = await request(appWithInlineAdminRoute()).delete('/api/posts/p1').set('Authorization', 'Bearer tok').expect(403);
    expect(res.body.code).toBe('TWO_FACTOR_REQUIRED');
    expect(res.body.setup).toBe('/dashboard/settings/security');
  });

  it('can still reach the routes that enrol a factor and read its own session', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', email: 'a@athena.com', role: 'ADMIN', persona: 'EARLY_CAREER', isSuspended: false, twoFactorEnabled: false });
    const status = await request(appWithInlineAdminRoute()).get('/api/auth/2fa/status?x=1').set('Authorization', 'Bearer tok').expect(200);
    expect(status.body).toEqual({ user: 'admin-1', session: 'sess-1' });
    await request(appWithInlineAdminRoute()).get('/api/auth/me').set('Authorization', 'Bearer tok').expect(200);
  });

  it('passes once the factor is enrolled, and a member is never gated', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', email: 'a@athena.com', role: 'ADMIN', persona: 'EARLY_CAREER', isSuspended: false, twoFactorEnabled: true });
    await request(appWithInlineAdminRoute()).delete('/api/posts/p1').set('Authorization', 'Bearer tok').expect(200);

    verify.mockReturnValue({ userId: 'u-1', email: 'u@athena.com', role: 'USER', persona: 'EARLY_CAREER' });
    sessions.findActiveSessionByAccessToken.mockResolvedValue({ id: 'sess-2', userId: 'u-1' });
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', email: 'u@athena.com', role: 'USER', persona: 'EARLY_CAREER', isSuspended: false, twoFactorEnabled: false });
    const member = await request(appWithInlineAdminRoute()).delete('/api/posts/p1').set('Authorization', 'Bearer tok').expect(403);
    expect(member.body.error).toBe('not yours');
  });

  it('asks the token to be an access token', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN', isSuspended: false, twoFactorEnabled: true });
    await request(appWithInlineAdminRoute()).get('/api/auth/me').set('Authorization', 'Bearer tok').expect(200);
    expect(verify).toHaveBeenCalledWith('tok', 'access');
  });

  it('knows which paths are the enrolment ones', () => {
    expect(isTwoFactorEnrolmentPath('/api/auth/2fa/setup')).toBe(true);
    expect(isTwoFactorEnrolmentPath('/api/auth/sessions/abc')).toBe(true);
    expect(isTwoFactorEnrolmentPath('/api/admin/users')).toBe(false);
    expect(isTwoFactorEnrolmentPath('/api/authors')).toBe(false);
  });
});
