import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    group: { findUnique: jest.fn() },
    groupMember: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    groupJoinRequest: { findMany: jest.fn() },
    conversation: { upsert: jest.fn(), update: jest.fn() },
    conversationParticipant: { updateMany: jest.fn() },
    message: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    like: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    postSave: { findMany: jest.fn(async () => []) },
    pollVote: { groupBy: jest.fn(async () => []), findMany: jest.fn(async () => []) },
    post: { findMany: jest.fn(async () => []) },
  },
}));

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

const prisma: any = prismaTyped;
const GROUP = 'g1';
const as = (userId: string) => ({ 'x-test-user': userId });

describe('Group chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.groupMember.findUnique.mockResolvedValue({ groupId: GROUP, userId: 'member-1', role: 'MEMBER', isBanned: false, isMuted: false });
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

  it('refuses a non-member, and never creates a conversation for them', async () => {
    prisma.groupMember.findUnique.mockResolvedValue(null);
    await request(app).post(`/api/groups/${GROUP}/chat/message`).set(as('stranger')).send({ content: 'Let me in' }).expect(403);
    await request(app).get(`/api/groups/${GROUP}/chat/messages`).set(as('stranger')).expect(403);
    expect(prisma.conversation.upsert).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
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

    prisma.groupMember.findUnique.mockResolvedValue({ groupId: GROUP, userId: 'mod-1', role: 'MODERATOR', isBanned: false, isMuted: false });
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
