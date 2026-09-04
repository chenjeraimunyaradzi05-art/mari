/**
 * Stories: a photo or clip that lasts 24 hours.
 *
 *   GET    /api/status/feed         one bucket per member, yours first; each story says whether you have seen it
 *   POST   /api/status              post one (with an optional caption)
 *   POST   /api/status/:id/view     you watched it: the ring goes quiet, the author's count goes up
 *   GET    /api/status/:id/viewers  who watched yours
 *   DELETE /api/status/:id
 */

import { Router } from 'express';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { prisma } from '../utils/prisma';
import { normalizeOptionalUserText, normalizeSafeUrl } from '../utils/contentSafety';

const router = Router();

type StoryType = 'image' | 'video';

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const CAPTION_MAX = 200;

/**
 * Which stories a viewer may see: everyone's public ones, their own, and the
 * close-friends stories of members who put them on their list.
 */
export function closeFriendsAudienceWhere(viewerId?: string) {
  if (!viewerId) return { audience: 'EVERYONE' as const };
  return {
    OR: [
      { audience: 'EVERYONE' as const },
      { userId: viewerId },
      { audience: 'CLOSE_FRIENDS' as const, user: { closeFriends: { some: { friendId: viewerId } } } },
    ],
  };
}

function normalizeStoryType(value: unknown): StoryType {
  return value === 'video' ? 'video' : 'image';
}

function displayNameOf(user: { displayName?: string | null; firstName?: string | null; lastName?: string | null } | null | undefined) {
  return user?.displayName?.trim() || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Member';
}

function storyView(story: {
  id: string;
  userId: string;
  type: string;
  mediaUrl: string;
  caption: string | null;
  audience?: string;
  viewCount: number;
  createdAt: Date;
  expiresAt: Date;
}, options: { viewed: boolean; isOwn: boolean }) {
  return {
    id: story.id,
    userId: story.userId,
    type: story.type === 'VIDEO' ? 'video' : 'image',
    mediaUrl: story.mediaUrl,
    caption: story.caption,
    audience: story.audience === 'CLOSE_FRIENDS' ? 'close_friends' : 'everyone',
    createdAt: story.createdAt.toISOString(),
    expiresAt: story.expiresAt.toISOString(),
    viewed: options.viewed,
    // Only the author sees the count; nobody else's curiosity is a metric.
    ...(options.isOwn ? { viewCount: story.viewCount } : {}),
  };
}

/**
 * GET /api/status/feed
 * Grouped stories, one bucket per member. The viewer's own bucket comes
 * first, then buckets with something unseen, then the rest, newest first.
 */
router.get('/feed', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const now = new Date();
    const viewerId = req.user?.id;

    const stories = await prisma.status.findMany({
      // Close-friends stories reach the author's list and the author.
      where: { expiresAt: { gt: now }, ...closeFriendsAudienceWhere(viewerId) },
      include: {
        user: { select: { id: true, displayName: true, firstName: true, lastName: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    const seen = new Set(
      viewerId && stories.length
        ? (
            await prisma.statusView.findMany({
              where: { userId: viewerId, statusId: { in: stories.map((s) => s.id) } },
              select: { statusId: true },
            })
          ).map((v) => v.statusId)
        : []
    );

    const byUser = new Map<string, { user: any; stories: ReturnType<typeof storyView>[]; hasUnseen: boolean; latest: string }>();
    for (const s of stories) {
      const isOwn = s.userId === viewerId;
      const viewed = isOwn || seen.has(s.id);
      const bucket = byUser.get(s.userId) || {
        user: { id: s.userId, displayName: displayNameOf(s.user), avatar: s.user?.avatar || null },
        stories: [],
        hasUnseen: false,
        latest: '',
      };
      bucket.stories.push(storyView(s, { viewed, isOwn }));
      if (!viewed) bucket.hasUnseen = true;
      bucket.latest = s.createdAt.toISOString();
      byUser.set(s.userId, bucket);
    }

    const feed = Array.from(byUser.values()).sort((a, b) => {
      if (viewerId) {
        if (a.user.id === viewerId) return -1;
        if (b.user.id === viewerId) return 1;
      }
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return b.latest.localeCompare(a.latest);
    });

    res.json({
      success: true,
      data: feed.map(({ latest: _latest, ...bucket }) => bucket),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/status
 */
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const type: StoryType = normalizeStoryType(req.body?.type);
    const mediaUrl = normalizeSafeUrl(req.body?.mediaUrl, {
      field: 'mediaUrl',
      allowRelativeUploads: true,
    });
    const caption = normalizeOptionalUserText(req.body?.caption, {
      field: 'caption',
      maxLength: CAPTION_MAX,
      allowEmpty: true,
    });
    const audience = req.body?.audience === 'close_friends' ? 'CLOSE_FRIENDS' : 'EVERYONE';

    const created = await prisma.status.create({
      data: {
        userId: req.user!.id,
        type: type === 'video' ? 'VIDEO' : 'IMAGE',
        mediaUrl,
        caption: caption || null,
        audience,
        expiresAt: new Date(Date.now() + STORY_TTL_MS),
      },
    });

    res.status(201).json({ success: true, data: storyView(created, { viewed: true, isOwn: true }) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/status/:id/view
 * Idempotent: watching twice is one view.
 */
router.post('/:id/view', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const story = await prisma.status.findFirst({
      where: { id: req.params.id, ...closeFriendsAudienceWhere(req.user!.id) },
      select: { id: true, userId: true, expiresAt: true, viewCount: true },
    });
    if (!story || story.expiresAt.getTime() <= Date.now()) throw new ApiError(404, 'Story not found');

    // Authors watching their own story are not an audience.
    if (story.userId === req.user!.id) {
      res.json({ success: true, viewCount: story.viewCount });
      return;
    }

    const existing = await prisma.statusView.findUnique({
      where: { statusId_userId: { statusId: story.id, userId: req.user!.id } },
      select: { id: true },
    });
    if (existing) {
      res.json({ success: true, viewCount: story.viewCount });
      return;
    }

    const [, updated] = await prisma.$transaction([
      prisma.statusView.create({ data: { statusId: story.id, userId: req.user!.id } }),
      prisma.status.update({ where: { id: story.id }, data: { viewCount: { increment: 1 } }, select: { viewCount: true } }),
    ]);
    res.status(201).json({ success: true, viewCount: updated.viewCount });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/status/:id/viewers (author only)
 */
router.get('/:id/viewers', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const story = await prisma.status.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, viewCount: true },
    });
    if (!story) throw new ApiError(404, 'Story not found');
    if (story.userId !== req.user!.id) throw new ApiError(403, 'Only the author can see who watched');

    const views = await prisma.statusView.findMany({
      where: { statusId: story.id },
      include: { user: { select: { id: true, displayName: true, firstName: true, lastName: true, avatar: true } } },
      orderBy: { viewedAt: 'desc' },
      take: 100,
    });

    res.json({
      success: true,
      data: {
        viewCount: story.viewCount,
        viewers: views.map((view) => ({
          id: view.user.id,
          displayName: displayNameOf(view.user),
          avatar: view.user.avatar,
          viewedAt: view.viewedAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/status/:id
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const story = await prisma.status.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true },
    });
    if (!story) throw new ApiError(404, 'Story not found');
    if (story.userId !== req.user!.id) throw new ApiError(403, 'Not allowed');

    await prisma.status.delete({ where: { id: story.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
