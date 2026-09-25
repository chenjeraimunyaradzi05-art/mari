/**
 * What the ranked feed promises about depth, and about who is in it.
 *
 * Two defects sat here together and made each other harder to see. The
 * candidate window was a flat two hundred rows, so at the default page size
 * the eleventh page was empty however many posts existed, and `total` was the
 * length of that window rather than a count of anything — a surface printing
 * "of N posts" was reading a ranking buffer. Blocking was applied by the
 * route to the page the ranker had already sliced, so a member who had
 * blocked a few busy posters got short pages, sometimes empty ones, while the
 * total she was handed still counted the posts she was not allowed to see.
 *
 * These cover the shape of the answer rather than the ordering, which
 * feed.reasons and feed.ml-ranking already own.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

type PrismaCall = (...args: unknown[]) => Promise<unknown>;

const findMany = jest.fn<PrismaCall>();
const count = jest.fn<PrismaCall>();
const userFindUnique = jest.fn<PrismaCall>();
const prefsFindUnique = jest.fn<PrismaCall>();
const safetyFindUnique = jest.fn<PrismaCall>();
const likeFindMany = jest.fn<PrismaCall>();

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findMany, count },
    user: { findUnique: userFindUnique },
    userFeedPreferences: { findUnique: prefsFindUnique },
    userSafetySettings: { findUnique: safetyFindUnique },
    like: { findMany: likeFindMany },
  },
}));
jest.mock('../../utils/cache', () => ({
  cacheGetOrSet: jest.fn(),
  CacheKeys: { feedTrending: jest.fn(() => 'k') },
}));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../feed-ml.service', () => ({
  rerankWithMl: jest.fn(async (posts: unknown) => ({ applied: false, posts, reasons: new Map() })),
}));

import { generateFeed } from '../feed.service';

/** A post by `authorId`, old enough that the freshness bonus is not in play. */
const postBy = (id: string, authorId: string) => ({
  id,
  authorId,
  type: 'TEXT',
  content: `post ${id}`,
  mediaUrls: [],
  likeCount: 0,
  commentCount: 0,
  shareCount: 0,
  viewCount: 0,
  isPinned: false,
  isSensitive: false,
  createdAt: new Date(Date.now() - 6 * 3600 * 1000),
  author: { id: authorId, displayName: authorId, avatar: null, headline: null, persona: null, role: 'MEMBER' },
});

/** `n` posts, each by a different author so creator diversity never trims. */
const postsFrom = (n: number) =>
  Array.from({ length: n }, (_, i) => postBy(`p${i}`, `author-${i}`));

/** The first argument the mock was called with, as a Prisma-ish query. */
function firstQuery(mock: { mock: { calls: unknown[][] } }): { take?: number; where?: unknown } {
  return (mock.mock.calls[0]?.[0] ?? {}) as { take?: number; where?: unknown };
}

/** Every clause an `AND`-nested where puts on authorId, flattened. */
function authorClauses(where: unknown): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (record.authorId && typeof record.authorId === 'object') {
      out.push(record.authorId as Record<string, unknown>);
    }
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  };
  walk(where);
  return out;
}

describe('generateFeed pagination and blocking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FEED_MAX_RANKED_CANDIDATES;
    userFindUnique.mockResolvedValue({ persona: 'GENERAL', currentJobTitle: null, following: [] });
    prefsFindUnique.mockResolvedValue(null);
    safetyFindUnique.mockResolvedValue(null);
    likeFindMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
  });

  it('reports the number of posts behind the feed, not the size of its ranking buffer', async () => {
    count.mockResolvedValue(4137);
    findMany.mockResolvedValue(postsFrom(200));

    const result = await generateFeed({ userId: 'viewer', page: 1, limit: 20 });

    // Capped at the depth an in-memory ranking can reach, not at 200.
    expect(result.total).toBe(1000);
    expect(result.posts).toHaveLength(20);
    expect(result.hasMore).toBe(true);
  });

  it('widens the candidate window with the page instead of stopping at page ten', async () => {
    count.mockResolvedValue(5000);
    findMany.mockResolvedValue(postsFrom(660));

    const result = await generateFeed({ userId: 'viewer', page: 11, limit: 20 });

    // page * limit * 3, still under the ceiling.
    expect(firstQuery(findMany).take).toBe(660);
    expect(result.posts).toHaveLength(20);
  });

  it('stops honestly at the ranked ceiling rather than pretending there is more', async () => {
    count.mockResolvedValue(50000);
    findMany.mockResolvedValue(postsFrom(1000));

    const result = await generateFeed({ userId: 'viewer', page: 50, limit: 20 });

    expect(firstQuery(findMany).take).toBe(1000);
    expect(result.total).toBe(1000);
    // The last page the ranked feed can serve: entries 980 to 999.
    expect(result.posts).toHaveLength(20);
    expect(result.hasMore).toBe(false);
  });

  it('keeps blocked authors out of the query, so the page is not shortened afterwards', async () => {
    count.mockResolvedValue(300);
    findMany.mockResolvedValue(postsFrom(200));

    const result = await generateFeed({
      userId: 'viewer',
      page: 1,
      limit: 20,
      excludeAuthorIds: ['abuser-1', 'abuser-2', 'abuser-1'],
    });

    expect(authorClauses(firstQuery(findMany).where)).toContainEqual({ notIn: ['abuser-1', 'abuser-2'] });

    // The count that becomes `total` is taken with the same where, so she is
    // not told about posts she is never going to be shown.
    expect(authorClauses(firstQuery(count).where)).toContainEqual({ notIn: ['abuser-1', 'abuser-2'] });

    expect(result.posts).toHaveLength(20);
  });

  it('asks for no block clause when the viewer has blocked nobody', async () => {
    count.mockResolvedValue(30);
    findMany.mockResolvedValue(postsFrom(30));

    await generateFeed({ userId: 'viewer', page: 1, limit: 20 });

    expect(authorClauses(firstQuery(findMany).where).some((clause) => 'notIn' in clause)).toBe(false);
  });

  it('a window that came back short says there is nothing after this page', async () => {
    count.mockResolvedValue(25);
    findMany.mockResolvedValue(postsFrom(25));

    const first = await generateFeed({ userId: 'viewer', page: 1, limit: 20 });
    expect(first.hasMore).toBe(true);

    const second = await generateFeed({ userId: 'viewer', page: 2, limit: 20 });
    expect(second.posts).toHaveLength(5);
    expect(second.hasMore).toBe(false);
  });
});
