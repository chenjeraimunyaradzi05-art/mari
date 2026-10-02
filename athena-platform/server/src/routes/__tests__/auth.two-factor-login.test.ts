/**
 * Signing in to an account with two-factor on, through POST /api/auth/login.
 *
 * The enrolment routes had tests; the challenge a member actually meets at the
 * door did not exercise a recovery code or a replayed code at all. The recovery
 * code is the way back in when the authenticator is on a phone she no longer
 * has, so what matters is that it works once and only once, and that a wrong or
 * reused answer counts against the same lockout as a wrong password.
 *
 * TOTP is checked for real against a known seed rather than stubbed: what the
 * door is for is refusing a code that is wrong, and a stub that says yes proves
 * nothing. Only the sealing of the seed and the replay ledger are stood in for.
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
    user: { findUnique: jest.fn(), update: jest.fn(async () => ({})), updateMany: jest.fn() },
  },
}));

jest.mock('../../utils/secret-box', () => ({
  sealSecret: (plain: string) => `sealed:${plain}`,
  openSecret: (stored: string | null | undefined) =>
    typeof stored === 'string' && stored.startsWith('sealed:') ? stored.slice('sealed:'.length) : null,
  isSealed: (value: string | null | undefined) => typeof value === 'string' && value.startsWith('sealed:'),
}));

const claimStep = jest.fn<(userId: string, step: number) => Promise<boolean>>(async () => true);
jest.mock('../../utils/totp-replay', () => ({
  claimTotpStep: (userId: string, step: number) => claimStep(userId, step),
  resetTotpReplayMemory: jest.fn(),
  TOTP_REPLAY_TTL_SECONDS: 120,
}));

// Predictable, so a recovery code can actually be spent below.
jest.mock('../../utils/password', () => ({
  hashPassword: jest.fn(async (plain: string) => `hashed:${plain}`),
  comparePassword: jest.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
  DUMMY_PASSWORD_HASH: 'hashed:dummy-never-matches',
}));

const lockout = { locked: false, retryAfterSeconds: 0 };
jest.mock('../../utils/loginAttempts', () => ({
  getLockoutStatus: jest.fn(async () => lockout),
  recordFailedLogin: jest.fn(async () => ({ locked: false, retryAfterSeconds: 0 })),
  clearFailedLogins: jest.fn(async () => undefined),
}));

jest.mock('../../services/session.service', () => ({
  sessionService: { createSession: jest.fn(async () => ({ id: 'session-1' })) },
}));

jest.mock('../../services/login-alert.service', () => ({ noteSignIn: jest.fn(async () => undefined) }));

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
import { sessionService } from '../../services/session.service';
import { getLockoutStatus, recordFailedLogin } from '../../utils/loginAttempts';

const prisma: any = prismaTyped;
const failedLogin = recordFailedLogin as unknown as jest.Mock;
const lockStatus = getLockoutStatus as unknown as jest.Mock;
const createSession = sessionService.createSession as unknown as jest.Mock;

const EMAIL = 'two.factor@example.com';
/** What the member saved when she enrolled: the printed form, and the hashes the account holds. */
const SAVED_CODE = 'ABCDE-FGHJK';
const OTHER_CODE = 'MNPQR-STUVW';
const hashOf = (printed: string) => `hashed:${printed.replace(/-/g, '')}`;

/** The account as the login route reads it, with whatever recovery codes are still unspent. */
let recoveryCodes: string[];

function accountRow() {
  return {
    id: 'her',
    email: EMAIL,
    emailVerified: true,
    passwordHash: 'hashed:her-password',
    firstName: 'Her',
    lastName: 'Self',
    displayName: 'Her Self',
    avatar: null,
    role: 'USER',
    persona: 'EARLY_CAREER',
    isSuspended: false,
    lockedAt: null,
    twoFactorEnabled: true,
    twoFactorSecret: `sealed:${SECRET}`,
    twoFactorEnabledAt: new Date('2026-07-01T00:00:00Z'),
    twoFactorRecoveryCodes: [...recoveryCodes],
  };
}

const signIn = (body: Record<string, unknown>) =>
  request(app).post('/api/auth/login').send({ email: EMAIL, password: 'her-password', ...body });

beforeEach(() => {
  jest.clearAllMocks();
  lockout.locked = false;
  recoveryCodes = [hashOf(SAVED_CODE), hashOf(OTHER_CODE)];
  claimStep.mockResolvedValue(true);
  prisma.user.findUnique.mockImplementation(async () => accountRow());
  // Spending a code is a compare-and-swap on the hash still being in the set.
  prisma.user.updateMany.mockImplementation(async ({ where, data }: any) => {
    const wanted = where?.twoFactorRecoveryCodes?.has;
    if (!recoveryCodes.includes(wanted)) return { count: 0 };
    recoveryCodes = data.twoFactorRecoveryCodes.set;
    return { count: 1 };
  });
});

describe('the second factor at sign-in', () => {
  it('asks for it, and opens nothing, when the password alone is sent', async () => {
    const res = await signIn({}).expect(401);

    expect(res.body.message).toBe('Two-factor code required');
    expect(createSession).not.toHaveBeenCalled();
    // Not having been asked yet is not a wrong answer, so it is not counted.
    expect(failedLogin).not.toHaveBeenCalled();
  });

  it('opens the account for a live authenticator code', async () => {
    const res = await signIn({ twoFactorCode: currentCode() }).expect(200);

    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it('refuses a code that was already spent, even though it is still the right one for the minute', async () => {
    claimStep.mockResolvedValue(false);

    const res = await signIn({ twoFactorCode: currentCode() }).expect(401);

    expect(res.body.message).toBe('Invalid two-factor code');
    expect(createSession).not.toHaveBeenCalled();
    expect(failedLogin).toHaveBeenCalledTimes(1);
  });

  it('refuses a wrong code and counts it against the same lockout as a wrong password', async () => {
    const res = await signIn({ twoFactorCode: '000000' }).expect(401);

    expect(res.body.message).toBe('Invalid two-factor code');
    expect(failedLogin).toHaveBeenCalledWith(EMAIL, expect.anything());
    expect(createSession).not.toHaveBeenCalled();
  });

  it('answers 429 once those wrong answers have locked it, before it so much as compares the password', async () => {
    lockout.locked = true;
    lockout.retryAfterSeconds = 900;

    const res = await signIn({ twoFactorCode: currentCode() }).expect(429);

    expect(res.body.message).toMatch(/Try again in 15 minutes/);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(lockStatus).toHaveBeenCalled();
  });

  it('refuses the right code with the wrong password, and never reveals that the account has a second factor', async () => {
    const res = await signIn({ password: 'not-hers', twoFactorCode: currentCode() }).expect(401);

    expect(res.body.message).toBe('Invalid email or password');
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe('a recovery code, which is the way back in without the phone', () => {
  it('opens the account, written the way it was printed or typed loosely', async () => {
    await signIn({ twoFactorCode: SAVED_CODE }).expect(200);
    expect(createSession).toHaveBeenCalledTimes(1);

    recoveryCodes = [hashOf(SAVED_CODE), hashOf(OTHER_CODE)];
    await signIn({ twoFactorCode: ' abcde fghjk ' }).expect(200);
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it('is spent by being used: the account holds one code fewer, and the other is untouched', async () => {
    await signIn({ twoFactorCode: SAVED_CODE }).expect(200);

    expect(recoveryCodes).toEqual([hashOf(OTHER_CODE)]);
  });

  it('works once and only once', async () => {
    await signIn({ twoFactorCode: SAVED_CODE }).expect(200);
    createSession.mockClear();
    failedLogin.mockClear();

    const second = await signIn({ twoFactorCode: SAVED_CODE }).expect(401);

    expect(second.body.message).toBe('Invalid two-factor code');
    expect(createSession).not.toHaveBeenCalled();
    expect(failedLogin).toHaveBeenCalledTimes(1);
  });

  it('is honoured for only one of two requests that arrive together with the same code', async () => {
    // Both read the account while the code is still unspent; the compare-and-swap
    // that spends it is what decides, and it lets one of them through.
    const [one, two] = await Promise.all([signIn({ twoFactorCode: SAVED_CODE }), signIn({ twoFactorCode: SAVED_CODE })]);

    expect([one.status, two.status].sort()).toEqual([200, 401]);
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it('is refused when it is not one of hers, and counted', async () => {
    const res = await signIn({ twoFactorCode: 'ZZZZZ-ZZZZZ' }).expect(401);

    expect(res.body.message).toBe('Invalid two-factor code');
    expect(failedLogin).toHaveBeenCalledTimes(1);
    expect(recoveryCodes).toHaveLength(2);
  });

  it('can be typed in full: the sign-in box accepts a ten character code as well as six digits', async () => {
    // The validator's length rule is six to thirty-two; a recovery code is
    // ten characters before it is split for printing.
    const res = await signIn({ twoFactorCode: 'ABCDEFGHJK' });

    expect(res.status).toBe(200);
  });
});
