/**
 * A moderator's decision ends the member's sessions, not only her access.
 *
 * Suspending, banning or changing the role of an account set a column. The REST
 * API reads the account on every request and so refused her at once, but the
 * session rows stayed live, and a socket authenticates only at the handshake, so
 * a member suspended for threatening someone kept the connections she already
 * had open: they went on delivering and accepting direct messages and live chat
 * until they happened to drop. Revoking her sessions announces it, and the
 * socket service closes every connection on them (socket-revocation.test.ts).
 *
 * The session service and the announcement run for real here; only the database
 * is stood in for. What is asserted is what reached the session table and what
 * was announced, not that a function was called.
 */

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
    session: { updateMany: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));

// Ending a membership at Stripe before the soft delete has its own tests
// (admin.user-erasure.test.ts, erasure-billing.service.test.ts); here it succeeds.
jest.mock('../../services/erasure-billing.service', () => ({
  endBillingBeforeErasure: jest.fn(async () => ({ subscriptionCancelled: false, payoutBalanceFlagged: false })),
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', role: 'ADMIN', email: 'admin@athena.test' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import app from '../../index';
import { prisma } from '../../utils/prisma';
import { sessionEvents } from '../../utils/session-events';
import * as contentReport from '../../services/content-report.service';

const prismaAny: any = prisma;

const member = { id: 'member-1', role: 'USER', isSuspended: false, bannedAt: null };

let announced: Array<{ userId: string; reason: string }> = [];

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  announced = [];
  sessionEvents.removeAllListeners('revoked');
  sessionEvents.onRevoked((event) => announced.push({ userId: event.userId, reason: event.reason }));

  prismaAny.user.findUnique.mockResolvedValue(member);
  prismaAny.user.update.mockResolvedValue({ id: member.id });
  prismaAny.user.findUniqueOrThrow.mockResolvedValue({ ...member, isSuspended: true });
  prismaAny.session.updateMany.mockResolvedValue({ count: 3 });
  prismaAny.auditLog.create.mockResolvedValue({ id: 'audit-1' });
});

afterEach(() => {
  sessionEvents.removeAllListeners('revoked');
});

/** The one query that ends sessions: every live session of the account, and no one else's. */
function expectAllLiveSessionsEnded(userId: string) {
  expect(prismaAny.session.updateMany).toHaveBeenCalledTimes(1);
  const call = prismaAny.session.updateMany.mock.calls[0][0];
  expect(call.where).toEqual({ userId, revokedAt: null });
  expect(call.data.revokedAt).toBeInstanceOf(Date);
}

describe('PATCH /api/admin/users/:id', () => {
  it('ends every session of an account the moment it is suspended, and announces why', async () => {
    const res = await request(app)
      .patch('/api/admin/users/member-1')
      .send({ isSuspended: true, suspensionReason: 'Threats in direct messages' });

    expect(res.status).toBe(200);
    expectAllLiveSessionsEnded('member-1');
    expect(announced).toEqual([{ userId: 'member-1', reason: 'suspended' }]);
  });

  it('does not touch the sessions of a suspension that was refused for want of a reason', async () => {
    const res = await request(app).patch('/api/admin/users/member-1').send({ isSuspended: true });

    expect(res.status).toBe(400);
    expect(prismaAny.session.updateMany).not.toHaveBeenCalled();
    expect(announced).toEqual([]);
  });

  it('ends every session when the role changes, so she signs in as what she now is', async () => {
    prismaAny.user.findUniqueOrThrow.mockResolvedValue({ ...member, role: 'MODERATOR' });

    const res = await request(app).patch('/api/admin/users/member-1').send({ role: 'MODERATOR' });

    expect(res.status).toBe(200);
    expectAllLiveSessionsEnded('member-1');
    expect(announced).toEqual([{ userId: 'member-1', reason: 'role-changed' }]);
  });

  it('ends them when staff access is taken away', async () => {
    prismaAny.user.findUnique.mockResolvedValue({ ...member, role: 'ADMIN' });

    const res = await request(app).patch('/api/admin/users/member-1').send({ role: 'USER' });

    expect(res.status).toBe(200);
    expect(announced).toEqual([{ userId: 'member-1', reason: 'role-changed' }]);
  });

  it('leaves the sessions alone when the role is sent again unchanged', async () => {
    const res = await request(app).patch('/api/admin/users/member-1').send({ role: 'USER' });

    expect(res.status).toBe(200);
    expect(prismaAny.session.updateMany).not.toHaveBeenCalled();
    expect(announced).toEqual([]);
  });

  it('leaves the sessions alone when an account is unsuspended, or only its email is marked verified', async () => {
    prismaAny.user.findUnique.mockResolvedValue({ ...member, isSuspended: true });
    const lifted = await request(app).patch('/api/admin/users/member-1').send({ isSuspended: false });
    const verified = await request(app).patch('/api/admin/users/member-1').send({ emailVerified: true });

    expect(lifted.status).toBe(200);
    expect(verified.status).toBe(200);
    expect(prismaAny.session.updateMany).not.toHaveBeenCalled();
  });

  it('says suspension, not role change, when one request does both', async () => {
    const res = await request(app)
      .patch('/api/admin/users/member-1')
      .send({ role: 'MODERATOR', isSuspended: true, suspensionReason: 'Pending review' });

    expect(res.status).toBe(200);
    expect(announced).toEqual([{ userId: 'member-1', reason: 'suspended' }]);
    expect(prismaAny.session.updateMany).toHaveBeenCalledTimes(1);
  });

  it('leaves a ban to banAccount, which ends the sessions itself, so they are not ended twice', async () => {
    const ban = jest.spyOn(contentReport, 'banAccount').mockResolvedValue(true);

    const res = await request(app)
      .patch('/api/admin/users/member-1')
      .send({ isBanned: true, banReason: 'Repeated threats to members', role: 'USER' });

    expect(res.status).toBe(200);
    expect(ban).toHaveBeenCalledWith('member-1', expect.objectContaining({ moderatorId: 'admin-1' }));
    expect(prismaAny.session.updateMany).not.toHaveBeenCalled();
  });

  it('still answers 200 when the sessions could not be ended, because the account is locked either way', async () => {
    prismaAny.session.updateMany.mockRejectedValue(new Error('connection reset'));

    const res = await request(app)
      .patch('/api/admin/users/member-1')
      .send({ isSuspended: true, suspensionReason: 'Threats in direct messages' });

    expect(res.status).toBe(200);
    expect(prismaAny.user.update.mock.calls[0][0].data).toMatchObject({ isSuspended: true });
    // The failure is not announced as a revocation that did not happen.
    expect(announced).toEqual([]);
  });
});

describe('DELETE /api/admin/users/:id', () => {
  it('ends the sessions of an account an administrator has deleted', async () => {
    const res = await request(app).delete('/api/admin/users/member-1');

    expect(res.status).toBe(200);
    expectAllLiveSessionsEnded('member-1');
    expect(announced).toEqual([{ userId: 'member-1', reason: 'account-deleted' }]);
  });
});
