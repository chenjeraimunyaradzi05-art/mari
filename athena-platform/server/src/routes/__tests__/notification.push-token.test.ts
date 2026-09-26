import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    pushToken: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), create: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
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
import { deviceFingerprint, issueDeviceKey } from '../../services/push.service';

const prisma: any = prismaTyped;
const EXPO = 'ExponentPushToken[abcdefghijklmnop]';

describe('Push token registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.pushToken.findMany.mockResolvedValue([]);
    prisma.pushToken.create.mockImplementation(async (args: any) => ({ id: 'pt1', platform: args.data.platform }));
    prisma.pushToken.update.mockResolvedValue({});
    prisma.pushToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.pushToken.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('registers a new Expo device and issues it a key the device must keep', async () => {
    // After the create, the route re-reads the token's rows to settle any race;
    // the only row is the one just written.
    prisma.pushToken.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'pt1', userId: 'user-123', deviceId: 'x' }]);

    const res = await request(app)
      .post('/api/notifications/push-token')
      .send({ token: EXPO, provider: 'expo', platform: 'ios', deviceId: 'caller-chosen' })
      .expect(201);

    const data = prisma.pushToken.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 'user-123', token: EXPO, platform: 'ios', isActive: true });
    // The stored id is the server's fingerprint of the key it issued, never a
    // value the caller chose — a caller-chosen id was what made takeover free.
    expect(data.deviceId).toMatch(/^dk1:[0-9a-f]{64}$/);
    expect(data.deviceId).not.toBe('caller-chosen');
    expect(typeof res.body.data.deviceKey).toBe('string');
  });

  // The hole this route had: any signed-in member who knew another member's
  // token could POST it and the device became hers, so the other woman's
  // safety alerts and message previews stopped reaching her.
  it('refuses to move a device another account holds when no key is presented', async () => {
    prisma.pushToken.findMany.mockResolvedValue([
      { id: 'pt-old', userId: 'someone-else', deviceId: deviceFingerprint(issueDeviceKey()) },
    ]);

    await request(app).post('/api/notifications/push-token').send({ token: EXPO, provider: 'expo' }).expect(409);

    expect(prisma.pushToken.update).not.toHaveBeenCalled();
    expect(prisma.pushToken.create).not.toHaveBeenCalled();
  });

  it('refuses to move a device another account holds when the wrong key is presented', async () => {
    prisma.pushToken.findMany.mockResolvedValue([
      { id: 'pt-old', userId: 'someone-else', deviceId: deviceFingerprint(issueDeviceKey()) },
    ]);

    await request(app)
      .post('/api/notifications/push-token')
      .send({ token: EXPO, provider: 'expo', deviceKey: issueDeviceKey() })
      .expect(409);

    expect(prisma.pushToken.update).not.toHaveBeenCalled();
  });

  // A phone that genuinely changed hands still holds the key it was issued,
  // so the member now signed in on it can take it over.
  it('moves a device to the account signed in on it when the device proves it holds the key', async () => {
    const heldKey = issueDeviceKey();
    prisma.pushToken.findMany.mockResolvedValue([
      { id: 'pt-old', userId: 'someone-else', deviceId: deviceFingerprint(heldKey) },
    ]);

    const res = await request(app)
      .post('/api/notifications/push-token')
      .send({ token: EXPO, provider: 'expo', deviceKey: heldKey })
      .expect(200);

    expect(res.body.message).toBe('Device moved to this account');
    expect(prisma.pushToken.update).toHaveBeenCalledWith({
      where: { id: 'pt-old' },
      data: { userId: 'user-123', platform: 'android', deviceId: deviceFingerprint(heldKey), isActive: true },
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
