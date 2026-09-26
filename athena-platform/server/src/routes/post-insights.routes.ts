/**
 * What a post did, for the person who wrote it.
 *
 *   POST /api/posts/impressions          { ids[], source?, anonId? }   the client batches what was on screen
 *   GET  /api/posts/me/insights?days=30  totals across your recent posts, and the ones that carried furthest
 *   GET  /api/posts/:id/insights         one post: impressions, reach, engagement, where it was seen, reach by day
 *
 * Both impressions and reach count distinct viewers: one PostImpression row
 * per viewer per post, and Post.impressionCount moves only when such a row is
 * new. Anonymous readers count once per network address, through a keyed
 * hash of it (see anonymousKey).
 *
 * impressionCount used to be incremented once per id in every batch, while
 * the row behind it was deduplicated. The client sends each id once per page
 * load, so every reload and every re-navigation bumped it again: an author
 * was shown an "impressions" number that grew with her own scrolling, her
 * engagement rate was divided by it and came out too low, and the milestone
 * notice told her a post had "reached 1,000 people" when a few dozen had seen
 * it. A number the product puts in a congratulation has to be a number that
 * happened.
 *
 * Mounted ahead of post.routes.
 */

import { Router, type Request } from 'express';
import { createHmac } from 'crypto';
import { prisma } from '../utils/prisma';
import { getJwtSecretOrThrow } from '../utils/jwt';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { bestEffort } from '../utils/best-effort';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * The impression endpoint needs no account, so the only thing standing
 * between it and a script minting viewers was the global tier limit. Keyed by
 * address rather than by member, because the abuse is one caller pretending
 * to be many browsers, and set far above what a real reader's page loads
 * produce.
 */
const impressionLimiter = createRateLimiter({
  max: 240,
  windowMs: 10 * 60 * 1000,
  skip: () => process.env.NODE_ENV === 'test' || !process.env.REDIS_URL,
  keyGenerator: (req: Request) => `post:impressions:${(req as AuthRequest).user?.id || req.ip}`,
  handler: (_req, res) => {
    // Nothing the reader did is wrong and nothing on screen depends on the
    // answer, so this is quiet: the batch is dropped, not reported.
    res.status(204).end();
  },
});

const SOURCES = new Set(['feed', 'home', 'profile', 'post', 'saved', 'search', 'topic']);
const MAX_BATCH = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

function isId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

/**
 * Who an anonymous reader is, for counting: her network address, keyed with
 * the server's secret so the stored value cannot be turned back into it.
 *
 * This used to hash the browser's own random key together with the address,
 * and said that minting a new viewer therefore took a new address as well as
 * a new key. It did not: a new key from the same address was a new digest,
 * so one script behind one address could rotate `anonId` and add a viewer to
 * fifty posts a request, walking any of them to a "Your post reached 1,000
 * people" notice. Only the address counts now, so one address is at most one
 * anonymous viewer of a post, however many keys it presents.
 *
 * Several people behind one address — a household, an office, a phone
 * carrier's shared address — read as one. That is an undercount of people who
 * were not signed in, which is the direction a number put in a congratulation
 * is allowed to err. Signed-in readers are counted by account and are
 * unaffected.
 *
 * The browser's key is still required: it is how this site's own client
 * identifies a reader, and a bare request without one is not counted at all.
 * It no longer takes part in who the reader is. The keyed hash matters because
 * the address space is small enough that a plain hash of an address can be
 * reversed by trying them all; without the secret, these cannot.
 */
function anonymousKey(anonId: unknown, ip: string | undefined): string | null {
  if (typeof anonId !== 'string' || anonId.length < 8 || anonId.length > 64) return null;
  if (!ip) return null;
  const digest = createHmac('sha256', getJwtSecretOrThrow())
    .update(`post-impression-reader|${ip}`)
    .digest('hex')
    .slice(0, 24);
  return `anon:${digest}`;
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

/**
 * Reach milestones. impressionCount now moves one at a time and only for a
 * viewer who had not seen the post before, so a count that equals a milestone
 * has just crossed it and the number is genuinely people. One notification
 * per milestone, pointing at the post's insights.
 */
export const REACH_MILESTONES = [100, 1000, 10000, 100000];

export async function announceMilestones(postIds: string[]): Promise<void> {
  // A missed milestone note is still not worth a failed request: the caller
  // fires this off after the response has already gone out. What it is worth is
  // a line in the log. This was a bare `catch {}`, so if the notification table
  // started rejecting writes every author would simply stop being told her post
  // had carried, and the only evidence would be notifications that never
  // arrived. A failure part-way through still abandons the rest of the batch,
  // exactly as the catch around the loop always did.
  await bestEffort('post-insights.reach-milestone-notification', async () => {
    const crossed = await prisma.post.findMany({
      where: { id: { in: postIds }, impressionCount: { in: REACH_MILESTONES }, isHidden: false },
      select: { id: true, authorId: true, impressionCount: true, content: true, groupId: true },
    });
    for (const post of crossed) {
      const excerpt = post.content.trim().slice(0, 60);
      await prisma.notification.create({
        data: {
          userId: post.authorId,
          type: 'SYSTEM',
          title: `Your post reached ${post.impressionCount.toLocaleString('en-AU')} people`,
          message: excerpt
            ? `"${excerpt}${post.content.trim().length > 60 ? '…' : ''}" has been seen by ${post.impressionCount.toLocaleString('en-AU')} people. Open its insights to see where it travelled.`
            : `One of your posts has been seen by ${post.impressionCount.toLocaleString('en-AU')} people. Open its insights to see where it travelled.`,
          link: `/posts/${post.id}`,
          data: { milestone: post.impressionCount, postId: post.id, kind: 'reach' },
        },
      });
    }
  });
}

router.post('/impressions', optionalAuth, impressionLimiter, async (req: AuthRequest, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? Array.from(new Set((req.body.ids as unknown[]).filter(isId))).slice(0, MAX_BATCH)
      : [];
    const source = SOURCES.has(req.body?.source) ? String(req.body.source) : null;
    const viewerKey = req.user ? req.user.id : anonymousKey(req.body?.anonId, req.ip);

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

    // Which of these this viewer has already been counted for. The unique on
    // (postId, viewerKey) means createMany below silently drops those, and the
    // counter has to drop them with it — incrementing for the whole batch
    // regardless was the bug this file's header describes.
    const alreadySeen = new Set(
      (
        await prisma.postImpression.findMany({
          where: { postId: { in: postIds }, viewerKey },
          select: { postId: true },
        })
      ).map((row) => row.postId)
    );
    const freshIds = postIds.filter((postId) => !alreadySeen.has(postId));

    if (freshIds.length > 0) {
      await prisma.postImpression.createMany({
        data: freshIds.map((postId) => ({ postId, viewerKey, userId: req.user?.id ?? null, source })),
        skipDuplicates: true,
      });
      // Two tabs of the same browser reporting the same post in the same
      // instant can both read "not seen" and both increment, while the unique
      // constraint keeps one row. That leaves the counter one ahead of reach
      // for that post, which is a rounding error rather than the unbounded
      // drift it replaces; closing it properly wants the counter derived from
      // the rows rather than kept beside them.
      await prisma.post.updateMany({
        where: { id: { in: freshIds } },
        data: { impressionCount: { increment: 1 } },
      });
    }

    res.status(204).end();

    // After answering: a post that just crossed a round number tells its author.
    if (freshIds.length > 0) void announceMilestones(freshIds);
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
