/**
 * Group Chat Routes
 * API endpoints for group chat management with role validation
 * Phase 2: Backend Logic & Integrations
 * 
 */

import { Router, Response, NextFunction } from 'express';
import { groupChatService, validatePermission, type GroupRole } from '../services/group-chat.service';
import { chatStorageService } from '../services/chat-storage.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireWomanMember } from '../middleware/account-gates';
import { ApiError } from '../middleware/errorHandler';
import { assertContentAllowed } from '../services/moderation.service';
import {
  CONTENT_LIMITS,
  normalizeMessageAttachments,
  normalizeUserText,
  parseBoundedInteger,
  parseOptionalDate,
} from '../utils/contentSafety';
import { prisma } from '../utils/prisma';
import { emitToGroupRoom } from '../services/socket.service';

const router = Router();

const GROUP_ROLES: GroupRole[] = ['ADMIN', 'MODERATOR', 'MEMBER'];
/** A mute or ban reason is shown to the person it is about, so it is short and plain text. */
const REASON_MAX = 300;

/** An optional free-text reason from the body, trimmed and bounded; absent when blank. */
function optionalReason(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const reason = normalizeUserText(raw, { field: 'reason', maxLength: REASON_MAX, allowEmpty: true });
  return reason || undefined;
}

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
 * @route GET /api/groups/:groupId/members/banned
 * @desc The banned rows, so a ban can be seen and reversed. Admins only.
 */
router.get('/:groupId/members/banned', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const banned = await groupChatService.getBannedMembers(req.params.groupId, req.user!.id);
    res.json({ success: true, data: banned });
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
// Speaking in a group chat is the surface a refused account would use to reach
// a room full of members at once, so the women-only floor applies to the write.
router.post('/:groupId/chat/message', authenticate, requireWomanMember, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    // Screened after the membership check, so somebody who cannot post here
    // never gets their text scanned on the group's behalf, and before the
    // write, so nothing a provider refuses is ever stored or broadcast. A
    // message that is only an attachment has no text to screen.
    if (content) {
      await assertContentAllowed(content, { kind: 'group_message', userId: req.user!.id });
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

    // Everyone with the room open sees it now rather than on the next poll.
    emitToGroupRoom(groupId, 'groups:message', { groupId, message });

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
 * @desc Add someone to the group by name. Admins and moderators add her
 *       straight away (200); a member's suggestion in a private group
 *       becomes a join request for them to approve (202).
 * @access Private (members with invite rights; the service decides)
 */
router.post('/:groupId/members', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
    if (!userId) {
      throw new ApiError(400, 'userId is required');
    }

    const role: GroupRole = req.body?.role === undefined || req.body?.role === null ? 'MEMBER' : req.body.role;
    if (!GROUP_ROLES.includes(role)) {
      throw new ApiError(400, 'Valid role is required');
    }

    const member = await groupChatService.addMember(groupId, req.user!.id, userId, role);

    if (!member) {
      res.status(202).json({ success: true, data: { status: 'pending' } });
      return;
    }
    res.json({
      success: true,
      data: { status: 'added', ...member },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ## Retired: DELETE /api/groups/:groupId/members/:userId
 *
 * This file used to declare a remove-member handler on this path that called
 * `groupChatService.removeMember` (role hierarchy, optional reason, a
 * "removed from group" notification). It never ran: group.routes.ts is
 * mounted on /api/groups first (index.ts) and its own DELETE on the same
 * path responds without calling next(), so every request stopped there and
 * the notification was never sent. The contract check could not see this
 * because the client call matched both. The live handler in group.routes.ts
 * now sends the notification; this declaration was dropped so there is one
 * handler per path. Change removals there, not here.
 */

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
    // Default 24 hours; at most 30 days.
    const duration = parseBoundedInteger(req.body?.duration, 'duration', 24 * 60, 1, 30 * 24 * 60);
    const reason = optionalReason(req.body?.reason);

    await groupChatService.muteMember(groupId, req.user!.id, userId, duration, reason);

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
    const reason = optionalReason(req.body?.reason);

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
 * @route POST /api/groups/:groupId/members/:userId/unban
 * @desc Lift a ban so the person can join again
 * @access Private (Admin)
 */
router.post('/:groupId/members/:userId/unban', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId, userId } = req.params;

    await groupChatService.unbanMember(groupId, req.user!.id, userId);

    res.json({
      success: true,
      message: 'Ban lifted',
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

    emitToGroupRoom(groupId, 'groups:message_removed', { groupId, messageId });

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

    emitToGroupRoom(groupId, 'groups:message_pinned', { groupId, messageId, pinned });

    res.json({
      success: true,
      message: pinned ? 'Message pinned' : 'Message unpinned',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
