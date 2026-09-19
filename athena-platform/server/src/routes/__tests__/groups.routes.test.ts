import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    group: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    groupMember: {
      create: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(async () => []),
      count: jest.fn(),
      update: jest.fn(),
    },
    groupJoinRequest: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    groupPost: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    post: {
      findMany: jest.fn(async () => []),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    conversation: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    like: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    postSave: { findMany: jest.fn(async () => []) },
    pollVote: { groupBy: jest.fn(async () => []), findMany: jest.fn(async () => []) },
    user: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    notification: { create: jest.fn(async () => ({ id: 'n1' })) },
  },
}));

jest.mock('../../services/moderation.service', () => ({
  assertContentAllowed: jest.fn(async () => undefined),
}));

jest.mock('../../services/link-preview.service', () => ({
  enrichPostLinkPreview: jest.fn(),
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-auth'] === '1') {
      req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
    }
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

// Notifications are fired after the response, never awaited into it.
const flush = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

const PRIVATE_GROUP = {
  id: 'g1',
  name: 'Founders Circle',
  privacy: 'PRIVATE',
  isHidden: false,
  createdById: 'seed',
  createdAt: new Date('2026-01-10T00:00:00.000Z'),
  _count: { members: 3 },
};

describe('Groups routes (Prisma-backed)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.groupMember.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue(null);
  });

  it('GET /api/groups (unauth) queries only PUBLIC groups', async () => {
    (prisma.group.findMany as any).mockResolvedValue([
      {
        id: 'g1',
        name: 'Women in Tech',
        description: 'Desc',
        privacy: 'PUBLIC',
        createdById: 'seed',
        createdAt: new Date('2026-01-10T00:00:00.000Z'),
        _count: { members: 5 },
      },
    ]);

    const res = await request(app).get('/api/groups').expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].privacy).toBe('public');

    expect(prisma.group.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ privacy: 'PUBLIC' }),
      })
    );
  });

  it('GET /api/groups tells a signed-in viewer which private groups she has asked to join', async () => {
    (prisma.group.findMany as any).mockResolvedValue([
      { ...PRIVATE_GROUP, description: 'Desc', members: [], joinRequests: [{ status: 'PENDING' }] },
    ]);

    const res = await request(app).get('/api/groups').set('x-test-auth', '1').expect(200);

    expect(res.body.data[0]).toMatchObject({ isMember: false, joinRequestStatus: 'pending' });
    // Banned rows are not members and are not counted.
    expect((prisma.group.findMany as any).mock.calls[0][0].include._count.select.members).toEqual({ where: { isBanned: false } });
  });

  it('POST /api/groups creates group and returns member view', async () => {
    (prisma.group.create as any).mockResolvedValue({
      id: 'g_new',
      name: 'New Group',
      description: 'Hello',
      privacy: 'PRIVATE',
      createdById: 'user-123',
      createdAt: new Date('2026-01-10T00:00:00.000Z'),
    });

    (prisma.groupMember.create as any).mockResolvedValue({ id: 'gm_1' });
    (prisma.groupMember.count as any).mockResolvedValue(1);

    (prisma.group.findUnique as any).mockResolvedValue({
      id: 'g_new',
      name: 'New Group',
      description: 'Hello',
      privacy: 'PRIVATE',
      createdById: 'user-123',
      createdAt: new Date('2026-01-10T00:00:00.000Z'),
      _count: { members: 1 },
      members: [{ role: 'ADMIN' }],
    });

    const res = await request(app)
      .post('/api/groups')
      .set('x-test-auth', '1')
      .send({ name: 'New Group', description: 'Hello', privacy: 'private' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('g_new');
    expect(res.body.data.privacy).toBe('private');
    expect(res.body.data.memberCount).toBe(1);
    expect(res.body.data.isMember).toBe(true);
    expect(res.body.data.adminCount).toBe(1);
  });

  it('GET /api/groups/:id shows a non-member where her request stands, and treats a banned row as no membership', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ ...PRIVATE_GROUP, members: [], joinRequests: [{ status: 'DENIED' }] });
    let res = await request(app).get('/api/groups/g1').set('x-test-auth', '1').expect(200);
    expect(res.body.data).toMatchObject({ isMember: false, role: null, joinRequestStatus: 'denied' });

    (prisma.group.findUnique as any).mockResolvedValue({ ...PRIVATE_GROUP, members: [{ role: 'MODERATOR', isBanned: true }], joinRequests: [] });
    res = await request(app).get('/api/groups/g1').set('x-test-auth', '1').expect(200);
    expect(res.body.data).toMatchObject({ isMember: false, role: null });
  });

  it('POST /api/groups/:id/join returns 202 and creates join request for private group', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PRIVATE', isHidden: false });
    (prisma.groupMember.findUnique as any).mockResolvedValue(null);
    (prisma.groupJoinRequest.findUnique as any).mockResolvedValue(null);
    (prisma.groupJoinRequest.upsert as any).mockResolvedValue({ id: 'r1', status: 'PENDING' });

    const res = await request(app)
      .post('/api/groups/g1/join')
      .set('x-test-auth', '1')
      .send({})
      .expect(202);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pending');
    expect(prisma.groupJoinRequest.upsert).toHaveBeenCalled();
    expect(prisma.groupMember.upsert).not.toHaveBeenCalled();
  });

  it('POST /api/groups/:id/join tells the admins and moderators, with a link to the requests tab', async () => {
    (prisma.group.findUnique as any).mockResolvedValue(PRIVATE_GROUP);
    (prisma.groupMember.findUnique as any).mockResolvedValue(null);
    (prisma.groupJoinRequest.findUnique as any).mockResolvedValue(null);
    (prisma.groupJoinRequest.upsert as any).mockResolvedValue({ id: 'r1', status: 'PENDING' });
    prisma.groupMember.findMany.mockResolvedValue([{ userId: 'admin-1' }, { userId: 'mod-1' }]);

    await request(app).post('/api/groups/g1/join').set('x-test-auth', '1').send({}).expect(202);
    await flush();

    expect(prisma.groupMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ groupId: 'g1', role: { in: ['ADMIN', 'MODERATOR'] }, isBanned: false }) })
    );
    const sentTo = (prisma.notification.create as any).mock.calls.map((call: any) => call[0].data);
    expect(sentTo).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'admin-1', link: '/dashboard/groups/g1?tab=requests', message: expect.stringContaining('Founders Circle') }),
        expect.objectContaining({ userId: 'mod-1', link: '/dashboard/groups/g1?tab=requests' }),
      ])
    );
  });

  it('POST /api/groups/:id/join does not quietly re-open a request declined this month', async () => {
    (prisma.group.findUnique as any).mockResolvedValue(PRIVATE_GROUP);
    (prisma.groupMember.findUnique as any).mockResolvedValue(null);
    (prisma.groupJoinRequest.findUnique as any).mockResolvedValue({ id: 'r1', status: 'DENIED', reviewedAt: new Date() });

    const res = await request(app).post('/api/groups/g1/join').set('x-test-auth', '1').send({}).expect(400);

    expect(res.body.message).toMatch(/wasn't approved/);
    expect(prisma.groupJoinRequest.upsert).not.toHaveBeenCalled();
  });

  it('a banned member cannot lift her ban by leaving and rejoining', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ ...PRIVATE_GROUP, privacy: 'PUBLIC', members: [{ role: 'MEMBER', isBanned: true }] });
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'MEMBER', isBanned: true });

    // Leave keeps the banned row rather than deleting it.
    const left = await request(app).post('/api/groups/g1/leave').set('x-test-auth', '1').send({}).expect(200);
    expect(prisma.groupMember.delete).not.toHaveBeenCalled();
    expect(left.body.data.isMember).toBe(false);

    // Join reads the row and refuses.
    const res = await request(app).post('/api/groups/g1/join').set('x-test-auth', '1').send({}).expect(403);
    expect(res.body.message).toBe('You cannot join this group');
    expect(prisma.groupMember.upsert).not.toHaveBeenCalled();
    expect(prisma.groupJoinRequest.upsert).not.toHaveBeenCalled();
  });

  it('POST /api/groups/:id/leave refuses the last admin while other members remain', async () => {
    (prisma.group.findUnique as any).mockResolvedValue(PRIVATE_GROUP);
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'ADMIN', isBanned: false });
    // other members, then admins
    (prisma.groupMember.count as any).mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const res = await request(app).post('/api/groups/g1/leave').set('x-test-auth', '1').send({}).expect(400);

    expect(res.body.message).toBe('Make someone else an admin before you leave');
    expect(prisma.groupMember.delete).not.toHaveBeenCalled();
  });

  it('POST /api/groups/:id/leave lets the only member go, and an admin who is not the last', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ ...PRIVATE_GROUP, members: [] });
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'ADMIN', isBanned: false });
    (prisma.groupMember.delete as any).mockResolvedValue({});

    // Alone in the group: nobody is orphaned.
    (prisma.groupMember.count as any).mockResolvedValueOnce(0);
    await request(app).post('/api/groups/g1/leave').set('x-test-auth', '1').send({}).expect(200);
    expect(prisma.groupMember.delete).toHaveBeenCalledTimes(1);

    // Two admins: she may go.
    (prisma.groupMember.count as any).mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    await request(app).post('/api/groups/g1/leave').set('x-test-auth', '1').send({}).expect(200);
    expect(prisma.groupMember.delete).toHaveBeenCalledTimes(2);
  });

  it('POST /api/groups/:id/join-requests/:requestId/approve approves request, upserts membership and tells the requester', async () => {
    (prisma.group.findUnique as any).mockResolvedValue(PRIVATE_GROUP);

    // actor role lookup => allow
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'MODERATOR', isBanned: false });

    // transaction wrapper returns whatever callback returns
    (prisma.$transaction as any).mockImplementation(async (cb: any) => {
      const tx: any = {
        groupJoinRequest: {
          findUnique: (jest.fn() as any).mockResolvedValue({ id: 'r1', groupId: 'g1', userId: 'user-999', status: 'PENDING' }),
          update: (jest.fn() as any).mockResolvedValue({ id: 'r1', groupId: 'g1', userId: 'user-999', status: 'APPROVED' }),
        },
        groupMember: {
          upsert: (jest.fn() as any).mockResolvedValue({ id: 'gm_new' }),
        },
      };
      return await cb(tx);
    });

    const res = await request(app)
      .post('/api/groups/g1/join-requests/r1/approve')
      .set('x-test-auth', '1')
      .send({})
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('APPROVED');
    expect(prisma.$transaction).toHaveBeenCalled();

    await flush();
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-999', link: '/dashboard/groups/g1', title: "You're in" }) })
    );
  });

  it('POST /api/groups/:id/join-requests/:requestId/deny tells the requester gently', async () => {
    (prisma.group.findUnique as any).mockResolvedValue(PRIVATE_GROUP);
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'ADMIN', isBanned: false });
    (prisma.$transaction as any).mockImplementation(async (cb: any) =>
      cb({
        groupJoinRequest: {
          findUnique: (jest.fn() as any).mockResolvedValue({ id: 'r1', groupId: 'g1', userId: 'user-999', status: 'PENDING' }),
          update: (jest.fn() as any).mockResolvedValue({ id: 'r1', groupId: 'g1', userId: 'user-999', status: 'DENIED' }),
        },
        groupMember: { upsert: jest.fn() },
      })
    );

    await request(app).post('/api/groups/g1/join-requests/r1/deny').set('x-test-auth', '1').send({}).expect(200);
    await flush();

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-999', message: expect.stringContaining("wasn't approved this time") }) })
    );
  });

  it('GET /api/groups/:id/join-request returns status none when no request exists', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PRIVATE', isHidden: false });
    (prisma.groupMember.findUnique as any).mockResolvedValue(null);
    (prisma.groupJoinRequest.findUnique as any).mockResolvedValue(null);

    const res = await request(app)
      .get('/api/groups/g1/join-request')
      .set('x-test-auth', '1')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('none');
  });

  it('GET /api/groups/:id/join-request returns pending when request exists', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PRIVATE', isHidden: false });
    (prisma.groupMember.findUnique as any).mockResolvedValue(null);
    (prisma.groupJoinRequest.findUnique as any).mockResolvedValue({
      id: 'r1',
      status: 'PENDING',
      createdAt: new Date('2026-01-10T00:00:00.000Z'),
      reviewedAt: null,
    });

    const res = await request(app)
      .get('/api/groups/g1/join-request')
      .set('x-test-auth', '1')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.id).toBe('r1');
  });

  it('DELETE /api/groups/:id/join-request cancels pending request', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PRIVATE', isHidden: false });
    (prisma.groupJoinRequest.findUnique as any).mockResolvedValue({ id: 'r1', status: 'PENDING' });
    (prisma.groupJoinRequest.delete as any).mockResolvedValue({ id: 'r1' });

    const res = await request(app)
      .delete('/api/groups/g1/join-request')
      .set('x-test-auth', '1')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('cancelled');
    expect(prisma.groupJoinRequest.delete).toHaveBeenCalled();
  });

  it('PATCH /api/groups/:id lets a group admin change the name, description and privacy, and nobody else', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ ...PRIVATE_GROUP, members: [{ role: 'ADMIN', isBanned: false }] });
    (prisma.groupMember.count as any).mockResolvedValue(1);
    (prisma.group.update as any).mockResolvedValue({});

    // A moderator is refused before anything is written.
    (prisma.groupMember.findUnique as any).mockResolvedValueOnce({ role: 'MODERATOR', isBanned: false });
    await request(app).patch('/api/groups/g1').set('x-test-auth', '1').send({ name: 'Renamed' }).expect(403);
    expect(prisma.group.update).not.toHaveBeenCalled();

    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'ADMIN', isBanned: false });
    const res = await request(app)
      .patch('/api/groups/g1')
      .set('x-test-auth', '1')
      .send({ name: 'Renamed', description: 'A fresh purpose', privacy: 'public', isFeatured: true })
      .expect(200);

    expect(res.body.success).toBe(true);
    // Featuring stays with the operator console; it is not written from here.
    expect(prisma.group.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { name: 'Renamed', description: 'A fresh purpose', privacy: 'PUBLIC' },
    });

    await request(app).patch('/api/groups/g1').set('x-test-auth', '1').send({ privacy: 'secret' }).expect(400);
  });

  it('DELETE /api/groups/:id closes the group for a group admin, chat row included', async () => {
    (prisma.group.findUnique as any).mockResolvedValue(PRIVATE_GROUP);
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'ADMIN', isBanned: false });
    (prisma.group.delete as any).mockResolvedValue({});

    await request(app).delete('/api/groups/g1').set('x-test-auth', '1').expect(200);

    expect(prisma.group.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
    expect(prisma.conversation.deleteMany).toHaveBeenCalledWith({ where: { id: 'g1' } });

    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'MEMBER', isBanned: false });
    await request(app).delete('/api/groups/g1').set('x-test-auth', '1').expect(403);
    expect(prisma.group.delete).toHaveBeenCalledTimes(1);
  });

  it('POST /api/groups/:id/posts returns 403 when not a member', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PUBLIC' });
    (prisma.groupMember.findUnique as any).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/groups/g1/posts')
      .set('x-test-auth', '1')
      .send({ content: 'hi' })
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  it('POST /api/groups/:id/posts creates post when member', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PUBLIC' });
    (prisma.groupMember.findUnique as any).mockResolvedValue({ id: 'gm_1' });
    (prisma.post.create as any).mockResolvedValue({
      id: 'gp_1',
      groupId: 'g1',
      authorId: 'user-123',
      content: 'Hello group',
      poll: null,
      createdAt: new Date('2026-01-10T00:00:00.000Z'),
      author: { id: 'user-123', displayName: 'Member' },
    });

    const res = await request(app)
      .post('/api/groups/g1/posts')
      .set('x-test-auth', '1')
      .send({ content: 'Hello group' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('gp_1');
    expect(res.body.data.content).toBe('Hello group');
    expect((prisma.post.create as any).mock.calls[0][0].data).toMatchObject({ groupId: 'g1', authorId: 'user-123', content: 'Hello group', isPublic: true });
  });

  it('GET /api/groups/:id/posts keeps a private group’s posts for its members', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PRIVATE', isHidden: false });
    (prisma.groupMember.findUnique as any).mockResolvedValue(null);
    await request(app).get('/api/groups/g1/posts').set('x-test-auth', '1').expect(403);

    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'MEMBER' });
    (prisma.post.findMany as any).mockResolvedValue([{ id: 'p1', groupId: 'g1', content: 'inside', poll: null, author: { id: 'a' } }]);
    const res = await request(app).get('/api/groups/g1/posts').set('x-test-auth', '1').expect(200);
    expect(res.body.data[0]).toMatchObject({ id: 'p1', content: 'inside', isLiked: false });
    expect((prisma.post.findMany as any).mock.calls[0][0].where).toEqual({ groupId: 'g1', isHidden: false });
  });

  it('DELETE /api/groups/:id/posts/:postId returns 403 when not moderator/admin', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PUBLIC', isHidden: false });
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'MEMBER' });
    (prisma.post.findUnique as any).mockResolvedValue({ id: 'gp_1', groupId: 'g1', authorId: 'other-user' });

    const res = await request(app)
      .delete('/api/groups/g1/posts/gp_1')
      .set('x-test-auth', '1')
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/groups/:id/posts/:postId succeeds for post author (member)', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PUBLIC', isHidden: false });
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'MEMBER' });
    (prisma.post.findUnique as any).mockResolvedValue({ id: 'gp_1', groupId: 'g1', authorId: 'user-123' });
    (prisma.post.delete as any).mockResolvedValue({ id: 'gp_1' });

    const res = await request(app)
      .delete('/api/groups/g1/posts/gp_1')
      .set('x-test-auth', '1')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(prisma.post.delete).toHaveBeenCalled();
  });

  it('DELETE /api/groups/:id/posts/:postId succeeds for moderator', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PUBLIC', isHidden: false });
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'MODERATOR' });
    (prisma.post.findUnique as any).mockResolvedValue({ id: 'gp_1', groupId: 'g1' });
    (prisma.post.delete as any).mockResolvedValue({ id: 'gp_1' });

    const res = await request(app)
      .delete('/api/groups/g1/posts/gp_1')
      .set('x-test-auth', '1')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(prisma.post.delete).toHaveBeenCalled();
  });

  it('DELETE /api/groups/:id/members/:userId removes the member and tells her', async () => {
    (prisma.group.findUnique as any).mockResolvedValue(PRIVATE_GROUP);
    (prisma.groupMember.findUnique as any)
      .mockResolvedValueOnce({ role: 'ADMIN', isBanned: false }) // actor
      .mockResolvedValueOnce({ role: 'MEMBER' }); // target
    (prisma.groupMember.delete as any).mockResolvedValue({});

    await request(app).delete('/api/groups/g1/members/user-999').set('x-test-auth', '1').expect(200);
    await flush();

    expect(prisma.groupMember.delete).toHaveBeenCalledWith({ where: { groupId_userId: { groupId: 'g1', userId: 'user-999' } } });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-999', message: 'You were removed from Founders Circle.' }) })
    );
  });

  // Role changes go through the one /role handler (group-chat.routes.ts ->
  // groupChatService.updateMemberRole); the duplicate PATCH without /role
  // was retired, so its two cases moved onto this contract.
  it('PATCH /api/groups/:id/members/:userId/role returns 403 for a moderator', async () => {
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'MODERATOR', isBanned: false, group: { allowMemberInvites: true } });

    const res = await request(app)
      .patch('/api/groups/g1/members/user-999/role')
      .set('x-test-auth', '1')
      .send({ role: 'MODERATOR' })
      .expect(403);

    expect(res.body.success).toBe(false);
    expect(prisma.groupMember.update).not.toHaveBeenCalled();
  });

  it('PATCH /api/groups/:id/members/:userId/role updates role for admin', async () => {
    // 1) actor role lookup
    (prisma.groupMember.findUnique as any)
      .mockResolvedValueOnce({ role: 'ADMIN', isBanned: false, group: { allowMemberInvites: true } })
      // 2) target membership lookup
      .mockResolvedValueOnce({ role: 'MEMBER', isBanned: false });

    (prisma.groupMember.update as any).mockResolvedValue({ groupId: 'g1', userId: 'user-999', role: 'MODERATOR' });

    const res = await request(app)
      .patch('/api/groups/g1/members/user-999/role')
      .set('x-test-auth', '1')
      .send({ role: 'MODERATOR' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('MODERATOR');
    expect(prisma.groupMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { groupId_userId: { groupId: 'g1', userId: 'user-999' } },
        data: { role: 'MODERATOR' },
      })
    );
  });

  it('PATCH /api/groups/:id/members/:userId/role will not demote the last admin', async () => {
    (prisma.groupMember.findUnique as any)
      .mockResolvedValueOnce({ role: 'ADMIN', isBanned: false, group: { allowMemberInvites: true } })
      .mockResolvedValueOnce({ role: 'ADMIN', isBanned: false });
    (prisma.groupMember.count as any).mockResolvedValue(1);

    const res = await request(app)
      .patch('/api/groups/g1/members/user-999/role')
      .set('x-test-auth', '1')
      .send({ role: 'MEMBER' })
      .expect(400);

    expect(res.body.message).toBe('Group must have at least one admin');
    expect(prisma.groupMember.update).not.toHaveBeenCalled();
  });
});
