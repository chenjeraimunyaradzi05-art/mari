/**
 * Group Chat Routes
 * API endpoints for group chat management with role validation
 * Phase 2: Backend Logic & Integrations
 * 
 */

import { Router, Response, NextFunction } from 'express';
import { groupChatService, validatePermission, type GroupRole } from '../services/group-chat.service';
import { chatStorageService, messageTypeForAttachments } from '../services/chat-storage.service';
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
import { requireChatAttachments } from '../utils/chat-attachments';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { blockedEitherWayIds } from '../services/audience.service';
import { emitToGroupRoom } from '../services/socket.service';
// Group chat reaches a whole room at once and had no ceiling of its own:
// only the global tier limit, which allows a message every few seconds all
// day. The direct-message ceiling is the right one — a group message is a
// message to everyone in the room — and it is generous for a real
// conversation while being a wall for a script.
import { messageLimiter } from '../middleware/socialLimits';

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
    const viewerId = req.user!.id;
    const canRead = await validatePermission(groupId, viewerId, 'send_messages');
    if (!canRead) {
      throw new ApiError(403, 'You are not a member of this group');
    }
    // A message pinned by a moderator is still a message, and still not one she
    // is shown from either side of a block.
    const blocked = await blockedEitherWayIds(viewerId);
    const pinned = await prisma.message.findMany({
      where: {
        conversationId: groupId,
        deletedAt: null,
        metadata: { path: ['pinned'], equals: true },
        ...(blocked.length > 0 ? { senderId: { notIn: blocked } } : {}),
      },
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
// validated: content goes through normalizeUserText with the group message limit, attachments
//   through normalizeMessageAttachments (at most 5), replyToId is read as trimmed text and then
//   looked up.
router.post('/:groupId/chat/message', authenticate, requireWomanMember, messageLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const senderId = req.user!.id;
    let attachments = normalizeMessageAttachments(req.body?.attachments);
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
    
    const sendPolicy = await groupChatService.canSendMessage(groupId, senderId);
    if (!sendPolicy.allowed) {
      throw new ApiError(403, sendPolicy.reason || 'You are not allowed to send messages in this group');
    }

    // A file in a room is one she uploaded to this room (utils/chat-attachments):
    // by key, never by link, so nothing the room stores can be opened without
    // asking the API, and a room cannot be made to show a picture from somewhere
    // else, or a file somebody else sent.
    if (attachments?.length) {
      attachments = requireChatAttachments(attachments, groupId, senderId);
    }

    // Screened after the membership check, so somebody who cannot post here
    // never gets their text scanned on the group's behalf, and before the
    // write, so nothing a provider refuses is ever stored or broadcast. A
    // message that is only an attachment has no text to screen.
    if (content) {
      await assertContentAllowed(content, { kind: 'group_message', userId: senderId });
    }

    await ensureGroupConversation(groupId);

    if (replyToId) {
      const replyTo = await prisma.message.findUnique({
        where: { id: replyToId },
        select: { conversationId: true, deletedAt: true, senderId: true },
      });

      if (!replyTo || replyTo.conversationId !== groupId || replyTo.deletedAt) {
        throw new ApiError(400, 'Invalid reply target');
      }

      // A reply carries the line it answers, and the history never shows her a
      // message from either side of a block, so she cannot have chosen one to
      // reply to; an id she was not shown is refused as one that does not exist.
      // Not best-effort: if the block lists cannot be read the reply fails.
      if (replyTo.senderId && replyTo.senderId !== senderId) {
        if ((await blockedEitherWayIds(senderId)).includes(replyTo.senderId)) {
          throw new ApiError(400, 'Invalid reply target');
        }
      }
    }
    
    // Store message
    const message = await chatStorageService.storeMessage({
      conversationId: groupId,
      senderId,
      content,
      // Was `attachments ? 'IMAGE' : 'TEXT'`: a PDF, a voice note, or an
      // empty list all came back labelled a picture.
      type: messageTypeForAttachments(attachments),
      replyToId,
      metadata: { groupId, attachments },
    });

    // Everyone with the room open sees it now rather than on the next poll,
    // except the members on either side of a block with the sender: a room is a
    // way round a block unless the push is held to it as the history is. If the
    // block lists cannot be read nothing is pushed rather than everything; the
    // message is stored, and the history read applies the same rule.
    //
    // A reply also carries the line it answers, which is somebody else's words:
    // the history wipes that line for a reader on either side of a block with
    // its author, so the push is not sent to one either (they read it, with the
    // line wiped, on their next read).
    try {
      const exceptUserIds = await blockedEitherWayIds(message.senderId);
      const quotedAuthorId: unknown = message.replyTo?.senderId;
      if (typeof quotedAuthorId === 'string' && quotedAuthorId !== message.senderId) {
        const quotedBlocked = await blockedEitherWayIds(quotedAuthorId);
        exceptUserIds.push(...quotedBlocked.filter((id) => id !== message.senderId));
      }
      emitToGroupRoom(groupId, 'groups:message', { groupId, message }, { exceptUserIds });
    } catch (error) {
      logger.warn('Group message not pushed: the sender\'s block lists could not be read', { groupId, error });
    }

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
    const viewerId = req.user!.id;
    const canRead = await validatePermission(groupId, viewerId, 'send_messages');
    if (!canRead) {
      throw new ApiError(403, 'You are not a member of this group');
    }
    
    // What a block ends is contact, and a group chat is contact with everyone in
    // the room at once: two members who have blocked each other, in either
    // store and either direction, do not read each other's messages here. The
    // group posts list already holds to this; the chat was the way round.
    const messages = await chatStorageService.getMessages({
      conversationId: groupId,
      limit,
      before,
      after,
      excludeSenderIds: await blockedEitherWayIds(viewerId),
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
// validated: userId must be non-empty text and role one of GROUP_ROLES.
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
// validated: role must be ADMIN, MODERATOR or MEMBER.
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
// validated: duration goes through parseBoundedInteger (1 minute to 30 days) and reason through
//   optionalReason.
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
// validated: reason goes through optionalReason, which measures it.
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
// validated: the only field read is pinned, as !== false.
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
