/**
 * Trending topics used to be counted over the newest 1,000 posts and the
 * newest 1,000 reels in the window. Past that volume "this week" quietly meant
 * "the last few hours", and nothing in the answer said so. These pin that the
 * whole window is counted, a page at a time; that a window of any length is
 * answered from one of three spans, so ninety different `?days=` values cost
 * at most three reads a minute rather than ninety; that the count is shared
 * for a minute (the composer asks on every keystroke); and that a count that
 * failed is reported as a failure and retried, never kept and never turned
 * into an empty list.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

type FindMany = jest.Mock<(args: any) => Promise<any[]>>;

const postFindMany = jest.fn() as FindMany;
const videoFindMany = jest.fn() as FindMany;
jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findMany: postFindMany },
    video: { findMany: videoFindMany },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../services/post-decoration.service', () => ({ decoratePosts: jest.fn(async (posts: unknown) => posts) }));
jest.mock('../../services/sound.service', () => ({ attachSounds: jest.fn(async (videos: unknown) => videos) }));

import { authorAudienceWhere, authorVisibleWhere } from '../../services/audience.service';
import {
  TRENDING_SCAN_BATCH,
  TRENDING_SCAN_SPANS,
  resetTrendingTopicsCache,
  topicCountsFor,
  trendingTopics,
} from '../topic.routes';

const DAY = 24 * 60 * 60 * 1000;
// An hour ago: inside every window. Every row of a page sits on this one
// instant, so the tie on id is what orders them.
const AT = new Date(Date.now() - 60 * 60 * 1000);

const posts = (prefix: string, count: number, content: string, createdAt = AT) =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, content, createdAt }));

/** How far back the where clause of a read reached, in days. */
const reachOf = (call: [any], before: number) => (before - (call[0].where.createdAt.gte as Date).getTime()) / DAY;

beforeEach(() => {
  jest.clearAllMocks();
  resetTrendingTopicsCache();
  postFindMany.mockResolvedValue([]);
  videoFindMany.mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('trending topics count the whole window', () => {
  it('keeps reading posts past the first page, from where the last page ended', async () => {
    postFindMany
      .mockResolvedValueOnce(posts('p', TRENDING_SCAN_BATCH, 'Week one #payrise'))
      .mockResolvedValueOnce(posts('q', 3, 'Older but in the window #mentoring #payrise'));

    const topics = await trendingTopics(7, 10);

    expect(postFindMany).toHaveBeenCalledTimes(2);
    // The first page carries only the audience rule; the second adds the place to start from.
    expect(postFindMany.mock.calls[0][0].where.AND).toEqual([authorAudienceWhere()]);
    // The second page starts after the last row of the first, by date and then
    // by id, written into the where clause rather than as a Prisma cursor.
    expect(postFindMany.mock.calls[1][0]).toMatchObject({
      take: TRENDING_SCAN_BATCH,
      where: {
        AND: [
          authorAudienceWhere(),
          {
            OR: [{ createdAt: { gt: AT } }, { createdAt: AT, id: { gt: `p-${TRENDING_SCAN_BATCH - 1}` } }],
          },
        ],
      },
    });
    expect(postFindMany.mock.calls[1][0]).not.toHaveProperty('cursor');
    // Before, the second page was never read: #payrise stopped at 1,000 and
    // #mentoring did not exist.
    expect(topics).toEqual([
      { tag: 'payrise', posts: TRENDING_SCAN_BATCH + 3, videos: 0, total: TRENDING_SCAN_BATCH + 3 },
      { tag: 'mentoring', posts: 3, videos: 0, total: 3 },
    ]);
  });

  it('reads reels a page at a time too, and counts a tag repeated in one reel once', async () => {
    videoFindMany
      .mockResolvedValueOnce(
        Array.from({ length: TRENDING_SCAN_BATCH }, (_, i) => ({
          id: `v-${i}`,
          hashtags: ['#Salary', 'salary'],
          publishedAt: AT,
        }))
      )
      .mockResolvedValueOnce([{ id: 'w-0', hashtags: ['interviews'], publishedAt: AT }]);

    const topics = await trendingTopics(7, 10);

    expect(videoFindMany).toHaveBeenCalledTimes(2);
    expect(videoFindMany.mock.calls[1][0].where.AND).toEqual([
      { OR: [{ publishedAt: { gt: AT } }, { publishedAt: AT, id: { gt: `v-${TRENDING_SCAN_BATCH - 1}` } }] },
    ]);
    expect(videoFindMany.mock.calls[1][0].where.author).toEqual(authorVisibleWhere());
    expect(topics).toEqual([
      { tag: 'salary', posts: 0, videos: TRENDING_SCAN_BATCH, total: TRENDING_SCAN_BATCH },
      { tag: 'interviews', posts: 0, videos: 1, total: 1 },
    ]);
  });

  it('counts only what is public, outside groups, visible and inside the window', async () => {
    const before = Date.now();
    await trendingTopics(7, 10);

    const postWhere = postFindMany.mock.calls[0][0].where;
    expect(postWhere).toMatchObject({ isHidden: false, isPublic: true, content: { contains: '#' } });
    // Outside groups is the audience rule's (it carries groupId: null).
    expect(authorAudienceWhere()).toMatchObject({ groupId: null });
    expect(postWhere.AND).toContainEqual(authorAudienceWhere());
    expect(reachOf(postFindMany.mock.calls[0] as [any], before)).toBeCloseTo(7, 3);

    expect(videoFindMany.mock.calls[0][0].where).toMatchObject({ status: 'PUBLISHED', isHidden: false });
  });

  // The count is one for everyone, so it is made of what a stranger may be
  // shown: a tag used only by members whose profile is private, connections-only
  // or in Safe Mode would otherwise trend, and be offered by the composer, on
  // the strength of posts nobody outside their audience can open.
  it('counts only what a stranger may be shown: not private, connections-only or Safe Mode authors', async () => {
    await trendingTopics(7, 10);

    const audience = authorAudienceWhere();
    // Open to no viewer: a public profile or none set, and not discreet.
    expect(JSON.stringify(audience)).not.toContain('private');
    expect(JSON.stringify(audience)).not.toContain('connections');
    expect(JSON.stringify(audience)).toContain('isSafeMode');
    expect(postFindMany.mock.calls[0][0].where.AND).toContainEqual(audience);
    expect(videoFindMany.mock.calls[0][0].where.author).toEqual(authorVisibleWhere());
    expect(JSON.stringify(authorVisibleWhere())).not.toContain('connections');
    expect(JSON.stringify(authorVisibleWhere())).not.toContain('private');
  });

  it('a reel that comes back without a publication date fails the count rather than vanishing from it', async () => {
    videoFindMany.mockResolvedValueOnce([{ id: 'v-1', hashtags: ['salary'], publishedAt: null }]);

    await expect(trendingTopics(7, 10)).rejects.toThrow('publication date');
  });

  it('the public list stops at fifty; the full count is there for the composer', async () => {
    postFindMany.mockResolvedValueOnce(
      Array.from({ length: 60 }, (_, i) => ({ id: `p-${i}`, content: `#tag${String(i).padStart(2, '0')}`, createdAt: AT }))
    );

    expect(await trendingTopics(30, 500)).toHaveLength(50);
    expect(await topicCountsFor(30)).toHaveLength(60);
  });
});

describe('a window of any length is answered from one of three spans', () => {
  it('reads the shortest span that covers the window', async () => {
    expect(TRENDING_SCAN_SPANS).toEqual([7, 30, 90]);
    const before = Date.now();

    await trendingTopics(3, 5);
    await trendingTopics(10, 5);
    await trendingTopics(45, 5);

    expect(postFindMany).toHaveBeenCalledTimes(3);
    expect(reachOf(postFindMany.mock.calls[0] as [any], before)).toBeCloseTo(7, 3);
    expect(reachOf(postFindMany.mock.calls[1] as [any], before)).toBeCloseTo(30, 3);
    expect(reachOf(postFindMany.mock.calls[2] as [any], before)).toBeCloseTo(90, 3);
  });

  it('counts only the window asked for, not the whole span it was read from', async () => {
    postFindMany.mockResolvedValueOnce([
      { id: 'old', content: 'Three weeks ago #grants', createdAt: new Date(Date.now() - 21 * DAY) },
      { id: 'mid', content: 'Last week #grants #housing', createdAt: new Date(Date.now() - 5 * DAY) },
      { id: 'new', content: 'Today #housing', createdAt: AT },
    ]);

    // Ten days is read from the thirty-day span.
    const tenDays = await trendingTopics(10, 5);
    const thirtyDays = await trendingTopics(30, 5);

    expect(postFindMany).toHaveBeenCalledTimes(1);
    expect(tenDays).toEqual([
      { tag: 'housing', posts: 2, videos: 0, total: 2 },
      { tag: 'grants', posts: 1, videos: 0, total: 1 },
    ]);
    expect(thirtyDays).toEqual([
      { tag: 'grants', posts: 2, videos: 0, total: 2 },
      { tag: 'housing', posts: 2, videos: 0, total: 2 },
    ]);
  });

  it('asking for every window in turn costs at most one read of each span', async () => {
    for (let days = 90; days >= 1; days -= 1) await trendingTopics(days, 5);
    // The ninety-day read covers every shorter window asked for inside the minute.
    expect(postFindMany).toHaveBeenCalledTimes(1);

    resetTrendingTopicsCache();
    jest.clearAllMocks();
    for (let days = 1; days <= 90; days += 1) await trendingTopics(days, 5);
    // Growing windows step up through the spans: seven, thirty, ninety.
    expect(postFindMany).toHaveBeenCalledTimes(3);
  });
});

describe('the count is shared, and a failure is not', () => {
  it('asks the database once for callers inside the same minute, including ones that arrive mid-count', async () => {
    postFindMany.mockResolvedValue([{ id: 'p-1', content: '#grants', createdAt: AT }]);

    const [first, second] = await Promise.all([trendingTopics(30, 5), topicCountsFor(30)]);
    const third = await trendingTopics(30, 5);

    expect(postFindMany).toHaveBeenCalledTimes(1);
    expect(first).toEqual(third);
    expect(second[0].tag).toBe('grants');
  });

  it('reads again once the minute is up', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_800_000_000_000);
    await trendingTopics(7, 5);

    now.mockReturnValue(1_800_000_000_000 + 61_000);
    await trendingTopics(7, 5);

    expect(postFindMany).toHaveBeenCalledTimes(2);
  });

  it('a failed count is thrown to the caller, not kept, and the next caller counts afresh', async () => {
    postFindMany.mockRejectedValueOnce(new Error('connection reset'));

    await expect(trendingTopics(7, 5)).rejects.toThrow('connection reset');

    postFindMany.mockResolvedValueOnce([{ id: 'p-1', content: '#recovered', createdAt: AT }]);
    const topics = await trendingTopics(7, 5);
    expect(topics.map((t) => t.tag)).toEqual(['recovered']);
  });
});
