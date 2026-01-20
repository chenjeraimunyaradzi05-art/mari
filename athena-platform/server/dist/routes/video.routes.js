"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
function parseLimit(value, fallback = 20, max = 50) {
    const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
    if (Number.isNaN(parsed) || parsed <= 0)
        return fallback;
    return Math.min(parsed, max);
}
// ===========================================
// VIDEO FEED
// ===========================================
router.get('/feed', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 50);
        const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
        const type = typeof req.query.type === 'string' ? req.query.type : undefined;
        const where = {
            status: 'PUBLISHED',
            isHidden: false,
        };
        if (type) {
            where.type = type;
        }
        const videos = await prisma_1.prisma.video.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            cursor: cursor ? { id: cursor } : undefined,
            skip: cursor ? 1 : 0,
            take: limit + 1,
            include: {
                author: {
                    select: { id: true, displayName: true, avatar: true, headline: true },
                },
            },
        });
        const hasMore = videos.length > limit;
        const result = hasMore ? videos.slice(0, limit) : videos;
        const nextCursor = hasMore ? result[result.length - 1]?.id : null;
        res.json({
            success: true,
            data: result,
            nextCursor,
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET VIDEO BY ID
// ===========================================
router.get('/:id', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const video = await prisma_1.prisma.video.findUnique({
            where: { id },
            include: {
                author: { select: { id: true, displayName: true, avatar: true, headline: true } },
            },
        });
        if (!video || video.isHidden) {
            throw new errorHandler_1.ApiError(404, 'Video not found');
        }
        res.json({ success: true, data: video });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// CREATE VIDEO
// ===========================================
router.post('/', auth_1.authenticate, [
    (0, express_validator_1.body)('videoUrl').isString().notEmpty(),
    (0, express_validator_1.body)('title').optional().isString(),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('type').optional().isIn(['REEL', 'STORY', 'TUTORIAL', 'CAREER_STORY', 'MENTOR_TIP', 'LIVE_REPLAY']),
    (0, express_validator_1.body)('thumbnailUrl').optional().isString(),
    (0, express_validator_1.body)('duration').optional().isInt({ min: 1 }),
    (0, express_validator_1.body)('aspectRatio').optional().isString(),
    (0, express_validator_1.body)('hashtags').optional().isArray(),
    (0, express_validator_1.body)('mentionedUserIds').optional().isArray(),
    (0, express_validator_1.body)('location').optional().isString(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const created = await prisma_1.prisma.video.create({
            data: {
                authorId: req.user.id,
                title: req.body.title,
                description: req.body.description,
                type: req.body.type,
                status: 'PUBLISHED',
                videoUrl: req.body.videoUrl,
                thumbnailUrl: req.body.thumbnailUrl,
                duration: req.body.duration,
                aspectRatio: req.body.aspectRatio,
                hashtags: req.body.hashtags || [],
                mentionedUserIds: req.body.mentionedUserIds || [],
                location: req.body.location,
                publishedAt: new Date(),
            },
        });
        res.status(201).json({ success: true, data: created });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPDATE VIDEO
// ===========================================
router.patch('/:id', auth_1.authenticate, [
    (0, express_validator_1.body)('title').optional().isString(),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('status').optional().isIn(['PROCESSING', 'PUBLISHED', 'HIDDEN', 'REMOVED']),
    (0, express_validator_1.body)('type').optional().isIn(['REEL', 'STORY', 'TUTORIAL', 'CAREER_STORY', 'MENTOR_TIP', 'LIVE_REPLAY']),
    (0, express_validator_1.body)('thumbnailUrl').optional().isString(),
    (0, express_validator_1.body)('hashtags').optional().isArray(),
    (0, express_validator_1.body)('mentionedUserIds').optional().isArray(),
    (0, express_validator_1.body)('location').optional().isString(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { id } = req.params;
        const existing = await prisma_1.prisma.video.findUnique({ where: { id } });
        if (!existing) {
            throw new errorHandler_1.ApiError(404, 'Video not found');
        }
        if (existing.authorId !== req.user.id && req.user.role !== 'ADMIN') {
            throw new errorHandler_1.ApiError(403, 'Not authorized');
        }
        const updated = await prisma_1.prisma.video.update({
            where: { id },
            data: {
                title: req.body.title,
                description: req.body.description,
                status: req.body.status,
                type: req.body.type,
                thumbnailUrl: req.body.thumbnailUrl,
                hashtags: req.body.hashtags,
                mentionedUserIds: req.body.mentionedUserIds,
                location: req.body.location,
            },
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// LIKE VIDEO
// ===========================================
router.post('/:id/like', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const video = await prisma_1.prisma.video.findUnique({ where: { id } });
        if (!video) {
            throw new errorHandler_1.ApiError(404, 'Video not found');
        }
        const existing = await prisma_1.prisma.videoLike.findUnique({
            where: { videoId_userId: { videoId: id, userId: req.user.id } },
        });
        if (existing) {
            throw new errorHandler_1.ApiError(400, 'Already liked this video');
        }
        await prisma_1.prisma.videoLike.create({
            data: { videoId: id, userId: req.user.id },
        });
        await prisma_1.prisma.video.update({
            where: { id },
            data: { likeCount: { increment: 1 } },
        });
        res.json({ success: true, message: 'Video liked' });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UNLIKE VIDEO
// ===========================================
router.delete('/:id/like', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const deleted = await prisma_1.prisma.videoLike.deleteMany({
            where: { videoId: id, userId: req.user.id },
        });
        if (deleted.count > 0) {
            await prisma_1.prisma.video.update({
                where: { id },
                data: { likeCount: { decrement: 1 } },
            });
        }
        res.json({ success: true, message: 'Like removed' });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// COMMENTS
// ===========================================
router.get('/:id/comments', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const limit = parseLimit(req.query.limit, 20, 50);
        const comments = await prisma_1.prisma.videoComment.findMany({
            where: { videoId: id, parentId: null, isHidden: false },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                author: { select: { id: true, displayName: true, avatar: true } },
                replies: {
                    include: { author: { select: { id: true, displayName: true, avatar: true } } },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        res.json({ success: true, data: comments });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/comments', auth_1.authenticate, [(0, express_validator_1.body)('content').isString().notEmpty(), (0, express_validator_1.body)('parentId').optional().isString()], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { id } = req.params;
        const video = await prisma_1.prisma.video.findUnique({ where: { id } });
        if (!video) {
            throw new errorHandler_1.ApiError(404, 'Video not found');
        }
        const comment = await prisma_1.prisma.videoComment.create({
            data: {
                videoId: id,
                authorId: req.user.id,
                content: req.body.content,
                parentId: req.body.parentId,
            },
        });
        await prisma_1.prisma.video.update({
            where: { id },
            data: { commentCount: { increment: 1 } },
        });
        res.status(201).json({ success: true, data: comment });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// SAVE VIDEO
// ===========================================
router.post('/:id/save', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const video = await prisma_1.prisma.video.findUnique({ where: { id } });
        if (!video) {
            throw new errorHandler_1.ApiError(404, 'Video not found');
        }
        const existing = await prisma_1.prisma.videoSave.findUnique({
            where: { videoId_userId: { videoId: id, userId: req.user.id } },
        });
        if (existing) {
            throw new errorHandler_1.ApiError(400, 'Already saved this video');
        }
        await prisma_1.prisma.videoSave.create({
            data: { videoId: id, userId: req.user.id },
        });
        await prisma_1.prisma.video.update({
            where: { id },
            data: { saveCount: { increment: 1 } },
        });
        res.json({ success: true, message: 'Video saved' });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id/save', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const deleted = await prisma_1.prisma.videoSave.deleteMany({
            where: { videoId: id, userId: req.user.id },
        });
        if (deleted.count > 0) {
            await prisma_1.prisma.video.update({
                where: { id },
                data: { saveCount: { decrement: 1 } },
            });
        }
        res.json({ success: true, message: 'Save removed' });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// RECORD VIEW
// ===========================================
router.post('/:id/view', auth_1.optionalAuth, [
    (0, express_validator_1.body)('watchDuration').isInt({ min: 1 }),
    (0, express_validator_1.body)('completionPct').isFloat({ min: 0, max: 100 }),
    (0, express_validator_1.body)('source').optional().isString(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { id } = req.params;
        const video = await prisma_1.prisma.video.findUnique({ where: { id } });
        if (!video) {
            throw new errorHandler_1.ApiError(404, 'Video not found');
        }
        await prisma_1.prisma.videoView.create({
            data: {
                videoId: id,
                userId: req.user?.id,
                watchDuration: req.body.watchDuration,
                completionPct: req.body.completionPct,
                source: req.body.source,
            },
        });
        await prisma_1.prisma.video.update({
            where: { id },
            data: { viewCount: { increment: 1 } },
        });
        res.json({ success: true, message: 'View recorded' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=video.routes.js.map