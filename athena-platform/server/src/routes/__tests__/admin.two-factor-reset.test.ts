/**
 * POST /api/admin/users/:id/two-factor/reset, the way back for a member who has
 * lost both her authenticator and her recovery codes.
 *
 * Until it existed nothing on the platform could help her: the second factor was
 * cleared only by herself, from inside a session she no longer had, or by erasing
 * the account. The route is narrow on purpose, and these hold the narrowness:
 * administrators only, never on the administrator's own account, a reason on the
 * record, the password left alone, every session ended, the member told whoever
 * asked, and the other administrators told when the account is staff.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(async () => ({})), findMany: jest.fn(async () => []) },
    notification: { create: jest.fn(async () => ({})), createMany: jest.fn(async () => ({ count: 1 })) },
    auditLog: { create: jest.fn(async () => ({})) },
  },
}));

// The real thing but for who is calling: a role check that says no, so the
// wiring of the admin prefix (an administrator, never a moderator) is covered.
const caller = { id: 'admin-1', role: 'ADMIN' };
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: caller.id, role: caller.role, email: 'admin@athena.test' };
    next();
  },
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Access denied: insufficient privileges' }),
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

const revokeAll = jest.fn(async (_userId: string, _options?: unknown) => ({ count: 2 }));
jest.mock('../../services/session.service', () => ({
  sessionService: { revokeAllUserSessions: (userId: string, options?: unknown) => revokeAll(userId, options) },
}));

const sendEmail = jest.fn<(options: any) => Promise<boolean>>(async () => true);
jest.mock('../../utils/email', () => ({
  sendEmail: (options: any) => sendEmail(options),
  sendVerificationEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import app from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const REASON = 'She phoned from the number on file, read back her last invoice and her date of birth, and the verified email round trip came back.';
const valid = { reason: REASON, identityChecked: true };

function target(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    email: 'member@example.com',
    firstName: 'Mem<b>ber',
    role: 'USER',
    twoFactorEnabled: true,
    twoFactorSecret: 'sealed:seed',
    twoFactorRecoveryCodes: ['h1', 'h2', 'h3'],
    ...overrides,
  };
}

const reset = (id = 'member-1', body: unknown = valid) => request(app).post(`/api/admin/users/${id}/two-factor/reset`).send(body as object);
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  caller.id = 'admin-1';
  caller.role = 'ADMIN';
  prisma.user.findUnique.mockResolvedValue(target());
  prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);
});

describe('who may do it', () => {
  it('is an administrator and nobody else: a moderator is turned away before anything is looked up', async () => {
    caller.role = 'MODERATOR';

    await reset().expect(403);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('is never her own account: removing a factor always takes two people', async () => {
    const res = await reset('admin-1').expect(409);

    expect(res.body.message).toMatch(/Another administrator has to do it/);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('what has to be said first', () => {
  it('wants a reason of at least a sentence on the record', async () => {
    await reset('member-1', { identityChecked: true }).expect(400);
    await reset('member-1', { reason: 'lost it', identityChecked: true }).expect(400);
    await reset('member-1', { reason: 'x'.repeat(501), identityChecked: true }).expect(400);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('wants the administrator to say she checked who was asking, and that is the literal true', async () => {
    await reset('member-1', { reason: REASON }).expect(400);
    await reset('member-1', { reason: REASON, identityChecked: false }).expect(400);
    await reset('member-1', { reason: REASON, identityChecked: 'true' }).expect(400);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses a body with anything else in it, rather than guessing what was meant', async () => {
    await reset('member-1', { ...valid, notify: false }).expect(400);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('what it does', () => {
  it('removes the factor and the recovery codes, and touches nothing else on the account, least of all the password', async () => {
    await reset().expect(200);

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const { where, data } = prisma.user.update.mock.calls[0][0];
    expect(where).toEqual({ id: 'member-1' });
    expect(data).toEqual({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
      twoFactorRecoveryCodes: { set: [] },
    });
    expect(data).not.toHaveProperty('passwordHash');
  });

  it('also clears a setup that was started and never finished, which is a factor with no way to use it', async () => {
    prisma.user.findUnique.mockResolvedValue(target({ twoFactorEnabled: false, twoFactorRecoveryCodes: [] }));

    await reset().expect(200);

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('ends every session on the account, since a reset follows a lost device', async () => {
    await reset().expect(200);

    expect(revokeAll).toHaveBeenCalledWith('member-1', expect.anything());
  });

  it('tells the member in the app and by email, to the address on the account, with her name escaped', async () => {
    await reset().expect(200);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'member-1', type: 'SYSTEM', link: '/dashboard/settings/security' }),
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe('member@example.com');
    expect(mail.html).toContain('Mem&lt;b&gt;ber');
    expect(mail.html).not.toContain('Mem<b>ber');
    // What to do if she did not ask for it is in it.
    expect(mail.text).toMatch(/did not ask for this/);
    expect(mail.text).toMatch(/choose a new password/);
  });

  it('refuses an account that has no second factor to reset, and does nothing', async () => {
    prisma.user.findUnique.mockResolvedValue(target({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: [] }));

    const res = await reset().expect(409);

    expect(res.body.message).toMatch(/no two-factor sign-in to reset/);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(revokeAll).not.toHaveBeenCalled();
  });

  it('answers 404 for an account that is not there', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await reset('nobody').expect(404);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('still succeeds when the email or the in-app notice fails: the factor is already gone, and saying otherwise would be false', async () => {
    sendEmail.mockRejectedValueOnce(new Error('mail provider down'));
    prisma.notification.create.mockRejectedValueOnce(new Error('db blip'));

    const res = await reset().expect(200);

    expect(res.body.data.memberEmailed).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });
});

describe('the other administrators', () => {
  it('are not troubled about an ordinary member', async () => {
    await reset().expect(200);
    await flush();

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('are told, by account and not by name, when the account is a moderator or an administrator', async () => {
    for (const role of ['MODERATOR', 'ADMIN']) {
      prisma.notification.createMany.mockClear();
      prisma.user.findUnique.mockResolvedValue(target({ role }));

      const res = await reset().expect(200);

      expect(res.body.data.targetWasStaff).toBe(true);
      expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
      const rows = prisma.notification.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(2);
      expect(rows[0].data).toMatchObject({ targetUserId: 'member-1', actorId: 'admin-1' });
    }
  });
});

describe('the record of it', () => {
  it('is filed under its own verb, with the reason and what was checked, against the acting administrator and the member', async () => {
    await reset().expect(200);
    await flush();

    const row = prisma.auditLog.create.mock.calls[0][0].data;
    expect(row.action).toBe('ADMIN_USER_UPDATE');
    expect(row.actorUserId).toBe('admin-1');
    expect(row.targetUserId).toBe('member-1');
    expect(row.metadata).toMatchObject({
      adminAction: 'USER_TWO_FACTOR_RESET',
      resourceType: 'User',
      resourceId: 'member-1',
      reason: REASON,
      identityChecked: true,
      targetWasStaff: false,
      recoveryCodesCleared: 3,
    });
  });

  it('writes nothing when the reset was refused', async () => {
    await reset('admin-1').expect(409);
    await flush();

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
