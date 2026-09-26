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
      expect.objectContaining({ groupId: GROUP, message: expect.objectContaining({ content: 'Live one' }) })
    );
  });

  // Anything carrying an attachments field used to be stored as IMAGE: a PDF,
  // a voice note, even an empty list next to plain text.
  it('labels a message by what it carries, not by whether it carries anything', async () => {
    const send = (body: Record<string, unknown>) =>
      request(app).post(`/api/groups/${GROUP}/chat/message`).set(as('member-1')).send(body).expect(200);
    const file = (name: string, contentType: string) => ({ url: `/uploads/posts/member-1/${name}`, name, contentType });

    await send({ content: 'Just words', attachments: [] });
    await send({ attachments: [file('agenda.pdf', 'application/pdf')] });
    await send({ attachments: [file('note.m4a', 'audio/mp4')] });
    await send({ attachments: [file('clip.mp4', 'video/mp4')] });
    await send({ attachments: [file('a.webp', 'image/webp'), file('b.webp', 'image/webp')] });

    expect(prisma.message.create.mock.calls.map((call: any[]) => call[0].data.type)).toEqual(['TEXT', 'FILE', 'AUDIO', 'VIDEO', 'IMAGE']);
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
    expect(res.body.data[0].id).toBe('m9');
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
