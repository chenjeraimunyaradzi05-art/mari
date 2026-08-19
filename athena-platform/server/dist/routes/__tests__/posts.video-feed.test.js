"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const globals_1 = require("@jest/globals");
globals_1.jest.mock('../../utils/prisma', () => ({
    prisma: {
        post: {
            findMany: globals_1.jest.fn(),
            update: globals_1.jest.fn(),
            findUnique: globals_1.jest.fn(),
        },
        like: {
            findMany: globals_1.jest.fn(),
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
    requireRole: (..._roles) => (_req, _res, next) => next(),
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
(0, globals_1.describe)('Posts video feed', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.it)('GET /api/posts/video-feed returns videos + nextCursor', async () => {
        const createdAt1 = new Date('2026-01-10T10:00:00.000Z');
        const createdAt2 = new Date('2026-01-09T10:00:00.000Z');
        // getVideoFeed uses take: limit+1; we provide 3 items for limit=2.
        prisma_1.prisma.post.findMany.mockResolvedValue([
            {
                id: 'p1',
                authorId: 'a1',
                type: 'VIDEO',
                content: 'v1',
                mediaUrls: ['u1'],
                likeCount: 1,
                commentCount: 0,
                shareCount: 0,
                viewCount: 5,
                createdAt: createdAt1,
                author: { id: 'a1', displayName: 'A1', avatar: null, headline: null },
            },
            {
                id: 'p2',
                authorId: 'a2',
                type: 'VIDEO',
                content: 'v2',
                mediaUrls: ['u2'],
                likeCount: 2,
                commentCount: 1,
                shareCount: 0,
                viewCount: 7,
                createdAt: createdAt2,
                author: { id: 'a2', displayName: 'A2', avatar: null, headline: null },
            },
            {
                id: 'p3',
                authorId: 'a3',
                type: 'VIDEO',
                content: 'v3',
                mediaUrls: ['u3'],
                likeCount: 0,
                commentCount: 0,
                shareCount: 0,
                viewCount: 1,
                createdAt: new Date('2026-01-08T10:00:00.000Z'),
                author: { id: 'a3', displayName: 'A3', avatar: null, headline: null },
            },
        ]);
        prisma_1.prisma.like.findMany.mockResolvedValue([{ postId: 'p2' }]);
        const res = await (0, supertest_1.default)(index_1.app)
            .get('/api/posts/video-feed?limit=2')
            .set('x-test-auth', '1')
            .expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data).toHaveLength(2);
        (0, globals_1.expect)(res.body.data[0].id).toBe('p1');
        (0, globals_1.expect)(res.body.data[1].id).toBe('p2');
        (0, globals_1.expect)(res.body.data[1].isLiked).toBe(true);
        (0, globals_1.expect)(res.body.nextCursor).toBe(createdAt2.toISOString());
        (0, globals_1.expect)(prisma_1.prisma.post.findMany).toHaveBeenCalledWith(globals_1.expect.objectContaining({
            where: globals_1.expect.objectContaining({ type: 'VIDEO' }),
            take: 3,
        }));
    });
    (0, globals_1.it)('POST /api/posts/:id/view returns 204 and increments viewCount', async () => {
        prisma_1.prisma.post.update.mockResolvedValue({ id: 'p1' });
        await (0, supertest_1.default)(index_1.app)
            .post('/api/posts/p1/view')
            .set('x-test-auth', '1')
            .expect(204);
        (0, globals_1.expect)(prisma_1.prisma.post.update).toHaveBeenCalledWith(globals_1.expect.objectContaining({
            where: { id: 'p1' },
            data: { viewCount: { increment: 1 } },
        }));
    });
    (0, globals_1.it)('POST /api/posts/:id/view returns 404 when post missing', async () => {
        const err = new Error('Record not found');
        err.code = 'P2025';
        prisma_1.prisma.post.update.mockRejectedValue(err);
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/posts/missing/view')
            .set('x-test-auth', '1')
            .expect(404);
        (0, globals_1.expect)(res.body.success).toBe(false);
    });
});
//# sourceMappingURL=posts.video-feed.test.js.map