"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const contentSafety_1 = require("../utils/contentSafety");
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
        const search = typeof req.query.search === 'string'
            ? (0, contentSafety_1.normalizeOptionalUserText)(req.query.search, {
                field: 'search',
                maxLength: 100,
                allowEmpty: true,
            })
            : undefined;
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
    (0, express_validator_1.body)('name').isString().notEmpty().isLength({ max: contentSafety_1.CONTENT_LIMITS.channelName }).withMessage('Channel name max 100 characters'),
    (0, express_validator_1.body)('type').isIn(['EMPLOYER_BROADCAST', 'MENTOR_BROADCAST', 'COMMUNITY_CHANNEL', 'EDUCATION_CHANNEL', 'CREATOR_CHANNEL']),
    (0, express_validator_1.body)('description').optional().isString().isLength({ max: 2000 }).withMessage('Description max 2000 characters'),
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
                name: (0, contentSafety_1.normalizeUserText)(req.body.name, {
                    field: 'name',
                    maxLength: contentSafety_1.CONTENT_LIMITS.channelName,
                }),
                type: req.body.type,
                description: (0, contentSafety_1.normalizeOptionalUserText)(req.body.description, {
                    field: 'description',
                    maxLength: contentSafety_1.CONTENT_LIMITS.channelDescription,
                    allowEmpty: true,
                }),
                isPublic: req.body.isPublic ?? true,
                allowReplies: req.body.allowReplies ?? false,
                avatarUrl: req.body.avatarUrl
                    ? (0, contentSafety_1.normalizeSafeUrl)(req.body.avatarUrl, { field: 'avatarUrl', allowRelativeUploads: true })
                    : undefined,
                bannerUrl: req.body.bannerUrl
                    ? (0, contentSafety_1.normalizeSafeUrl)(req.body.bannerUrl, { field: 'bannerUrl', allowRelativeUploads: true })
                    : undefined,
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
    (0, express_validator_1.body)('name').optional().isString().isLength({ max: contentSafety_1.CONTENT_LIMITS.channelName }),
    (0, express_validator_1.body)('description').optional().isString().isLength({ max: contentSafety_1.CONTENT_LIMITS.channelDescription }),
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
        const data = {};
        if (req.body.name !== undefined) {
            data.name = (0, contentSafety_1.normalizeUserText)(req.body.name, {
                field: 'name',
                maxLength: contentSafety_1.CONTENT_LIMITS.channelName,
            });
        }
        if (req.body.description !== undefined) {
            data.description = (0, contentSafety_1.normalizeOptionalUserText)(req.body.description, {
                field: 'description',
                maxLength: contentSafety_1.CONTENT_LIMITS.channelDescription,
                allowEmpty: true,
            }) || '';
        }
        if (req.body.isPublic !== undefined)
            data.isPublic = req.body.isPublic;
        if (req.body.allowReplies !== undefined)
            data.allowReplies = req.body.allowReplies;
        if (req.body.avatarUrl !== undefined) {
            data.avatarUrl = (0, contentSafety_1.normalizeSafeUrl)(req.body.avatarUrl, { field: 'avatarUrl', allowRelativeUploads: true });
        }
        if (req.body.bannerUrl !== undefined) {
            data.bannerUrl = (0, contentSafety_1.normalizeSafeUrl)(req.body.bannerUrl, { field: 'bannerUrl', allowRelativeUploads: true });
        }
        const updated = await prisma_1.prisma.channel.update({
            where: { id },
            data,
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
                include: {
                    author: { select: { id: true, displayName: true, avatar: true } },
                    reactions: { select: { emoji: true, userId: true } },
                },
            }),
            prisma_1.prisma.channelMessage.count({ where: { channelId: id } }),
        ]);
        // The client renders one chip per emoji with a count and whether the viewer
        // reacted, so collapse the raw rows into that shape here.
        const viewerId = req.user?.id;
        const shaped = messages.map(({ reactions, ...message }) => {
            const byEmoji = new Map();
            for (const reaction of reactions) {
                const entry = byEmoji.get(reaction.emoji) ?? {
                    emoji: reaction.emoji,
                    count: 0,
                    hasReacted: false,
                };
                entry.count += 1;
                if (viewerId && reaction.userId === viewerId)
                    entry.hasReacted = true;
                byEmoji.set(reaction.emoji, entry);
            }
            return { ...message, reactions: [...byEmoji.values()] };
        });
        res.json({
            success: true,
            data: shaped,
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
router.post('/:id/messages', auth_1.authenticate, [
    (0, express_validator_1.body)('content').isString().notEmpty().isLength({ max: contentSafety_1.CONTENT_LIMITS.channelMessage }),
    (0, express_validator_1.body)('mediaUrls').optional().isArray({ max: 10 }),
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
                content: (0, contentSafety_1.normalizeUserText)(req.body.content, {
                    field: 'content',
                    maxLength: contentSafety_1.CONTENT_LIMITS.channelMessage,
                }),
                mediaUrls: (0, contentSafety_1.normalizeMediaUrls)(req.body.mediaUrls),
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
// ===========================================
// EDIT / DELETE / PIN A CHANNEL MESSAGE
// ===========================================
// Resolves a message inside a channel and returns it along with who may act on
// it. Authors may edit and delete their own; channel owners may delete any
// message and are the only ones who can pin.
async function loadChannelMessage(channelId, messageId, userId) {
    const channel = await prisma_1.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) {
        throw new errorHandler_1.ApiError(404, 'Channel not found');
    }
    const message = await prisma_1.prisma.channelMessage.findUnique({ where: { id: messageId } });
    if (!message || message.channelId !== channelId) {
        throw new errorHandler_1.ApiError(404, 'Message not found');
    }
    return {
        channel,
        message,
        isAuthor: message.authorId === userId,
        isOwner: channel.ownerId === userId,
    };
}
router.patch('/:channelId/messages/:messageId', auth_1.authenticate, [(0, express_validator_1.body)('content').isString().notEmpty().isLength({ max: contentSafety_1.CONTENT_LIMITS.channelMessage })], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { channelId, messageId } = req.params;
        const { isAuthor } = await loadChannelMessage(channelId, messageId, req.user.id);
        if (!isAuthor) {
            throw new errorHandler_1.ApiError(403, 'You can only edit your own messages');
        }
        const updated = await prisma_1.prisma.channelMessage.update({
            where: { id: messageId },
            data: {
                content: (0, contentSafety_1.normalizeUserText)(req.body.content, {
                    field: 'content',
                    maxLength: contentSafety_1.CONTENT_LIMITS.channelMessage,
                }),
                editedAt: new Date(),
            },
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:channelId/messages/:messageId', auth_1.authenticate, async (req, res, next) => {
    try {
        const { channelId, messageId } = req.params;
        const { isAuthor, isOwner } = await loadChannelMessage(channelId, messageId, req.user.id);
        if (!isAuthor && !isOwner) {
            throw new errorHandler_1.ApiError(403, 'You can only delete your own messages');
        }
        await prisma_1.prisma.channelMessage.delete({ where: { id: messageId } });
        await prisma_1.prisma.channel.update({
            where: { id: channelId },
            data: { messageCount: { decrement: 1 } },
        });
        res.json({ success: true, message: 'Message deleted' });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:channelId/messages/:messageId/reactions', auth_1.authenticate, [(0, express_validator_1.body)('emoji').isString().trim().notEmpty().isLength({ max: 32 })], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.ApiError(400, errors.array()[0].msg);
        }
        const { channelId, messageId } = req.params;
        await loadChannelMessage(channelId, messageId, req.user.id);
        const emoji = String(req.body.emoji).trim();
        // The unique constraint makes this idempotent: reacting twice with the
        // same emoji is a no-op rather than a duplicate row or an error.
        const existing = await prisma_1.prisma.channelMessageReaction.findUnique({
            where: { messageId_userId_emoji: { messageId, userId: req.user.id, emoji } },
        });
        if (!existing) {
            await prisma_1.prisma.channelMessageReaction.create({
                data: { messageId, userId: req.user.id, emoji },
            });
            await prisma_1.prisma.channelMessage.update({
                where: { id: messageId },
                data: { reactionCount: { increment: 1 } },
            });
        }
        res.status(201).json({ success: true, message: 'Reaction added' });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:channelId/messages/:messageId/reactions/:emoji', auth_1.authenticate, async (req, res, next) => {
    try {
        const { channelId, messageId } = req.params;
        await loadChannelMessage(channelId, messageId, req.user.id);
        const emoji = decodeURIComponent(req.params.emoji);
        const deleted = await prisma_1.prisma.channelMessageReaction.deleteMany({
            where: { messageId, userId: req.user.id, emoji },
        });
        if (deleted.count > 0) {
            await prisma_1.prisma.channelMessage.update({
                where: { id: messageId },
                data: { reactionCount: { decrement: deleted.count } },
            });
        }
        res.json({ success: true, message: 'Reaction removed' });
    }
    catch (error) {
        next(error);
    }
});
router.post('/:channelId/messages/:messageId/pin', auth_1.authenticate, async (req, res, next) => {
    try {
        const { channelId, messageId } = req.params;
        const { isOwner } = await loadChannelMessage(channelId, messageId, req.user.id);
        if (!isOwner) {
            throw new errorHandler_1.ApiError(403, 'Only the channel owner can pin messages');
        }
        const updated = await prisma_1.prisma.channelMessage.update({
            where: { id: messageId },
            data: { isPinned: true },
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/:channelId/messages/:messageId/pin', auth_1.authenticate, async (req, res, next) => {
    try {
        const { channelId, messageId } = req.params;
        const { isOwner } = await loadChannelMessage(channelId, messageId, req.user.id);
        if (!isOwner) {
            throw new errorHandler_1.ApiError(403, 'Only the channel owner can unpin messages');
        }
        const updated = await prisma_1.prisma.channelMessage.update({
            where: { id: messageId },
            data: { isPinned: false },
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=channel.routes.js.map