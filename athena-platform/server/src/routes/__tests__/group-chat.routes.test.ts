import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    group: { findUnique: jest.fn() },
    groupMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    groupJoinRequest: { findMany: jest.fn(), upsert: jest.fn(), updateMany: jest.fn(async () => ({ count: 0 })) },
    conversation: { upsert: jest.fn(), update: jest.fn() },
    conversationParticipant: { updateMany: jest.fn() },
    message: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    // The member list is read for blocks, in both stores and both directions.
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    dvSafetyProfile: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
    },
    follow: { findMany: jest.fn(async () => []) },
    notification: { create: jest.fn(async () => ({ id: 'n1' })) },
    like: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    postSave: { findMany: jest.fn(async () => []) },
    pollVote: { groupBy: jest.fn(async () => []), findMany: jest.fn(async () => []) },
    post: { findMany: jest.fn(async () => []) },
  },
}));

// The room broadcast is the one thing here that needs a live socket server;
// everything else in the module stays real.
jest.mock('../../services/socket.service', () => {
  const actual = jest.requireActual('../../services/socket.service') as Record<string, unknown>;
  return { ...actual, emitToGroupRoom: jest.fn() };
});

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'member-1', role: 'USER', email: 'm@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) req.user = { id: req.headers['x-test-user'], role: 'USER', email: 'm@athena.com' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { emitToGroupRoom } from '../../services/socket.service';

const prisma: any = prismaTyped;
const GROUP = 'g1';
const as = (userId: string) => ({ 'x-test-user': userId });

// The key of a file member-1 uploaded to the room: it names the room and the member.
const roomKey = (name: string, room = GROUP, sender = 'member-1') =>
  `chat/${room}/${sender}_0b0a1c2e-3f4a-4b5c-8d6e-7f8091a2b3c4.${name.split('.').pop()}`;

// Notifications are fired after the response, never awaited into it.
const flush = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

const memberRow = (userId: string, role: string, extra: Record<string, unknown> = {}) => ({
  groupId: GROUP,
  userId,
  role,
  isBanned: false,
  isMuted: false,
  group: { allowMemberInvites: true },
  ...extra,
});

describe('Group chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.groupMember.findUnique.mockResolvedValue(memberRow('member-1', 'MEMBER'));
    prisma.conversation.upsert.mockResolvedValue({ id: GROUP });
    prisma.conversation.update.mockResolvedValue({});
    prisma.conversationParticipant.updateMany.mockResolvedValue({ count: 0 });
    prisma.message.create.mockImplementation(async (args: any) => ({ id: 'm1', ...args.data, sender: { id: 'member-1', displayName: 'Mei', avatar: null }, replyTo: null }));
    prisma.message.findMany.mockResolvedValue([]);
  });

  it('creates the group’s conversation row before the first message, keyed by the group id', async () => {
    const res = await request(app).post(`/api/groups/${GROUP}/chat/message`).set(as('member-1')).send({ content: 'Hello all' }).expect(200);

    expect(prisma.conversation.upsert).toHaveBeenCalledWith({ where: { id: GROUP }, update: {}, create: { id: GROUP } });
    expect(prisma.message.create.mock.calls[0][0].data).toMatchObject({ conversationId: GROUP, senderId: 'member-1', content: 'Hello all' });
    expect(res.body.data.content).toBe('Hello all');
  });

  it('pushes a new message to everyone with the room open', async () => {
    await request(app).post(`/api/groups/${GROUP}/chat/message`).set(as('member-1')).send({ content: 'Live one' }).expect(200);

    expect(emitToGroupRoom).toHaveBeenCalledWith(
      GROUP,
      'groups:message',
      expect.objectContaining({ groupId: GROUP, message: expect.objectContaining({ content: 'Live one' }) }),
      { exceptUserIds: [] }
    );
  });

  // Anything carrying an attachments field used to be stored as IMAGE: a PDF,
  // a voice note, even an empty list next to plain text.
  it('labels a message by what it carries, not by whether it carries anything', async () => {
    const send = (body: Record<string, unknown>) =>
      request(app).post(`/api/groups/${GROUP}/chat/message`).set(as('member-1')).send(body).expect(200);
    // A file in a room is uploaded to it first and carried by its key (utils/chat-attachments).
    const file = (name: string, contentType: string) => ({ key: roomKey(name), name, contentType });

    await send({ content: 'Just words', attachments: [] });
    await send({ attachments: [file('agenda.pdf', 'application/pdf')] });
    await send({ attachments: [file('note.m4a', 'audio/mp4')] });
    await send({ attachments: [file('clip.mp4', 'video/mp4')] });
    await send({ attachments: [file('a.webp', 'image/webp'), file('b.webp', 'image/webp')] });

    expect(prisma.message.create.mock.calls.map((call: any[]) => call[0].data.type)).toEqual(['TEXT', 'FILE', 'AUDIO', 'VIDEO', 'IMAGE']);
  });

  // A file in a room is one she uploaded to that room, by key. A link, however
  // well formed, is somebody's public picture or reel; a key from another room
  // shows that room's file here; a key somebody else uploaded is not hers to send.
  describe('a file has to be one she uploaded to this room', () => {
    const send = (attachment: Record<string, unknown>) =>
      request(app).post(`/api/groups/${GROUP}/chat/message`).set(as('member-1')).send({ content: 'look', attachments: [attachment] });

    const refused = async (attachment: Record<string, unknown>) => {
      const res = await send(attachment).expect(400);
      expect(res.body.message).toMatch(/not sent from this conversation/i);
      expect(prisma.message.create).not.toHaveBeenCalled();
      expect(emitToGroupRoom).not.toHaveBeenCalled();
    };

    it('stores the key and what she said about the file, and no link', async () => {
      await send({ key: roomKey('a.webp'), url: 'https://bucket.example/anything', name: 'a.webp', contentType: 'image/webp', size: 1200 }).expect(200);

      expect(prisma.message.create.mock.calls[0][0].data.metadata.attachments).toEqual([
        { key: roomKey('a.webp'), name: 'a.webp', contentType: 'image/webp', size: 1200 },
      ]);
    });

    it('refuses a link to a public post picture', async () => {
      await refused({ url: '/uploads/posts/member-1/a.webp', name: 'a.webp', contentType: 'image/webp' });
    });

    it('refuses a key under another room', async () => {
      await refused({ key: roomKey('a.webp', 'g2'), contentType: 'image/webp' });
    });

    it('refuses a key another member uploaded', async () => {
      await refused({ key: roomKey('a.webp', GROUP, 'member-2'), contentType: 'image/webp' });
    });

    it('is asked after membership, so a non-member learns nothing about keys', async () => {
      prisma.groupMember.findUnique.mockResolvedValue(null);

      await send({ key: roomKey('a.webp', 'g2'), contentType: 'image/webp' }).expect(403);
    });
  });

  it('refuses a non-member, and never creates a conversation for them', async () => {
    prisma.groupMember.findUnique.mockResolvedValue(null);
    await request(app).post(`/api/groups/${GROUP}/chat/message`).set(as('stranger')).send({ content: 'Let me in' }).expect(403);
    await request(app).get(`/api/groups/${GROUP}/chat/messages`).set(as('stranger')).expect(403);
    expect(prisma.conversation.upsert).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(emitToGroupRoom).not.toHaveBeenCalled();
  });

  it('lists members with their roles for a member', async () => {
    prisma.groupMember.findMany.mockResolvedValue([
      { userId: 'admin-1', role: 'ADMIN', joinedAt: new Date(), isMuted: false, user: { id: 'admin-1', displayName: 'Priya', avatar: null } },
      { userId: 'member-1', role: 'MEMBER', joinedAt: new Date(), isMuted: true, user: { id: 'member-1', displayName: 'Mei', avatar: null } },
    ]);

    const res = await request(app).get(`/api/groups/${GROUP}/members`).set(as('member-1')).expect(200);

    expect(res.body.data).toEqual([
      expect.objectContaining({ userId: 'admin-1', role: 'ADMIN', displayName: 'Priya' }),
      expect.objectContaining({ userId: 'member-1', role: 'MEMBER', isMuted: true }),
    ]);
  });

  describe('the member list and blocks', () => {
    beforeEach(() => {
      // Nobody blocked on the platform-wide list unless a test says so.
      prisma.userSafetySettings.findUnique.mockResolvedValue(null);
      prisma.userSafetySettings.findMany.mockResolvedValue([]);
      prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
      prisma.follow.findMany.mockResolvedValue([]);
      prisma.groupMember.findMany.mockResolvedValue([]);
    });

    const askedFor = () => prisma.groupMember.findMany.mock.calls[0][0].where;

    it('leaves out a member she blocked and one who blocked her, in the query so the list is not short', async () => {
      prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
      prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'blocked-her' }]);

      await request(app).get(`/api/groups/${GROUP}/members`).set(as('member-1')).expect(200);

      expect(askedFor().userId.notIn.sort()).toEqual(['blocked-her', 'him']);
      expect(askedFor()).toMatchObject({ groupId: GROUP, isBanned: false });
    });

    it('reads a block she made from the DV safety page, before it reached the platform list', async () => {
      prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['dv-only'] });

      await request(app).get(`/api/groups/${GROUP}/members`).set(as('member-1')).expect(200);

      expect(askedFor().userId.notIn).toEqual(['dv-only']);
    });

    it('leaves out a member who blocked her from the DV page only, which the id list cannot name', async () => {
      await request(app).get(`/api/groups/${GROUP}/members`).set(as('member-1')).expect(200);

      expect(askedFor().user).toEqual({ NOT: { dvSafetyProfile: { is: { blockedUserIds: { has: 'member-1' } } } } });
    });

    it('does not narrow the list when nobody is blocked', async () => {
      await request(app).get(`/api/groups/${GROUP}/members`).set(as('member-1')).expect(200);

      expect(askedFor().userId).toBeUndefined();
    });

    it('does not answer with the whole roster when the block lists cannot be read', async () => {
      prisma.userSafetySettings.findMany.mockRejectedValue(new Error('connection reset'));

      const res = await request(app).get(`/api/groups/${GROUP}/members`).set(as('member-1'));

      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(res.body.data).toBeUndefined();
      expect(prisma.groupMember.findMany).not.toHaveBeenCalled();
    });

    it('does not take a member in Safe Mode off the list: the room is one she chose, and her name is on everything she writes there', async () => {
      await request(app).get(`/api/groups/${GROUP}/members`).set(as('member-1')).expect(200);

      expect(JSON.stringify(askedFor())).not.toContain('isSafeMode');
      expect(JSON.stringify(askedFor())).not.toContain('hideFromSearch');
    });
  });

  it('a moderator pins and unpins; a member may not', async () => {
    prisma.message.findUnique.mockResolvedValue({ conversationId: GROUP, deletedAt: null, metadata: { attachments: [] } });
    prisma.message.update.mockResolvedValue({});

    // Member: refused.
    await request(app).patch(`/api/groups/${GROUP}/chat/messages/m1/pin`).set(as('member-1')).send({}).expect(403);

    prisma.groupMember.findUnique.mockResolvedValue(memberRow('mod-1', 'MODERATOR'));
    await request(app).patch(`/api/groups/${GROUP}/chat/messages/m1/pin`).set(as('mod-1')).send({}).expect(200);
    expect(prisma.message.update.mock.calls[0][0].data.metadata).toMatchObject({ pinned: true, pinnedBy: 'mod-1' });

    await request(app).patch(`/api/groups/${GROUP}/chat/messages/m1/pin`).set(as('mod-1')).send({ pinned: false }).expect(200);
    expect(prisma.message.update.mock.calls[1][0].data.metadata).toMatchObject({ pinned: false });
  });

  it('pinned messages are the ones flagged in metadata, members only', async () => {
    prisma.message.findMany.mockResolvedValue([{ id: 'm9', content: 'Rules', metadata: { pinned: true }, sender: { id: 'mod-1', displayName: 'Ana', avatar: null } }]);
    const res = await request(app).get(`/api/groups/${GROUP}/chat/pinned`).set(as('member-1')).expect(200);
    expect(prisma.message.findMany.mock.calls[0][0].where).toMatchObject({ conversationId: GROUP, deletedAt: null, metadata: { path: ['pinned'], equals: true } });
    expect(prisma.message.findMany.mock.calls[0][0].where.senderId).toBeUndefined();
    expect(res.body.data[0].id).toBe('m9');
  });
});

/**
 * A block ends contact, and a group chat is contact with everyone in the room at
 * once. The group's posts list and its member list already held to it; the chat
 * (the history, the pinned messages and the live push) read no block list, so two
 * members who had blocked each other still read each other in real time. The
 * assertions are on the query, in both stores and both directions, for the reason
 * the rest of the block tests give: applied to the page afterwards they would
 * shorten it.
 */
describe('Group chat and blocks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.groupMember.findUnique.mockResolvedValue(memberRow('member-1', 'MEMBER'));
    prisma.conversation.upsert.mockResolvedValue({ id: GROUP });
    prisma.conversation.update.mockResolvedValue({});
    prisma.conversationParticipant.updateMany.mockResolvedValue({ count: 0 });
    prisma.message.create.mockImplementation(async (args: any) => ({ id: 'm1', ...args.data, sender: { id: 'member-1', displayName: 'Mei', avatar: null }, replyTo: null }));
    prisma.message.findMany.mockResolvedValue([]);
    // Nobody is blocked unless a test says so.
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.dvSafetyProfile.findMany.mockResolvedValue([]);
  });

  /** She blocked 'him'; 'blocked-her' blocked her; she blocked 'dv-only' from the DV page; 'dv-blocked-her' blocked her from it. */
  const blockEveryWay = () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'blocked-her' }]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['dv-only'] });
    prisma.dvSafetyProfile.findMany.mockResolvedValue([{ userId: 'dv-blocked-her' }]);
  };
  const EVERYONE_BLOCKED = ['blocked-her', 'dv-blocked-her', 'dv-only', 'him'];

  describe('the history', () => {
    it('leaves a blocked member’s messages out in the query, whichever side blocked and whichever store holds the block', async () => {
      blockEveryWay();

      await request(app).get(`/api/groups/${GROUP}/chat/messages`).set(as('member-1')).expect(200);

      const { where } = prisma.message.findMany.mock.calls[0][0];
      expect(where.conversationId).toBe(GROUP);
      expect([...where.senderId.notIn].sort()).toEqual(EVERYONE_BLOCKED);
    });

    it('asks for no sender clause when nobody is blocked', async () => {
      await request(app).get(`/api/groups/${GROUP}/chat/messages`).set(as('member-1')).expect(200);

      expect(prisma.message.findMany.mock.calls[0][0].where.senderId).toBeUndefined();
    });

    it('wipes what a blocked member said from the line a reply quotes and from the reactions on a message she can read', async () => {
      blockEveryWay();
      prisma.message.findMany.mockResolvedValue([
        {
          id: 'm2',
          senderId: 'priya',
          content: 'A reply',
          createdAt: new Date('2026-10-01T00:00:00Z'),
          replyTo: { id: 'm1', senderId: 'him', content: 'What he said' },
          reactions: [
            { emoji: 'x', userId: 'him' },
            { emoji: 'y', userId: 'priya' },
          ],
        },
        {
          id: 'm3',
          senderId: 'priya',
          content: 'Another reply',
          createdAt: new Date('2026-10-01T00:01:00Z'),
          replyTo: { id: 'm0', senderId: 'ana', content: 'Fine to read' },
          reactions: [],
        },
      ]);

      const res = await request(app).get(`/api/groups/${GROUP}/chat/messages`).set(as('member-1')).expect(200);

      const byId = Object.fromEntries(res.body.data.messages.map((message: any) => [message.id, message]));
      expect(byId.m2.replyTo).toEqual({ id: 'm1', senderId: 'him', content: '' });
      expect(byId.m2.reactions).toEqual([{ emoji: 'y', userId: 'priya' }]);
      expect(JSON.stringify(res.body)).not.toContain('What he said');
      // A line from somebody she has not blocked is quoted as it was written.
      expect(byId.m3.replyTo.content).toBe('Fine to read');
    });

    it('does not answer with the whole history when the block lists cannot be read', async () => {
      prisma.userSafetySettings.findMany.mockRejectedValue(new Error('connection reset'));

      const res = await request(app).get(`/api/groups/${GROUP}/chat/messages`).set(as('member-1'));

      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(res.body.data).toBeUndefined();
      expect(prisma.message.findMany).not.toHaveBeenCalled();
    });
  });

  describe('the pinned messages', () => {
    it('leaves a blocked member’s pinned message out in the query', async () => {
      blockEveryWay();

      await request(app).get(`/api/groups/${GROUP}/chat/pinned`).set(as('member-1')).expect(200);

      const { where } = prisma.message.findMany.mock.calls[0][0];
      expect(where).toMatchObject({ conversationId: GROUP, metadata: { path: ['pinned'], equals: true } });
      expect([...where.senderId.notIn].sort()).toEqual(EVERYONE_BLOCKED);
    });
  });

  describe('the live push', () => {
    it('is not pushed to a member on either side of a block with the sender, in either store', async () => {
      blockEveryWay();

      await request(app).post(`/api/groups/${GROUP}/chat/message`).set(as('member-1')).send({ content: 'Hello room' }).expect(200);

      const [, , , options] = (emitToGroupRoom as any).mock.calls[0];
      expect([...options.exceptUserIds].sort()).toEqual(EVERYONE_BLOCKED);
    });

    it('pushes nothing, rather than everything, when the sender’s block lists cannot be read; the message is still stored', async () => {
      prisma.dvSafetyProfile.findMany.mockRejectedValue(new Error('connection reset'));

      const res = await request(app).post(`/api/groups/${GROUP}/chat/message`).set(as('member-1')).send({ content: 'Hello room' }).expect(200);

      expect(res.body.data.content).toBe('Hello room');
      expect(prisma.message.create).toHaveBeenCalledTimes(1);
      expect(emitToGroupRoom).not.toHaveBeenCalled();
    });
  });

  describe('a reply, which carries the line it answers', () => {
    const asReplyTo = (senderId: string) => {
      prisma.message.findUnique.mockResolvedValue({ conversationId: GROUP, deletedAt: null, senderId });
      prisma.message.create.mockImplementation(async (args: any) => ({
        id: 'm2',
        ...args.data,
        sender: { id: 'member-1', displayName: 'Mei', avatar: null },
        replyTo: { id: 'm1', senderId, content: `What ${senderId} said` },
      }));
    };

    it('is not pushed to a member across a block with the author of the quoted line, who the sender has no block with', async () => {
      asReplyTo('ana');
      // Ana blocked Carol; the sender has blocked nobody and nobody has blocked her.
      prisma.userSafetySettings.findUnique.mockImplementation(async ({ where }: any) =>
        where.userId === 'ana' ? { blockedUsers: ['carol'] } : null
      );

      await request(app)
        .post(`/api/groups/${GROUP}/chat/message`)
        .set(as('member-1'))
        .send({ content: 'Agreed', replyToId: 'm1' })
        .expect(200);

      const [, , , options] = (emitToGroupRoom as any).mock.calls[0];
      expect(options.exceptUserIds).toEqual(['carol']);
    });

    it('is pushed to the room as usual when its quoted author is the sender, or nobody is blocked', async () => {
      asReplyTo('member-1');

      await request(app)
        .post(`/api/groups/${GROUP}/chat/message`)
        .set(as('member-1'))
        .send({ content: 'Adding to that', replyToId: 'm1' })
        .expect(200);

      const [, , , options] = (emitToGroupRoom as any).mock.calls[0];
      expect(options.exceptUserIds).toEqual([]);
    });

    it('is refused when the line it answers is from either side of a block with the sender, and is not stored', async () => {
      blockEveryWay();
      asReplyTo('him');

      const res = await request(app)
        .post(`/api/groups/${GROUP}/chat/message`)
        .set(as('member-1'))
        .send({ content: 'Replying anyway', replyToId: 'm1' })
        .expect(400);

      expect(res.body.message ?? res.body.error?.message ?? JSON.stringify(res.body)).toMatch(/reply target/i);
      expect(prisma.message.create).not.toHaveBeenCalled();
      expect(emitToGroupRoom).not.toHaveBeenCalled();
    });
  });
});

describe('Adding someone by name', () => {
  const group = { id: GROUP, name: 'Founders Circle', privacy: 'PRIVATE', requireApproval: false, maxMembers: 1000, _count: { members: 2 } };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.group.findUnique.mockResolvedValue(group);
    prisma.user.findMany.mockResolvedValue([
      { id: 'mod-1', displayName: 'Ana', firstName: null, lastName: null },
      { id: 'u9', displayName: null, firstName: 'Zara', lastName: 'Okoro' },
    ]);
    prisma.groupMember.findMany.mockResolvedValue([{ userId: 'admin-1' }]);
    prisma.groupMember.create.mockResolvedValue({ userId: 'u9', role: 'MEMBER', joinedAt: new Date(), user: { id: 'u9', displayName: 'Zara Okoro', avatar: null } });
    prisma.groupJoinRequest.upsert.mockResolvedValue({ id: 'r1' });
    // Nobody is blocked unless a test says so (an earlier suite's mocks do not carry over).
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.dvSafetyProfile.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findFirst.mockResolvedValue(null);
  });

  it('a moderator adds her straight away and she is told, with a link the app serves', async () => {
    prisma.groupMember.findUnique
      .mockResolvedValueOnce(memberRow('mod-1', 'MODERATOR')) // the person adding
      .mockResolvedValueOnce(null); // not yet a member

    const res = await request(app).post(`/api/groups/${GROUP}/members`).set(as('mod-1')).send({ userId: 'u9' }).expect(200);
    await flush();

    expect(res.body.data).toMatchObject({ status: 'added', userId: 'u9', role: 'MEMBER' });
    expect(prisma.groupMember.create.mock.calls[0][0].data).toEqual({ groupId: GROUP, userId: 'u9', role: 'MEMBER' });
    expect(prisma.groupJoinRequest.upsert).not.toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u9', link: `/dashboard/groups/${GROUP}`, message: 'Ana added you to Founders Circle' }) })
    );
  });

  it('a member’s suggestion in a private group becomes a join request for the admins', async () => {
    prisma.groupMember.findUnique
      .mockResolvedValueOnce(memberRow('member-1', 'MEMBER'))
      .mockResolvedValueOnce(null);

    const res = await request(app).post(`/api/groups/${GROUP}/members`).set(as('member-1')).send({ userId: 'u9' }).expect(202);
    await flush();

    expect(res.body.data.status).toBe('pending');
    expect(prisma.groupMember.create).not.toHaveBeenCalled();
    expect(prisma.groupJoinRequest.upsert.mock.calls[0][0].create).toMatchObject({ groupId: GROUP, userId: 'u9', invitedById: 'member-1', status: 'PENDING' });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'admin-1', link: `/dashboard/groups/${GROUP}?tab=requests` }) })
    );
  });

  it('nobody adds, or suggests, a member on either side of a block with her, in either store, and nothing is written', async () => {
    const add = () => {
      prisma.groupMember.findUnique
        .mockResolvedValueOnce(memberRow('mod-1', 'MODERATOR')) // the person adding
        .mockResolvedValueOnce(null); // not yet a member
      return request(app).post(`/api/groups/${GROUP}/members`).set(as('mod-1')).send({ userId: 'u9' });
    };

    // She blocked u9 in the Safety Centre, or u9 blocked her.
    prisma.userSafetySettings.findMany.mockResolvedValueOnce([{ userId: 'u9' }]);
    await add().expect(403);

    // Or the block is on the DV safety page alone, in either direction.
    prisma.dvSafetyProfile.findFirst.mockResolvedValueOnce({ userId: 'u9' });
    const res = await add().expect(403);

    expect(res.body.message).toBe('You cannot add that person to this group.');
    expect(prisma.groupMember.create).not.toHaveBeenCalled();
    expect(prisma.groupJoinRequest.upsert).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('a member may not add when the group has switched invites off', async () => {
    prisma.groupMember.findUnique.mockResolvedValueOnce(memberRow('member-1', 'MEMBER', { group: { allowMemberInvites: false } }));

    await request(app).post(`/api/groups/${GROUP}/members`).set(as('member-1')).send({ userId: 'u9' }).expect(403);
    expect(prisma.groupMember.create).not.toHaveBeenCalled();
    expect(prisma.groupJoinRequest.upsert).not.toHaveBeenCalled();
  });

  it('rejects a role that is not a group role before touching the database', async () => {
    const res = await request(app).post(`/api/groups/${GROUP}/members`).set(as('mod-1')).send({ userId: 'u9', role: 'OWNER' }).expect(400);
    expect(res.body.message).toBe('Valid role is required');
    expect(prisma.groupMember.findUnique).not.toHaveBeenCalled();
  });
});

describe('Bans and mutes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.group.findUnique.mockResolvedValue({ id: GROUP, name: 'Founders Circle' });
    prisma.groupMember.update.mockResolvedValue({});
    prisma.groupMember.delete.mockResolvedValue({});
  });

  it('an admin sees who is banned, with the reason; a member does not', async () => {
    prisma.groupMember.findUnique.mockResolvedValue(memberRow('admin-1', 'ADMIN'));
    prisma.groupMember.findMany.mockResolvedValue([
      { userId: 'b1', bannedReason: 'Kept spamming', joinedAt: new Date(), user: { id: 'b1', displayName: 'Nobody', avatar: null } },
    ]);

    const res = await request(app).get(`/api/groups/${GROUP}/members/banned`).set(as('admin-1')).expect(200);
    expect(res.body.data).toEqual([expect.objectContaining({ userId: 'b1', displayName: 'Nobody', bannedReason: 'Kept spamming' })]);
    expect(prisma.groupMember.findMany.mock.calls[0][0].where).toEqual({ groupId: GROUP, isBanned: true });

    prisma.groupMember.findUnique.mockResolvedValue(memberRow('member-1', 'MEMBER'));
    await request(app).get(`/api/groups/${GROUP}/members/banned`).set(as('member-1')).expect(403);
  });

  it('an admin lifts a ban: the row goes, and she is told she can join again', async () => {
    prisma.groupMember.findUnique
      .mockResolvedValueOnce(memberRow('admin-1', 'ADMIN'))
      .mockResolvedValueOnce({ isBanned: true });

    await request(app).post(`/api/groups/${GROUP}/members/b1/unban`).set(as('admin-1')).expect(200);
    await flush();

    expect(prisma.groupMember.delete).toHaveBeenCalledWith({ where: { groupId_userId: { groupId: GROUP, userId: 'b1' } } });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'b1', link: `/dashboard/groups/${GROUP}` }) })
    );
  });

  it('unban is a no-op on someone who is not banned', async () => {
    prisma.groupMember.findUnique
      .mockResolvedValueOnce(memberRow('admin-1', 'ADMIN'))
      .mockResolvedValueOnce({ isBanned: false });

    await request(app).post(`/api/groups/${GROUP}/members/m2/unban`).set(as('admin-1')).expect(404);
    expect(prisma.groupMember.delete).not.toHaveBeenCalled();
  });

  it('a mute carries its reason to the person muted', async () => {
    prisma.groupMember.findUnique.mockResolvedValue(memberRow('mod-1', 'MODERATOR'));

    await request(app).post(`/api/groups/${GROUP}/members/m2/mute`).set(as('mod-1')).send({ reason: 'Take a breather' }).expect(200);
    await flush();

    expect(prisma.groupMember.update.mock.calls[0][0].data).toMatchObject({ isMuted: true });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'm2',
          message: expect.stringContaining('for 24 hours: Take a breather'),
          link: `/dashboard/groups/${GROUP}`,
        }),
      })
    );
  });

  it('a ban demotes the row and keeps it, so leaving does not clear it', async () => {
    prisma.groupMember.findUnique
      .mockResolvedValueOnce(memberRow('admin-1', 'ADMIN'))
      .mockResolvedValueOnce({ role: 'MODERATOR', isBanned: false });
    prisma.groupMember.upsert.mockResolvedValue({});

    await request(app).post(`/api/groups/${GROUP}/members/m2/ban`).set(as('admin-1')).send({ reason: 'Harassment' }).expect(200);

    expect(prisma.groupMember.upsert.mock.calls[0][0].update).toMatchObject({ isBanned: true, role: 'MEMBER', bannedReason: 'Harassment' });
    expect(prisma.groupMember.delete).not.toHaveBeenCalled();
  });
});

describe('Join requests name the person asking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.group.findUnique.mockResolvedValue({ id: GROUP, privacy: 'PRIVATE', isHidden: false });
    prisma.groupMember.findUnique.mockResolvedValue({ role: 'MODERATOR' });
  });

  it('includes the requester’s profile fields', async () => {
    prisma.groupJoinRequest.findMany.mockResolvedValue([
      { id: 'r1', groupId: GROUP, userId: 'u2', status: 'PENDING', createdAt: new Date(), user: { id: 'u2', firstName: 'Mei', lastName: 'Chen', displayName: null, avatar: null, headline: 'Product lead' } },
    ]);

    const res = await request(app).get(`/api/groups/${GROUP}/join-requests`).set(as('mod-1')).expect(200);

    expect(prisma.groupJoinRequest.findMany.mock.calls[0][0].select.user).toBeDefined();
    expect(res.body.data[0].user).toMatchObject({ firstName: 'Mei', headline: 'Product lead' });
  });
});
