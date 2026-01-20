"use strict";
/**
 * Group Chat Routes
 * API endpoints for group chat management with role validation
 * Phase 2: Backend Logic & Integrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const group_chat_service_1 = require("../services/group-chat.service");
const chat_storage_service_1 = require("../services/chat-storage.service");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
/**
 * @route POST /api/groups/:groupId/chat/message
 * @desc Send a message to group chat
 * @access Private (Group members)
 */
router.post('/:groupId/chat/message', auth_1.authenticate, async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { content, attachments, replyToId } = req.body;
        if (!content && (!attachments || attachments.length === 0)) {
            throw new errorHandler_1.ApiError(400, 'Content or attachments required');
        }
        // Validate permission
        const canSend = await (0, group_chat_service_1.validatePermission)(groupId, req.user.id, 'SEND_MESSAGE');
        if (!canSend) {
            throw new errorHandler_1.ApiError(403, 'You are not allowed to send messages in this group');
        }
        // Store message
        const message = await chat_storage_service_1.chatStorageService.storeMessage({
            conversationId: groupId,
            senderId: req.user.id,
            content,
            type: attachments ? 'MEDIA' : 'TEXT',
            attachments,
            replyToId,
            metadata: { groupId },
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
        const { cursor, limit = '50', before, after } = req.query;
        // Validate membership
        const canRead = await (0, group_chat_service_1.validatePermission)(groupId, req.user.id, 'SEND_MESSAGE');
        if (!canRead) {
            throw new errorHandler_1.ApiError(403, 'You are not a member of this group');
        }
        const messages = await chat_storage_service_1.chatStorageService.getMessages(groupId, {
            cursor: cursor,
            limit: parseInt(limit, 10),
            before: before ? new Date(before) : undefined,
            after: after ? new Date(after) : undefined,
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
        const member = await group_chat_service_1.groupChatService.addMember(groupId, userId, req.user.id, role);
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
        await group_chat_service_1.groupChatService.removeMember(groupId, userId, req.user.id, reason);
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
        const member = await group_chat_service_1.groupChatService.updateMemberRole(groupId, userId, req.user.id, role);
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
        await group_chat_service_1.groupChatService.muteMember(groupId, userId, req.user.id, duration || 24 * 60, // Default 24 hours
        reason);
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
        await group_chat_service_1.groupChatService.unmuteMember(groupId, userId, req.user.id);
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
        await group_chat_service_1.groupChatService.banMember(groupId, userId, req.user.id, reason);
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
        // Check if user is message author or has delete permission
        const canDelete = await (0, group_chat_service_1.validatePermission)(groupId, req.user.id, 'DELETE_MESSAGE');
        await chat_storage_service_1.chatStorageService.deleteMessage(messageId, req.user.id, canDelete);
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
        const canPin = await (0, group_chat_service_1.validatePermission)(groupId, req.user.id, 'PIN_MESSAGE');
        if (!canPin) {
            throw new errorHandler_1.ApiError(403, 'You are not allowed to pin messages');
        }
        await chat_storage_service_1.chatStorageService.pinMessage(messageId, req.user.id);
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