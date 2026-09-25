/**
 * Search suggestions and trending name things that exist.
 *
 * Both were part literal. getTrendingSearches returned eight US recruiting
 * phrases under its own comment saying a real version would track queries,
 * wrapped in a thirty-minute cache so a trace read like an aggregation.
 * getSearchSuggestions substring-matched a hardcoded list of the same kind and
 * unioned it with a genuine skills lookup, and it is reached from search()
 * whenever a search returns fewer than five results — so the invented terms
 * were shown to a member at the moment her search had just found nothing.
 *
 * These assert on the queries and on the shape of the answer: every
 * suggestion comes from a row, and nothing matching means nothing offered.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    skill: { findMany: jest.fn(async () => []) },
    job: { findMany: jest.fn(async () => []) },
    course: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../routes/topic.routes', () => ({
  trendingTopics: jest.fn(async () => []),
}));

jest.mock('../../utils/opensearch', () => ({
  getOpenSearchClient: () => null,
  IndexNames: { USERS: 'u', JOBS: 'j', POSTS: 'p', COURSES: 'c', VIDEOS: 'v', MENTORS: 'm' },
}));

// The cache is transparent here: every call runs the producer, so the
// assertions are about what the producer returns rather than what a previous
// test left behind.
jest.mock('../../utils/cache', () => ({
  cacheGetOrSet: jest.fn(async (_key: string, producer: () => Promise<unknown>) => producer()),
  CacheKeys: { search: (key: string) => `search:${key}` },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { trendingTopics as trendingTopicsTyped } from '../../routes/topic.routes';
import { getSearchSuggestions, getTrendingSearches } from '../search.service';

type QueryMock = jest.Mock<(query?: { where?: Record<string, unknown> }) => Promise<unknown>>;

const prisma = prismaTyped as unknown as {
  skill: { findMany: QueryMock };
  job: { findMany: QueryMock };
  course: { findMany: QueryMock };
};
const trendingTopics = trendingTopicsTyped as unknown as jest.Mock<
  (days?: number, limit?: number) => Promise<unknown>
>;

describe('search suggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.skill.findMany.mockResolvedValue([]);
    prisma.job.findMany.mockResolvedValue([]);
    prisma.course.findMany.mockResolvedValue([]);
    trendingTopics.mockResolvedValue([]);
  });

  it('offers nothing when nothing on the platform matches', async () => {
    expect(await getSearchSuggestions('quantum basket weaving')).toEqual([]);
  });

  it('names a skill somebody holds, a job that is open and a course that is running', async () => {
    prisma.skill.findMany.mockResolvedValue([{ name: 'Bookkeeping' }]);
    prisma.job.findMany.mockResolvedValue([{ title: 'Bookkeeper, Brisbane' }]);
    prisma.course.findMany.mockResolvedValue([{ title: 'Bookkeeping for sole traders' }]);
    trendingTopics.mockResolvedValue([{ tag: 'bookkeepingtips', posts: 4, videos: 1, total: 5 }]);

    expect(await getSearchSuggestions('bookkeep')).toEqual([
      'Bookkeeping',
      'Bookkeeper, Brisbane',
      'Bookkeeping for sole traders',
      'bookkeepingtips',
    ]);
  });

  it('only looks at jobs that are open and courses that are running', async () => {
    await getSearchSuggestions('nurse');

    expect(prisma.job.findMany.mock.calls[0][0]?.where).toMatchObject({ status: 'ACTIVE' });
    expect(prisma.course.findMany.mock.calls[0][0]?.where).toMatchObject({ isActive: true });
  });

  it('does not go to the database for a one-character prefix', async () => {
    expect(await getSearchSuggestions('b')).toEqual([]);
    expect(prisma.skill.findMany).not.toHaveBeenCalled();
    expect(prisma.job.findMany).not.toHaveBeenCalled();
  });

  it('counts the same term from two sources once', async () => {
    prisma.skill.findMany.mockResolvedValue([{ name: 'Python' }]);
    trendingTopics.mockResolvedValue([{ tag: 'python', posts: 9, videos: 0, total: 9 }]);

    expect(await getSearchSuggestions('pyth')).toEqual(['Python']);
  });
});

describe('trending searches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    trendingTopics.mockResolvedValue([]);
  });

  it('is what the community tagged this week, not a curated list', async () => {
    trendingTopics.mockResolvedValue([
      { tag: 'soletrader', posts: 12, videos: 3, total: 15 },
      { tag: 'brisbanewomen', posts: 8, videos: 1, total: 9 },
    ]);

    expect(await getTrendingSearches()).toEqual(['soletrader', 'brisbanewomen']);
    expect(trendingTopics).toHaveBeenCalledWith(7, 8);
  });

  it('says nothing rather than inventing something when nobody has tagged anything', async () => {
    expect(await getTrendingSearches()).toEqual([]);
  });

  it('a failing aggregation is an empty list, not a broken search response', async () => {
    trendingTopics.mockRejectedValue(new Error('database is down'));
    expect(await getTrendingSearches()).toEqual([]);
  });
});
