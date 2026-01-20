import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    group: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    groupMember: {
      create: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
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
  },
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

describe('Groups routes (Prisma-backed)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
  });

  it('POST /api/groups/:id/join returns 202 and creates join request for private group', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PRIVATE', isHidden: false });
    (prisma.groupMember.findUnique as any).mockResolvedValue(null);
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

  it('POST /api/groups/:id/join-requests/:requestId/approve approves request and upserts membership for moderator/admin', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PRIVATE', isHidden: false });

    // actor role lookup => allow
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'MODERATOR' });

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
    (prisma.groupPost.create as any).mockResolvedValue({
      id: 'gp_1',
      groupId: 'g1',
      authorId: 'user-123',
      content: 'Hello group',
      createdAt: new Date('2026-01-10T00:00:00.000Z'),
    });

    const res = await request(app)
      .post('/api/groups/g1/posts')
      .set('x-test-auth', '1')
      .send({ content: 'Hello group' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('gp_1');
    expect(res.body.data.content).toBe('Hello group');
  });

  it('DELETE /api/groups/:id/posts/:postId returns 403 when not moderator/admin', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PUBLIC', isHidden: false });
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'MEMBER' });
    (prisma.groupPost.findUnique as any).mockResolvedValue({ id: 'gp_1', groupId: 'g1', authorId: 'other-user' });

    const res = await request(app)
      .delete('/api/groups/g1/posts/gp_1')
      .set('x-test-auth', '1')
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/groups/:id/posts/:postId succeeds for post author (member)', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PUBLIC', isHidden: false });
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'MEMBER' });
    (prisma.groupPost.findUnique as any).mockResolvedValue({ id: 'gp_1', groupId: 'g1', authorId: 'user-123' });
    (prisma.groupPost.delete as any).mockResolvedValue({ id: 'gp_1' });

    const res = await request(app)
      .delete('/api/groups/g1/posts/gp_1')
      .set('x-test-auth', '1')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(prisma.groupPost.delete).toHaveBeenCalled();
  });

  it('DELETE /api/groups/:id/posts/:postId succeeds for moderator', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PUBLIC', isHidden: false });
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'MODERATOR' });
    (prisma.groupPost.findUnique as any).mockResolvedValue({ id: 'gp_1', groupId: 'g1' });
    (prisma.groupPost.delete as any).mockResolvedValue({ id: 'gp_1' });

    const res = await request(app)
      .delete('/api/groups/g1/posts/gp_1')
      .set('x-test-auth', '1')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(prisma.groupPost.delete).toHaveBeenCalled();
  });

  it('PATCH /api/groups/:id/members/:userId returns 403 for non-admin', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PUBLIC', isHidden: false });
    (prisma.groupMember.findUnique as any).mockResolvedValue({ role: 'MODERATOR' });

    const res = await request(app)
      .patch('/api/groups/g1/members/user-999')
      .set('x-test-auth', '1')
      .send({ role: 'moderator' })
      .expect(403);

    expect(res.body.success).toBe(false);
  });

  it('PATCH /api/groups/:id/members/:userId updates role for admin', async () => {
    (prisma.group.findUnique as any).mockResolvedValue({ id: 'g1', privacy: 'PUBLIC', isHidden: false });

    // 1) actor role lookup
    (prisma.groupMember.findUnique as any)
      .mockResolvedValueOnce({ role: 'ADMIN' })
      // 2) target membership lookup
      .mockResolvedValueOnce({ role: 'MEMBER' });

    (prisma.groupMember.update as any).mockResolvedValue({ groupId: 'g1', userId: 'user-999', role: 'MODERATOR' });

    const res = await request(app)
      .patch('/api/groups/g1/members/user-999')
      .set('x-test-auth', '1')
      .send({ role: 'moderator' })
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
});
