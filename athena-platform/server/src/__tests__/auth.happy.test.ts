import request from 'supertest';
import crypto from 'crypto';

const TEST_USER = {
  id: 'user_test_1',
  email: 'test.user@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'USER',
  persona: 'EARLY_CAREER',
  referralCode: 'REFTEST1',
};

const TWO_FACTOR_USER = {
  ...TEST_USER,
  id: 'user_2fa_1',
  email: 'two.factor@example.com',
  referralCode: 'REF2FA1',
  twoFactorSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
};

const REGISTER_EMAIL = 'new.user@example.com';
const ACTIVE_ACCESS_TOKEN = 'access_token_test_1';
const ACTIVE_REFRESH_TOKEN = 'refresh_token_test_1';

function getSetCookieHeader(res: request.Response): string {
  const header = res.headers['set-cookie'];
  if (Array.isArray(header)) {
    return header.join(';');
  }

  return header || '';
}

function generateTestTotpCode(secret: string, now = Date.now()): string {
  const key = base32Decode(secret);
  const counter = Math.floor(now / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter % 0x100000000, 4);

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];

  return String(binary % 1_000_000).padStart(6, '0');
}

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

jest.mock('../utils/email', () => ({
  sendVerificationEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
  sendAccountExistsEmail: jest.fn(async () => true),
}));

jest.mock('../utils/password', () => ({
  hashPassword: jest.fn(async () => 'hashed-password'),
  comparePassword: jest.fn(async () => true),
}));

jest.mock('../utils/jwt', () => {
  const actual = jest.requireActual('../utils/jwt');
  return {
    ...actual,
    verifyToken: jest.fn(() => ({
      userId: TEST_USER.id,
      email: TEST_USER.email,
      role: TEST_USER.role,
      persona: TEST_USER.persona,
    })),
  };
});

jest.mock('../utils/loginAttempts', () => ({
  getLockoutStatus: jest.fn(async () => ({ locked: false, retryAfterSeconds: 0 })),
  recordFailedLogin: jest.fn(async () => ({ locked: false, retryAfterSeconds: 0 })),
  clearFailedLogins: jest.fn(async () => undefined),
}));

jest.mock('../utils/prisma', () => {
  // Sessions are stored by the SHA-256 of their tokens and looked up by it, so
  // the row a lookup finds carries the hashes, as it does in the table.
  const { hashOpaqueToken } = jest.requireActual('../utils/opaqueToken');
  const SESSION = {
    id: 'sess_test_1',
    userId: TEST_USER.id,
    token: hashOpaqueToken(ACTIVE_ACCESS_TOKEN),
    refreshToken: hashOpaqueToken(ACTIVE_REFRESH_TOKEN),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    revokedAt: null,
  };

  const prisma: any = {
    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where?.email) {
          const email = String(where.email).toLowerCase();
          if (email === TEST_USER.email) {
            return {
              ...TEST_USER,
              emailVerified: true,
              passwordHash: 'hashed-password',
              avatar: null,
              twoFactorEnabled: false,
              twoFactorSecret: null,
              twoFactorEnabledAt: null,
            };
          }
          if (email === TWO_FACTOR_USER.email) {
            return {
              ...TWO_FACTOR_USER,
              emailVerified: true,
              passwordHash: 'hashed-password',
              avatar: null,
              twoFactorEnabled: true,
              twoFactorEnabledAt: new Date('2026-07-01T00:00:00.000Z'),
            };
          }
          return null;
        }
        if (where?.referralCode) return null;
        if (where?.id) {
          if (where.id === TEST_USER.id) {
            return {
              id: TEST_USER.id,
              email: TEST_USER.email,
              role: TEST_USER.role,
              persona: TEST_USER.persona,
            };
          }
          return null;
        }
        return null;
      }),
      create: jest.fn(async () => ({
        id: TEST_USER.id,
        email: REGISTER_EMAIL,
        firstName: TEST_USER.firstName,
        lastName: TEST_USER.lastName,
        role: TEST_USER.role,
        persona: TEST_USER.persona,
        referralCode: TEST_USER.referralCode,
      })),
      update: jest.fn(async () => ({})),
    },
    // The ban list every new account is checked against; nobody here is on it.
    bannedIdentity: { findUnique: jest.fn(async () => null) },
    // No invite code exists unless a test says so.
    inviteCode: { findFirst: jest.fn(async () => null), updateMany: jest.fn(async () => ({ count: 0 })) },
    verificationToken: {
      create: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({})),
      findFirst: jest.fn(async () => null),
    },
    session: {
      create: jest.fn(async ({ data }: any) => ({
        id: 'sess_created',
        ...data,
      })),
      deleteMany: jest.fn(async () => ({ count: 0 })),
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.refreshToken === SESSION.refreshToken) {
          if (
            (!where?.userId || where.userId === SESSION.userId) &&
            (!where?.revokedAt || SESSION.revokedAt === where.revokedAt) &&
            (!where?.expiresAt?.gt || SESSION.expiresAt > where.expiresAt.gt)
          ) {
            return SESSION;
          }
        }
        return null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where?.token === SESSION.token) {
          return SESSION;
        }
        return null;
      }),
      update: jest.fn(async ({ data }: any) => ({
        ...SESSION,
        ...data,
      })),
      // Rotation retires the old session conditionally and reports how many rows it changed.
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    referral: {
      create: jest.fn(async () => ({})),
    },
    notification: {
      create: jest.fn(async () => ({})),
    },
    subscription: {
      findUnique: jest.fn(async () => null),
    },
    $queryRaw: jest.fn(async () => 1),
    $disconnect: jest.fn(async () => undefined),
    // Rotation retires the old session and creates the new one in one transaction.
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
  };

  return { prisma };
});

// Import after mocks are declared
import { app } from '../index';
import { prisma } from '../utils/prisma';
import { sendAccountExistsEmail, sendPasswordResetEmail, sendVerificationEmail } from '../utils/email';

/** Deferred mail is sent after the reply, so a test waits for the call rather than assuming it. */
async function waitForCall(mock: jest.Mock, timeoutMs = 2000): Promise<void> {
  const started = Date.now();
  while (mock.mock.calls.length === 0) {
    if (Date.now() - started > timeoutMs) throw new Error('The deferred email was never handed to the provider');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('auth endpoints (happy path, mocked prisma)', () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  afterEach(() => {
    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it('POST /api/auth/register returns 201 and requires email verification', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'NEW.USER@EXAMPLE.COM',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        womanSelfAttested: true,
        dateOfBirth: '1990-05-12',
      })
      .expect(201);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.verificationRequired).toBe(true);
    // The account is not described in the reply: a taken address gets the
    // same body, so it cannot carry anything only a new member would be told.
    expect(res.body?.data?.user).toBeUndefined();
    expect(res.body?.data?.accessToken).toBeUndefined();
    expect(getSetCookieHeader(res)).not.toContain('refreshToken=');
  });

  it('POST /api/auth/register answers a taken address exactly as it answers a new one', async () => {
    const body = {
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      womanSelfAttested: true,
      dateOfBirth: '1990-05-12',
    };
    (prisma.user.create as jest.Mock).mockClear();
    (sendAccountExistsEmail as jest.Mock).mockClear();
    (sendVerificationEmail as jest.Mock).mockClear();

    const fresh = await request(app).post('/api/auth/register').send({ ...body, email: REGISTER_EMAIL });
    const taken = await request(app).post('/api/auth/register').send({ ...body, email: TEST_USER.email });

    // The same status and the same body, so the form cannot be used to ask
    // whether somebody has an account.
    expect(taken.status).toBe(201);
    expect(taken.status).toBe(fresh.status);
    expect(taken.body).toEqual(fresh.body);
    expect(Object.keys(taken.body.data)).toEqual(['verificationRequired']);

    // One account was made, for the new address only.
    expect(prisma.user.create).toHaveBeenCalledTimes(1);

    // The owner of the taken address is told by email, after the reply; the
    // new address is sent its confirmation link.
    await waitForCall(sendAccountExistsEmail as jest.Mock);
    expect(sendAccountExistsEmail).toHaveBeenCalledWith(TEST_USER.email, TEST_USER.firstName);
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect((sendVerificationEmail as jest.Mock).mock.calls[0][0]).toBe(REGISTER_EMAIL);
  });

  it('POST /api/auth/register sends a fresh confirmation link, not a notice, to an unconfirmed address', async () => {
    (prisma.user.create as jest.Mock).mockClear();
    (sendAccountExistsEmail as jest.Mock).mockClear();
    (sendVerificationEmail as jest.Mock).mockClear();
    (prisma.user.findUnique as jest.Mock).mockImplementationOnce(async () => ({
      id: 'user_unconfirmed_1',
      email: 'unconfirmed@example.com',
      firstName: 'Una',
      emailVerified: false,
    }));

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'unconfirmed@example.com',
        password: 'Password123!',
        firstName: 'Una',
        lastName: 'Confirmed',
        womanSelfAttested: true,
        dateOfBirth: '1990-05-12',
      })
      .expect(201);

    expect(res.body?.data).toEqual({ verificationRequired: true });
    expect(prisma.user.create).not.toHaveBeenCalled();
    await waitForCall(sendVerificationEmail as jest.Mock);
    expect((sendVerificationEmail as jest.Mock).mock.calls[0][0]).toBe('unconfirmed@example.com');
    expect(sendAccountExistsEmail).not.toHaveBeenCalled();
  });

  it('POST /api/auth/register gives a bad invite code the same refusal for a taken address as a new one', async () => {
    const body = {
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      womanSelfAttested: true,
      dateOfBirth: '1990-05-12',
      inviteCode: 'NOSUCHCODE',
    };
    (prisma as any).inviteCode.findFirst.mockResolvedValue(null);

    const fresh = await request(app).post('/api/auth/register').send({ ...body, email: 'another.fresh@example.com' });
    const taken = await request(app).post('/api/auth/register').send({ ...body, email: TEST_USER.email });

    expect(fresh.status).toBe(400);
    expect(taken.status).toBe(fresh.status);
    expect(taken.body.message).toBe(fresh.body.message);
  });

  // A known address used to be slower to answer than an unknown one: the old
  // reset token was deleted and a new one written before the reply, and an
  // unknown address had none of that to do. All of it now follows the reply,
  // so the only work before it is the lookup both addresses get.
  it('POST /api/auth/forgot-password replies before it writes a reset token, for a known address as for an unknown one', async () => {
    let releaseToken!: () => void;
    const tokenWriteIsHeld = new Promise<void>((resolve) => {
      releaseToken = resolve;
    });
    (prisma.verificationToken.deleteMany as jest.Mock).mockClear();
    (prisma.verificationToken.create as jest.Mock).mockClear();
    (sendPasswordResetEmail as jest.Mock).mockClear();
    (prisma.verificationToken.create as jest.Mock).mockImplementationOnce(async () => {
      await tokenWriteIsHeld;
      return {};
    });

    // If the token were written before the reply, this would wait on the held
    // write and the test would time out instead of getting an answer.
    const known = await request(app).post('/api/auth/forgot-password').send({ email: TEST_USER.email }).expect(200);
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' }).expect(200);
    expect(known.body).toEqual(unknown.body);

    // The reply is out and the write is still held: nothing was sent yet.
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();

    releaseToken();
    await waitForCall(sendPasswordResetEmail as jest.Mock);
    expect((sendPasswordResetEmail as jest.Mock).mock.calls[0][0]).toBe(TEST_USER.email);
    expect(prisma.verificationToken.create).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  // The platform's own Terms say it is for adults and that it verifies this.
  // Nothing collected a date of birth until now, so these two cases are the
  // whole of the check: no date, and a date that does not clear the minimum.
  it('POST /api/auth/register refuses a sign-up with no date of birth', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'no.dob@example.com',
        password: 'Password123!',
        firstName: 'No',
        lastName: 'Birthday',
        womanSelfAttested: true,
      })
      .expect(400);

    expect(res.body?.message).toContain('date of birth');
  });

  it('POST /api/auth/register refuses a sign-up under the minimum age', async () => {
    const twelveYearsAgo = new Date();
    twelveYearsAgo.setFullYear(twelveYearsAgo.getFullYear() - 12);

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'too.young@example.com',
        password: 'Password123!',
        firstName: 'Too',
        lastName: 'Young',
        womanSelfAttested: true,
        dateOfBirth: twelveYearsAgo.toISOString().slice(0, 10),
      })
      .expect(400);

    // The refusal must not name the threshold back to someone who is guessing
    // at it, or the form becomes a calculator.
    expect(res.body?.message).not.toMatch(/\b18\b/);
  });

  it('POST /api/auth/login returns 200 and tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: 'Password123!',
      })
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.user?.id).toBe(TEST_USER.id);
    expect(res.body?.data?.user?.email).toBe(TEST_USER.email);
    expect(typeof res.body?.data?.accessToken).toBe('string');
    expect(res.body.data.accessToken.length).toBeGreaterThan(10);
    expect(typeof res.body?.data?.expiresIn).toBe('number');
    expect(res.body.data.expiresIn).toBeGreaterThan(0);
    expect(getSetCookieHeader(res)).toContain('refreshToken=');
  });

  it('POST /api/auth/login requires a TOTP code when two-factor auth is enabled', async () => {
    (prisma.session.create as jest.Mock).mockClear();

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: TWO_FACTOR_USER.email,
        password: 'Password123!',
      })
      .expect(401);

    expect(res.body?.message).toMatch(/two-factor code required/i);
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('POST /api/auth/login accepts a valid TOTP code when two-factor auth is enabled', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: TWO_FACTOR_USER.email,
        password: 'Password123!',
        twoFactorCode: generateTestTotpCode(TWO_FACTOR_USER.twoFactorSecret),
      })
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.user?.id).toBe(TWO_FACTOR_USER.id);
    expect(typeof res.body?.data?.accessToken).toBe('string');
    expect(getSetCookieHeader(res)).toContain('refreshToken=');
    expect(res.body?.data?.user?.twoFactorSecret).toBeUndefined();
  });

  it('POST /api/auth/refresh returns 200 and new tokens for a valid session', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'refresh_token_test_1' })
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(typeof res.body?.data?.accessToken).toBe('string');
    expect(res.body.data.accessToken.length).toBeGreaterThan(10);
    expect(typeof res.body?.data?.expiresIn).toBe('number');
    expect(res.body.data.expiresIn).toBeGreaterThan(0);
    expect(getSetCookieHeader(res)).toContain('refreshToken=');
  });

  it('POST /api/auth/refresh rejects cookie-based refresh without a trusted origin', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['refreshToken=refresh_token_test_1'])
        .expect(403);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('POST /api/auth/refresh accepts cookie-based refresh from a trusted origin', async () => {
    process.env.ALLOWED_ORIGINS = 'https://app.athena.example';

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', ['refreshToken=refresh_token_test_1'])
      .set('Origin', 'https://app.athena.example')
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(typeof res.body?.data?.accessToken).toBe('string');
    expect(getSetCookieHeader(res)).toContain('refreshToken=');
  });

  it('POST /api/auth/register allows empty persona and defaults', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'empty.persona@example.com',
        password: 'Password123!',
        firstName: 'Empty',
        lastName: 'Persona',
        persona: '',
        womanSelfAttested: true,
        dateOfBirth: '1990-05-12',
      })
      .expect(201);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.verificationRequired).toBe(true);
    expect(res.body?.data?.accessToken).toBeUndefined();
    expect(getSetCookieHeader(res)).not.toContain('refreshToken=');
  });

  it('GET /api/auth/me returns 200 for an active access-token session', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ACTIVE_ACCESS_TOKEN}`)
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.id).toBe(TEST_USER.id);
    expect(res.body?.data?.email).toBe(TEST_USER.email);
  });

  it('GET /api/auth/me returns 401 when the access-token session is missing', async () => {
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer revoked_access_token')
      .expect(401);
  });
});
