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

const router = Router();

/**
 * @route POST /api/groups/:groupId/chat/message
 * @desc Send a message to group chat
 * @access Private (Group members)
 */
router.post('/:groupId/chat/message', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { groupId } = req.params;
    const { content, attachments, replyToId } = req.body;
    
    if (!content && (!attachments || attachments.length === 0)) {
      throw new ApiError(400, 'Content or attachments required');
    }
    
    // Validate permission
    const canSend = await validatePermission(groupId, req.user!.id, 'send_messages');
    if (!canSend) {
      throw new ApiError(403, 'You are not allowed to send messages in this group');
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
    const { cursor, limit = '50', before, after } = req.query;
    
    // Validate membership
    const canRead = await validatePermission(groupId, req.user!.id, 'send_messages');
    if (!canRead) {
      throw new ApiError(403, 'You are not a member of this group');
    }
    
    const messages = await chatStorageService.getMessages({
      conversationId: groupId,
      limit: parseInt(limit as string, 10),
      before: before ? new Date(before as string) : undefined,
      after: after ? new Date(after as string) : undefined,
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
    
    await groupChatService.removeMember(groupId, userId, req.user!.id, reason);
    
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
      userId,
      req.user!.id,
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
    
    await groupChatService.banMember(groupId, userId, req.user!.id, reason);
    
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
    
    await chatStorageService.deleteMessage(messageId, req.user!.id);
    
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

    await chatStorageService.pinMessage(messageId, req.user!.id, true);

    res.json({
      success: true,
      message: 'Message pinned',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
