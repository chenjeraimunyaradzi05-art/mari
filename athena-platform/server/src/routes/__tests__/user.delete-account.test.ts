/**
 * DELETE /api/users/me, and the other door to the same erasure, POST
 * /api/gdpr/dsar/delete.
 *
 * The first used to be a hand-written anonymisation that left her posts,
 * messages, health and safety records and bank connections where they were,
 * and deleted the local subscription row (and with it the only copy of the
 * Stripe subscription id) so the card kept being charged. It now creates a
 * deletion request and carries it out through the register-driven erasure, the
 * same code the data-rights route runs. These hold that: one erasure behind both
 * doors, refused (409, nothing erased) for a hold or for billing that could not
 * be ended, and a second look at who is asking first, because it cannot be
 * undone.
 */

import request from 'supertest';
import crypto from 'crypto';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

function base32Decode(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of secret.replace(/=|\s|-/g, '').toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** The code the member's authenticator would be showing right now. */
function currentCode(secret = SECRET): string {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
    auditLog: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(),
  },
}));

// The erasure limit is five an hour per member and is kept in memory for the
// life of the process, so each test is a different member. (It is also what
// lets the last test show both doors drawing on the one allowance.)
const principal = { id: 'her' };
let members = 0;

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: principal.id, role: 'USER', email: 'her@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
  SUSPENDED_ACCOUNT_MESSAGE: 'suspended',
}));

jest.mock('../../utils/opensearch', () => ({
  initializeOpenSearch: jest.fn(),
  indexDocument: jest.fn(),
  deleteDocument: jest.fn(),
  IndexNames: { USERS: 'users' },
}));

jest.mock('../../utils/secret-box', () => ({
  sealSecret: (plain: string) => `sealed:${plain}`,
  openSecret: (stored: string | null | undefined) =>
    typeof stored === 'string' && stored.startsWith('sealed:') ? stored.slice('sealed:'.length) : null,
  isSealed: (value: string | null | undefined) => typeof value === 'string' && value.startsWith('sealed:'),
}));

jest.mock('../../utils/totp-replay', () => ({
  claimTotpStep: jest.fn(async () => true),
  resetTotpReplayMemory: jest.fn(),
  TOTP_REPLAY_TTL_SECONDS: 120,
}));

jest.mock('../../utils/password', () => ({
  hashPassword: jest.fn(async (plain: string) => `hashed:${plain}`),
  comparePassword: jest.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
  DUMMY_PASSWORD_HASH: 'hashed:dummy',
}));

const lockout = { locked: false, retryAfterSeconds: 0 };
jest.mock('../../utils/loginAttempts', () => ({
  getLockoutStatus: jest.fn(async () => lockout),
  recordFailedLogin: jest.fn(async () => ({ locked: false, retryAfterSeconds: 0 })),
  clearFailedLogins: jest.fn(async () => undefined),
}));

jest.mock('../../utils/email', () => ({
  sendVerificationEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { gdprService } from '../../services/gdpr.service';
import { recordFailedLogin } from '../../utils/loginAttempts';
import { ApiError } from '../../middleware/errorHandler';

const prisma: any = prismaTyped;
const failed = recordFailedLogin as unknown as jest.Mock;

/** The row requireStepUp reads. A member with a password and nothing else, unless told otherwise. */
function account(overrides: Record<string, unknown> = {}) {
  return {
    id: principal.id,
    passwordHash: 'hashed:her-password',
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorRecoveryCodes: [],
    ...overrides,
  };
}

const COMPLETED = { requestId: 'dsar-1', status: 'COMPLETED', accountRemoved: false, retainedSections: ['subscriptions'], rowsRemoved: 41 };

let createRequest: jest.SpiedFunction<typeof gdprService.createDSARRequest>;
let processDeletion: jest.SpiedFunction<typeof gdprService.processDeletionRequest>;

/** Audit rows are written after the response is flushed. */
const flushAudit = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  members += 1;
  principal.id = `her-${members}`;
  lockout.locked = false;
  prisma.user.findUnique.mockResolvedValue(account());
  prisma.auditLog.create.mockResolvedValue({});
  createRequest = jest.spyOn(gdprService, 'createDSARRequest').mockResolvedValue({ id: 'dsar-1' } as any);
  processDeletion = jest.spyOn(gdprService, 'processDeletionRequest').mockResolvedValue(COMPLETED as any);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DELETE /api/users/me runs the data-rights erasure', () => {
  it('creates a deletion request and carries it out, instead of anonymising the row by hand', async () => {
    const res = await request(app)
      .delete('/api/users/me')
      .send({ confirm: true, currentPassword: 'her-password' })
      .expect(200);

    expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({ userId: principal.id, type: 'DELETION' }));
    expect(processDeletion).toHaveBeenCalledWith('dsar-1');
    // The hand-written transaction and its tombstone update are gone.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: true,
      data: { requestId: 'dsar-1', status: 'COMPLETED', accountRemoved: false, retainedRecords: ['subscriptions'] },
    });
  });

  it('tells her what actually happened, in the same words the other door uses', async () => {
    const shell = await request(app).delete('/api/users/me').send({ confirm: true, currentPassword: 'her-password' }).expect(200);
    expect(shell.body.message).toMatch(/Records we are legally required to keep are held without anything that identifies you/);

    processDeletion.mockResolvedValue({ ...COMPLETED, accountRemoved: true, retainedSections: [] } as any);
    const gone = await request(app).delete('/api/users/me').send({ confirm: true, currentPassword: 'her-password' }).expect(200);
    expect(gone.body.message).toBe('Your account and personal data have been deleted.');
  });

  it('writes the same audit row the data-rights route does, without naming her', async () => {
    await request(app).delete('/api/users/me').send({ confirm: true, currentPassword: 'her-password' }).expect(200);
    await flushAudit();

    const row = prisma.auditLog.create.mock.calls[0][0].data;
    expect(row.action).toBe('ACCOUNT_DELETE');
    expect(row.actorUserId ?? null).toBeNull();
    expect(row.targetUserId ?? null).toBeNull();
    expect(row.metadata).toMatchObject({ requestId: 'dsar-1', accountRemoved: false, rowsRemoved: 41 });
  });

  it('refuses without the explicit confirmation, before anything is asked or run', async () => {
    await request(app).delete('/api/users/me').send({ confirm: false, currentPassword: 'her-password' }).expect(400);
    await request(app).delete('/api/users/me').send({ currentPassword: 'her-password' }).expect(400);

    expect(createRequest).not.toHaveBeenCalled();
  });

  it('answers a legal hold with a 409 and the reason, and records nothing as erased', async () => {
    processDeletion.mockResolvedValue({
      requestId: 'dsar-1',
      status: 'REJECTED',
      accountRemoved: false,
      retainedSections: [],
      rowsRemoved: 0,
      reason: 'Cannot delete: active legal hold (hold-1)',
    } as any);

    const res = await request(app).delete('/api/users/me').send({ confirm: true, currentPassword: 'her-password' }).expect(409);
    await flushAudit();

    expect(res.body.message).toMatch(/legal hold/);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('answers billing that could not be ended with the 409 the erasure threw, and records nothing as erased', async () => {
    processDeletion.mockRejectedValue(
      new ApiError(409, 'We could not end your membership billing just now, so your account has not been deleted and nothing has changed.')
    );

    const res = await request(app).delete('/api/users/me').send({ confirm: true, currentPassword: 'her-password' }).expect(409);
    await flushAudit();

    expect(res.body.message).toMatch(/has not been deleted/);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('asking who is at the keyboard first', () => {
  it('wants her password when the account has one, and runs nothing without it', async () => {
    const res = await request(app).delete('/api/users/me').send({ confirm: true }).expect(400);

    expect(res.body.message).toMatch(/Current password is required/);
    expect(createRequest).not.toHaveBeenCalled();
    expect(processDeletion).not.toHaveBeenCalled();
  });

  it('refuses a wrong password, counts it against the shared limit, and runs nothing', async () => {
    // A 403, never a 401: the clients answer a 401 by refreshing the session and
    // sending the request again, which counted one wrong password twice.
    const res = await request(app).delete('/api/users/me').send({ confirm: true, currentPassword: 'not-hers' }).expect(403);

    expect(res.body.message).toMatch(/incorrect/i);
    expect(failed).toHaveBeenCalledWith(`credential-check:${principal.id}`);
    expect(createRequest).not.toHaveBeenCalled();
  });

  it('stops asking, and says why, once the five wrong answers have locked the checks', async () => {
    lockout.locked = true;
    lockout.retryAfterSeconds = 600;

    await request(app).delete('/api/users/me').send({ confirm: true, currentPassword: 'her-password' }).expect(429);

    expect(createRequest).not.toHaveBeenCalled();
  });

  it('asks a member with no password (Google or Facebook only) for nothing she does not have', async () => {
    prisma.user.findUnique.mockResolvedValue(account({ passwordHash: null }));

    await request(app).delete('/api/users/me').send({ confirm: true }).expect(200);

    expect(processDeletion).toHaveBeenCalledTimes(1);
  });

  it('also wants a live second factor when two-factor is on, and does not count not having been asked as a wrong answer', async () => {
    prisma.user.findUnique.mockResolvedValue(account({ twoFactorEnabled: true, twoFactorSecret: `sealed:${SECRET}` }));

    const res = await request(app).delete('/api/users/me').send({ confirm: true, currentPassword: 'her-password' }).expect(400);

    expect(res.body.message).toMatch(/Two-factor code is required/);
    expect(failed).not.toHaveBeenCalled();
    expect(createRequest).not.toHaveBeenCalled();
  });

  it('refuses a wrong code and counts it', async () => {
    prisma.user.findUnique.mockResolvedValue(account({ twoFactorEnabled: true, twoFactorSecret: `sealed:${SECRET}` }));

    await request(app)
      .delete('/api/users/me')
      .send({ confirm: true, currentPassword: 'her-password', code: '000000' })
      .expect(400);

    expect(failed).toHaveBeenCalledWith(`credential-check:${principal.id}`);
    expect(createRequest).not.toHaveBeenCalled();
  });

  it('goes ahead with the password and a live authenticator code', async () => {
    prisma.user.findUnique.mockResolvedValue(account({ twoFactorEnabled: true, twoFactorSecret: `sealed:${SECRET}` }));

    await request(app)
      .delete('/api/users/me')
      .send({ confirm: true, currentPassword: 'her-password', code: currentCode() })
      .expect(200);

    expect(processDeletion).toHaveBeenCalledTimes(1);
  });

  it('accepts an unused recovery code in place of the authenticator, and spends it', async () => {
    prisma.user.findUnique.mockResolvedValue(
      account({
        twoFactorEnabled: true,
        twoFactorSecret: `sealed:${SECRET}`,
        // normalizeRecoveryCode upper-cases and strips dashes before comparing.
        twoFactorRecoveryCodes: ['hashed:ABCDEFGHJK'],
      })
    );

    await request(app)
      .delete('/api/users/me')
      .send({ confirm: true, currentPassword: 'her-password', code: 'ABCDE-FGHJK' })
      .expect(200);

    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { twoFactorRecoveryCodes: { set: [] } } })
    );
  });

  it('is asked of the data-rights door too, so one cannot be used to get round the other', async () => {
    const without = await request(app).post('/api/gdpr/dsar/delete').send({ confirmation: 'DELETE_MY_ACCOUNT' }).expect(400);
    expect(without.body.message).toMatch(/Current password is required/);
    expect(createRequest).not.toHaveBeenCalled();

    await request(app)
      .post('/api/gdpr/dsar/delete')
      .send({ confirmation: 'DELETE_MY_ACCOUNT', currentPassword: 'her-password' })
      .expect(200);
    expect(processDeletion).toHaveBeenCalledTimes(1);
  });
});

describe('one allowance for both doors', () => {
  it('counts the data-rights request and DELETE /users/me against the same five an hour', async () => {
    // Five attempts through one door, whatever their outcome, and the sixth
    // through the other is refused: using the second door is not a way round
    // the first one's limit.
    for (let i = 0; i < 5; i += 1) {
      await request(app).delete('/api/users/me').send({ confirm: true, currentPassword: 'her-password' }).expect(200);
    }

    await request(app)
      .post('/api/gdpr/dsar/delete')
      .send({ confirmation: 'DELETE_MY_ACCOUNT', currentPassword: 'her-password' })
      .expect(429);
    await request(app).delete('/api/users/me').send({ confirm: true, currentPassword: 'her-password' }).expect(429);
  });
});
