/**
 * Topics: hashtags as first-class places.
 *
 *   GET    /api/topics/trending?days=7   what the community is tagging this week
 *   GET    /api/topics/me/following      the topics you follow
 *   GET    /api/topics/:tag              the topic's posts, reels, counts and related tags
 *   POST   /api/topics/:tag/follow       follow it: the ranked feed boosts it and says so
 *   DELETE /api/topics/:tag/follow
 *
 * Following is stored in UserFeedPreferences.followedHashtags, which the
 * feed ranking reads. The column existed for years with nothing writing it.
 */

import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { decoratePosts } from '../services/post-decoration.service';
import { attachSounds } from '../services/sound.service';

const router = Router();

const HASHTAG_PATTERN = /#([\p{L}\p{N}_]{2,64})/gu;

export function normalizeTag(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/^#+/, '').toLowerCase().slice(0, 64) : '';
}

export function hashtagsIn(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const match of text.matchAll(HASHTAG_PATTERN)) found.add(match[1].toLowerCase());
  return Array.from(found);
}

const AUTHOR_SELECT = {
  author: {
    select: { id: true, firstName: true, lastName: true, displayName: true, avatar: true, headline: true },
  },
};

/** Counts hashtags across recent posts and reels; the two are added together. */
export async function trendingTopics(days = 7, limit = 10) {
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 90) * 24 * 60 * 60 * 1000);
  const [posts, videos] = await Promise.all([
    prisma.post.findMany({
      where: { isHidden: false, isPublic: true, groupId: null, createdAt: { gte: since }, content: { contains: '#' } },
      select: { content: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
    prisma.video.findMany({
      where: { status: 'PUBLISHED', isHidden: false, publishedAt: { gte: since } },
      select: { hashtags: true },
      orderBy: { publishedAt: 'desc' },
      take: 1000,
    }),
  ]);

  const counts = new Map<string, { posts: number; videos: number }>();
  for (const post of posts) {
    for (const tag of hashtagsIn(post.content)) {
      const entry = counts.get(tag) ?? { posts: 0, videos: 0 };
      entry.posts += 1;
      counts.set(tag, entry);
    }
  }
  for (const video of videos) {
    for (const raw of video.hashtags ?? []) {
      const tag = normalizeTag(raw);
      if (!tag) continue;
      const entry = counts.get(tag) ?? { posts: 0, videos: 0 };
      entry.videos += 1;
      counts.set(tag, entry);
    }
  }

  return Array.from(counts.entries())
    .map(([tag, entry]) => ({ tag, posts: entry.posts, videos: entry.videos, total: entry.posts + entry.videos }))
    .sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag))
    .slice(0, Math.min(Math.max(limit, 1), 50));
}

async function followedTagsOf(userId: string): Promise<string[]> {
  const prefs = await prisma.userFeedPreferences.findUnique({
    where: { userId },
    select: { followedHashtags: true },
  });
  return (prefs?.followedHashtags ?? []).map(normalizeTag).filter(Boolean);
}

router.get('/trending', async (req, res, next) => {
  try {
    const days = typeof req.query.days === 'string' ? parseInt(req.query.days, 10) || 7 : 7;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) || 10 : 10;
    res.json({ success: true, data: await trendingTopics(days, limit), days });
  } catch (error) {
    next(error);
  }
});

router.get('/me/following', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json({ success: true, data: await followedTagsOf(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/topics/suggest?q=lead
 * The composer's # autocomplete: topics in use over the last 30 days that
 * start with what was typed, busiest first. An empty query gives the busiest.
 */
router.get('/suggest', optionalAuth, async (req, res, next) => {
  try {
    const q = normalizeTag(req.query.q).slice(0, 40);
    const topics = await trendingTopics(30, 200);
    const matches = topics
      .filter((t) => (q ? t.tag.startsWith(q) : true))
      .slice(0, 8)
      .map((t) => ({ tag: t.tag, count: t.posts + t.videos }));
    // What was typed is always a valid new topic, offered when nothing matches it exactly.
    if (q.length >= 2 && !matches.some((m) => m.tag === q)) {
      matches.push({ tag: q, count: 0 });
    }
    res.json({ success: true, data: matches.slice(0, 8) });
  } catch (error) {
    next(error);
  }
});

router.get('/:tag', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const tag = normalizeTag(req.params.tag);
    if (!tag) throw new ApiError(400, 'A topic needs a name');

    const [posts, videos, postTotal, videoTotal, followers, mine] = await Promise.all([
      prisma.post.findMany({
        where: { isHidden: false, isPublic: true, groupId: null, content: { contains: `#${tag}`, mode: 'insensitive' } },
        include: AUTHOR_SELECT,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.video.findMany({
        where: { status: 'PUBLISHED', isHidden: false, hashtags: { has: tag } },
        include: { author: { select: { id: true, displayName: true, avatar: true } } },
        orderBy: [{ engagementScore: 'desc' }, { publishedAt: 'desc' }],
        take: 12,
      }),
      prisma.post.count({ where: { isHidden: false, isPublic: true, groupId: null, content: { contains: `#${tag}`, mode: 'insensitive' } } }),
      prisma.video.count({ where: { status: 'PUBLISHED', isHidden: false, hashtags: { has: tag } } }),
      prisma.userFeedPreferences.count({ where: { followedHashtags: { has: tag } } }),
      req.user ? followedTagsOf(req.user.id) : Promise.resolve([] as string[]),
    ]);

    // Tags that travel with this one, from the posts on the page.
    const related = new Map<string, number>();
    for (const post of posts) {
      for (const other of hashtagsIn(post.content)) {
        if (other === tag) continue;
        related.set(other, (related.get(other) ?? 0) + 1);
      }
    }

    res.json({
      success: true,
      data: {
        tag,
        counts: { posts: postTotal, videos: videoTotal, followers },
        isFollowing: mine.includes(tag),
        related: Array.from(related.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name]) => name),
        posts: await decoratePosts(posts, req.user?.id),
        videos: await attachSounds(videos),
      },
    });
  } catch (error) {
    next(error);
  }
});

async function setFollowing(userId: string, tag: string, follow: boolean) {
  const current = await followedTagsOf(userId);
  const next = follow ? Array.from(new Set([...current, tag])).slice(0, 100) : current.filter((t) => t !== tag);
  await prisma.userFeedPreferences.upsert({
    where: { userId },
    update: { followedHashtags: next },
    create: {
      userId,
      followedHashtags: next,
      followedCategories: [],
      blockedHashtags: [],
      blockedCreators: [],
      searchHistory: [],
    },
  });
  return next;
}

router.post('/:tag/follow', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const tag = normalizeTag(req.params.tag);
    if (!tag) throw new ApiError(400, 'A topic needs a name');
    const following = await setFollowing(req.user!.id, tag, true);
    res.status(201).json({ success: true, data: { tag, isFollowing: true, following } });
  } catch (error) {
    next(error);
  }
});

router.delete('/:tag/follow', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const tag = normalizeTag(req.params.tag);
    if (!tag) throw new ApiError(400, 'A topic needs a name');
    const following = await setFollowing(req.user!.id, tag, false);
    res.json({ success: true, data: { tag, isFollowing: false, following } });
  } catch (error) {
    next(error);
  }
});

export default router;
