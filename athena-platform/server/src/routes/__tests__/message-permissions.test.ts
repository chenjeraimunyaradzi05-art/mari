import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    // The DV safety page's own block list, the second place a block can be written: nobody is blocked there unless a test says so.
    dvSafetyProfile: { findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    conversation: { findFirst: jest.fn(async () => null), create: jest.fn(), findUnique: jest.fn() },
    follow: { findUnique: jest.fn(async () => null) },
    user: { findUnique: jest.fn(async () => ({ id: 'mei', womanVerificationStatus: 'UNVERIFIED', dvSafetyProfile: null, profile: null, dateOfBirth: new Date('1990-01-01') })) },
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
import { DEFAULT_MESSAGE_AUDIENCE, canOpenConversation, messageAudienceOf } from '../../services/message-permissions.service';

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

  // The Safety Centre shows a member with no settings row the same default the
  // server enforces for her. They were two different answers (the page said only
  // people she follows, the server let anyone in), so what she was told was not
  // what protected her.
  it('answers a member who has never chosen with the default the settings page shows her', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ allowMessages: true });
    prisma.profile = { findUnique: jest.fn(async () => null) };
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);

    expect(await messageAudienceOf('mei')).toBe(DEFAULT_MESSAGE_AUDIENCE);
    // Whatever the default is, the verdict for a stranger follows from it.
    const verdict = await canOpenConversation('sarah', 'mei');
    expect(verdict.allowed).toBe(DEFAULT_MESSAGE_AUDIENCE === 'all');

    const page = await request(app).get('/api/safety/settings').expect(200);
    expect(page.body.data.allowMessagesFrom).toBe(DEFAULT_MESSAGE_AUDIENCE);
  });

  it('a thread that already exists stays open whatever the setting', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ allowMessagesFrom: 'none' });
    prisma.conversation.findFirst.mockResolvedValue({ id: 'c1' });
    expect(await canOpenConversation('sarah', 'mei')).toEqual({ allowed: true });
  });
});
