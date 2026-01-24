import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';

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
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
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
    body('name').isString().notEmpty().isLength({ max: 100 }).withMessage('Channel name max 100 characters'),
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
          name: req.body.name,
          type: req.body.type,
          description: req.body.description,
          isPublic: req.body.isPublic ?? true,
          allowReplies: req.body.allowReplies ?? false,
          avatarUrl: req.body.avatarUrl,
          bannerUrl: req.body.bannerUrl,
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
    body('name').optional().isString(),
    body('description').optional().isString(),
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

      const updated = await prisma.channel.update({
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
        include: { author: { select: { id: true, displayName: true, avatar: true } } },
      }),
      prisma.channelMessage.count({ where: { channelId: id } }),
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
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/messages',
  authenticate,
  [body('content').isString().notEmpty().isLength({ max: 5000 }), body('mediaUrls').optional()],
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
          content: req.body.content,
          mediaUrls: req.body.mediaUrls,
        },
      });

      await prisma.channel.update({
        where: { id },
        data: { messageCount: { increment: 1 } },
      });

      res.status(201).json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
