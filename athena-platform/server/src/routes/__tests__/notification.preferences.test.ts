import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    next();
  },
  requireRole: (_role: string) => (_req: any, _res: any, next: any) => {
    next();
  },
  requirePremium: (_req: any, _res: any, next: any) => {
    next();
  },
}));

import { app } from '../../index';
import { prisma } from '../../utils/prisma';

describe('Notification preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/notifications/preferences returns defaults when unset', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ notificationPreferences: null });

    const res = await request(app).get('/api/notifications/preferences').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        email: expect.objectContaining({ jobMatches: true, newsletter: true }),
        push: expect.objectContaining({ messages: true }),
        inApp: expect.objectContaining({ all: true }),
      }),
    );
  });

  it('PATCH /api/notifications/preferences persists merged preferences', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      notificationPreferences: {
        email: { newsletter: false },
      },
    });

    (prisma.user.update as any).mockResolvedValue({ id: 'user-123' });

    const res = await request(app)
      .patch('/api/notifications/preferences')
      .send({ preferences: { push: { messages: false } } })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email.newsletter).toBe(false);
    expect(res.body.data.push.messages).toBe(false);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          notificationPreferences: expect.objectContaining({
            email: expect.objectContaining({ newsletter: false }),
            push: expect.objectContaining({ messages: false }),
          }),
        }),
      }),
    );
  });

  it('PATCH /api/notifications/preferences returns 400 on invalid payload', async () => {
    const res = await request(app)
      .patch('/api/notifications/preferences')
      .send({ preferences: { push: { messages: 'nope' } } })
      .expect(400);

    expect(res.body.success).toBe(false);
  });
});
