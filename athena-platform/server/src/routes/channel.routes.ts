import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { emitToChannel } from '../services/socket.service';
import {
  CONTENT_LIMITS,
  normalizeMediaUrls,
  normalizeOptionalUserText,
  normalizeSafeUrl,
  normalizeUserText,
} from '../utils/contentSafety';

const router = Router();

function parseLimit(value: unknown, fallback = 20, max = 50): number {
  const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

// ===========================================
// LIST CHANNELS
// ===========================================
router.get('/', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 20, 50);
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
    const search = typeof req.query.search === 'string'
      ? normalizeOptionalUserText(req.query.search, {
          field: 'search',
          maxLength: 100,
          allowEmpty: true,
        })
      : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;

    const where: any = {};
    if (type) where.type = type;
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
    } else {
      where.isPublic = true;
    }

    const [channels, total] = await Promise.all([
      prisma.channel.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          owner: { select: { id: true, displayName: true, avatar: true } },
        },
      }),
      prisma.channel.count({ where }),
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
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CREATE CHANNEL
// ===========================================
router.post(
  '/',
  authenticate,
  [
    body('name').isString().notEmpty().isLength({ max: CONTENT_LIMITS.channelName }).withMessage('Channel name max 100 characters'),
    body('type').isIn(['EMPLOYER_BROADCAST', 'MENTOR_BROADCAST', 'COMMUNITY_CHANNEL', 'EDUCATION_CHANNEL', 'CREATOR_CHANNEL']),
    body('description').optional().isString().isLength({ max: 2000 }).withMessage('Description max 2000 characters'),
    body('isPublic').optional().isBoolean(),
    body('allowReplies').optional().isBoolean(),
    body('avatarUrl').optional().isString(),
    body('bannerUrl').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const created = await prisma.channel.create({
        data: {
          name: normalizeUserText(req.body.name, {
            field: 'name',
            maxLength: CONTENT_LIMITS.channelName,
          }),
          type: req.body.type,
          description: normalizeOptionalUserText(req.body.description, {
            field: 'description',
            maxLength: CONTENT_LIMITS.channelDescription,
            allowEmpty: true,
          }),
          isPublic: req.body.isPublic ?? true,
          allowReplies: req.body.allowReplies ?? false,
          avatarUrl: req.body.avatarUrl
            ? normalizeSafeUrl(req.body.avatarUrl, { field: 'avatarUrl', allowRelativeUploads: true })
            : undefined,
          bannerUrl: req.body.bannerUrl
            ? normalizeSafeUrl(req.body.bannerUrl, { field: 'bannerUrl', allowRelativeUploads: true })
            : undefined,
          ownerId: req.user!.id,
          memberCount: 1,
          members: {
            create: { userId: req.user!.id },
          },
        },
        include: {
          owner: { select: { id: true, displayName: true, avatar: true } },
        },
      });

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  }
);

// `/discover` and `/unread` must stay above `/:id`, or Express treats them as
// channel ids and answers 404.

// ===========================================
// DISCOVER PUBLIC CHANNELS
// ===========================================
router.get('/discover', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const limit = parseLimit(req.query.limit, 20, 50);
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const search = normalizeOptionalUserText(req.query.search, {
      field: 'search',
      maxLength: 100,
      allowEmpty: true,
    });

    const where: any = { isPublic: true };
    if (category) where.type = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Channels the viewer already belongs to are not discoveries.
    if (req.user) {
      where.members = { none: { userId: req.user.id } };
    }

    const [channels, total] = await Promise.all([
      prisma.channel.findMany({
        where,
        orderBy: [{ memberCount: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { owner: { select: { id: true, displayName: true, avatar: true } } },
      }),
      prisma.channel.count({ where }),
    ]);

    res.json({
      success: true,
      data: channels,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UNREAD COUNTS
// ===========================================
router.get('/unread', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const memberships = await prisma.channelMember.findMany({
      where: { userId: req.user!.id },
      select: { channelId: true, lastReadAt: true, joinedAt: true },
    });

    // One grouped count instead of a query per channel. A member who has never
    // opened the channel is measured from when they joined, so they do not
    // inherit the channel's entire backlog as unread.
    const grouped = await Promise.all(
      memberships.map(async (m) => ({
        channelId: m.channelId,
        unreadCount: await prisma.channelMessage.count({
          where: {
            channelId: m.channelId,
            createdAt: { gt: m.lastReadAt ?? m.joinedAt },
            authorId: { not: req.user!.id },
          },
        }),
      }))
    );

    res.json({
      success: true,
      data: {
        channels: grouped,
        total: grouped.reduce((sum, c) => sum + c.unreadCount, 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET CHANNEL
// ===========================================
router.get('/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const channel = await prisma.channel.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, displayName: true, avatar: true } },
      },
    });

    if (!channel) {
      throw new ApiError(404, 'Channel not found');
    }

    if (!channel.isPublic && !req.user) {
      throw new ApiError(403, 'Private channel');
    }

    if (!channel.isPublic && req.user) {
      const isMember = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: id, userId: req.user.id } },
      });
      if (!isMember && channel.ownerId !== req.user.id) {
        throw new ApiError(403, 'Private channel');
      }
    }

    res.json({ success: true, data: channel });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UPDATE CHANNEL
// ===========================================
router.patch(
  '/:id',
  authenticate,
  [
    body('name').optional().isString().isLength({ max: CONTENT_LIMITS.channelName }),
    body('description').optional().isString().isLength({ max: CONTENT_LIMITS.channelDescription }),
    body('isPublic').optional().isBoolean(),
    body('allowReplies').optional().isBoolean(),
    body('avatarUrl').optional().isString(),
    body('bannerUrl').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const channel = await prisma.channel.findUnique({ where: { id } });
      if (!channel) {
        throw new ApiError(404, 'Channel not found');
      }

      if (channel.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
        throw new ApiError(403, 'Not authorized');
      }

      const data: {
        name?: string;
        description?: string;
        isPublic?: boolean;
        allowReplies?: boolean;
        avatarUrl?: string;
        bannerUrl?: string;
      } = {};

      if (req.body.name !== undefined) {
        data.name = normalizeUserText(req.body.name, {
          field: 'name',
          maxLength: CONTENT_LIMITS.channelName,
        });
      }
      if (req.body.description !== undefined) {
        data.description = normalizeOptionalUserText(req.body.description, {
          field: 'description',
          maxLength: CONTENT_LIMITS.channelDescription,
          allowEmpty: true,
        }) || '';
      }
      if (req.body.isPublic !== undefined) data.isPublic = req.body.isPublic;
      if (req.body.allowReplies !== undefined) data.allowReplies = req.body.allowReplies;
      if (req.body.avatarUrl !== undefined) {
        data.avatarUrl = normalizeSafeUrl(req.body.avatarUrl, { field: 'avatarUrl', allowRelativeUploads: true });
      }
      if (req.body.bannerUrl !== undefined) {
        data.bannerUrl = normalizeSafeUrl(req.body.bannerUrl, { field: 'bannerUrl', allowRelativeUploads: true });
      }

      const updated = await prisma.channel.update({
        where: { id },
        data,
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// JOIN / LEAVE
// ===========================================
router.post('/:id/join', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      throw new ApiError(404, 'Channel not found');
    }

    if (!channel.isPublic) {
      throw new ApiError(403, 'Channel is private');
    }

    const existing = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: id, userId: req.user!.id } },
    });

    if (existing) {
      return res.json({ success: true, message: 'Already joined' });
    }

    await prisma.channelMember.create({
      data: { channelId: id, userId: req.user!.id },
    });

    await prisma.channel.update({
      where: { id },
      data: { memberCount: { increment: 1 } },
    });

    res.json({ success: true, message: 'Joined channel' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/leave', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      throw new ApiError(404, 'Channel not found');
    }

    if (channel.ownerId === req.user!.id) {
      throw new ApiError(400, 'Owner cannot leave channel');
    }

    const deleted = await prisma.channelMember.deleteMany({
      where: { channelId: id, userId: req.user!.id },
    });

    if (deleted.count > 0) {
      await prisma.channel.update({
        where: { id },
        data: { memberCount: { decrement: 1 } },
      });
    }

    res.json({ success: true, message: 'Left channel' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SHARED ACCESS CHECKS
// ===========================================

// Same rule the message routes apply: a public channel is readable by anyone,
// a private one only by its members and its owner.
async function requireChannelAccess(channelId: string, userId?: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) {
    throw new ApiError(404, 'Channel not found');
  }

  if (!channel.isPublic) {
    if (!userId) {
      throw new ApiError(403, 'Private channel');
    }
    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!member && channel.ownerId !== userId) {
      throw new ApiError(403, 'Private channel');
    }
  }

  return channel;
}

async function requireChannelOwner(channelId: string, userId: string, role?: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) {
    throw new ApiError(404, 'Channel not found');
  }
  if (channel.ownerId !== userId && role !== 'ADMIN') {
    throw new ApiError(403, 'Only the channel owner can do that');
  }
  return channel;
}

// ===========================================
// DELETE CHANNEL
// ===========================================
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    await requireChannelOwner(id, req.user!.id, req.user!.role);

    // Members, messages and reactions all cascade from the Channel row.
    await prisma.channel.delete({ where: { id } });

    emitToChannel(id, 'channels:deleted', { channelId: id });

    res.json({ success: true, message: 'Channel deleted' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// MEMBERS
// ===========================================
router.get('/:id/members', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    await requireChannelAccess(id, req.user?.id);

    const members = await prisma.channelMember.findMany({
      where: { channelId: id },
      orderBy: { joinedAt: 'asc' },
      include: {
        user: { select: { id: true, displayName: true, avatar: true, headline: true } },
      },
    });

    res.json({
      success: true,
      data: members.map((member) => ({
        id: member.id,
        joinedAt: member.joinedAt,
        isMuted: member.isMuted,
        user: member.user,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/members',
  authenticate,
  [body('userId').isString().notEmpty()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const { userId } = req.body;
      await requireChannelOwner(id, req.user!.id, req.user!.role);

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      const existing = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: id, userId } },
      });
      if (existing) {
        return res.json({ success: true, message: 'Already a member' });
      }

      await prisma.channelMember.create({ data: { channelId: id, userId } });
      await prisma.channel.update({
        where: { id },
        data: { memberCount: { increment: 1 } },
      });

      res.status(201).json({ success: true, message: 'Member added' });
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id/members/:userId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id, userId } = req.params;
    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      throw new ApiError(404, 'Channel not found');
    }

    // The owner can remove anyone; anyone else may only remove themselves.
    const isOwner = channel.ownerId === req.user!.id || req.user!.role === 'ADMIN';
    if (!isOwner && userId !== req.user!.id) {
      throw new ApiError(403, 'Only the channel owner can remove other members');
    }
    if (userId === channel.ownerId) {
      throw new ApiError(400, 'Owner cannot be removed from channel');
    }

    const deleted = await prisma.channelMember.deleteMany({
      where: { channelId: id, userId },
    });

    if (deleted.count > 0) {
      await prisma.channel.update({
        where: { id },
        data: { memberCount: { decrement: 1 } },
      });
    }

    res.json({ success: true, message: 'Member removed' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// PINNED MESSAGES
// ===========================================
router.get('/:id/pinned', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    await requireChannelAccess(id, req.user?.id);

    const messages = await prisma.channelMessage.findMany({
      where: { channelId: id, isPinned: true },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, displayName: true, avatar: true } } },
    });

    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// SEARCH MESSAGES
// ===========================================
router.get('/:id/search', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    await requireChannelAccess(id, req.user?.id);

    const query = normalizeOptionalUserText(req.query.q, {
      field: 'q',
      maxLength: 100,
      allowEmpty: true,
    });
    if (!query) {
      throw new ApiError(400, 'A search query is required');
    }

    const limit = parseLimit(req.query.limit, 20, 50);
    const messages = await prisma.channelMessage.findMany({
      where: { channelId: id, content: { contains: query, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { author: { select: { id: true, displayName: true, avatar: true } } },
    });

    res.json({ success: true, data: messages, query });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// MARK READ
// ===========================================
router.post('/:id/read', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const updated = await prisma.channelMember.updateMany({
      where: { channelId: id, userId: req.user!.id },
      data: { lastReadAt: new Date() },
    });

    if (updated.count === 0) {
      throw new ApiError(404, 'Not a member of this channel');
    }

    res.json({ success: true, message: 'Channel marked as read' });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// TYPING INDICATOR
// ===========================================

// Clients with a live socket should emit `channels:typing` directly. This REST
// entry point exists for callers that only speak HTTP; both land in the same
// channel room.
router.post('/:id/typing', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    await requireChannelAccess(id, req.user!.id);

    const stopped = req.body?.stopped === true;
    emitToChannel(id, stopped ? 'channels:user_stopped_typing' : 'channels:user_typing', {
      channelId: id,
      userId: req.user!.id,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// CHANNEL MESSAGES
// ===========================================
router.get('/:id/messages', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const limit = parseLimit(req.query.limit, 20, 50);
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : 1;

    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      throw new ApiError(404, 'Channel not found');
    }

    if (!channel.isPublic) {
      if (!req.user) {
        throw new ApiError(403, 'Private channel');
      }
      const member = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: id, userId: req.user.id } },
      });
      if (!member && channel.ownerId !== req.user.id) {
        throw new ApiError(403, 'Private channel');
      }
    }

    const [messages, total] = await Promise.all([
      prisma.channelMessage.findMany({
        where: { channelId: id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: { select: { id: true, displayName: true, avatar: true } },
          reactions: { select: { emoji: true, userId: true } },
        },
      }),
      prisma.channelMessage.count({ where: { channelId: id } }),
    ]);

    // The client renders one chip per emoji with a count and whether the viewer
    // reacted, so collapse the raw rows into that shape here.
    const viewerId = req.user?.id;
    const shaped = messages.map(({ reactions, ...message }) => {
      const byEmoji = new Map<string, { emoji: string; count: number; hasReacted: boolean }>();
      for (const reaction of reactions) {
        const entry = byEmoji.get(reaction.emoji) ?? {
          emoji: reaction.emoji,
          count: 0,
          hasReacted: false,
        };
        entry.count += 1;
        if (viewerId && reaction.userId === viewerId) entry.hasReacted = true;
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
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/messages',
  authenticate,
  [
    body('content').isString().notEmpty().isLength({ max: CONTENT_LIMITS.channelMessage }),
    body('mediaUrls').optional().isArray({ max: 10 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { id } = req.params;
      const channel = await prisma.channel.findUnique({ where: { id } });
      if (!channel) {
        throw new ApiError(404, 'Channel not found');
      }

      const isOwner = channel.ownerId === req.user!.id;
      const member = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: id, userId: req.user!.id } },
      });

      if (!isOwner && !member) {
        throw new ApiError(403, 'Not a channel member');
      }

      if (!channel.allowReplies && !isOwner) {
        throw new ApiError(403, 'Replies are disabled for this channel');
      }

      const message = await prisma.channelMessage.create({
        data: {
          channelId: id,
          authorId: req.user!.id,
          content: normalizeUserText(req.body.content, {
            field: 'content',
            maxLength: CONTENT_LIMITS.channelMessage,
          }),
          mediaUrls: normalizeMediaUrls(req.body.mediaUrls),
        },
        include: {
          author: { select: { id: true, displayName: true, avatar: true } },
        },
      });

      await prisma.channel.update({
        where: { id },
        data: { messageCount: { increment: 1 } },
      });

      // Everyone else in the room sees it without waiting for their next poll.
      emitToChannel(id, 'channels:message', { channelId: id, message });

      res.status(201).json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================
// EDIT / DELETE / PIN A CHANNEL MESSAGE
// ===========================================

// Resolves a message inside a channel and returns it along with who may act on
// it. Authors may edit and delete their own; channel owners may delete any
// message and are the only ones who can pin.
async function loadChannelMessage(channelId: string, messageId: string, userId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) {
    throw new ApiError(404, 'Channel not found');
  }

  const message = await prisma.channelMessage.findUnique({ where: { id: messageId } });
  if (!message || message.channelId !== channelId) {
    throw new ApiError(404, 'Message not found');
  }

  return {
    channel,
    message,
    isAuthor: message.authorId === userId,
    isOwner: channel.ownerId === userId,
  };
}

router.patch(
  '/:channelId/messages/:messageId',
  authenticate,
  [body('content').isString().notEmpty().isLength({ max: CONTENT_LIMITS.channelMessage })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { channelId, messageId } = req.params;
      const { isAuthor } = await loadChannelMessage(channelId, messageId, req.user!.id);

      if (!isAuthor) {
        throw new ApiError(403, 'You can only edit your own messages');
      }

      const updated = await prisma.channelMessage.update({
        where: { id: messageId },
        data: {
          content: normalizeUserText(req.body.content, {
            field: 'content',
            maxLength: CONTENT_LIMITS.channelMessage,
          }),
          editedAt: new Date(),
        },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:channelId/messages/:messageId',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { channelId, messageId } = req.params;
      const { isAuthor, isOwner } = await loadChannelMessage(channelId, messageId, req.user!.id);

      if (!isAuthor && !isOwner) {
        throw new ApiError(403, 'You can only delete your own messages');
      }

      await prisma.channelMessage.delete({ where: { id: messageId } });
      await prisma.channel.update({
        where: { id: channelId },
        data: { messageCount: { decrement: 1 } },
      });

      res.json({ success: true, message: 'Message deleted' });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:channelId/messages/:messageId/reactions',
  authenticate,
  [body('emoji').isString().trim().notEmpty().isLength({ max: 32 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, errors.array()[0].msg);
      }

      const { channelId, messageId } = req.params;
      await loadChannelMessage(channelId, messageId, req.user!.id);

      const emoji = String(req.body.emoji).trim();

      // The unique constraint makes this idempotent: reacting twice with the
      // same emoji is a no-op rather than a duplicate row or an error.
      const existing = await prisma.channelMessageReaction.findUnique({
        where: { messageId_userId_emoji: { messageId, userId: req.user!.id, emoji } },
      });

      if (!existing) {
        await prisma.channelMessageReaction.create({
          data: { messageId, userId: req.user!.id, emoji },
        });
        await prisma.channelMessage.update({
          where: { id: messageId },
          data: { reactionCount: { increment: 1 } },
        });
      }

      res.status(201).json({ success: true, message: 'Reaction added' });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:channelId/messages/:messageId/reactions/:emoji',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { channelId, messageId } = req.params;
      await loadChannelMessage(channelId, messageId, req.user!.id);

      const emoji = decodeURIComponent(req.params.emoji);
      const deleted = await prisma.channelMessageReaction.deleteMany({
        where: { messageId, userId: req.user!.id, emoji },
      });

      if (deleted.count > 0) {
        await prisma.channelMessage.update({
          where: { id: messageId },
          data: { reactionCount: { decrement: deleted.count } },
        });
      }

      res.json({ success: true, message: 'Reaction removed' });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:channelId/messages/:messageId/pin',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { channelId, messageId } = req.params;
      const { isOwner } = await loadChannelMessage(channelId, messageId, req.user!.id);

      if (!isOwner) {
        throw new ApiError(403, 'Only the channel owner can pin messages');
      }

      const updated = await prisma.channelMessage.update({
        where: { id: messageId },
        data: { isPinned: true },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:channelId/messages/:messageId/pin',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { channelId, messageId } = req.params;
      const { isOwner } = await loadChannelMessage(channelId, messageId, req.user!.id);

      if (!isOwner) {
        throw new ApiError(403, 'Only the channel owner can unpin messages');
      }

      const updated = await prisma.channelMessage.update({
        where: { id: messageId },
        data: { isPinned: false },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
