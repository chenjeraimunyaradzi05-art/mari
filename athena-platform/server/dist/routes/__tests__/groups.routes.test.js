"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const globals_1 = require("@jest/globals");
globals_1.jest.mock('../../utils/prisma', () => ({
    prisma: {
        $transaction: globals_1.jest.fn(),
        group: {
            findMany: globals_1.jest.fn(),
            findUnique: globals_1.jest.fn(),
            create: globals_1.jest.fn(),
        },
        groupMember: {
            create: globals_1.jest.fn(),
            upsert: globals_1.jest.fn(),
            delete: globals_1.jest.fn(),
            findUnique: globals_1.jest.fn(),
            count: globals_1.jest.fn(),
            update: globals_1.jest.fn(),
        },
        groupJoinRequest: {
            upsert: globals_1.jest.fn(),
            findMany: globals_1.jest.fn(),
            findUnique: globals_1.jest.fn(),
            update: globals_1.jest.fn(),
            delete: globals_1.jest.fn(),
        },
        groupPost: {
            findMany: globals_1.jest.fn(),
            create: globals_1.jest.fn(),
            findUnique: globals_1.jest.fn(),
            delete: globals_1.jest.fn(),
        },
    },
}));
globals_1.jest.mock('../../middleware/auth', () => ({
    authenticate: (req, _res, next) => {
        req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
        next();
    },
    optionalAuth: (req, _res, next) => {
        if (req.headers['x-test-auth'] === '1') {
            req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
        }
        next();
    },
    requireRole: (..._roles) => (_req, __res, next) => next(),
    requirePremium: (_req, _res, next) => next(),
}));
globals_1.jest.mock('../../utils/logger', () => ({
    logger: {
        debug: globals_1.jest.fn(),
        info: globals_1.jest.fn(),
        warn: globals_1.jest.fn(),
        error: globals_1.jest.fn(),
    },
}));
const index_1 = require("../../index");
const prisma_1 = require("../../utils/prisma");
const prisma = prisma_1.prisma;
(0, globals_1.describe)('Groups routes (Prisma-backed)', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.it)('GET /api/groups (unauth) queries only PUBLIC groups', async () => {
        prisma.group.findMany.mockResolvedValue([
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
        const res = await (0, supertest_1.default)(index_1.app).get('/api/groups').expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(Array.isArray(res.body.data)).toBe(true);
        (0, globals_1.expect)(res.body.data[0].privacy).toBe('public');
        (0, globals_1.expect)(prisma.group.findMany).toHaveBeenCalledWith(globals_1.expect.objectContaining({
            where: globals_1.expect.objectContaining({ privacy: 'PUBLIC' }),
        }));
    });
    (0, globals_1.it)('POST /api/groups creates group and returns member view', async () => {
        prisma.group.create.mockResolvedValue({
            id: 'g_new',
            name: 'New Group',
            description: 'Hello',
            privacy: 'PRIVATE',
            createdById: 'user-123',
            createdAt: new Date('2026-01-10T00:00:00.000Z'),
        });
        prisma.groupMember.create.mockResolvedValue({ id: 'gm_1' });
        prisma.group.findUnique.mockResolvedValue({
            id: 'g_new',
            name: 'New Group',
            description: 'Hello',
            privacy: 'PRIVATE',
            createdById: 'user-123',
            createdAt: new Date('2026-01-10T00:00:00.000Z'),
            _count: { members: 1 },
            members: [{ role: 'ADMIN' }],
        });
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/groups')
            .set('x-test-auth', '1')
            .send({ name: 'New Group', description: 'Hello', privacy: 'private' })
            .expect(201);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data.id).toBe('g_new');
        (0, globals_1.expect)(res.body.data.privacy).toBe('private');
        (0, globals_1.expect)(res.body.data.memberCount).toBe(1);
        (0, globals_1.expect)(res.body.data.isMember).toBe(true);
    });
    (0, globals_1.it)('POST /api/groups/:id/join returns 202 and creates join request for private group', async () => {
        prisma.group.findUnique.mockResolvedValue({ id: 'g1', privacy: 'PRIVATE', isHidden: false });
        prisma.groupMember.findUnique.mockResolvedValue(null);
        prisma.groupJoinRequest.upsert.mockResolvedValue({ id: 'r1', status: 'PENDING' });
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/groups/g1/join')
            .set('x-test-auth', '1')
            .send({})
            .expect(202);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data.status).toBe('pending');
        (0, globals_1.expect)(prisma.groupJoinRequest.upsert).toHaveBeenCalled();
        (0, globals_1.expect)(prisma.groupMember.upsert).not.toHaveBeenCalled();
    });
    (0, globals_1.it)('POST /api/groups/:id/join-requests/:requestId/approve approves request and upserts membership for moderator/admin', async () => {
        prisma.group.findUnique.mockResolvedValue({ id: 'g1', privacy: 'PRIVATE', isHidden: false });
        // actor role lookup => allow
        prisma.groupMember.findUnique.mockResolvedValue({ role: 'MODERATOR' });
        // transaction wrapper returns whatever callback returns
        prisma.$transaction.mockImplementation(async (cb) => {
            const tx = {
                groupJoinRequest: {
                    findUnique: globals_1.jest.fn().mockResolvedValue({ id: 'r1', groupId: 'g1', userId: 'user-999', status: 'PENDING' }),
                    update: globals_1.jest.fn().mockResolvedValue({ id: 'r1', groupId: 'g1', userId: 'user-999', status: 'APPROVED' }),
                },
                groupMember: {
                    upsert: globals_1.jest.fn().mockResolvedValue({ id: 'gm_new' }),
                },
            };
            return await cb(tx);
        });
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/groups/g1/join-requests/r1/approve')
            .set('x-test-auth', '1')
            .send({})
            .expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data.status).toBe('APPROVED');
        (0, globals_1.expect)(prisma.$transaction).toHaveBeenCalled();
    });
    (0, globals_1.it)('GET /api/groups/:id/join-request returns status none when no request exists', async () => {
        prisma.group.findUnique.mockResolvedValue({ id: 'g1', privacy: 'PRIVATE', isHidden: false });
        prisma.groupMember.findUnique.mockResolvedValue(null);
        prisma.groupJoinRequest.findUnique.mockResolvedValue(null);
        const res = await (0, supertest_1.default)(index_1.app)
            .get('/api/groups/g1/join-request')
            .set('x-test-auth', '1')
            .expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data.status).toBe('none');
    });
    (0, globals_1.it)('GET /api/groups/:id/join-request returns pending when request exists', async () => {
        prisma.group.findUnique.mockResolvedValue({ id: 'g1', privacy: 'PRIVATE', isHidden: false });
        prisma.groupMember.findUnique.mockResolvedValue(null);
        prisma.groupJoinRequest.findUnique.mockResolvedValue({
            id: 'r1',
            status: 'PENDING',
            createdAt: new Date('2026-01-10T00:00:00.000Z'),
            reviewedAt: null,
        });
        const res = await (0, supertest_1.default)(index_1.app)
            .get('/api/groups/g1/join-request')
            .set('x-test-auth', '1')
            .expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data.status).toBe('pending');
        (0, globals_1.expect)(res.body.data.id).toBe('r1');
    });
    (0, globals_1.it)('DELETE /api/groups/:id/join-request cancels pending request', async () => {
        prisma.group.findUnique.mockResolvedValue({ id: 'g1', privacy: 'PRIVATE', isHidden: false });
        prisma.groupJoinRequest.findUnique.mockResolvedValue({ id: 'r1', status: 'PENDING' });
        prisma.groupJoinRequest.delete.mockResolvedValue({ id: 'r1' });
        const res = await (0, supertest_1.default)(index_1.app)
            .delete('/api/groups/g1/join-request')
            .set('x-test-auth', '1')
            .expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data.status).toBe('cancelled');
        (0, globals_1.expect)(prisma.groupJoinRequest.delete).toHaveBeenCalled();
    });
    (0, globals_1.it)('POST /api/groups/:id/posts returns 403 when not a member', async () => {
        prisma.group.findUnique.mockResolvedValue({ id: 'g1', privacy: 'PUBLIC' });
        prisma.groupMember.findUnique.mockResolvedValue(null);
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/groups/g1/posts')
            .set('x-test-auth', '1')
            .send({ content: 'hi' })
            .expect(403);
        (0, globals_1.expect)(res.body.success).toBe(false);
    });
    (0, globals_1.it)('POST /api/groups/:id/posts creates post when member', async () => {
        prisma.group.findUnique.mockResolvedValue({ id: 'g1', privacy: 'PUBLIC' });
        prisma.groupMember.findUnique.mockResolvedValue({ id: 'gm_1' });
        prisma.groupPost.create.mockResolvedValue({
            id: 'gp_1',
            groupId: 'g1',
            authorId: 'user-123',
            content: 'Hello group',
            createdAt: new Date('2026-01-10T00:00:00.000Z'),
        });
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/groups/g1/posts')
            .set('x-test-auth', '1')
            .send({ content: 'Hello group' })
            .expect(201);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data.id).toBe('gp_1');
        (0, globals_1.expect)(res.body.data.content).toBe('Hello group');
    });
    (0, globals_1.it)('DELETE /api/groups/:id/posts/:postId returns 403 when not moderator/admin', async () => {
        prisma.group.findUnique.mockResolvedValue({ id: 'g1', privacy: 'PUBLIC', isHidden: false });
        prisma.groupMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
        prisma.groupPost.findUnique.mockResolvedValue({ id: 'gp_1', groupId: 'g1', authorId: 'other-user' });
        const res = await (0, supertest_1.default)(index_1.app)
            .delete('/api/groups/g1/posts/gp_1')
            .set('x-test-auth', '1')
            .expect(403);
        (0, globals_1.expect)(res.body.success).toBe(false);
    });
    (0, globals_1.it)('DELETE /api/groups/:id/posts/:postId succeeds for post author (member)', async () => {
        prisma.group.findUnique.mockResolvedValue({ id: 'g1', privacy: 'PUBLIC', isHidden: false });
        prisma.groupMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
        prisma.groupPost.findUnique.mockResolvedValue({ id: 'gp_1', groupId: 'g1', authorId: 'user-123' });
        prisma.groupPost.delete.mockResolvedValue({ id: 'gp_1' });
        const res = await (0, supertest_1.default)(index_1.app)
            .delete('/api/groups/g1/posts/gp_1')
            .set('x-test-auth', '1')
            .expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(prisma.groupPost.delete).toHaveBeenCalled();
    });
    (0, globals_1.it)('DELETE /api/groups/:id/posts/:postId succeeds for moderator', async () => {
        prisma.group.findUnique.mockResolvedValue({ id: 'g1', privacy: 'PUBLIC', isHidden: false });
        prisma.groupMember.findUnique.mockResolvedValue({ role: 'MODERATOR' });
        prisma.groupPost.findUnique.mockResolvedValue({ id: 'gp_1', groupId: 'g1' });
        prisma.groupPost.delete.mockResolvedValue({ id: 'gp_1' });
        const res = await (0, supertest_1.default)(index_1.app)
            .delete('/api/groups/g1/posts/gp_1')
            .set('x-test-auth', '1')
            .expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(prisma.groupPost.delete).toHaveBeenCalled();
    });
    (0, globals_1.it)('PATCH /api/groups/:id/members/:userId returns 403 for non-admin', async () => {
        prisma.group.findUnique.mockResolvedValue({ id: 'g1', privacy: 'PUBLIC', isHidden: false });
        prisma.groupMember.findUnique.mockResolvedValue({ role: 'MODERATOR' });
        const res = await (0, supertest_1.default)(index_1.app)
            .patch('/api/groups/g1/members/user-999')
            .set('x-test-auth', '1')
            .send({ role: 'moderator' })
            .expect(403);
        (0, globals_1.expect)(res.body.success).toBe(false);
    });
    (0, globals_1.it)('PATCH /api/groups/:id/members/:userId updates role for admin', async () => {
        prisma.group.findUnique.mockResolvedValue({ id: 'g1', privacy: 'PUBLIC', isHidden: false });
        // 1) actor role lookup
        prisma.groupMember.findUnique
            .mockResolvedValueOnce({ role: 'ADMIN' })
            // 2) target membership lookup
            .mockResolvedValueOnce({ role: 'MEMBER' });
        prisma.groupMember.update.mockResolvedValue({ groupId: 'g1', userId: 'user-999', role: 'MODERATOR' });
        const res = await (0, supertest_1.default)(index_1.app)
            .patch('/api/groups/g1/members/user-999')
            .set('x-test-auth', '1')
            .send({ role: 'moderator' })
            .expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data.role).toBe('MODERATOR');
        (0, globals_1.expect)(prisma.groupMember.update).toHaveBeenCalledWith(globals_1.expect.objectContaining({
            where: { groupId_userId: { groupId: 'g1', userId: 'user-999' } },
            data: { role: 'MODERATOR' },
        }));
    });
});
//# sourceMappingURL=groups.routes.test.js.map