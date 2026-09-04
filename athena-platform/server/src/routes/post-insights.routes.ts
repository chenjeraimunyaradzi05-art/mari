/**
 * What a post did, for the person who wrote it.
 *
 *   POST /api/posts/impressions          { ids[], source?, anonId? }   the client batches what was on screen
 *   GET  /api/posts/me/insights?days=30  totals across your recent posts, and the ones that carried furthest
 *   GET  /api/posts/:id/insights         one post: impressions, reach, engagement, where it was seen, reach by day
 *
 * Impressions count every showing (Post.impressionCount); reach is the number
 * of distinct people, one PostImpression row per viewer per post. Anonymous
 * readers count once per browser through a hashed key they generate
 * themselves. Your own posts never count when you look at them.
 *
 * Mounted ahead of post.routes.
 */

import { Router } from 'express';
import { createHash } from 'crypto';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const SOURCES = new Set(['feed', 'home', 'profile', 'post', 'saved', 'search', 'topic']);
const MAX_BATCH = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

function isId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

/** A browser's own random key, hashed so the raw value is never stored. */
function anonymousKey(anonId: unknown): string | null {
  if (typeof anonId !== 'string' || anonId.length < 8 || anonId.length > 64) return null;
  return `anon:${createHash('sha256').update(anonId).digest('hex').slice(0, 24)}`;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The last `days` days as YYYY-MM-DD, oldest first, ending today. */
function lastDays(days: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) out.push(dayKey(new Date(now.getTime() - i * DAY_MS)));
  return out;
}

function rate(engagements: number, impressions: number): number {
  return impressions > 0 ? Math.round((engagements / impressions) * 1000) / 10 : 0;
}

router.post('/impressions', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? Array.from(new Set((req.body.ids as unknown[]).filter(isId))).slice(0, MAX_BATCH)
      : [];
    const source = SOURCES.has(req.body?.source) ? String(req.body.source) : null;
    const viewerKey = req.user ? req.user.id : anonymousKey(req.body?.anonId);

    if (ids.length === 0 || !viewerKey) {
      res.status(204).end();
      return;
    }

    const visible = await prisma.post.findMany({
      where: {
        id: { in: ids },
        isHidden: false,
        ...(req.user ? { authorId: { not: req.user.id } } : {}),
      },
      select: { id: true },
    });
    const postIds = visible.map((p) => p.id);
    if (postIds.length === 0) {
      res.status(204).end();
      return;
    }

    await prisma.postImpression.createMany({
      data: postIds.map((postId) => ({ postId, viewerKey, userId: req.user?.id ?? null, source })),
      skipDuplicates: true,
    });
    await prisma.post.updateMany({ where: { id: { in: postIds } }, data: { impressionCount: { increment: 1 } } });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/me/insights', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(String(req.query.days ?? '30'), 10) || 30));
    const since = new Date(Date.now() - days * DAY_MS);
    const authorId = req.user!.id;

    const posts = await prisma.post.findMany({
      where: { authorId, isHidden: false, createdAt: { gte: since } },
      select: {
        id: true,
        content: true,
        type: true,
        mediaUrls: true,
        createdAt: true,
        impressionCount: true,
        likeCount: true,
        commentCount: true,
        repostCount: true,
      },
      orderBy: { impressionCount: 'desc' },
      take: 200,
    });
    const ids = posts.map((p) => p.id);

    const [viewers, saves, newFollowers] = await Promise.all([
      ids.length
        ? prisma.postImpression.groupBy({ by: ['viewerKey'], where: { postId: { in: ids } } })
        : Promise.resolve([] as Array<{ viewerKey: string }>),
      ids.length ? prisma.postSave.count({ where: { postId: { in: ids } } }) : Promise.resolve(0),
      prisma.follow.count({ where: { followingId: authorId, createdAt: { gte: since } } }),
    ]);

    const impressions = posts.reduce((sum, p) => sum + p.impressionCount, 0);
    const reactions = posts.reduce((sum, p) => sum + p.likeCount, 0);
    const comments = posts.reduce((sum, p) => sum + p.commentCount, 0);
    const reposts = posts.reduce((sum, p) => sum + p.repostCount, 0);
    const engagements = reactions + comments + reposts + saves;

    res.json({
      success: true,
      data: {
        days,
        posts: posts.length,
        impressions,
        reach: Array.isArray(viewers) ? viewers.length : 0,
        reactions,
        comments,
        reposts,
        saves,
        engagements,
        engagementRate: rate(engagements, impressions),
        newFollowers,
        top: posts.slice(0, 5).map((p) => ({
          id: p.id,
          excerpt: p.content.slice(0, 120),
          type: p.type,
          hasMedia: Array.isArray(p.mediaUrls) && p.mediaUrls.length > 0,
          createdAt: p.createdAt,
          impressions: p.impressionCount,
          engagements: p.likeCount + p.commentCount + p.repostCount,
          engagementRate: rate(p.likeCount + p.commentCount + p.repostCount, p.impressionCount),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/insights', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        createdAt: true,
        impressionCount: true,
        likeCount: true,
        commentCount: true,
        shareCount: true,
        repostCount: true,
      },
    });
    if (!post) {
      throw new ApiError(404, 'Post not found');
    }
    if (post.authorId !== req.user!.id && String(req.user!.role || '').toUpperCase() !== 'ADMIN') {
      throw new ApiError(403, 'Only the author can see how a post did');
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
    const [reach, reactionRows, comments, saves, sourceRows, recent] = await Promise.all([
      prisma.postImpression.count({ where: { postId: id } }),
      prisma.like.groupBy({ by: ['type'], where: { postId: id }, _count: { _all: true } }),
      prisma.comment.count({ where: { postId: id, isHidden: false } }),
      prisma.postSave.count({ where: { postId: id } }),
      prisma.postImpression.groupBy({ by: ['source'], where: { postId: id }, _count: { _all: true } }),
      prisma.postImpression.findMany({
        where: { postId: id, createdAt: { gte: weekAgo } },
        select: { createdAt: true },
      }),
    ]);

    const byType: Record<string, number> = {};
    let reactions = 0;
    for (const row of reactionRows) {
      const type = row.type ?? 'LIKE';
      byType[type] = (byType[type] ?? 0) + row._count._all;
      reactions += row._count._all;
    }

    const perDay = new Map<string, number>();
    for (const row of recent) {
      const key = dayKey(row.createdAt);
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }

    const engagements = reactions + comments + saves + post.repostCount;

    res.json({
      success: true,
      data: {
        postId: id,
        postedAt: post.createdAt,
        impressions: post.impressionCount,
        reach,
        reactions: { total: reactions, byType },
        comments,
        saves,
        reposts: post.repostCount,
        shares: post.shareCount,
        engagements,
        engagementRate: rate(engagements, post.impressionCount),
        sources: sourceRows
          .map((row) => ({ source: row.source ?? 'other', count: row._count._all }))
          .sort((a, b) => b.count - a.count),
        daily: lastDays(7, now).map((date) => ({ date, reach: perDay.get(date) ?? 0 })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
