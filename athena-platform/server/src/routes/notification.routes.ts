import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { groupNotifications, type NotificationRow } from '../services/notification-grouping.service';
import { registerPushToken } from '../services/push.service';

const router = Router();

// ===========================================
// PUSH TOKENS
// ===========================================
// The mobile app hands over its Expo push token after sign-in and takes it
// back on sign-out. A token is a device, not a person — but it is not moved to
// whoever names it. This route used to reassign any known token to the caller,
// so a member who had another's token could take over her phone's
// notifications: the other woman's safety alerts and message previews would
// stop reaching her and start reaching nobody she chose. A token now moves
// only when the request proves it holds the device, through the key the
// device was issued the first time it registered; see registerPushToken.
// Declared ahead of the /:id routes so DELETE /push-token is never read as a
// notification id.

const TOKEN_MAX = 4096;
const PLATFORMS = new Set(['ios', 'android', 'web']);

function tokenFrom(body: unknown, query: unknown): string | null {
  const raw =
    (body && typeof body === 'object' && typeof (body as { token?: unknown }).token === 'string'
      ? (body as { token: string }).token
      : undefined) ??
    (query && typeof query === 'object' && typeof (query as { token?: unknown }).token === 'string'
      ? (query as { token: string }).token
      : undefined);
  const token = raw?.trim();
  if (!token || token.length > TOKEN_MAX) return null;
  return token;
}

router.post('/push-token', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const token = tokenFrom(req.body, undefined);
    if (!token) throw new ApiError(400, 'A push token is required');

    const provider = typeof req.body?.provider === 'string' ? req.body.provider.toLowerCase() : 'expo';
    const isExpo = /^Expo(nent)?PushToken\[[^\]\s]+\]$/.test(token);
    if (provider === 'expo' && !isExpo) {
      throw new ApiError(400, 'That is not an Expo push token');
    }
    const requestedPlatform = typeof req.body?.platform === 'string' ? req.body.platform.toLowerCase() : '';
    const platform = PLATFORMS.has(requestedPlatform) ? requestedPlatform : provider === 'web' ? 'web' : 'android';
    // A caller-supplied deviceId is no longer read: PushToken.deviceId holds the
    // fingerprint of the key the server issued this device, which is what
    // proves possession when the token is already held by another account.
    const result = await registerPushToken({
      userId: req.user!.id,
      token,
      platform,
      deviceKey: req.body?.deviceKey,
    });

    if (result.outcome === 'held-by-another-account') {
      throw new ApiError(
        409,
        'This device is registered for notifications on another ATHENA account. Sign out of that account on this device first.'
      );
    }

    res.status(result.outcome === 'registered' ? 201 : 200).json({
      success: true,
      message:
        result.outcome === 'registered'
          ? 'Device registered'
          : result.outcome === 'moved'
            ? 'Device moved to this account'
            : 'Device updated',
      data: {
        id: result.id,
        platform: result.platform,
        ...(result.deviceKey ? { deviceKey: result.deviceKey } : {}),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/push-token', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const token = tokenFrom(req.body, req.query);
    if (!token) throw new ApiError(400, 'A push token is required');
    const result = await prisma.pushToken.updateMany({
      where: { token, userId: req.user!.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: result.count > 0 ? 'Device forgotten' : 'Device was not registered', data: { removed: result.count } });
  } catch (error) {
    next(error);
  }
});

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
    // The social kinds, each switchable on its own once "all" is on.
    likes: boolean;
    comments: boolean;
    follows: boolean;
    reposts: boolean;
    mentions: boolean;
  };
};

type NotificationPreferences = Partial<NotificationPreferencesFull>;

export const defaultNotificationPreferences: NotificationPreferencesFull = {
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
    likes: true,
    comments: true,
    follows: true,
    reposts: true,
    mentions: true,
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
  const inApp = coerceSection(input.inApp, ['all', 'likes', 'comments', 'follows', 'reposts', 'mentions']);

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

    // ?grouped=false returns the raw rows; the bell and the page read groups.
    const grouped =
      req.query.grouped === 'false'
        ? notifications
        : groupNotifications(notifications as unknown as NotificationRow[]);

    res.json({
      success: true,
      data: {
        notifications: grouped,
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
// MARK SEVERAL AS READ (a grouped row)
// ===========================================
router.patch('/read-many', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? (req.body.ids as unknown[]).filter((id): id is string => typeof id === 'string').slice(0, 200)
      : [];
    if (ids.length === 0) throw new ApiError(400, 'ids is required');

    const result = await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ success: true, count: result.count });
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
