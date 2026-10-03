/**
 * A notification is read and deleted by the person it was sent to, and by no
 * one else. Someone else's reads as missing (404), not forbidden (403): the
 * 403 these routes used to give told a stranger the id was real.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    notification: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'ada', role: 'USER', email: 'ada@athena.com', persona: 'EARLY_CAREER' };
      next();
    },
  };
});

jest.mock('../../middleware/rateLimiter', () => {
  const actual: any = jest.requireActual('../../middleware/rateLimiter');
  return { ...actual, createRateLimiter: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

describe('a notification belongs to the member it was sent to', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.notification.findUnique.mockImplementation(async ({ where }: any) =>
      where.id === 'mine' ? { id: 'mine', userId: 'ada', readAt: null } : where.id === 'hers' ? { id: 'hers', userId: 'bea', readAt: null } : null
    );
    prisma.notification.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data }));
    prisma.notification.delete.mockResolvedValue({});
  });

  it('marks her own notification read', async () => {
    const res = await request(app).patch('/api/notifications/mine/read').expect(200);
    expect(prisma.notification.update).toHaveBeenCalledWith({ where: { id: 'mine' }, data: { readAt: expect.any(Date) } });
    expect(res.body.success).toBe(true);
  });

  it('answers 404, not 403, for someone else’s, and changes nothing', async () => {
    await request(app).patch('/api/notifications/hers/read').expect(404);
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('answers the same 404 for an id that does not exist', async () => {
    const stranger = await request(app).patch('/api/notifications/hers/read').expect(404);
    const missing = await request(app).patch('/api/notifications/nobody/read').expect(404);
    expect(stranger.body.message).toBe(missing.body.message);
  });

  it('deletes her own and refuses to delete anyone else’s', async () => {
    await request(app).delete('/api/notifications/mine').expect(200);
    expect(prisma.notification.delete).toHaveBeenCalledWith({ where: { id: 'mine' } });

    prisma.notification.delete.mockClear();
    await request(app).delete('/api/notifications/hers').expect(404);
    await request(app).delete('/api/notifications/nobody').expect(404);
    expect(prisma.notification.delete).not.toHaveBeenCalled();
  });
});
