import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    conversation: { findFirst: jest.fn(async () => null), create: jest.fn(), findUnique: jest.fn() },
    follow: { findUnique: jest.fn(async () => null) },
    user: { findUnique: jest.fn(async () => ({ id: 'mei' })) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'sarah', role: 'USER', email: 'u@athena.com' };
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
import { canOpenConversation } from '../../services/message-permissions.service';

const prisma: any = prismaTyped;

describe('Who can message me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.conversation.findFirst.mockResolvedValue(null);
    prisma.follow.findUnique.mockResolvedValue(null);
  });

  it('lets anyone open a thread with a member who accepts messages from all', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ allowMessagesFrom: 'all' });
    expect(await canOpenConversation('sarah', 'mei')).toEqual({ allowed: true });
  });

  it('refuses a new thread to a member who accepts none', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ allowMessagesFrom: 'none' });
    const verdict = await canOpenConversation('sarah', 'mei');
    expect(verdict.allowed).toBe(false);

    const res = await request(app).post('/api/messages/conversations').send({ userId: 'mei' }).expect(403);
    expect(res.body.message).toMatch(/not accepting new messages/);
  });

  it('with "connections", only people the member follows may start a thread', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ allowMessagesFrom: 'connections' });
    expect((await canOpenConversation('sarah', 'mei')).allowed).toBe(false);

    prisma.follow.findUnique.mockResolvedValue({ followerId: 'mei', followingId: 'sarah' });
    expect(await canOpenConversation('sarah', 'mei')).toEqual({ allowed: true });
    expect(prisma.follow.findUnique.mock.calls[0][0].where).toEqual({
      followerId_followingId: { followerId: 'mei', followingId: 'sarah' },
    });
  });

  it('a thread that already exists stays open whatever the setting', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ allowMessagesFrom: 'none' });
    prisma.conversation.findFirst.mockResolvedValue({ id: 'c1' });
    expect(await canOpenConversation('sarah', 'mei')).toEqual({ allowed: true });
  });
});
