"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const prisma_1 = require("../utils/prisma");
const router = (0, express_1.Router)();
function normalizeStoryType(value) {
    return value === 'video' ? 'video' : 'image';
}
/**
 * GET /api/status/feed
 * Returns grouped stories (one bucket per user).
 */
router.get('/feed', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const now = new Date();
        const stories = await prisma_1.prisma.status.findMany({
            where: { expiresAt: { gt: now } },
            include: {
                user: {
                    select: { id: true, displayName: true, firstName: true, lastName: true, avatar: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });
        const byUser = new Map();
        for (const s of stories) {
            const u = s.user;
            const userBucket = byUser.get(s.userId) || {
                user: {
                    id: s.userId,
                    displayName: u?.displayName || `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || 'Member',
                    avatar: u?.avatar || null,
                },
                stories: [],
            };
            userBucket.stories.push({
                id: s.id,
                userId: s.userId,
                type: s.type === 'VIDEO' ? 'video' : 'image',
                mediaUrl: s.mediaUrl,
                createdAt: s.createdAt.toISOString(),
                expiresAt: s.expiresAt.toISOString(),
            });
            byUser.set(s.userId, userBucket);
        }
        const feed = Array.from(byUser.values()).sort((a, b) => {
            const aLatest = a.stories[0]?.createdAt || '';
            const bLatest = b.stories[0]?.createdAt || '';
            return bLatest.localeCompare(aLatest);
        });
        res.json({ success: true, data: feed });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/status
 */
router.post('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const type = normalizeStoryType(req.body?.type);
        const mediaUrl = typeof req.body?.mediaUrl === 'string' ? req.body.mediaUrl.trim() : '';
        if (!mediaUrl)
            throw new errorHandler_1.ApiError(400, 'mediaUrl is required');
        const createdAt = new Date();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const created = await prisma_1.prisma.status.create({
            data: {
                userId: req.user.id,
                type: type === 'video' ? 'VIDEO' : 'IMAGE',
                mediaUrl,
                expiresAt,
            },
        });
        const record = {
            id: created.id,
            userId: created.userId,
            type: created.type === 'VIDEO' ? 'video' : 'image',
            mediaUrl: created.mediaUrl,
            createdAt: created.createdAt.toISOString(),
            expiresAt: created.expiresAt.toISOString(),
        };
        res.status(201).json({ success: true, data: record });
    }
    catch (err) {
        next(err);
    }
});
/**
 * DELETE /api/status/:id
 */
router.delete('/:id', auth_1.authenticate, async (req, res, next) => {
    try {
        const story = await prisma_1.prisma.status.findUnique({
            where: { id: req.params.id },
            select: { id: true, userId: true },
        });
        if (!story)
            throw new errorHandler_1.ApiError(404, 'Story not found');
        if (story.userId !== req.user.id)
            throw new errorHandler_1.ApiError(403, 'Not allowed');
        await prisma_1.prisma.status.delete({ where: { id: story.id } });
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=status.routes.js.map