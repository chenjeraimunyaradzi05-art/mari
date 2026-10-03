import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(async () => ({ id: 'them', allowMessages: true, womanVerificationStatus: 'UNVERIFIED', dvSafetyProfile: null, profile: null, dateOfBirth: new Date('1990-01-01') })) },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    // The DV safety page's own block list, the second place a block can be written: nobody is blocked there unless a test says so.
    dvSafetyProfile: { findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    follow: { findUnique: jest.fn() },
    conversation: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    conversationParticipant: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 1 })),
      count: jest.fn(async () => 0),
    },
    message: { count: jest.fn(async () => 0), create: jest.fn(), findMany: jest.fn(async () => []), updateMany: jest.fn(async () => ({ count: 0 })) },
    $transaction: jest.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
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

// Counting the women who say no to one account is its own service, with its own
// tests; here the route only has to hand it the account after a decline.
const reviewUnwantedContact = jest.fn(async (_senderId: string) => false);
jest.mock('../../services/unwanted-contact.service', () => ({
  reviewUnwantedContact: (senderId: string) => reviewUnwantedContact(senderId),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { isBlockedRelationship } from '../../utils/safety-store';
import * as socketService from '../../services/socket.service';

const prisma: any = prismaTyped;
const blocked = isBlockedRelationship as jest.MockedFunction<typeof isBlockedRelationship>;

const otherUser = { id: 'them', firstName: 'Ana', lastName: 'Ruiz', displayName: null, avatar: null, isVerified: false };

describe('Message requests and thread preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 'them', allowMessages: true, womanVerificationStatus: 'UNVERIFIED', dvSafetyProfile: null, profile: null, dateOfBirth: new Date('1990-01-01') });
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.conversation.findMany.mockResolvedValue([]);
    prisma.conversation.findFirst.mockResolvedValue(null);
    // clearAllMocks keeps an implementation a test set: nobody is blocked in the DV list unless a test says so.
    prisma.dvSafetyProfile.findFirst.mockResolvedValue(null);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.dvSafetyProfile.findMany.mockResolvedValue([]);
    prisma.message.count.mockResolvedValue(0);
    prisma.message.create.mockImplementation(async ({ data }: any) => ({ id: 'm-new', ...data, sender: { id: data.senderId } }));
    prisma.conversation.update.mockResolvedValue({});
    blocked.mockResolvedValue(false);
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

  // The pseudonymous display name: the person on the other side of a thread is shown by
  // her public name, and her legal first and last name never leave the server.
  it('names the person on the other side of each thread by her public name, never her legal one', async () => {
    const row = (id: string, user: Record<string, unknown>) => ({
      isPinned: false,
      isMuted: false,
      isArchived: false,
      unreadCount: 0,
      conversation: { id, disappearingTtlSeconds: null, requestedById: null, requestAcceptedAt: null, requestDeclinedAt: null, participants: [{ user }], messages: [], updatedAt: new Date() },
    });
    prisma.conversationParticipant.findMany.mockResolvedValue([
      row('c1', { id: 'jane', firstName: 'Jane', lastName: 'Doe', displayName: 'Willow Rain', avatar: null, isVerified: false }),
      row('c2', otherUser),
    ]);

    const res = await request(app).get('/api/messages/conversations').expect(200);

    expect(res.body.data.map((c: any) => [c.participant.displayName, c.participant.firstName, c.participant.lastName])).toEqual([
      ['Willow Rain', 'Willow Rain', ''],
      ['Ana', 'Ana', ''],
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/Doe|Ruiz|Jane/);
    // The legal surname is not even loaded.
    const select = prisma.conversationParticipant.findMany.mock.calls[0][0].include.conversation.include.participants.include.user.select;
    expect(Object.keys(select)).not.toContain('lastName');
    expect(Object.keys(select)).toContain('displayName');
  });

  // The inbox used to load every thread she had ever opened, joined, on every
  // open and every thirty-second refetch.
  it('the list comes a page at a time and says whether there is more', async () => {
    prisma.conversationParticipant.count.mockResolvedValue(260);

    // A client that does not page gets the largest page, and is told there is more.
    const first = await request(app).get('/api/messages/conversations').expect(200);
    const firstArgs = prisma.conversationParticipant.findMany.mock.calls[0][0];
    expect(firstArgs).toMatchObject({ skip: 0, take: 100 });
    expect(firstArgs.orderBy).toEqual([{ isPinned: 'desc' }, { conversation: { lastMessageAt: 'desc' } }, { id: 'asc' }]);
    expect(first.body.pagination).toMatchObject({ page: 1, limit: 100, total: 260, hasMore: true });

    prisma.conversationParticipant.findMany.mockClear();
    const second = await request(app).get('/api/messages/conversations?page=2&limit=30').expect(200);
    expect(prisma.conversationParticipant.findMany.mock.calls[0][0]).toMatchObject({ skip: 30, take: 30 });
    expect(second.body.pagination).toMatchObject({ page: 2, limit: 30, hasMore: true });

    prisma.conversationParticipant.findMany.mockClear();
    const third = await request(app).get('/api/messages/conversations?page=3&limit=500').expect(200);
    // The ceiling holds whatever the caller asks for.
    expect(prisma.conversationParticipant.findMany.mock.calls[0][0]).toMatchObject({ skip: 200, take: 100 });
    expect(third.body.pagination).toMatchObject({ page: 3, limit: 100, hasMore: false });
  });

  it('the unread total covers every thread, not the page, and leaves requests off', async () => {
    const unread = (unreadCount: number, requestedById: string | null, requestAcceptedAt: Date | null = null) => ({
      unreadCount,
      conversation: { requestedById, requestAcceptedAt, requestDeclinedAt: null },
    });
    // The page itself is empty; the badge still counts what is waiting.
    prisma.conversationParticipant.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([unread(3, null), unread(2, 'them'), unread(4, 'them', new Date()), unread(1, 'me')]);

    const res = await request(app).get('/api/messages/conversations').expect(200);

    // 3 in an ordinary thread, 4 in an accepted request, 1 in a request she
    // opened; the 2 in a request someone sent her wait in her Requests tab.
    expect(res.body.unreadTotal).toBe(8);
    const unreadWhere = prisma.conversationParticipant.findMany.mock.calls[1][0].where;
    expect(unreadWhere).toMatchObject({ userId: 'me', unreadCount: { gt: 0 }, isMuted: false, isArchived: false });
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

  // The thread and the message rules below are the ones the socket door is held
  // to as well (socket.handlers.test.ts runs the same function against the same
  // cases); both doors call sendDirectMessage.
  const thread = (overrides: Record<string, unknown> = {}) => ({
    id: 'c1',
    requestedById: null,
    requestAcceptedAt: null,
    requestDeclinedAt: null,
    disappearingTtlSeconds: null,
    participants: [
      { userId: 'me', isMuted: false },
      { userId: 'them', isMuted: false },
    ],
    ...overrides,
  });

  describe('across a block', () => {
    it('opening a thread is refused, whichever of you did the blocking', async () => {
      blocked.mockResolvedValue(true);

      const res = await request(app).post('/api/messages/conversations').send({ userId: 'them' }).expect(403);

      expect(res.body.message).toBe('You cannot message this user');
      expect(blocked).toHaveBeenCalledWith('me', 'them');
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it('sending into a thread that already exists is refused too, and nothing is written', async () => {
      prisma.conversation.findUnique.mockResolvedValue(thread());
      blocked.mockResolvedValue(true);

      const res = await request(app).post('/api/messages/conversations/c1/messages').send({ content: 'hello?' }).expect(403);

      expect(res.body.message).toBe('You cannot message this user');
      expect(prisma.message.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // A block can be written to the platform-wide list or to the DV safety
    // page's own list (the DV page writes the platform list first now, but did
    // not always), and the message routes read only the first.
    it('opening a thread is refused for a block that exists only on the DV safety page', async () => {
      prisma.dvSafetyProfile.findFirst.mockResolvedValue({ userId: 'them' });

      const res = await request(app).post('/api/messages/conversations').send({ userId: 'them' }).expect(403);

      expect(res.body.message).toBe('You cannot message this user');
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it('sending is refused for a block that exists only on the DV safety page, and nothing is written', async () => {
      prisma.conversation.findUnique.mockResolvedValue(thread());
      prisma.dvSafetyProfile.findFirst.mockResolvedValue({ userId: 'me' });

      const res = await request(app).post('/api/messages/conversations/c1/messages').send({ content: 'hello?' }).expect(403);

      expect(res.body.message).toBe('You cannot message this user');
      expect(prisma.message.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not send on a guess when the DV safety list cannot be read', async () => {
      prisma.conversation.findUnique.mockResolvedValue(thread());
      prisma.dvSafetyProfile.findFirst.mockRejectedValue(new Error('connection reset'));

      await request(app).post('/api/messages/conversations/c1/messages').send({ content: 'hello?' }).expect(500);

      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    describe('the inbox list', () => {
      // Whoever is on either side of a block with her, in either store: the thread
      // lists their name, picture and last line, and its unread count is a badge.
      const listBlocks = () => {
        prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['she-blocked'] });
        prisma.userSafetySettings.findMany.mockImplementation(async ({ where }: any) =>
          where?.hideReadReceipts ? [] : [{ userId: 'blocked-her' }]
        );
        prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['dv-she-blocked'] });
        prisma.dvSafetyProfile.findMany.mockResolvedValue([{ userId: 'dv-blocked-her' }]);
      };

      it('leaves out every thread with a member across a block, in the page, the count and the unread badge', async () => {
        listBlocks();

        await request(app).get('/api/messages/conversations').expect(200);

        const calls = prisma.conversationParticipant.findMany.mock.calls;
        const page = calls[0][0].where;
        const badge = calls[1][0].where;
        const count = prisma.conversationParticipant.count.mock.calls[0][0].where;
        for (const where of [page, badge, count]) {
          expect(where.conversation.participants.none.userId.in.slice().sort()).toEqual([
            'blocked-her',
            'dv-blocked-her',
            'dv-she-blocked',
            'she-blocked',
          ]);
        }
        // What was already there is kept: a request she declined is still gone from her side.
        expect(page.conversation.OR).toEqual([{ requestDeclinedAt: null }, { requestedById: 'me' }]);
      });

      it('asks for no exclusion at all when nobody is blocked, so the query is what it was', async () => {
        await request(app).get('/api/messages/conversations').expect(200);

        expect(prisma.conversationParticipant.findMany.mock.calls[0][0].where.conversation).toEqual({
          OR: [{ requestDeclinedAt: null }, { requestedById: 'me' }],
        });
      });

      it('fails rather than listing every thread when the block lists cannot be read', async () => {
        prisma.dvSafetyProfile.findUnique.mockRejectedValue(new Error('connection reset'));

        await request(app).get('/api/messages/conversations').expect(500);

        expect(prisma.conversationParticipant.findMany).not.toHaveBeenCalled();
      });
    });
  });

  describe('a declined request', () => {
    it('stays closed to the one who asked, and nothing is written', async () => {
      prisma.conversation.findUnique.mockResolvedValue(thread({ requestedById: 'me', requestDeclinedAt: new Date() }));

      const res = await request(app).post('/api/messages/conversations/c1/messages').send({ content: 'Please?' }).expect(403);

      expect(res.body.message).toMatch(/declined/i);
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('is handed to the unwanted-contact count against the account that asked', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'c1',
        requestedById: 'them',
        requestAcceptedAt: null,
        requestDeclinedAt: null,
        participants: [{ userId: 'me' }, { userId: 'them' }],
      });

      await request(app).post('/api/messages/conversations/c1/request/decline').expect(200);

      expect(prisma.conversation.update.mock.calls[0][0].data.requestDeclinedAt).toBeInstanceOf(Date);
      expect(reviewUnwantedContact).toHaveBeenCalledWith('them');
    });

    it('does not count anything when the thread was not a request to her', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'c1',
        requestedById: 'me',
        requestAcceptedAt: null,
        requestDeclinedAt: null,
        participants: [{ userId: 'me' }, { userId: 'them' }],
      });

      await request(app).post('/api/messages/conversations/c1/request/decline').expect(400);

      expect(prisma.conversation.update).not.toHaveBeenCalled();
      expect(reviewUnwantedContact).not.toHaveBeenCalled();
    });
  });

  // The banner tells the person who was asked that the other cannot see when she
  // read it. That has to hold wherever a read state leaves the server, or it is a
  // promise a stranger can see through by polling the thread.
  describe('read receipts for a request', () => {
    const sent = (overrides: Record<string, unknown> = {}) => ({
      id: 'm1',
      conversationId: 'c1',
      senderId: 'me',
      receiverId: 'them',
      content: 'Hi, I am a friend of Ana',
      isRead: true,
      readAt: new Date('2026-10-01T01:00:00Z'),
      createdAt: new Date('2026-10-01T00:00:00Z'),
      sender: { id: 'me' },
      replyTo: null,
      reactions: [],
      ...overrides,
    });

    const participation = (conversation: Record<string, unknown>) => ({
      id: 'p1',
      hasUnread: false,
      conversation,
    });

    it('does not tell the opener, in the thread, that her message was read, until it is accepted', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue(
        participation({ requestedById: 'me', requestAcceptedAt: null })
      );
      prisma.message.findMany.mockResolvedValue([
        sent({ id: 'm2', senderId: 'them', receiverId: 'me', content: 'Who is this?', isRead: true }),
        sent(),
      ]);

      const res = await request(app).get('/api/messages/conversations/c1/messages').expect(200);

      const mine = res.body.data.find((m: any) => m.id === 'm1');
      expect(mine).toMatchObject({ isRead: false, readAt: null });
      // What the other person wrote is read state of her own, and is left alone.
      expect(res.body.data.find((m: any) => m.id === 'm2').isRead).toBe(true);
    });

    it('tells her once it is accepted, and always tells the person who was asked', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue(
        participation({ requestedById: 'me', requestAcceptedAt: new Date() })
      );
      prisma.message.findMany.mockResolvedValue([sent()]);
      const accepted = await request(app).get('/api/messages/conversations/c1/messages').expect(200);
      expect(accepted.body.data[0].isRead).toBe(true);

      // She is the one who was asked: the opener is them, and her own messages' read state is hers.
      prisma.conversationParticipant.findUnique.mockResolvedValue(
        participation({ requestedById: 'them', requestAcceptedAt: null })
      );
      const asked = await request(app).get('/api/messages/conversations/c1/messages').expect(200);
      expect(asked.body.data[0].isRead).toBe(true);
    });

    it('does not tell the opener in the inbox list either', async () => {
      const listed = (conversation: Record<string, unknown>) => ({
        isPinned: false,
        isMuted: false,
        isArchived: false,
        unreadCount: 0,
        conversation: {
          id: 'c1',
          disappearingTtlSeconds: null,
          requestDeclinedAt: null,
          participants: [{ user: otherUser }],
          messages: [sent()],
          updatedAt: new Date(),
          ...conversation,
        },
      });
      prisma.conversationParticipant.findMany.mockResolvedValue([listed({ requestedById: 'me', requestAcceptedAt: null })]);
      const pending = await request(app).get('/api/messages/conversations').expect(200);
      expect(pending.body.data[0].lastMessage.isRead).toBe(false);

      prisma.conversationParticipant.findMany.mockResolvedValue([listed({ requestedById: 'me', requestAcceptedAt: new Date() })]);
      const accepted = await request(app).get('/api/messages/conversations').expect(200);
      expect(accepted.body.data[0].lastMessage.isRead).toBe(true);
    });

    // "Read receipts" in her message settings: the live tick honoured it, and the
    // two reads that serve the same fact on a reload did not, so the sender's
    // "read" tick came back the moment her client refetched.
    describe('when the other person has switched her read receipts off', () => {
      const accepted = { requestedById: null, requestAcceptedAt: null, participants: [{ userId: 'them' }] };

      it('does not tell the sender, in the thread, that her message was read, or when', async () => {
        prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'them' }]);
        prisma.conversationParticipant.findUnique.mockResolvedValue(participation(accepted));
        prisma.message.findMany.mockResolvedValue([
          sent({ id: 'm2', senderId: 'them', receiverId: 'me', content: 'Hello', isRead: true }),
          sent(),
        ]);

        const res = await request(app).get('/api/messages/conversations/c1/messages').expect(200);

        expect(res.body.data.find((m: any) => m.id === 'm1')).toMatchObject({ isRead: false, readAt: null });
        // What the other person wrote is read state of her own, and is left alone.
        expect(res.body.data.find((m: any) => m.id === 'm2').isRead).toBe(true);
        // And the question asked of the database was about her, and only her.
        expect(prisma.userSafetySettings.findMany).toHaveBeenCalledWith({
          where: { userId: { in: ['them'] }, hideReadReceipts: true },
          select: { userId: true },
        });
      });

      it('still tells the sender when she has not switched them off', async () => {
        prisma.userSafetySettings.findMany.mockResolvedValue([]);
        prisma.conversationParticipant.findUnique.mockResolvedValue(participation(accepted));
        prisma.message.findMany.mockResolvedValue([sent()]);

        const res = await request(app).get('/api/messages/conversations/c1/messages').expect(200);

        expect(res.body.data[0]).toMatchObject({ isRead: true });
        expect(res.body.data[0].readAt).toBeTruthy();
      });

      it('withholds the tick when her settings cannot be read, as the live tick does', async () => {
        prisma.userSafetySettings.findMany.mockRejectedValue(new Error('connection reset'));
        prisma.conversationParticipant.findUnique.mockResolvedValue(participation(accepted));
        prisma.message.findMany.mockResolvedValue([sent()]);

        const res = await request(app).get('/api/messages/conversations/c1/messages').expect(200);

        expect(res.body.data[0]).toMatchObject({ isRead: false, readAt: null });
      });

      it('does not tell the sender in the inbox list either, and leaves other threads alone', async () => {
        const listed = (id: string, otherId: string) => ({
          isPinned: false,
          isMuted: false,
          isArchived: false,
          unreadCount: 0,
          conversation: {
            id,
            disappearingTtlSeconds: null,
            requestDeclinedAt: null,
            requestedById: null,
            requestAcceptedAt: null,
            participants: [{ userId: otherId, user: { ...otherUser, id: otherId } }],
            messages: [sent({ conversationId: id })],
            updatedAt: new Date(),
          },
        });
        // Only the receipts question is answered with her: the same table is asked
        // who has blocked the reader, and nobody has.
        prisma.userSafetySettings.findMany.mockImplementation(async ({ where }: any) =>
          where?.hideReadReceipts ? [{ userId: 'them' }] : []
        );
        prisma.conversationParticipant.findMany.mockResolvedValue([listed('c1', 'them'), listed('c2', 'someone-else')]);

        const res = await request(app).get('/api/messages/conversations').expect(200);

        expect(res.body.data.find((c: any) => c.id === 'c1').lastMessage.isRead).toBe(false);
        expect(res.body.data.find((c: any) => c.id === 'c2').lastMessage.isRead).toBe(true);
        // One lookup for the page, not one per thread.
        const receiptLookups = prisma.userSafetySettings.findMany.mock.calls.filter(([args]: any) => args?.where?.hideReadReceipts);
        expect(receiptLookups).toHaveLength(1);
      });
    });
  });

  describe('request messages', () => {
    let delivered: jest.SpiedFunction<typeof socketService.sendRealTimeMessage>;

    beforeEach(() => {
      delivered = jest.spyOn(socketService, 'sendRealTimeMessage').mockResolvedValue(undefined);
    });

    afterEach(() => {
      delivered.mockRestore();
    });

    it('the first one knocks, and says it is a request', async () => {
      prisma.conversation.findUnique.mockResolvedValue(thread({ requestedById: 'me' }));
      prisma.message.count.mockResolvedValue(0);

      await request(app).post('/api/messages/conversations/c1/messages').send({ content: 'Hi, I am a friend of Ana' }).expect(201);

      expect(delivered).toHaveBeenCalledWith('them', expect.anything(), { quiet: false, request: true });
    });

    it('the ones after it arrive quietly: no push, no badge', async () => {
      prisma.conversation.findUnique.mockResolvedValue(thread({ requestedById: 'me' }));
      prisma.message.count.mockResolvedValue(2);

      await request(app).post('/api/messages/conversations/c1/messages').send({ content: 'And another thing' }).expect(201);

      expect(delivered).toHaveBeenCalledWith('them', expect.anything(), { quiet: true, request: true });
    });

    it('the person who was asked replying accepts the request, in the same write', async () => {
      prisma.conversation.findUnique.mockResolvedValue(thread({ requestedById: 'them' }));

      await request(app).post('/api/messages/conversations/c1/messages').send({ content: 'Yes, happy to chat' }).expect(201);

      const data = prisma.conversation.update.mock.calls[0][0].data;
      expect(data.requestAcceptedAt).toBeInstanceOf(Date);
      expect(data.requestDeclinedAt).toBeNull();
      expect(delivered).toHaveBeenCalledWith('them', expect.anything(), { quiet: false, request: false });
    });

    // The pseudonymous display name: the message goes to the other person's sockets and
    // push notification straight from the service, without passing through a route, so
    // the sender is named by her public name there too and her legal name is not in it.
    it('goes out naming its sender by her public name, with her legal first and last name left out', async () => {
      prisma.conversation.findUnique.mockResolvedValue(thread());
      prisma.message.create.mockImplementation(async ({ data }: any) => ({
        id: 'm-new',
        ...data,
        sender: { id: 'me', firstName: 'Jane', displayName: 'Willow Rain', avatar: null },
      }));

      await request(app).post('/api/messages/conversations/c1/messages').send({ content: 'hello' }).expect(201);

      const [, announced] = delivered.mock.calls[0] as [string, any, unknown];
      // Sent to 'them', so 'me' is another member there: the sender is not the reader.
      expect(announced.sender).toMatchObject({ id: 'me', displayName: 'Willow Rain', firstName: 'Willow Rain', lastName: '' });
      expect(JSON.stringify(announced)).not.toContain('Jane');
      // And the select that loads her never asks for a legal surname.
      const select = prisma.message.create.mock.calls[0][0].include.sender.select;
      expect(Object.keys(select)).not.toContain('lastName');
      expect(Object.keys(select)).toContain('displayName');
    });

    it('a message that is stored is not reported as failed because announcing it failed', async () => {
      prisma.conversation.findUnique.mockResolvedValue(thread());
      delivered.mockRejectedValue(new Error('socket server went away'));

      const res = await request(app).post('/api/messages/conversations/c1/messages').send({ content: 'hello' }).expect(201);

      expect(res.body.data.content).toBe('hello');
      expect(prisma.message.create).toHaveBeenCalledTimes(1);
    });
  });
});
