import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    channel: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), delete: jest.fn() },
    channelMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
    channelMessage: { findMany: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = {
      id: req.headers['x-test-user'] || 'member-1',
      role: req.headers['x-test-role'] || 'USER',
      email: 'u@athena.com',
    };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) {
      req.user = {
        id: req.headers['x-test-user'],
        role: req.headers['x-test-role'] || 'USER',
        email: 'u@athena.com',
      };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const emitToChannel = jest.fn();
jest.mock('../../services/socket.service', () => ({
  emitToChannel: (...args: unknown[]) => emitToChannel(...args),
  initializeSocketHandlers: jest.fn(),
  getChannelRoomId: (id: string) => `channel:${id}`,
  sendNotification: jest.fn(),
  emitToUser: jest.fn(),
  createNotification: jest.fn(),
  isUserOnline: jest.fn(),
  getOnlineUsers: jest.fn(),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const OWNER = 'owner-1';
const MEMBER = 'member-1';
const OUTSIDER = 'outsider-1';

const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });

function mockChannel(overrides: Record<string, unknown> = {}) {
  (prisma.channel.findUnique as any).mockResolvedValue({
    id: 'c1',
    ownerId: OWNER,
    isPublic: true,
    ...overrides,
  });
}

describe('Channel discovery and unread counts avoid the /:id route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.channel.findMany as any).mockResolvedValue([]);
    (prisma.channel.count as any).mockResolvedValue(0);
  });

  it('GET /discover excludes channels the viewer already belongs to', async () => {
    await request(app).get('/api/channels/discover').set(as(MEMBER)).expect(200);

    expect(prisma.channel.findUnique).not.toHaveBeenCalled();
    const where = (prisma.channel.findMany as any).mock.calls[0][0].where;
    expect(where.isPublic).toBe(true);
    expect(where.members).toEqual({ none: { userId: MEMBER } });
  });

  it('GET /discover for a signed-out viewer lists all public channels', async () => {
    await request(app).get('/api/channels/discover').expect(200);

    const where = (prisma.channel.findMany as any).mock.calls[0][0].where;
    expect(where.members).toBeUndefined();
  });

  it('GET /unread counts only messages from other people since the read mark', async () => {
    const lastReadAt = new Date('2026-01-01T00:00:00Z');
    (prisma.channelMember.findMany as any).mockResolvedValue([
      { channelId: 'c1', lastReadAt, joinedAt: new Date('2025-01-01T00:00:00Z') },
    ]);
    (prisma.channelMessage.count as any).mockResolvedValue(4);

    const res = await request(app).get('/api/channels/unread').set(as(MEMBER)).expect(200);

    expect(res.body.data.total).toBe(4);
    expect(res.body.data.channels).toEqual([{ channelId: 'c1', unreadCount: 4 }]);

    const where = (prisma.channelMessage.count as any).mock.calls[0][0].where;
    expect(where.createdAt).toEqual({ gt: lastReadAt });
    expect(where.authorId).toEqual({ not: MEMBER });
  });

  it('a member who never opened a channel is measured from when they joined', async () => {
    const joinedAt = new Date('2026-02-02T00:00:00Z');
    (prisma.channelMember.findMany as any).mockResolvedValue([
      { channelId: 'c1', lastReadAt: null, joinedAt },
    ]);
    (prisma.channelMessage.count as any).mockResolvedValue(0);

    await request(app).get('/api/channels/unread').set(as(MEMBER)).expect(200);

    expect((prisma.channelMessage.count as any).mock.calls[0][0].where.createdAt).toEqual({
      gt: joinedAt,
    });
  });
});

describe('Channel membership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.channel.update as any).mockResolvedValue({});
    (prisma.channelMember.create as any).mockResolvedValue({});
    (prisma.channelMember.deleteMany as any).mockResolvedValue({ count: 1 });
  });

  it('lists members of a public channel', async () => {
    mockChannel();
    (prisma.channelMember.findMany as any).mockResolvedValue([
      { id: 'm1', joinedAt: new Date(), isMuted: false, user: { id: MEMBER, displayName: 'M' } },
    ]);

    const res = await request(app).get('/api/channels/c1/members').expect(200);
    expect(res.body.data[0].user.id).toBe(MEMBER);
  });

  it('hides the member list of a private channel from an outsider', async () => {
    mockChannel({ isPublic: false });
    (prisma.channelMember.findUnique as any).mockResolvedValue(null);

    await request(app).get('/api/channels/c1/members').set(as(OUTSIDER)).expect(403);
  });

  it('only the owner may add a member', async () => {
    mockChannel();

    await request(app)
      .post('/api/channels/c1/members')
      .set(as(MEMBER))
      .send({ userId: OUTSIDER })
      .expect(403);

    expect(prisma.channelMember.create).not.toHaveBeenCalled();
  });

  it('the owner adds a member and the count moves', async () => {
    mockChannel();
    (prisma.user.findUnique as any).mockResolvedValue({ id: OUTSIDER });
    (prisma.channelMember.findUnique as any).mockResolvedValue(null);

    await request(app)
      .post('/api/channels/c1/members')
      .set(as(OWNER))
      .send({ userId: OUTSIDER })
      .expect(201);

    expect(prisma.channelMember.create).toHaveBeenCalledWith({
      data: { channelId: 'c1', userId: OUTSIDER },
    });
    expect((prisma.channel.update as any).mock.calls[0][0].data).toEqual({
      memberCount: { increment: 1 },
    });
  });

  it('adding an existing member is a no-op rather than an error', async () => {
    mockChannel();
    (prisma.user.findUnique as any).mockResolvedValue({ id: OUTSIDER });
    (prisma.channelMember.findUnique as any).mockResolvedValue({ id: 'm1' });

    await request(app)
      .post('/api/channels/c1/members')
      .set(as(OWNER))
      .send({ userId: OUTSIDER })
      .expect(200);

    expect(prisma.channelMember.create).not.toHaveBeenCalled();
  });

  it('a member may remove themselves', async () => {
    mockChannel();

    await request(app).delete(`/api/channels/c1/members/${MEMBER}`).set(as(MEMBER)).expect(200);

    expect((prisma.channelMember.deleteMany as any).mock.calls[0][0].where).toEqual({
      channelId: 'c1',
      userId: MEMBER,
    });
  });

  it('a member may not remove somebody else', async () => {
    mockChannel();

    await request(app).delete(`/api/channels/c1/members/${OUTSIDER}`).set(as(MEMBER)).expect(403);

    expect(prisma.channelMember.deleteMany).not.toHaveBeenCalled();
  });

  it('the owner cannot be removed from their own channel', async () => {
    mockChannel();

    await request(app).delete(`/api/channels/c1/members/${OWNER}`).set(as(OWNER)).expect(400);
  });
});

describe('Channel read state, search and deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emitToChannel.mockClear();
  });

  it('POST /:id/read stamps the watermark for the caller only', async () => {
    (prisma.channelMember.updateMany as any).mockResolvedValue({ count: 1 });

    await request(app).post('/api/channels/c1/read').set(as(MEMBER)).expect(200);

    const call = (prisma.channelMember.updateMany as any).mock.calls[0][0];
    expect(call.where).toEqual({ channelId: 'c1', userId: MEMBER });
    expect(call.data.lastReadAt).toBeInstanceOf(Date);
  });

  it('POST /:id/read 404s for a non-member', async () => {
    (prisma.channelMember.updateMany as any).mockResolvedValue({ count: 0 });

    await request(app).post('/api/channels/c1/read').set(as(OUTSIDER)).expect(404);
  });

  it('search requires a query', async () => {
    mockChannel();

    await request(app).get('/api/channels/c1/search').expect(400);
  });

  it('search is scoped to the channel and case-insensitive', async () => {
    mockChannel();
    (prisma.channelMessage.findMany as any).mockResolvedValue([]);

    await request(app).get('/api/channels/c1/search?q=roster').expect(200);

    expect((prisma.channelMessage.findMany as any).mock.calls[0][0].where).toEqual({
      channelId: 'c1',
      content: { contains: 'roster', mode: 'insensitive' },
    });
  });

  it('only the owner may delete a channel', async () => {
    mockChannel();

    await request(app).delete('/api/channels/c1').set(as(MEMBER)).expect(403);
    expect(prisma.channel.delete).not.toHaveBeenCalled();
  });

  it('the owner deletes the channel and listeners are told', async () => {
    mockChannel();
    (prisma.channel.delete as any).mockResolvedValue({});

    await request(app).delete('/api/channels/c1').set(as(OWNER)).expect(200);

    expect(prisma.channel.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(emitToChannel).toHaveBeenCalledWith('c1', 'channels:deleted', { channelId: 'c1' });
  });

  it('typing broadcasts to the channel room', async () => {
    mockChannel();

    await request(app).post('/api/channels/c1/typing').set(as(MEMBER)).send({}).expect(200);

    expect(emitToChannel).toHaveBeenCalledWith('c1', 'channels:user_typing', {
      channelId: 'c1',
      userId: MEMBER,
    });
  });

  it('typing can signal that it stopped', async () => {
    mockChannel();

    await request(app)
      .post('/api/channels/c1/typing')
      .set(as(MEMBER))
      .send({ stopped: true })
      .expect(200);

    expect(emitToChannel).toHaveBeenCalledWith(
      'c1',
      'channels:user_stopped_typing',
      expect.anything()
    );
  });

  it('an outsider cannot broadcast typing into a private channel', async () => {
    mockChannel({ isPublic: false });
    (prisma.channelMember.findUnique as any).mockResolvedValue(null);

    await request(app).post('/api/channels/c1/typing').set(as(OUTSIDER)).send({}).expect(403);

    expect(emitToChannel).not.toHaveBeenCalled();
  });
});
