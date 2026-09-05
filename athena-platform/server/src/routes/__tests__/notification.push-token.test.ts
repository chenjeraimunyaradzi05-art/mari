import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    pushToken: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    user: { findUnique: jest.fn() },
    notification: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(), delete: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const EXPO = 'ExponentPushToken[abcdefghijklmnop]';

describe('Push token registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.pushToken.findFirst.mockResolvedValue(null);
    prisma.pushToken.create.mockImplementation(async (args: any) => ({ id: 'pt1', platform: args.data.platform }));
    prisma.pushToken.update.mockResolvedValue({});
    prisma.pushToken.updateMany.mockResolvedValue({ count: 1 });
  });

  it('registers a new Expo device for the signed-in member', async () => {
    const res = await request(app)
      .post('/api/notifications/push-token')
      .send({ token: EXPO, provider: 'expo', platform: 'ios', deviceId: 'iphone-1' })
      .expect(201);

    expect(prisma.pushToken.create.mock.calls[0][0].data).toEqual({
      userId: 'user-123',
      token: EXPO,
      platform: 'ios',
      deviceId: 'iphone-1',
      isActive: true,
    });
    expect(res.body.data).toEqual({ id: 'pt1', platform: 'ios' });
  });

  it('moves a device already known to whoever is signed in on it now', async () => {
    prisma.pushToken.findFirst.mockResolvedValue({ id: 'pt-old', userId: 'someone-else' });

    await request(app).post('/api/notifications/push-token').send({ token: EXPO, provider: 'expo' }).expect(200);

    expect(prisma.pushToken.create).not.toHaveBeenCalled();
    expect(prisma.pushToken.update).toHaveBeenCalledWith({
      where: { id: 'pt-old' },
      data: { userId: 'user-123', platform: 'android', deviceId: null, isActive: true },
    });
  });

  it('refuses a token that is not an Expo token when the provider says expo, and an empty one', async () => {
    await request(app).post('/api/notifications/push-token').send({ token: 'not-a-token', provider: 'expo' }).expect(400);
    await request(app).post('/api/notifications/push-token').send({}).expect(400);
    expect(prisma.pushToken.create).not.toHaveBeenCalled();
  });

  it('forgets a device on sign-out, only for its own owner', async () => {
    const res = await request(app).delete('/api/notifications/push-token').send({ token: EXPO }).expect(200);

    expect(prisma.pushToken.updateMany).toHaveBeenCalledWith({
      where: { token: EXPO, userId: 'user-123' },
      data: { isActive: false },
    });
    expect(res.body.data).toEqual({ removed: 1 });
  });

  it('accepts the token in the query string for clients that cannot send a DELETE body', async () => {
    await request(app).delete(`/api/notifications/push-token?token=${encodeURIComponent(EXPO)}`).expect(200);
    expect(prisma.pushToken.updateMany.mock.calls[0][0].where.token).toBe(EXPO);
  });
});
