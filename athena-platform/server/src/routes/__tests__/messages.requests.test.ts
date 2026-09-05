import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(async () => ({ id: 'them', allowMessages: true })) },
    userSafetySettings: { findUnique: jest.fn(async () => null) },
    follow: { findUnique: jest.fn() },
    conversation: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    conversationParticipant: { findMany: jest.fn(async () => []), findUnique: jest.fn(), update: jest.fn() },
    message: { count: jest.fn(async () => 0) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'me', role: 'USER', email: 'me@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/safety-store', () => {
  const actual: any = jest.requireActual('../../utils/safety-store');
  return { ...actual, isBlockedRelationship: jest.fn(async () => false) };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const otherUser = { id: 'them', firstName: 'Ana', lastName: 'Ruiz', displayName: null, avatar: null, isVerified: false };

describe('Message requests and thread preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 'them', allowMessages: true });
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.conversation.findMany.mockResolvedValue([]);
    prisma.conversation.findFirst.mockResolvedValue(null);
    prisma.message.count.mockResolvedValue(0);
  });

  it('opening a thread with someone who does not follow you is a request', async () => {
    prisma.follow.findUnique.mockResolvedValue(null);
    prisma.conversation.create.mockResolvedValue({ id: 'c1' });

    const res = await request(app).post('/api/messages/conversations').send({ userId: 'them' }).expect(201);

    expect(prisma.conversation.create.mock.calls[0][0].data.requestedById).toBe('me');
    expect(res.body.data).toMatchObject({ id: 'c1', isNew: true, isRequest: true });
  });

  it('opening a thread with someone who follows you is an ordinary thread', async () => {
    prisma.follow.findUnique.mockResolvedValue({ followerId: 'them' });
    prisma.conversation.create.mockResolvedValue({ id: 'c2' });

    const res = await request(app).post('/api/messages/conversations').send({ userId: 'them' }).expect(201);

    expect(prisma.conversation.create.mock.calls[0][0].data.requestedById).toBeNull();
    expect(res.body.data.isRequest).toBe(false);
  });

  it('the list carries each thread’s pin, mute and request state, and hides what you declined', async () => {
    prisma.conversationParticipant.findMany.mockResolvedValue([
      {
        isPinned: true,
        isMuted: false,
        isArchived: false,
        unreadCount: 2,
        conversation: {
          id: 'c1',
          disappearingTtlSeconds: null,
          requestedById: 'them',
          requestAcceptedAt: null,
          requestDeclinedAt: null,
          participants: [{ user: otherUser }],
          messages: [],
          updatedAt: new Date(),
        },
      },
    ]);

    const res = await request(app).get('/api/messages/conversations').expect(200);

    expect(res.body.data[0]).toMatchObject({ id: 'c1', isPinned: true, isMuted: false, isRequest: true, requestPending: false });
    const where = prisma.conversationParticipant.findMany.mock.calls[0][0].where;
    expect(where.conversation.OR).toEqual([{ requestDeclinedAt: null }, { requestedById: 'me' }]);
  });

  it('preferences change only your own row', async () => {
    prisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'cp-me' });
    prisma.conversationParticipant.update.mockResolvedValue({ isPinned: true, isMuted: false, isArchived: false });

    const res = await request(app).patch('/api/messages/conversations/c1/preferences').send({ isPinned: true }).expect(200);
    expect(res.body.data).toEqual({ isPinned: true, isMuted: false, isArchived: false });
    expect(prisma.conversationParticipant.update).toHaveBeenCalledWith({
      where: { id: 'cp-me' },
      data: { isPinned: true },
      select: { isPinned: true, isMuted: true, isArchived: true },
    });

    prisma.conversationParticipant.findUnique.mockResolvedValue(null);
    await request(app).patch('/api/messages/conversations/c9/preferences').send({ isMuted: true }).expect(404);
  });

  it('only the person asked can accept, and accepting opens the thread', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'c1',
      requestedById: 'them',
      requestAcceptedAt: null,
      requestDeclinedAt: null,
      participants: [{ userId: 'me' }, { userId: 'them' }],
    });
    prisma.conversation.update.mockResolvedValue({});

    await request(app).post('/api/messages/conversations/c1/request/accept').expect(200);
    const data = prisma.conversation.update.mock.calls[0][0].data;
    expect(data.requestAcceptedAt).toBeInstanceOf(Date);
    expect(data.requestDeclinedAt).toBeNull();

    // The opener cannot accept their own request.
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'c1',
      requestedById: 'me',
      requestAcceptedAt: null,
      requestDeclinedAt: null,
      participants: [{ userId: 'me' }, { userId: 'them' }],
    });
    await request(app).post('/api/messages/conversations/c1/request/accept').expect(400);
  });

  it('the opener may send three messages, then waits for an answer', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'c1',
      requestedById: 'me',
      requestAcceptedAt: null,
      requestDeclinedAt: null,
      disappearingTtlSeconds: null,
      participants: [
        { userId: 'me', isMuted: false },
        { userId: 'them', isMuted: false },
      ],
    });
    prisma.message.count.mockResolvedValue(3);

    const res = await request(app).post('/api/messages/conversations/c1/messages').send({ content: 'One more' }).expect(403);
    expect(res.body.message).toMatch(/accept/i);
  });
});
