import request from 'supertest';

const CREATED_USER = {
  id: 'user_register_debug_1',
  email: 'debug.user@example.com',
  firstName: 'Debug',
  lastName: 'User',
  role: 'USER',
  persona: 'MID_CAREER',
  referralCode: 'ATHENA42',
};

jest.mock('../utils/email', () => ({
  sendVerificationEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
}));

jest.mock('../utils/password', () => ({
  hashPassword: jest.fn(async () => 'hashed-password'),
  comparePassword: jest.fn(async () => true),
}));

jest.mock('../utils/prisma', () => {
  const prisma: any = {
    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where?.email) return null;
        if (where?.referralCode) return null;
        return null;
      }),
      create: jest.fn(async ({ data }: any) => ({
        ...CREATED_USER,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        persona: data.persona,
      })),
      update: jest.fn(async () => ({})),
    },
    inviteCode: {
      findFirst: jest.fn(async ({ where }: any) => ({
        id: 'invite_debug_1',
        code: where.code,
        usesCount: 0,
        maxUses: 1,
        isActive: true,
      })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    verificationToken: {
      create: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({})),
      findFirst: jest.fn(async () => null),
    },
    session: {
      create: jest.fn(async () => ({})),
      findFirst: jest.fn(async () => null),
      update: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    referral: {
      create: jest.fn(async () => ({})),
      findFirst: jest.fn(async () => null),
      update: jest.fn(async () => ({})),
    },
    notification: {
      create: jest.fn(async () => ({})),
    },
    subscription: {
      findUnique: jest.fn(async () => null),
    },
    $queryRaw: jest.fn(async () => 1),
    $disconnect: jest.fn(async () => undefined),
    $transaction: jest.fn(async (operationsOrCallback: unknown): Promise<unknown> => {
      if (typeof operationsOrCallback === 'function') {
        return (operationsOrCallback as (tx: typeof prisma) => unknown)(prisma);
      }

      return operationsOrCallback;
    }),
  };

  return { prisma };
});

import { app } from '../index';
import { prisma } from '../utils/prisma';

function getSetCookieHeader(res: request.Response): string {
  const header = res.headers['set-cookie'];
  if (Array.isArray(header)) {
    return header.join(';');
  }

  return header || '';
}

describe('registration flow (mocked prisma)', () => {
  it('registers a new user with a normalized email and invite code without a live database', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'DEBUG.USER@EXAMPLE.COM',
        password: 'Password123!',
        firstName: 'Debug',
        lastName: 'User',
        persona: 'mid_career',
        womanSelfAttested: true,
        inviteCode: 'athena-2026',
      })
      .expect(201);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body?.data?.user?.email).toBe('debug.user@example.com');
    expect(res.body?.data?.user?.persona).toBe('MID_CAREER');
    expect(res.body?.data?.verificationRequired).toBe(true);
    expect(res.body?.data?.accessToken).toBeUndefined();
    expect(getSetCookieHeader(res)).not.toContain('refreshToken=');

    expect(prisma.user.findUnique).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { email: 'debug.user@example.com' } })
    );
    expect(prisma.inviteCode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ code: 'ATHENA-2026', isActive: true }),
      })
    );
    expect(prisma.inviteCode.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: 'invite_debug_1', isActive: true }),
        data: expect.objectContaining({
          usesCount: { increment: 1 },
        }),
      })
    );
    expect(prisma.inviteCode.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: 'invite_debug_1', usesCount: { gte: 1 } }),
        data: { isActive: false },
      })
    );
    expect(prisma.verificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          token: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      })
    );
    expect(prisma.session.create).not.toHaveBeenCalled();
  });
});
