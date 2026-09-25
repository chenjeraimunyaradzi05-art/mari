/**
 * Turning two-factor authentication on, off, and reissuing the recovery codes.
 *
 * The only 2FA coverage on this server was the middleware gate and the
 * login-time check. The enrolment chain itself — the four routes a member
 * actually presses, and the recovery codes that are her way back in when the
 * authenticator is on a phone she no longer has — had none, and one of those
 * routes had never worked: the reissue endpoint requires a live second factor
 * and the form did not collect one, so every press came back 400.
 *
 * TOTP is exercised for real against a known seed rather than stubbed, because
 * what these routes are for is refusing a code that is wrong, and a stub that
 * says yes proves nothing. Only the sealing of the seed at rest and the replay
 * ledger are stood in for.
 */

import request from 'supertest';
import crypto from 'crypto';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

function base32Decode(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of secret.replace(/=|\s|-/g, '').toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('Invalid test TOTP secret');
    value = (value << 5) | index;
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
    user: { findUnique: jest.fn(), update: jest.fn(async () => ({})), updateMany: jest.fn(async () => ({ count: 1 })) },
    session: { deleteMany: jest.fn(async () => ({ count: 0 })), findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'her', role: 'USER', email: 'her@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
  SUSPENDED_ACCOUNT_MESSAGE: 'suspended',
}));

// A stand-in for the seed sealing, so the test can hand the route a secret it
// also knows. The sealing itself has its own tests; what matters here is that
// the plaintext seed never leaves the setup response.
jest.mock('../../utils/secret-box', () => ({
  sealSecret: (plain: string) => `sealed:${plain}`,
  openSecret: (stored: string | null | undefined) =>
    typeof stored === 'string' && stored.startsWith('sealed:') ? stored.slice('sealed:'.length) : null,
  isSealed: (value: string | null | undefined) => typeof value === 'string' && value.startsWith('sealed:'),
}));

const claimStep = jest.fn(async (_userId: string, _step: number) => true);
jest.mock('../../utils/totp-replay', () => ({
  claimTotpStep: (userId: string, step: number) => claimStep(userId, step),
  resetTotpReplayMemory: jest.fn(),
  TOTP_REPLAY_TTL_SECONDS: 120,
}));

// Hashing is reversible here only in the sense that the test can predict it,
// which is what lets a recovery code actually be spent below.
jest.mock('../../utils/password', () => ({
  hashPassword: jest.fn(async (plain: string) => `hashed:${plain}`),
  comparePassword: jest.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
  DUMMY_PASSWORD_HASH: 'hashed:dummy',
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

const prisma: any = prismaTyped;

beforeEach(() => {
  jest.clearAllMocks();
  claimStep.mockResolvedValue(true);
  prisma.user.update.mockResolvedValue({});
  prisma.user.updateMany.mockResolvedValue({ count: 1 });
});

describe('GET /api/auth/2fa/status', () => {
  it('tells her a setup is half-finished rather than showing it as on', async () => {
    prisma.user.findUnique.mockResolvedValue({
      twoFactorEnabled: false,
      twoFactorEnabledAt: null,
      twoFactorSecret: `sealed:${SECRET}`,
      twoFactorRecoveryCodes: [],
    });

    const res = await request(app).get('/api/auth/2fa/status').expect(200);

    expect(res.body.data).toMatchObject({ enabled: false, setupPending: true, recoveryCodesRemaining: 0 });
  });

  it('counts the recovery codes she has left', async () => {
    prisma.user.findUnique.mockResolvedValue({
      twoFactorEnabled: true,
      twoFactorEnabledAt: new Date(),
      twoFactorSecret: `sealed:${SECRET}`,
      twoFactorRecoveryCodes: ['hashed:a', 'hashed:b', 'hashed:c'],
    });

    const res = await request(app).get('/api/auth/2fa/status').expect(200);

    expect(res.body.data.recoveryCodesRemaining).toBe(3);
  });
});

describe('POST /api/auth/2fa/setup', () => {
  it('stores the seed sealed and hands the plaintext only to her authenticator', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', email: 'her@example.com', twoFactorEnabled: false });

    const res = await request(app).post('/api/auth/2fa/setup').send({}).expect(200);

    const stored = prisma.user.update.mock.calls[0][0].data;
    expect(String(stored.twoFactorSecret)).toMatch(/^sealed:/);
    expect(stored.twoFactorSecret).not.toBe(res.body.data.secret);
    // Not enabled yet: a seed that exists is not a second factor until she has
    // proved the authenticator can read it.
    expect(stored.twoFactorEnabled).toBe(false);
    expect(res.body.data.otpauthUrl).toContain('otpauth://totp/');
  });

  it('refuses to start again on an account that already has it on', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', email: 'her@example.com', twoFactorEnabled: true });

    await request(app).post('/api/auth/2fa/setup').send({}).expect(400);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/2fa/enable', () => {
  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', twoFactorSecret: `sealed:${SECRET}` });
  });

  it('refuses a code the authenticator did not produce', async () => {
    await request(app).post('/api/auth/2fa/enable').send({ code: '000000' }).expect(400);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('turns it on for the real code and issues a full set of recovery codes', async () => {
    const res = await request(app).post('/api/auth/2fa/enable').send({ code: currentCode() }).expect(200);

    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.recoveryCodes).toHaveLength(10);
    // The codes are handed over once and stored as hashes; the account never
    // holds a plaintext copy.
    const stored = prisma.user.update.mock.calls.at(-1)[0].data.twoFactorRecoveryCodes.set;
    expect(stored).toHaveLength(10);
    for (const code of res.body.data.recoveryCodes) {
      expect(stored).not.toContain(code);
    }
  });

  it('refuses a code that has already been used once', async () => {
    // The replay ledger is what stops someone who watched her screen, or read
    // the code off a notification, from using it a second time.
    claimStep.mockResolvedValue(false);

    await request(app).post('/api/auth/2fa/enable').send({ code: currentCode() }).expect(400);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses before setup has ever been started', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'her', twoFactorSecret: null });

    await request(app).post('/api/auth/2fa/enable').send({ code: currentCode() }).expect(400);
  });

  it('will not accept an empty code through the validator', async () => {
    await request(app).post('/api/auth/2fa/enable').send({}).expect(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/2fa/disable', () => {
  const enrolled = {
    id: 'her',
    passwordHash: 'hashed:correct horse battery staple',
    twoFactorEnabled: true,
    twoFactorSecret: `sealed:${SECRET}`,
    twoFactorRecoveryCodes: [],
  };

  it('asks for the account password as well as the second factor', async () => {
    prisma.user.findUnique.mockResolvedValue(enrolled);

    await request(app).post('/api/auth/2fa/disable').send({ code: currentCode() }).expect(400);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses the wrong password with 401 and changes nothing', async () => {
    prisma.user.findUnique.mockResolvedValue(enrolled);

    await request(app)
      .post('/api/auth/2fa/disable')
      .send({ currentPassword: 'not it', code: currentCode() })
      .expect(401);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('clears the seed and every remaining recovery code when it does turn off', async () => {
    prisma.user.findUnique.mockResolvedValue(enrolled);

    await request(app)
      .post('/api/auth/2fa/disable')
      .send({ currentPassword: 'correct horse battery staple', code: currentCode() })
      .expect(200);

    expect(prisma.user.update.mock.calls.at(-1)[0].data).toMatchObject({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
      twoFactorRecoveryCodes: { set: [] },
    });
  });
});

describe('POST /api/auth/2fa/recovery-codes', () => {
  /*
   * This route is the one that had never worked. The server asks for the
   * account password and a live second factor; the settings page collected
   * only the password, so verifySecondFactor was handed undefined and every
   * press came back 400 — on the single control a member has to prepare for
   * losing her authenticator.
   */
  const enrolled = {
    id: 'her',
    passwordHash: 'hashed:correct horse battery staple',
    twoFactorEnabled: true,
    twoFactorSecret: `sealed:${SECRET}`,
    twoFactorRecoveryCodes: [],
  };

  it('refuses when the password is right but no second factor was sent', async () => {
    prisma.user.findUnique.mockResolvedValue(enrolled);

    await request(app)
      .post('/api/auth/2fa/recovery-codes')
      .send({ currentPassword: 'correct horse battery staple' })
      .expect(400);
  });

  it('issues a fresh set for the password and a live authenticator code', async () => {
    prisma.user.findUnique.mockResolvedValue(enrolled);

    const res = await request(app)
      .post('/api/auth/2fa/recovery-codes')
      .send({ currentPassword: 'correct horse battery staple', code: currentCode() })
      .expect(200);

    expect(res.body.data.recoveryCodes).toHaveLength(10);
    expect(res.body.data.recoveryCodesRemaining).toBe(10);
    expect(res.body.message).toMatch(/no longer work/i);
  });

  it('accepts one of her recovery codes in place of the authenticator, and spends it', async () => {
    // The point of the whole feature: the phone is gone, so the printout is
    // what she has.
    prisma.user.findUnique.mockResolvedValue({
      ...enrolled,
      twoFactorRecoveryCodes: ['hashed:ABCD234567'],
    });

    await request(app)
      .post('/api/auth/2fa/recovery-codes')
      .send({ currentPassword: 'correct horse battery staple', code: 'abcd-234567' })
      .expect(200);

    // Spent with a conditional write, so a second simultaneous use of the same
    // code loses the race rather than both being honoured.
    const spend = prisma.user.updateMany.mock.calls[0][0];
    expect(spend.where).toMatchObject({ id: 'her', twoFactorRecoveryCodes: { has: 'hashed:ABCD234567' } });
    expect(spend.data.twoFactorRecoveryCodes.set).toEqual([]);
  });

  it('refuses on an account that has not enabled two-factor at all', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...enrolled, twoFactorEnabled: false });

    await request(app)
      .post('/api/auth/2fa/recovery-codes')
      .send({ currentPassword: 'correct horse battery staple', code: currentCode() })
      .expect(400);
  });
});
