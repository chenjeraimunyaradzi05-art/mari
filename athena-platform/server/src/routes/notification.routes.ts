import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

type NotificationPreferencesFull = {
  email: {
    jobMatches: boolean;
    applications: boolean;
    messages: boolean;
    mentions: boolean;
    newsletter: boolean;
  };
  push: {
    jobMatches: boolean;
    applications: boolean;
    messages: boolean;
    mentions: boolean;
  };
  inApp: {
    all: boolean;
  };
};

type NotificationPreferences = Partial<NotificationPreferencesFull>;

const defaultNotificationPreferences: NotificationPreferencesFull = {
  email: {
    jobMatches: true,
    applications: true,
    messages: true,
    mentions: true,
    newsletter: true,
  },
  push: {
    jobMatches: true,
    applications: true,
    messages: true,
    mentions: true,
  },
  inApp: {
    all: true,
  },
};

const isPlainObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function validatePreferences(input: unknown): NotificationPreferences {
  if (!isPlainObject(input)) return {};

  const result: NotificationPreferences = {};

  const coerceSection = (
    section: unknown,
    allowed: string[],
  ): Record<string, boolean> | undefined => {
    if (!isPlainObject(section)) return undefined;
    const out: Record<string, boolean> = {};
    for (const key of allowed) {
      if (section[key] === undefined) continue;
      if (typeof section[key] !== 'boolean') {
        throw new ApiError(400, 'Invalid notification preferences');
      }
      out[key] = section[key];
    }
    return out;
  };

  const email = coerceSection(input.email, ['jobMatches', 'applications', 'messages', 'mentions', 'newsletter']);
  const push = coerceSection(input.push, ['jobMatches', 'applications', 'messages', 'mentions']);
  const inApp = coerceSection(input.inApp, ['all']);

  if (email) result.email = email as NotificationPreferencesFull['email'];
  if (push) result.push = push as NotificationPreferencesFull['push'];
  if (inApp) result.inApp = inApp as NotificationPreferencesFull['inApp'];

  return result;
}

function mergeNotificationPreferences(
  base: NotificationPreferencesFull,
  overrides: NotificationPreferences | undefined | null,
): NotificationPreferencesFull {
  const o = overrides || {};
  return {
    email: {
      ...base.email,
      ...(o.email || {}),
    },
    push: {
      ...base.push,
      ...(o.push || {}),
    },
    inApp: {
      ...base.inApp,
      ...(o.inApp || {}),
    },
  };
}

// ===========================================
// GET ALL NOTIFICATIONS
// ===========================================
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { page = '1', limit = '20', unreadOnly = 'false' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      userId: req.user!.id,
    };

    if (unreadOnly === 'true') {
      where.readAt = null;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.notification.count({ where }),
    ]);

    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user!.id,
        readAt: null,
      },
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// MARK NOTIFICATION AS READ
// ===========================================
router.patch('/:id/read', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }

    if (notification.userId !== req.user!.id) {
      throw new ApiError(403, 'Not authorized');
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// MARK ALL NOTIFICATIONS AS READ
// ===========================================
router.patch('/read-all', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user!.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// DELETE ALL READ NOTIFICATIONS
// ===========================================
router.delete('/clear-read', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.deleteMany({
      where: {
        userId: req.user!.id,
        readAt: { not: null },
      },
    });

    res.json({
      success: true,
      message: 'Read notifications cleared',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// DELETE NOTIFICATION
// ===========================================
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }

    if (notification.userId !== req.user!.id) {
      throw new ApiError(403, 'Not authorized');
    }

    await prisma.notification.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// GET NOTIFICATION PREFERENCES
// ===========================================
router.get('/preferences', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      // Cast to any so this compiles even if Prisma client isn't regenerated yet.
      select: { notificationPreferences: true } as any,
    });

    const stored = isPlainObject((user as any)?.notificationPreferences)
      ? (user as any).notificationPreferences
      : null;

    const preferences = mergeNotificationPreferences(
      defaultNotificationPreferences,
      stored as NotificationPreferences | null,
    );

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    next(error);
  }
});

// ===========================================
// UPDATE NOTIFICATION PREFERENCES
// ===========================================
router.patch('/preferences', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const input = (req.body && (req.body.preferences ?? req.body)) ?? {};
    const updateParsed = validatePreferences(input);

    const current = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { notificationPreferences: true } as any,
    });

    const currentStored = isPlainObject((current as any)?.notificationPreferences)
      ? (current as any).notificationPreferences
      : null;

    const base = mergeNotificationPreferences(
      defaultNotificationPreferences,
      currentStored as NotificationPreferences | null,
    );

    const merged = mergeNotificationPreferences(base, updateParsed);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { notificationPreferences: merged } as any,
    });

    res.json({
      success: true,
      message: 'Notification preferences updated',
      data: merged,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
