/**
 * What a creator's posts and reels did, for the creator dashboard.
 *
 * The dashboard used to be built from posts alone. Creator Studio publishes
 * reels, so a creator whose work is all reels opened it to no posts, no views
 * and no likes. Its day-by-day series was wrong in a second way: it put each
 * post's lifetime view count on the day the post was written, so a post that
 * took off a week later showed nothing on the days it was actually being
 * watched, which is the one thing a creator reads that chart for.
 *
 * Here both kinds are counted, and every number "in the period" is built from
 * rows that carry a date, on the day each one happened, whatever the age of
 * the post or reel it landed on:
 *
 *   views     a post's PostImpression rows (one per viewer per post, which is
 *             what Post.impressionCount counts) and a reel's counted views (the
 *             rule POST /api/video/:id/view applies to Video.viewCount, replayed
 *             over its VideoView rows; see countedReelViews)
 *   likes     Like and VideoLike rows, reactions of every kind
 *   comments  Comment and VideoComment rows that are not hidden
 *
 * Her own likes and comments on her own work are not reach and are left out,
 * as the view counters already leave out her own views. Hidden posts, and reels
 * that are hidden or not published, are left out of everything.
 *
 * Days are UTC calendar days, as on the post insights page. The period is the
 * last `days` of them, today included, so that the day-by-day series adds up
 * to the period totals exactly: the old window started `days` × 24 hours ago,
 * mid-way through a day that its chart then had no column for, and left today
 * off the chart altogether.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long one member's watch of one reel stands for a single counted view.
 * A day, so rewatching a reel in the evening that she watched at breakfast
 * counts twice — which is a real second view — while a page that fires the
 * ping on every loop of a fifteen-second clip counts once.
 *
 * The view route applies this as each watch arrives, and the dashboard below
 * replays it over the stored watches; one constant keeps the two agreeing.
 */
export const COUNTED_VIEW_WINDOW_MS = DAY_MS;

/** How many pieces of content the dashboard lists as her top content. */
export const TOP_CONTENT_LIMIT = 5;

/** YYYY-MM-DD, in UTC. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Midnight UTC at the start of the first day of a `days`-day period ending today. */
export function periodStart(days: number, now = new Date()): Date {
  const first = new Date(now.getTime() - (days - 1) * DAY_MS);
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate()));
}

/** The days of the period as YYYY-MM-DD, oldest first, ending today. */
export function periodDays(days: number, now = new Date()): string[] {
  const start = periodStart(days, now).getTime();
  return Array.from({ length: days }, (_, i) => dayKey(new Date(start + i * DAY_MS)));
}

export type ReelWatch = { videoId: string; userId: string | null; createdAt: Date };

/**
 * The watches that counted as views, by the rule the view route applies: a
 * signed-in member other than the author, whose previous watch of the same
 * reel (counted or not) was more than COUNTED_VIEW_WINDOW_MS earlier.
 *
 * `watches` has to reach back one window before `since`, or a watch just
 * inside the period would be counted when the one that made it a rewatch sat
 * just outside it. Only watches from `since` on are returned.
 */
export function countedReelViews(watches: ReadonlyArray<ReelWatch>, authorId: string, since: Date): ReelWatch[] {
  const counts = reelViewCounter(authorId, since);
  return [...watches].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).filter(counts);
}

/**
 * The rule countedReelViews applies, one watch at a time: true when this watch
 * counted and falls inside the period. The watches have to be handed over in
 * the order they happened, which is how the dashboard's scan reads them, a
 * page at a time, without holding every watch in memory at once.
 */
export function reelViewCounter(authorId: string, since: Date): (watch: ReelWatch) => boolean {
  const lastWatch = new Map<string, number>();
  return (watch) => {
    if (!watch.userId || watch.userId === authorId) return false;
    const key = `${watch.videoId}\u0000${watch.userId}`;
    const at = watch.createdAt.getTime();
    const previous = lastWatch.get(key);
    lastWatch.set(key, at);
    if (previous !== undefined && at - previous < COUNTED_VIEW_WINDOW_MS) return false;
    return at >= since.getTime();
  };
}

/**
 * Rows read per round trip from the two tables that grow with every view:
 * post impressions and reel watches. A creator whose work is seen widely can
 * have hundreds of thousands of them in ninety days, and reading them in one
 * query held all of them in the server's memory at once to answer one page.
 */
export const ACTIVITY_SCAN_BATCH = 5000;

type ScanPosition = { createdAt: Date; id: string } | null;

/**
 * "After this row" in (createdAt, id) order, written into the where clause.
 * Not a Prisma cursor: that is looked up by id, so a row deleted between two
 * pages would end the scan early with a count that looked complete.
 */
function after(position: ScanPosition) {
  return position
    ? {
        AND: [
          {
            OR: [
              { createdAt: { gt: position.createdAt } },
              { createdAt: position.createdAt, id: { gt: position.id } },
            ],
          },
        ],
      }
    : {};
}

async function scanImpressions(
  where: Prisma.PostImpressionWhereInput,
  visit: (row: { postId: string; createdAt: Date }) => void
): Promise<void> {
  let position: ScanPosition = null;
  for (;;) {
    const page: Array<{ id: string; postId: string; createdAt: Date }> = await prisma.postImpression.findMany({
      where: { ...where, ...after(position) },
      select: { id: true, postId: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: ACTIVITY_SCAN_BATCH,
    });
    for (const row of page) visit(row);
    if (page.length < ACTIVITY_SCAN_BATCH) return;
    const last = page[page.length - 1];
    position = { createdAt: last.createdAt, id: last.id };
  }
}

async function scanWatches(where: Prisma.VideoViewWhereInput, visit: (watch: ReelWatch) => void): Promise<void> {
  let position: ScanPosition = null;
  for (;;) {
    const page: Array<ReelWatch & { id: string }> = await prisma.videoView.findMany({
      where: { ...where, ...after(position) },
      select: { id: true, videoId: true, userId: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: ACTIVITY_SCAN_BATCH,
    });
    for (const watch of page) visit(watch);
    if (page.length < ACTIVITY_SCAN_BATCH) return;
    const last = page[page.length - 1];
    position = { createdAt: last.createdAt, id: last.id };
  }
}

export type ContentKind = 'post' | 'reel';

export type ActivityCounts = { views: number; likes: number; comments: number };

export type CreatorContentItem = {
  kind: ContentKind;
  id: string;
  /** A reel's title; posts have none. */
  title: string | null;
  /** A post's text, or a reel's description. */
  content: string | null;
  thumbnailUrl: string | null;
  /** Where the member opens it. */
  link: string;
  /** When it went out: a post's creation, a reel's publication. */
  createdAt: Date;
  /** The counts printed on it now, over its whole life. */
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  /** What it gathered inside the period. */
  period: ActivityCounts;
};

export type CreatorDay = ActivityCounts & { date: string };

export type CreatorContentAnalytics = {
  days: number;
  /** The first instant of the period, for callers counting other things over the same days. */
  since: Date;
  period: ActivityCounts & {
    /** Posts she published in the period. */
    posts: number;
    /** Reels she published in the period. */
    reels: number;
  };
  lifetime: ActivityCounts & { posts: number; reels: number; shares: number };
  /** One entry per day of the period, oldest first; each sums to the period totals. */
  daily: CreatorDay[];
  /** Her busiest posts and reels in the period, busiest first. */
  top: CreatorContentItem[];
};

const emptyCounts = (): ActivityCounts => ({ views: 0, likes: 0, comments: 0 });

/**
 * How the dashboard has always ranked top content: views, with a like worth
 * five of them. Now over the period's activity rather than lifetime totals.
 */
const score = (counts: ActivityCounts) => counts.views + counts.likes * 5;

export async function creatorContentAnalytics(
  authorId: string,
  days: number,
  now = new Date()
): Promise<CreatorContentAnalytics> {
  const since = periodStart(days, now);
  const dayList = periodDays(days, now);
  const inPeriod = { gte: since, lte: now };

  const postScope = { authorId, isHidden: false };
  const reelScope = { authorId, isHidden: false, status: 'PUBLISHED' as const };

  const byDay = new Map<string, ActivityCounts>(dayList.map((date) => [date, emptyCounts()]));
  const byItem = new Map<string, { kind: ContentKind; id: string; counts: ActivityCounts; recency: number }>();
  const period = emptyCounts();

  const tally = (kind: ContentKind, id: string, at: Date, field: keyof ActivityCounts) => {
    const day = byDay.get(dayKey(at));
    // A row outside the listed days cannot come back from the queries below;
    // skipping it keeps the series and the totals equal if one ever did.
    if (!day) return;
    day[field] += 1;
    period[field] += 1;
    const key = `${kind}:${id}`;
    const item = byItem.get(key) ?? { kind, id, counts: emptyCounts(), recency: 0 };
    item.counts[field] += 1;
    byItem.set(key, item);
  };
  const reelViewCounts = reelViewCounter(authorId, since);

  const [
    ,
    ,
    postLikes,
    reelLikes,
    postComments,
    reelComments,
    postsPublished,
    reelsPublished,
    recentPosts,
    recentReels,
    postTotals,
    reelTotals,
  ] = await Promise.all([
    scanImpressions({ createdAt: inPeriod, post: postScope }, (row) => tally('post', row.postId, row.createdAt, 'views')),
    // One window further back than the period; see countedReelViews. Watches
    // with nobody signed in are never counted, so they are not fetched. The
    // scan hands them over oldest first, which is the order the rule needs.
    scanWatches(
      {
        createdAt: { gte: new Date(since.getTime() - COUNTED_VIEW_WINDOW_MS), lte: now },
        video: reelScope,
        userId: { not: null },
      },
      (watch) => {
        if (reelViewCounts(watch)) tally('reel', watch.videoId, watch.createdAt, 'views');
      }
    ),
    prisma.like.findMany({
      where: { createdAt: inPeriod, post: postScope, userId: { not: authorId } },
      select: { postId: true, createdAt: true },
    }),
    prisma.videoLike.findMany({
      where: { createdAt: inPeriod, video: reelScope, userId: { not: authorId } },
      select: { videoId: true, createdAt: true },
    }),
    prisma.comment.findMany({
      where: { createdAt: inPeriod, post: postScope, authorId: { not: authorId }, isHidden: false },
      select: { postId: true, createdAt: true },
    }),
    prisma.videoComment.findMany({
      where: { createdAt: inPeriod, video: reelScope, authorId: { not: authorId }, isHidden: false },
      select: { videoId: true, createdAt: true },
    }),
    prisma.post.count({ where: { ...postScope, createdAt: inPeriod } }),
    prisma.video.count({ where: { ...reelScope, publishedAt: inPeriod } }),
    // So that something she published this week is listed even before anyone
    // has seen it, rather than the list reading "nothing in this period".
    prisma.post.findMany({
      where: { ...postScope, createdAt: inPeriod },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: TOP_CONTENT_LIMIT,
    }),
    prisma.video.findMany({
      where: { ...reelScope, publishedAt: inPeriod },
      select: { id: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: TOP_CONTENT_LIMIT,
    }),
    prisma.post.aggregate({
      where: postScope,
      _count: { _all: true },
      _sum: { impressionCount: true, likeCount: true, commentCount: true, shareCount: true },
    }),
    prisma.video.aggregate({
      where: reelScope,
      _count: { _all: true },
      _sum: { viewCount: true, likeCount: true, commentCount: true, shareCount: true },
    }),
  ]);

  for (const row of postLikes) tally('post', row.postId, row.createdAt, 'likes');
  for (const row of reelLikes) tally('reel', row.videoId, row.createdAt, 'likes');
  for (const row of postComments) tally('post', row.postId, row.createdAt, 'comments');
  for (const row of reelComments) tally('reel', row.videoId, row.createdAt, 'comments');

  const addRecent = (kind: ContentKind, id: string, at: Date | null) => {
    const key = `${kind}:${id}`;
    const item = byItem.get(key) ?? { kind, id, counts: emptyCounts(), recency: 0 };
    item.recency = at ? at.getTime() : 0;
    byItem.set(key, item);
  };
  for (const post of recentPosts) addRecent('post', post.id, post.createdAt);
  for (const reel of recentReels) addRecent('reel', reel.id, reel.publishedAt);

  const ranked = Array.from(byItem.values())
    .sort(
      (a, b) =>
        score(b.counts) - score(a.counts) ||
        b.counts.comments - a.counts.comments ||
        b.recency - a.recency ||
        // The two scans above fill this map in whichever order their pages
        // arrive, so a full tie is settled by name rather than by that race.
        `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`)
    )
    .slice(0, TOP_CONTENT_LIMIT);

  const postIds = ranked.filter((item) => item.kind === 'post').map((item) => item.id);
  const reelIds = ranked.filter((item) => item.kind === 'reel').map((item) => item.id);
  const [postRows, reelRows] = await Promise.all([
    postIds.length
      ? prisma.post.findMany({
          where: { ...postScope, id: { in: postIds } },
          select: {
            id: true,
            content: true,
            createdAt: true,
            impressionCount: true,
            likeCount: true,
            commentCount: true,
            shareCount: true,
          },
        })
      : Promise.resolve([]),
    reelIds.length
      ? prisma.video.findMany({
          where: { ...reelScope, id: { in: reelIds } },
          select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            createdAt: true,
            publishedAt: true,
            viewCount: true,
            likeCount: true,
            commentCount: true,
            shareCount: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const posts = new Map(postRows.map((post) => [post.id, post]));
  const reels = new Map(reelRows.map((reel) => [reel.id, reel]));
  const top: CreatorContentItem[] = [];
  for (const item of ranked) {
    if (item.kind === 'post') {
      const post = posts.get(item.id);
      // Hidden or deleted between the two reads: left out, not shown blank.
      if (!post) continue;
      top.push({
        kind: 'post',
        id: post.id,
        title: null,
        content: post.content,
        thumbnailUrl: null,
        link: `/posts/${post.id}`,
        createdAt: post.createdAt,
        viewCount: post.impressionCount,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        shareCount: post.shareCount,
        period: item.counts,
      });
    } else {
      const reel = reels.get(item.id);
      if (!reel) continue;
      top.push({
        kind: 'reel',
        id: reel.id,
        title: reel.title,
        content: reel.description,
        thumbnailUrl: reel.thumbnailUrl,
        link: `/explore?video=${reel.id}`,
        createdAt: reel.publishedAt ?? reel.createdAt,
        viewCount: reel.viewCount,
        likeCount: reel.likeCount,
        commentCount: reel.commentCount,
        shareCount: reel.shareCount,
        period: item.counts,
      });
    }
  }

  // An aggregate over no rows sums to null.
  const sum = (value: number | null | undefined) => value ?? 0;

  return {
    days,
    since,
    period: { ...period, posts: postsPublished, reels: reelsPublished },
    lifetime: {
      posts: postTotals._count._all,
      reels: reelTotals._count._all,
      views: sum(postTotals._sum.impressionCount) + sum(reelTotals._sum.viewCount),
      likes: sum(postTotals._sum.likeCount) + sum(reelTotals._sum.likeCount),
      comments: sum(postTotals._sum.commentCount) + sum(reelTotals._sum.commentCount),
      shares: sum(postTotals._sum.shareCount) + sum(reelTotals._sum.shareCount),
    },
    daily: dayList.map((date) => ({ date, ...(byDay.get(date) ?? emptyCounts()) })),
    top,
  };
}

// ==========================================
// THE WHOLE DASHBOARD
// ==========================================

export type CreatorDashboardDay = CreatorDay & {
  /** Gift points she received that day. */
  gifts: number;
  /** Members who started following her that day and still do. */
  followers: number;
};

export type CreatorDashboardAnalytics = {
  days: number;
  since: Date;
  summary: {
    /** Posts she published in the period. */
    totalPosts: number;
    /** Reels she published in the period. */
    totalReels: number;
    /** Views, likes and comments in the period, on posts and reels of any age. */
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    /** Gift points received in the period, and her share of them. */
    totalGiftValue: number;
    totalEarningsFromGifts: number;
    newFollowers: number;
    /**
     * Likes and comments per hundred views in the period. Null when there were
     * no views: a rate over nothing is not a rate of zero.
     */
    engagementRate: number | null;
  };
  /** Everything her visible posts and published reels have gathered, ever. */
  lifetime: CreatorContentAnalytics['lifetime'];
  profile: { totalEarnings: number; pendingPayout: number };
  /** One entry per day of the period, oldest first; each column sums to the summary. */
  dailyStats: CreatorDashboardDay[];
  /** Her busiest posts and reels in the period, each marked with its kind. */
  topPosts: CreatorContentItem[];
};

/**
 * Everything GET /api/creator/analytics answers, in the shape the creator
 * dashboard has always read, with reels in it.
 *
 * The old answer was built in creator.service from posts alone: `totalPosts`
 * was a count of posts, the view, like and comment totals were the lifetime
 * counters of the posts written in the period, `topPosts` could never hold a
 * reel, and `totalShares` summed lifetime shares the same way. Every one of
 * those now comes from creatorContentAnalytics above. `totalShares` is gone
 * from the summary rather than carried over, because no share leaves a dated
 * row, so "shares in the period" cannot be counted; lifetime shares are under
 * `lifetime`.
 *
 * Gifts and new followers are counted over the same calendar days as the
 * content, so the day-by-day series lines up column for column. A failed read
 * of any part fails the whole answer: the page says the analytics are
 * unavailable, which is true, rather than showing zeros, which would not be.
 */
export async function creatorDashboardAnalytics(
  userId: string,
  days: number,
  now = new Date()
): Promise<CreatorDashboardAnalytics> {
  const since = periodStart(days, now);
  const inPeriod = { gte: since, lte: now };

  const [content, gifts, follows, profile] = await Promise.all([
    creatorContentAnalytics(userId, days, now),
    prisma.giftTransaction.findMany({
      where: { receiverId: userId, createdAt: inPeriod },
      select: { giftValue: true, creatorShare: true, createdAt: true },
    }),
    prisma.follow.findMany({
      where: { followingId: userId, createdAt: inPeriod },
      select: { createdAt: true },
    }),
    prisma.creatorProfile.findUnique({
      where: { userId },
      select: { totalEarnings: true, pendingPayout: true },
    }),
  ]);

  const giftsByDay = new Map<string, number>();
  let totalGiftValue = 0;
  let totalEarningsFromGifts = 0;
  for (const gift of gifts) {
    totalGiftValue += gift.giftValue;
    totalEarningsFromGifts += gift.creatorShare;
    const key = dayKey(gift.createdAt);
    giftsByDay.set(key, (giftsByDay.get(key) ?? 0) + gift.giftValue);
  }

  const followersByDay = new Map<string, number>();
  for (const follow of follows) {
    const key = dayKey(follow.createdAt);
    followersByDay.set(key, (followersByDay.get(key) ?? 0) + 1);
  }

  const { views, likes, comments } = content.period;

  return {
    days,
    since,
    summary: {
      totalPosts: content.period.posts,
      totalReels: content.period.reels,
      totalViews: views,
      totalLikes: likes,
      totalComments: comments,
      totalGiftValue,
      totalEarningsFromGifts,
      newFollowers: follows.length,
      engagementRate: views > 0 ? ((likes + comments) / views) * 100 : null,
    },
    lifetime: content.lifetime,
    // No creator profile means she has never been paid a gift, so nothing
    // earned and nothing pending is the truth rather than a stand-in.
    profile: profile ?? { totalEarnings: 0, pendingPayout: 0 },
    dailyStats: content.daily.map((day) => ({
      ...day,
      gifts: giftsByDay.get(day.date) ?? 0,
      followers: followersByDay.get(day.date) ?? 0,
    })),
    topPosts: content.top,
  };
}
