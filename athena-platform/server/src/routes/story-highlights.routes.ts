/**
 * Story highlights: stories a member keeps on their profile after the 24 hours.
 *
 *   GET    /api/status/highlights/archive          your past stories, newest first, expired ones included
 *   GET    /api/status/highlights/user/:userId     someone's highlights with their items
 *   POST   /api/status/highlights                  { title, statusIds[] }
 *   PATCH  /api/status/highlights/:id              { title?, coverUrl? }
 *   DELETE /api/status/highlights/:id
 *   POST   /api/status/highlights/:id/items        { statusId }   add one of your stories
 *   DELETE /api/status/highlights/:id/items/:itemId
 *
 * Each item copies the story's media and caption, so a highlight outlives the
 * story it was made from. Mounted ahead of status.routes.
 */

import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { isBlockedRelationship } from '../utils/safety-store';
import { normalizeOptionalUserText, normalizeSafeUrl, normalizeUserText } from '../utils/contentSafety';

const router = Router();

const TITLE_MAX = 30;
const MAX_HIGHLIGHTS = 20;
const MAX_ITEMS = 50;

type ItemRow = {
  id: string;
  statusId: string | null;
  type: string;
  mediaUrl: string;
  caption: string | null;
  takenAt: Date;
  position: number;
};

type HighlightRow = {
  id: string;
  userId: string;
  title: string;
  coverUrl: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  items: ItemRow[];
};

function itemView(item: ItemRow, userId: string) {
  return {
    id: item.id,
    statusId: item.statusId,
    userId,
    type: item.type === 'VIDEO' ? 'video' : 'image',
    mediaUrl: item.mediaUrl,
    caption: item.caption,
    createdAt: item.takenAt.toISOString(),
    position: item.position,
  };
}

function highlightView(row: HighlightRow) {
  const items = [...row.items].sort((a, b) => a.position - b.position);
  const firstImage = items.find((i) => i.type !== 'VIDEO') ?? items[0];
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    coverUrl: row.coverUrl ?? firstImage?.mediaUrl ?? null,
    itemCount: items.length,
    updatedAt: row.updatedAt.toISOString(),
    items: items.map((item) => itemView(item, row.userId)),
  };
}

const ITEMS_INCLUDE = { items: { orderBy: { position: 'asc' as const } } };

async function loadOwnHighlight(id: string, userId: string) {
  const row = await prisma.storyHighlight.findUnique({ where: { id }, include: ITEMS_INCLUDE });
  if (!row || row.userId !== userId) {
    throw new ApiError(404, 'Highlight not found');
  }
  return row;
}

/** Your own stories that match, in the order asked for. */
async function loadOwnStories(statusIds: string[], userId: string) {
  const unique = Array.from(new Set(statusIds.filter((id) => typeof id === 'string'))).slice(0, MAX_ITEMS);
  if (unique.length === 0) return [];
  const rows = await prisma.status.findMany({ where: { id: { in: unique }, userId } });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return unique.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row));
}

router.get('/archive', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const now = new Date();
    const stories = await prisma.status.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({
      success: true,
      data: stories.map((s) => ({
        id: s.id,
        userId: s.userId,
        type: s.type === 'VIDEO' ? 'video' : 'image',
        mediaUrl: s.mediaUrl,
        caption: s.caption,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        expired: s.expiresAt.getTime() <= now.getTime(),
        viewCount: s.viewCount,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/user/:userId', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.params;
    if (req.user && req.user.id !== userId && (await isBlockedRelationship(req.user.id, userId))) {
      res.json({ success: true, data: [] });
      return;
    }
    const rows = await prisma.storyHighlight.findMany({
      where: { userId },
      include: ITEMS_INCLUDE,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ success: true, data: rows.map(highlightView) });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const title = normalizeUserText(req.body?.title, { field: 'title', maxLength: TITLE_MAX });
    const stories = await loadOwnStories(Array.isArray(req.body?.statusIds) ? req.body.statusIds : [], userId);
    if (stories.length === 0) {
      throw new ApiError(400, 'Pick at least one of your stories');
    }

    const count = await prisma.storyHighlight.count({ where: { userId } });
    if (count >= MAX_HIGHLIGHTS) {
      throw new ApiError(400, `You can keep up to ${MAX_HIGHLIGHTS} highlights`);
    }

    const created = await prisma.storyHighlight.create({
      data: {
        userId,
        title,
        position: count,
        items: {
          create: stories.map((story, index) => ({
            statusId: story.id,
            type: story.type,
            mediaUrl: story.mediaUrl,
            caption: story.caption,
            takenAt: story.createdAt,
            position: index,
          })),
        },
      },
      include: ITEMS_INCLUDE,
    });

    res.status(201).json({ success: true, message: 'Highlight created', data: highlightView(created) });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const existing = await loadOwnHighlight(req.params.id, req.user!.id);
    const data: { title?: string; coverUrl?: string | null } = {};
    if (req.body?.title !== undefined) {
      data.title = normalizeUserText(req.body.title, { field: 'title', maxLength: TITLE_MAX });
    }
    if (req.body?.coverUrl !== undefined) {
      data.coverUrl = req.body.coverUrl
        ? normalizeSafeUrl(req.body.coverUrl, { field: 'coverUrl', allowRelativeUploads: true })
        : null;
    }
    const updated = await prisma.storyHighlight.update({
      where: { id: existing.id },
      data,
      include: ITEMS_INCLUDE,
    });
    res.json({ success: true, data: highlightView(updated) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const existing = await loadOwnHighlight(req.params.id, req.user!.id);
    await prisma.storyHighlight.delete({ where: { id: existing.id } });
    res.json({ success: true, message: 'Highlight removed' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/items', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const highlight = await loadOwnHighlight(req.params.id, req.user!.id);
    const statusId = typeof req.body?.statusId === 'string' ? req.body.statusId : '';
    if (highlight.items.some((item) => item.statusId === statusId)) {
      res.json({ success: true, message: 'Already in this highlight', data: highlightView(highlight) });
      return;
    }
    const [story] = await loadOwnStories([statusId], req.user!.id);
    if (!story) {
      throw new ApiError(404, 'Story not found');
    }
    if (highlight.items.length >= MAX_ITEMS) {
      throw new ApiError(400, `A highlight holds up to ${MAX_ITEMS} stories`);
    }

    const caption = normalizeOptionalUserText(story.caption, { field: 'caption', maxLength: 200, allowEmpty: true });
    await prisma.storyHighlightItem.create({
      data: {
        highlightId: highlight.id,
        statusId: story.id,
        type: story.type,
        mediaUrl: story.mediaUrl,
        caption: caption || null,
        takenAt: story.createdAt,
        position: highlight.items.length,
      },
    });
    const updated = await loadOwnHighlight(highlight.id, req.user!.id);
    res.status(201).json({ success: true, message: 'Added to highlight', data: highlightView(updated) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/items/:itemId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const highlight = await loadOwnHighlight(req.params.id, req.user!.id);
    const item = highlight.items.find((i) => i.id === req.params.itemId);
    if (!item) {
      throw new ApiError(404, 'Story not in this highlight');
    }
    await prisma.storyHighlightItem.delete({ where: { id: item.id } });
    const updated = await loadOwnHighlight(highlight.id, req.user!.id);
    res.json({ success: true, message: 'Removed from highlight', data: highlightView(updated) });
  } catch (error) {
    next(error);
  }
});

export default router;
