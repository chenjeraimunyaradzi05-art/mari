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
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { decoratePosts } from '../services/post-decoration.service';
import { attachSounds } from '../services/sound.service';
import { clampLimit } from '../utils/pagination';
import { authorAudienceWhere, authorVisibleWhere } from '../services/audience.service';
import { authorScopeFor, publicPostWhere, viewerContextFor } from '../services/search.service';
import { PUBLIC_AUTHOR_SELECT, maskLegalNamesInResponses } from '../utils/member-display';

const router = Router();

// Every answer from here goes to other members, so a member who is not the reader is
// named by her public name and her legal first and last name are never sent (see
// utils/member-display: the pseudonymous display name). The authors of a topic's posts are covered.
router.use(maskLegalNamesInResponses);

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
    select: PUBLIC_AUTHOR_SELECT,
  },
};

export type TopicCount = { tag: string; posts: number; videos: number; total: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rows read per round trip while reading a span. */
export const TRENDING_SCAN_BATCH = 1000;

/**
 * The spans the database is actually read over, in days. A window of any
 * length is answered from the shortest span that covers it: `?days=` takes
 * ninety values, and when each was read on its own, asking for all ninety in
 * turn cost ninety full reads a minute. Now it costs at most one read of each
 * span a minute, however many windows are asked for.
 */
export const TRENDING_SCAN_SPANS = [7, 30, 90] as const;

/**
 * How long a read is reused. The composer's # autocomplete asks for the 30-day
 * count on every keystroke, and a count that is a minute old is still the
 * right answer to "what is the community tagging this month".
 */
const TRENDING_MEMO_MS = 60_000;

/** A post or reel in a span that carries at least one tag, and when it went out. */
type TaggedItem = { at: number; kind: 'posts' | 'videos'; tags: string[] };

/**
 * Every tagged post and reel from the last `days` days, read in pages until
 * the span is exhausted.
 *
 * This used to read the newest 1,000 posts and the newest 1,000 reels and
 * count only those. Once the community posts more than that in a week, the
 * "this week" list was really "the last few hours", and nothing in the answer
 * said it had been cut short. Each post or reel counts once per tag it
 * carries, however many times the tag is repeated in it.
 */
async function readSpan(days: number, now: number): Promise<TaggedItem[]> {
  const since = new Date(now - days * DAY_MS);
  const items: TaggedItem[] = [];

  // Keyset paging on (date, id) rather than skip/take: an offset page re-reads
  // every row before it, and a post published mid-read would shift the pages
  // under it so that one row was counted twice and another missed. The "after
  // this row" test is written out in the where clause rather than handed to
  // Prisma as a cursor, because a Prisma cursor is looked up by id: a post
  // deleted between two pages would match nothing, the next page would come
  // back empty, and the count would end there looking complete.
  let lastPost: { createdAt: Date; id: string } | null = null;
  for (;;) {
    const after: Prisma.PostWhereInput | null = lastPost
      ? {
          OR: [
            { createdAt: { gt: lastPost.createdAt } },
            { createdAt: lastPost.createdAt, id: { gt: lastPost.id } },
          ],
        }
      : null;
    const page: Array<{ id: string; content: string; createdAt: Date }> = await prisma.post.findMany({
      where: {
        isHidden: false,
        isPublic: true,
        createdAt: { gte: since },
        content: { contains: '#' },
        // The count is one for everyone, so it is made of what a stranger may
        // be shown: no group's posts (authorAudienceWhere keeps them out), and
        // none by a member whose profile is private, connections-only or in
        // Safe Mode. A tag used only by them would otherwise trend, and be
        // offered by the composer, on the strength of posts nobody outside
        // their audience can open.
        AND: [authorAudienceWhere(), ...(after ? [after] : [])],
      },
      select: { id: true, content: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: TRENDING_SCAN_BATCH,
    });
    for (const post of page) {
      const tags = hashtagsIn(post.content);
      if (tags.length > 0) items.push({ at: post.createdAt.getTime(), kind: 'posts', tags });
    }
    if (page.length < TRENDING_SCAN_BATCH) break;
    const last = page[page.length - 1];
    lastPost = { createdAt: last.createdAt, id: last.id };
  }

  let lastReel: { publishedAt: Date; id: string } | null = null;
  for (;;) {
    const after: Prisma.VideoWhereInput | null = lastReel
      ? {
          OR: [
            { publishedAt: { gt: lastReel.publishedAt } },
            { publishedAt: lastReel.publishedAt, id: { gt: lastReel.id } },
          ],
        }
      : null;
    const page: Array<{ id: string; hashtags: string[]; publishedAt: Date | null }> = await prisma.video.findMany({
      where: {
        status: 'PUBLISHED',
        isHidden: false,
        publishedAt: { gte: since },
        author: authorVisibleWhere(),
        ...(after ? { AND: [after] } : {}),
      },
      select: { id: true, hashtags: true, publishedAt: true },
      orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }],
      take: TRENDING_SCAN_BATCH,
    });
    let tail: { publishedAt: Date; id: string } | null = null;
    for (const video of page) {
      // The where clause above only matches reels with a publication date.
      // Were one to come back without it, it could be placed in no window, and
      // the scan could not say where it had got to; dropping it quietly would
      // pass a partial count off as the whole.
      if (!video.publishedAt) throw new Error('A reel in the trending window came back without a publication date');
      // A reel's tags are typed by hand and can repeat ("#salary", "Salary").
      const tags = Array.from(new Set((video.hashtags ?? []).map(normalizeTag).filter(Boolean)));
      if (tags.length > 0) items.push({ at: video.publishedAt.getTime(), kind: 'videos', tags });
      tail = { publishedAt: video.publishedAt, id: video.id };
    }
    if (page.length < TRENDING_SCAN_BATCH) break;
    lastReel = tail;
  }

  return items;
}

/** Every tag carried by an item from `since` on, busiest first. */
function countTags(items: ReadonlyArray<TaggedItem>, since: number): TopicCount[] {
  const counts = new Map<string, { posts: number; videos: number }>();
  for (const item of items) {
    if (item.at < since) continue;
    for (const tag of item.tags) {
      const entry = counts.get(tag) ?? { posts: 0, videos: 0 };
      entry[item.kind] += 1;
      counts.set(tag, entry);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, entry]) => ({ tag, posts: entry.posts, videos: entry.videos, total: entry.posts + entry.videos }))
    .sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag));
}

// The promises are kept, not the results, so that ten keystrokes arriving while
// a read is still running wait for that read rather than each starting one.
type Memo<T> = { startedAt: number; value: Promise<T> };
const spanReads = new Map<number, Memo<TaggedItem[]>>();
const windowCounts = new Map<number, Memo<TopicCount[]>>();

/**
 * Keeps `value` under `key` for the next minute, unless it fails. A failure is
 * not kept: the caller is told (an empty list would say nobody is tagging
 * anything), and the next request tries again rather than being handed the
 * same failure for a minute.
 */
function remember<T>(memos: Map<number, Memo<T>>, key: number, startedAt: number, value: Promise<T>): Memo<T> {
  const entry = { startedAt, value };
  memos.set(key, entry);
  value.catch(() => {
    if (memos.get(key) === entry) memos.delete(key);
  });
  return entry;
}

const isFresh = <T>(memo: Memo<T> | undefined, now: number): memo is Memo<T> =>
  !!memo && now - memo.startedAt < TRENDING_MEMO_MS;

/** A read covering at least the last `days` days: one already running or made this minute, or a new one. */
function itemsCovering(days: number, now: number): Memo<TaggedItem[]> {
  for (const span of TRENDING_SCAN_SPANS) {
    if (span < days) continue;
    const memo = spanReads.get(span);
    if (isFresh(memo, now)) return memo;
  }
  const span = TRENDING_SCAN_SPANS.find((candidate) => candidate >= days) ?? 90;
  return remember(spanReads, span, now, readSpan(span, now));
}

/** Forgets every memoised read and count. For tests, which each need to start clean. */
export function resetTrendingTopicsCache(): void {
  spanReads.clear();
  windowCounts.clear();
}

/** Every tag used over the last `days` days (1 to 90), busiest first. */
export async function topicCountsFor(days: number): Promise<TopicCount[]> {
  const window = Number.isFinite(days) ? Math.min(Math.max(Math.floor(days), 1), 90) : 7;
  const now = Date.now();
  const memo = windowCounts.get(window);
  if (isFresh(memo, now)) return memo.value;
  const since = now - window * DAY_MS;
  const read = itemsCovering(window, now);
  // Dated from the read it was counted from, not from now, so that a count is
  // never more than a minute behind the database however it was arrived at.
  return remember(
    windowCounts,
    window,
    read.startedAt,
    read.value.then((items) => countTags(items, since))
  ).value;
}

/** Counts hashtags across recent posts and reels; the two are added together. */
export async function trendingTopics(days = 7, limit = 10): Promise<TopicCount[]> {
  const counted = await topicCountsFor(days);
  return counted.slice(0, Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 50) : 10);
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
    // Both are bounded: `days` is how far back the counting query reads.
    const days = clampLimit(req.query.days, 7, 90);
    const limit = clampLimit(req.query.limit, 10, 50);
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
    // Every tag in the month, not the busiest fifty: a topic that is 51st by
    // volume is still the one she is typing, and used to go unoffered.
    const topics = await topicCountsFor(30);
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

    // A topic page is open to anyone, signed in or not, and lists whole posts
    // and reels with their authors. It asked only "public, not hidden, not in a
    // group", so a member whose profile is private or connections-only had her
    // posts listed to strangers, a member in Safe Mode her reels, and a member
    // the viewer had blocked both. Read before anything is listed, and not
    // best-effort: a lookup that fails fails the page rather than listing
    // everyone.
    const viewer = await viewerContextFor(req.user?.id);
    const postWhere: Prisma.PostWhereInput = {
      AND: [publicPostWhere(viewer), { content: { contains: `#${tag}`, mode: 'insensitive' } }],
    };
    const reelWhere: Prisma.VideoWhereInput = {
      status: 'PUBLISHED',
      isHidden: false,
      hashtags: { has: tag },
      ...authorScopeFor(viewer),
    };

    const [posts, videos, postTotal, videoTotal, followers, mine] = await Promise.all([
      prisma.post.findMany({
        where: postWhere,
        include: AUTHOR_SELECT,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.video.findMany({
        where: reelWhere,
        include: { author: { select: { id: true, displayName: true, avatar: true } } },
        orderBy: [{ engagementScore: 'desc' }, { publishedAt: 'desc' }],
        take: 12,
      }),
      prisma.post.count({ where: postWhere }),
      prisma.video.count({ where: reelWhere }),
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
