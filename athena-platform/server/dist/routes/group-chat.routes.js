"use strict";
/**
 * Group Chat Routes
 * API endpoints for group chat management with role validation
 * Phase 2: Backend Logic & Integrations
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const group_chat_service_1 = require("../services/group-chat.service");
const chat_storage_service_1 = require("../services/chat-storage.service");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const contentSafety_1 = require("../utils/contentSafety");
const prisma_1 = require("../utils/prisma");
const router = (0, express_1.Router)();
/**
 * @route POST /api/groups/:groupId/chat/message
 * @desc Send a message to group chat
 * @access Private (Group members)
 */
router.post('/:groupId/chat/message', auth_1.authenticate, async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const attachments = (0, contentSafety_1.normalizeMessageAttachments)(req.body?.attachments);
        const content = req.body?.content === undefined || req.body?.content === null
            ? ''
            : (0, contentSafety_1.normalizeUserText)(req.body.content, {
                field: 'content',
                maxLength: contentSafety_1.CONTENT_LIMITS.groupMessage,
                allowEmpty: true,
            });
        const replyToId = typeof req.body?.replyToId === 'string' && req.body.replyToId.trim()
            ? req.body.replyToId.trim()
            : undefined;
        if (!content && (!attachments || attachments.length === 0)) {
            throw new errorHandler_1.ApiError(400, 'Content or attachments required');
        }
        const sendPolicy = await group_chat_service_1.groupChatService.canSendMessage(groupId, req.user.id);
        if (!sendPolicy.allowed) {
            throw new errorHandler_1.ApiError(403, sendPolicy.reason || 'You are not allowed to send messages in this group');
        }
        if (replyToId) {
            const replyTo = await prisma_1.prisma.message.findUnique({
                where: { id: replyToId },
                select: { conversationId: true, deletedAt: true },
            });
            if (!replyTo || replyTo.conversationId !== groupId || replyTo.deletedAt) {
                throw new errorHandler_1.ApiError(400, 'Invalid reply target');
            }
        }
        // Store message
        const message = await chat_storage_service_1.chatStorageService.storeMessage({
            conversationId: groupId,
            senderId: req.user.id,
            content,
            type: attachments ? 'IMAGE' : 'TEXT',
            replyToId,
            metadata: { groupId, attachments },
        });
        res.json({
            success: true,
            data: message,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route GET /api/groups/:groupId/chat/messages
 * @desc Get group chat messages
 * @access Private (Group members)
 */
router.get('/:groupId/chat/messages', auth_1.authenticate, async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const limit = (0, contentSafety_1.parseBoundedInteger)(req.query.limit, 'limit', 50, 1, 100);
        const before = (0, contentSafety_1.parseOptionalDate)(req.query.before, 'before');
        const after = (0, contentSafety_1.parseOptionalDate)(req.query.after, 'after');
        // Validate membership
        const canRead = await (0, group_chat_service_1.validatePermission)(groupId, req.user.id, 'send_messages');
        if (!canRead) {
            throw new errorHandler_1.ApiError(403, 'You are not a member of this group');
        }
        const messages = await chat_storage_service_1.chatStorageService.getMessages({
            conversationId: groupId,
            limit,
            before,
            after,
        });
        res.json({
            success: true,
            data: messages,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/groups/:groupId/members
 * @desc Add a member to group
 * @access Private (Admin/Moderator)
 */
router.post('/:groupId/members', auth_1.authenticate, async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { userId, role = 'MEMBER' } = req.body;
        if (!userId) {
            throw new errorHandler_1.ApiError(400, 'userId is required');
        }
        const member = await group_chat_service_1.groupChatService.addMember(groupId, req.user.id, userId, role);
        res.json({
            success: true,
            data: member,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route DELETE /api/groups/:groupId/members/:userId
 * @desc Remove a member from group
 * @access Private (Admin/Moderator)
 */
router.delete('/:groupId/members/:userId', auth_1.authenticate, async (req, res, next) => {
    try {
        const { groupId, userId } = req.params;
        const { reason } = req.body;
        await group_chat_service_1.groupChatService.removeMember(groupId, req.user.id, userId, reason);
        res.json({
            success: true,
            message: 'Member removed from group',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route PATCH /api/groups/:groupId/members/:userId/role
 * @desc Update member role
 * @access Private (Admin)
 */
router.patch('/:groupId/members/:userId/role', auth_1.authenticate, async (req, res, next) => {
    try {
        const { groupId, userId } = req.params;
        const { role } = req.body;
        if (!role || !['ADMIN', 'MODERATOR', 'MEMBER'].includes(role)) {
            throw new errorHandler_1.ApiError(400, 'Valid role is required');
        }
        const member = await group_chat_service_1.groupChatService.updateMemberRole(groupId, req.user.id, userId, role);
        res.json({
            success: true,
            data: member,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/groups/:groupId/members/:userId/mute
 * @desc Mute a member
 * @access Private (Admin/Moderator)
 */
router.post('/:groupId/members/:userId/mute', auth_1.authenticate, async (req, res, next) => {
    try {
        const { groupId, userId } = req.params;
        const { duration, reason } = req.body;
        await group_chat_service_1.groupChatService.muteMember(groupId, req.user.id, userId, duration || 24 * 60 // Default 24 hours
        );
        res.json({
            success: true,
            message: 'Member muted',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/groups/:groupId/members/:userId/unmute
 * @desc Unmute a member
 * @access Private (Admin/Moderator)
 */
router.post('/:groupId/members/:userId/unmute', auth_1.authenticate, async (req, res, next) => {
    try {
        const { groupId, userId } = req.params;
        await group_chat_service_1.groupChatService.unmuteMember(groupId, req.user.id, userId);
        res.json({
            success: true,
            message: 'Member unmuted',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/groups/:groupId/members/:userId/ban
 * @desc Ban a member
 * @access Private (Admin)
 */
router.post('/:groupId/members/:userId/ban', auth_1.authenticate, async (req, res, next) => {
    try {
        const { groupId, userId } = req.params;
        const { reason } = req.body;
        await group_chat_service_1.groupChatService.banMember(groupId, req.user.id, userId, reason);
        res.json({
            success: true,
            message: 'Member banned from group',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route DELETE /api/groups/:groupId/chat/messages/:messageId
 * @desc Delete a message
 * @access Private (Message author or Moderator)
 */
router.delete('/:groupId/chat/messages/:messageId', auth_1.authenticate, async (req, res, next) => {
    try {
        const { groupId, messageId } = req.params;
        const message = await prisma_1.prisma.message.findUnique({
            where: { id: messageId },
            select: { id: true, senderId: true, conversationId: true, deletedAt: true },
        });
        if (!message || message.conversationId !== groupId || message.deletedAt) {
            throw new errorHandler_1.ApiError(404, 'Message not found');
        }
        const isAuthor = message.senderId === req.user.id;
        const canModerate = isAuthor ? true : await (0, group_chat_service_1.validatePermission)(groupId, req.user.id, 'delete_messages');
        if (!canModerate) {
            throw new errorHandler_1.ApiError(403, 'You are not allowed to delete this message');
        }
        const deleted = await chat_storage_service_1.chatStorageService.deleteMessage(messageId, req.user.id, {
            allowModerator: !isAuthor,
        });
        if (!deleted) {
            throw new errorHandler_1.ApiError(403, 'You are not allowed to delete this message');
        }
        res.json({
            success: true,
            message: 'Message deleted',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route PATCH /api/groups/:groupId/chat/messages/:messageId/pin
 * @desc Pin a message
 * @access Private (Admin/Moderator)
 */
router.patch('/:groupId/chat/messages/:messageId/pin', auth_1.authenticate, async (req, res, next) => {
    try {
        const { groupId, messageId } = req.params;
        const canPin = await (0, group_chat_service_1.validatePermission)(groupId, req.user.id, 'pin_messages');
        if (!canPin) {
            throw new errorHandler_1.ApiError(403, 'You are not allowed to pin messages');
        }
        const message = await prisma_1.prisma.message.findUnique({
            where: { id: messageId },
            select: { conversationId: true, deletedAt: true },
        });
        if (!message || message.conversationId !== groupId || message.deletedAt) {
            throw new errorHandler_1.ApiError(404, 'Message not found');
        }
        await chat_storage_service_1.chatStorageService.pinMessage(messageId, req.user.id, true);
        res.json({
            success: true,
            message: 'Message pinned',
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=group-chat.routes.js.map