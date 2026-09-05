/**
 * Group Chat Routes
 * API endpoints for group chat management with role validation
 * Phase 2: Backend Logic & Integrations
 * 
 */

import { Router, Response, NextFunction } from 'express';
import { groupChatService, validatePermission } from '../services/group-chat.service';
import { chatStorageService } from '../services/chat-storage.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import {
  CONTENT_LIMITS,
  normalizeMessageAttachments,
  normalizeUserText,
  parseBoundedInteger,
  parseOptionalDate,
} from '../utils/contentSafety';
import { prisma } from '../utils/prisma';

const router = Router();

/**
 * Group chat messages are Message rows whose conversationId is the group's
 * id. Message.conversationId is a foreign key to Conversation, so without a
 * Conversation row of that id every send failed. The row is created on first
 * use, keyed by the group id, so no other table needs to know about it.
 */
async function ensureGroupConversation(groupId: string): Promise<void> {
  await prisma.conversation.upsert({
    where: { id: groupId },
    update: {},
    create: { id: groupId },
  });
}

/**
 * @route GET /api/groups/:groupId/members
 * @desc Who is in the group, with roles. Members only.
 */
router.get('/:groupId/members', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const members = await groupChatService.getGroupMembers(req.params.groupId, req.user!.id);
    res.json({ success: true, data: members });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/groups/:groupId/chat/pinned
 * @desc Messages pinned by a moderator, newest first. Members only.
 */
router.get('/:groupId/chat/pinned', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const canRead = await validatePermission(groupId, req.user!.id, 'send_messages');
    if (!canRead) {
      throw new ApiError(403, 'You are not a member of this group');
    }
    const pinned = await prisma.message.findMany({
      where: { conversationId: groupId, deletedAt: null, metadata: { path: ['pinned'], equals: true } },
      include: { sender: { select: { id: true, displayName: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ success: true, data: pinned });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/groups/:groupId/chat/message
 * @desc Send a message to group chat
 * @access Private (Group members)
 */
router.post('/:groupId/chat/message', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const attachments = normalizeMessageAttachments(req.body?.attachments);
    const content = req.body?.content === undefined || req.body?.content === null
      ? ''
      : normalizeUserText(req.body.content, {
          field: 'content',
          maxLength: CONTENT_LIMITS.groupMessage,
          allowEmpty: true,
        });
    const replyToId = typeof req.body?.replyToId === 'string' && req.body.replyToId.trim()
      ? req.body.replyToId.trim()
      : undefined;
    
    if (!content && (!attachments || attachments.length === 0)) {
      throw new ApiError(400, 'Content or attachments required');
    }
    
    const sendPolicy = await groupChatService.canSendMessage(groupId, req.user!.id);
    if (!sendPolicy.allowed) {
      throw new ApiError(403, sendPolicy.reason || 'You are not allowed to send messages in this group');
    }

    await ensureGroupConversation(groupId);

    if (replyToId) {
      const replyTo = await prisma.message.findUnique({
        where: { id: replyToId },
        select: { conversationId: true, deletedAt: true },
      });

      if (!replyTo || replyTo.conversationId !== groupId || replyTo.deletedAt) {
        throw new ApiError(400, 'Invalid reply target');
      }
    }
    
    // Store message
    const message = await chatStorageService.storeMessage({
      conversationId: groupId,
      senderId: req.user!.id,
      content,
      type: attachments ? 'IMAGE' : 'TEXT',
      replyToId,
      metadata: { groupId, attachments },
    });
    
    res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/groups/:groupId/chat/messages
 * @desc Get group chat messages
 * @access Private (Group members)
 */
router.get('/:groupId/chat/messages', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const limit = parseBoundedInteger(req.query.limit, 'limit', 50, 1, 100);
    const before = parseOptionalDate(req.query.before, 'before');
    const after = parseOptionalDate(req.query.after, 'after');
    
    // Validate membership
    const canRead = await validatePermission(groupId, req.user!.id, 'send_messages');
    if (!canRead) {
      throw new ApiError(403, 'You are not a member of this group');
    }
    
    const messages = await chatStorageService.getMessages({
      conversationId: groupId,
      limit,
      before,
      after,
    });
    
    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/groups/:groupId/members
 * @desc Add a member to group
 * @access Private (Admin/Moderator)
 */
router.post('/:groupId/members', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const { userId, role = 'MEMBER' } = req.body;
    
    if (!userId) {
      throw new ApiError(400, 'userId is required');
    }
    
    const member = await groupChatService.addMember(
      groupId,
      req.user!.id,
      userId,
      role
    );
    
    res.json({
      success: true,
      data: member,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/groups/:groupId/members/:userId
 * @desc Remove a member from group
 * @access Private (Admin/Moderator)
 */
router.delete('/:groupId/members/:userId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId, userId } = req.params;
    const { reason } = req.body;
    
    await groupChatService.removeMember(groupId, req.user!.id, userId, reason);
    
    res.json({
      success: true,
      message: 'Member removed from group',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PATCH /api/groups/:groupId/members/:userId/role
 * @desc Update member role
 * @access Private (Admin)
 */
router.patch('/:groupId/members/:userId/role', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId, userId } = req.params;
    const { role } = req.body;
    
    if (!role || !['ADMIN', 'MODERATOR', 'MEMBER'].includes(role)) {
      throw new ApiError(400, 'Valid role is required');
    }
    
    const member = await groupChatService.updateMemberRole(
      groupId,
      req.user!.id,
      userId,
      role
    );
    
    res.json({
      success: true,
      data: member,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/groups/:groupId/members/:userId/mute
 * @desc Mute a member
 * @access Private (Admin/Moderator)
 */
router.post('/:groupId/members/:userId/mute', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId, userId } = req.params;
    const { duration, reason } = req.body;
    
    await groupChatService.muteMember(
      groupId,
      req.user!.id,
      userId,
      duration || 24 * 60 // Default 24 hours
    );
    
    res.json({
      success: true,
      message: 'Member muted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/groups/:groupId/members/:userId/unmute
 * @desc Unmute a member
 * @access Private (Admin/Moderator)
 */
router.post('/:groupId/members/:userId/unmute', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId, userId } = req.params;

    await groupChatService.unmuteMember(groupId, req.user!.id, userId);
    
    res.json({
      success: true,
      message: 'Member unmuted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/groups/:groupId/members/:userId/ban
 * @desc Ban a member
 * @access Private (Admin)
 */
router.post('/:groupId/members/:userId/ban', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId, userId } = req.params;
    const { reason } = req.body;
    
    await groupChatService.banMember(groupId, req.user!.id, userId, reason);
    
    res.json({
      success: true,
      message: 'Member banned from group',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/groups/:groupId/chat/messages/:messageId
 * @desc Delete a message
 * @access Private (Message author or Moderator)
 */
router.delete('/:groupId/chat/messages/:messageId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId, messageId } = req.params;
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, conversationId: true, deletedAt: true },
    });

    if (!message || message.conversationId !== groupId || message.deletedAt) {
      throw new ApiError(404, 'Message not found');
    }

    const isAuthor = message.senderId === req.user!.id;
    const canModerate = isAuthor ? true : await validatePermission(groupId, req.user!.id, 'delete_messages');

    if (!canModerate) {
      throw new ApiError(403, 'You are not allowed to delete this message');
    }

    const deleted = await chatStorageService.deleteMessage(messageId, req.user!.id, {
      allowModerator: !isAuthor,
    });

    if (!deleted) {
      throw new ApiError(403, 'You are not allowed to delete this message');
    }
    
    res.json({
      success: true,
      message: 'Message deleted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PATCH /api/groups/:groupId/chat/messages/:messageId/pin
 * @desc Pin a message
 * @access Private (Admin/Moderator)
 */
router.patch('/:groupId/chat/messages/:messageId/pin', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId, messageId } = req.params;
    
    const canPin = await validatePermission(groupId, req.user!.id, 'pin_messages');
    if (!canPin) {
      throw new ApiError(403, 'You are not allowed to pin messages');
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true, deletedAt: true },
    });

    if (!message || message.conversationId !== groupId || message.deletedAt) {
      throw new ApiError(404, 'Message not found');
    }

    // { pinned: false } takes a pin down; anything else pins.
    const pinned = req.body?.pinned !== false;
    await chatStorageService.pinMessage(messageId, req.user!.id, pinned);

    res.json({
      success: true,
      message: pinned ? 'Message pinned' : 'Message unpinned',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
