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
// LIST CHANNELS
// ===========================================
router.get('/', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 50);
        const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;
        const type = typeof req.query.type === 'string' ? req.query.type : undefined;
        const where = {};
        if (type)
            where.type = type;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (req.user) {
            where.OR = [
                ...(where.OR || []),
                { isPublic: true },
                { members: { some: { userId: req.user.id } } },
            ];
        }
        else {
            where.isPublic = true;
        }
        const [channels, total] = await Promise.all([
            prisma_1.prisma.channel.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    owner: { select: { id: true, displayName: true, avatar: true } },
                },
            }),
            prisma_1.prisma.channel.count({ where }),
        ]);
        res.json({
            success: true,
            data: channels,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// CREATE CHANNEL
// ===========================================
router.post('/', auth_1.authenticate, [
    (0, express_validator_1.body)('name').isString().notEmpty(),
    (0, express_validator_1.body)('type').isIn(['EMPLOYER_BROADCAST', 'MENTOR_BROADCAST', 'COMMUNITY_CHANNEL', 'EDUCATION_CHANNEL', 'CREATOR_CHANNEL']),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('isPublic').optional().isBoolean(),
    (0, express_validator_1.body)('allowReplies').optional().isBoolean(),
    (0, express_validator_1.body)('avatarUrl').optional().isString(),
    (0, express_validator_1.body)('bannerUrl').optional().isString(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const created = await prisma_1.prisma.channel.create({
            data: {
                name: req.body.name,
                type: req.body.type,
                description: req.body.description,
                isPublic: req.body.isPublic ?? true,
                allowReplies: req.body.allowReplies ?? false,
                avatarUrl: req.body.avatarUrl,
                bannerUrl: req.body.bannerUrl,
                ownerId: req.user.id,
                memberCount: 1,
                members: {
                    create: { userId: req.user.id },
                },
            },
            include: {
                owner: { select: { id: true, displayName: true, avatar: true } },
            },
        });
        res.status(201).json({ success: true, data: created });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// GET CHANNEL
// ===========================================
router.get('/:id', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const channel = await prisma_1.prisma.channel.findUnique({
            where: { id },
            include: {
                owner: { select: { id: true, displayName: true, avatar: true } },
            },
        });
        if (!channel) {
            throw new errorHandler_1.ApiError(404, 'Channel not found');
        }
        if (!channel.isPublic && !req.user) {
            throw new errorHandler_1.ApiError(403, 'Private channel');
        }
        if (!channel.isPublic && req.user) {
            const isMember = await prisma_1.prisma.channelMember.findUnique({
                where: { channelId_userId: { channelId: id, userId: req.user.id } },
            });
            if (!isMember && channel.ownerId !== req.user.id) {
                throw new errorHandler_1.ApiError(403, 'Private channel');
            }
        }
        res.json({ success: true, data: channel });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// UPDATE CHANNEL
// ===========================================
router.patch('/:id', auth_1.authenticate, [
    (0, express_validator_1.body)('name').optional().isString(),
    (0, express_validator_1.body)('description').optional().isString(),
    (0, express_validator_1.body)('isPublic').optional().isBoolean(),
    (0, express_validator_1.body)('allowReplies').optional().isBoolean(),
    (0, express_validator_1.body)('avatarUrl').optional().isString(),
    (0, express_validator_1.body)('bannerUrl').optional().isString(),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { id } = req.params;
        const channel = await prisma_1.prisma.channel.findUnique({ where: { id } });
        if (!channel) {
            throw new errorHandler_1.ApiError(404, 'Channel not found');
        }
        if (channel.ownerId !== req.user.id && req.user.role !== 'ADMIN') {
            throw new errorHandler_1.ApiError(403, 'Not authorized');
        }
        const updated = await prisma_1.prisma.channel.update({
            where: { id },
            data: {
                name: req.body.name,
                description: req.body.description,
                isPublic: req.body.isPublic,
                allowReplies: req.body.allowReplies,
                avatarUrl: req.body.avatarUrl,
                bannerUrl: req.body.bannerUrl,
            },
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// JOIN / LEAVE
// ===========================================
router.post('/:id/join', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const channel = await prisma_1.prisma.channel.findUnique({ where: { id } });
        if (!channel) {
            throw new errorHandler_1.ApiError(404, 'Channel not found');
        }
        if (!channel.isPublic) {
            throw new errorHandler_1.ApiError(403, 'Channel is private');
        }
        const existing = await prisma_1.prisma.channelMember.findUnique({
            where: { channelId_userId: { channelId: id, userId: req.user.id } },
        });
        if (existing) {
            return res.json({ success: true, message: 'Already joined' });
        }
        await prisma_1.prisma.channelMember.create({
            data: { channelId: id, userId: req.user.id },
        });
        await prisma_1.prisma.channel.update({
            where: { id },
            data: { memberCount: { increment: 1 } },
        });
        res.json({ success: true, message: 'Joined channel' });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:id/leave', auth_1.authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const channel = await prisma_1.prisma.channel.findUnique({ where: { id } });
        if (!channel) {
            throw new errorHandler_1.ApiError(404, 'Channel not found');
        }
        if (channel.ownerId === req.user.id) {
            throw new errorHandler_1.ApiError(400, 'Owner cannot leave channel');
        }
        const deleted = await prisma_1.prisma.channelMember.deleteMany({
            where: { channelId: id, userId: req.user.id },
        });
        if (deleted.count > 0) {
            await prisma_1.prisma.channel.update({
                where: { id },
                data: { memberCount: { decrement: 1 } },
            });
        }
        res.json({ success: true, message: 'Left channel' });
    }
    catch (error) {
        next(error);
    }
});
// ===========================================
// CHANNEL MESSAGES
// ===========================================
router.get('/:id/messages', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const limit = parseLimit(req.query.limit, 20, 50);
        const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
        const channel = await prisma_1.prisma.channel.findUnique({ where: { id } });
        if (!channel) {
            throw new errorHandler_1.ApiError(404, 'Channel not found');
        }
        if (!channel.isPublic) {
            if (!req.user) {
                throw new errorHandler_1.ApiError(403, 'Private channel');
            }
            const member = await prisma_1.prisma.channelMember.findUnique({
                where: { channelId_userId: { channelId: id, userId: req.user.id } },
            });
            if (!member && channel.ownerId !== req.user.id) {
                throw new errorHandler_1.ApiError(403, 'Private channel');
            }
        }
        const [messages, total] = await Promise.all([
            prisma_1.prisma.channelMessage.findMany({
                where: { channelId: id },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: { author: { select: { id: true, displayName: true, avatar: true } } },
            }),
            prisma_1.prisma.channelMessage.count({ where: { channelId: id } }),
        ]);
        res.json({
            success: true,
            data: messages,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/messages', auth_1.authenticate, [(0, express_validator_1.body)('content').isString().notEmpty(), (0, express_validator_1.body)('mediaUrls').optional()], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { id } = req.params;
        const channel = await prisma_1.prisma.channel.findUnique({ where: { id } });
        if (!channel) {
            throw new errorHandler_1.ApiError(404, 'Channel not found');
        }
        const isOwner = channel.ownerId === req.user.id;
        const member = await prisma_1.prisma.channelMember.findUnique({
            where: { channelId_userId: { channelId: id, userId: req.user.id } },
        });
        if (!isOwner && !member) {
            throw new errorHandler_1.ApiError(403, 'Not a channel member');
        }
        if (!channel.allowReplies && !isOwner) {
            throw new errorHandler_1.ApiError(403, 'Replies are disabled for this channel');
        }
        const message = await prisma_1.prisma.channelMessage.create({
            data: {
                channelId: id,
                authorId: req.user.id,
                content: req.body.content,
                mediaUrls: req.body.mediaUrls,
            },
        });
        await prisma_1.prisma.channel.update({
            where: { id },
            data: { messageCount: { increment: 1 } },
        });
        res.status(201).json({ success: true, data: message });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=channel.routes.js.map