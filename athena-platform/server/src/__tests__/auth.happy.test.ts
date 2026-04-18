import request from 'supertest';

const TEST_USER = {
  id: 'user_test_1',
  email: 'test.user@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'USER',
  persona: 'EARLY_CAREER',
  referralCode: 'REFTEST1',
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

jest.mock('../utils/email', () => ({
  sendVerificationEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
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

jest.mock('../utils/prisma', () => {
  const SESSION = {
    id: 'sess_test_1',
    userId: TEST_USER.id,
    token: ACTIVE_ACCESS_TOKEN,
    refreshToken: ACTIVE_REFRESH_TOKEN,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    revokedAt: null,
  };

  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where?.email) {
          const email = String(where.email).toLowerCase();
          if (email === TEST_USER.email) {
            return {
              ...TEST_USER,
              passwordHash: 'hashed-password',
              avatar: null,
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
  };

  return { prisma };
});

// Import after mocks are declared
import { app } from '../index';

describe('auth endpoints (happy path, mocked prisma)', () => {
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  afterEach(() => {
    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  });

  it('POST /api/auth/register returns 201 and tokens', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'NEW.USER@EXAMPLE.COM',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        womanSelfAttested: true,
      })
      .expect(201);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.user?.email).toBe('new.user@example.com');
    expect(typeof res.body?.data?.accessToken).toBe('string');
    expect(res.body.data.accessToken.length).toBeGreaterThan(10);
    expect(typeof res.body?.data?.expiresIn).toBe('number');
    expect(res.body.data.expiresIn).toBeGreaterThan(0);
    expect(getSetCookieHeader(res)).toContain('refreshToken=');
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
    await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', ['refreshToken=refresh_token_test_1'])
      .expect(403);
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
      })
      .expect(201);

    expect(res.body).toHaveProperty('success', true);
    expect(typeof res.body?.data?.accessToken).toBe('string');
    expect(typeof res.body?.data?.expiresIn).toBe('number');
    expect(getSetCookieHeader(res)).toContain('refreshToken=');
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
