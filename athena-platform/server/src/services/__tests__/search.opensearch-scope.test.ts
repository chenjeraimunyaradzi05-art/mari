/**
 * What search asks OpenSearch, and what it still asks the database.
 *
 * Only the users, posts and jobs indices are ever written. Search used to send
 * every kind to the engine while it was on, so courses, reels and mentors came
 * back from three empty indices and vanished from search the moment OpenSearch
 * was switched on. They come from the database now, on their own tabs and on
 * the all tab alike.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findMany: jest.fn(async () => []) },
    post: { findMany: jest.fn(async () => []) },
    job: { findMany: jest.fn(async () => []) },
    course: { findMany: jest.fn(async () => []) },
    video: { findMany: jest.fn(async () => []) },
    mentorProfile: { findMany: jest.fn(async () => []) },
    dvSafetyProfile: { findUnique: jest.fn(async () => null) },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    follow: { findMany: jest.fn(async () => []) },
  },
}));

const engineSearch = jest.fn();
jest.mock('../../utils/opensearch', () => ({
  getOpenSearchClient: () => ({ search: engineSearch }),
  IndexNames: {
    USERS: 'athena_users',
    JOBS: 'athena_jobs',
    POSTS: 'athena_posts',
    COURSES: 'athena_courses',
    VIDEOS: 'athena_videos',
    MENTORS: 'athena_mentors',
  },
}));

jest.mock('../../utils/cache', () => ({
  cacheGetOrSet: jest.fn(async () => []),
  CacheKeys: { search: (key: string) => `search:${key}` },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { search } from '../search.service';

const prisma: any = prismaTyped;

function engineAnswer(hits: Array<{ _index: string; _id: string; _score: number; _source: Record<string, unknown> }>) {
  return { body: { hits: { hits, total: { value: hits.length } } } };
}

const COURSE = {
  id: 'course-1',
  title: 'Welding for beginners',
  description: 'A welding course for women starting out in the trade',
  organization: null,
  providerName: 'TAFE',
  type: 'CERTIFICATE',
  durationMonths: 6,
  cost: 0,
  studyMode: 'IN_PERSON',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('search while OpenSearch is on', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    engineSearch.mockImplementation(async () => engineAnswer([]));
  });

  it('asks the engine only for the indices that are written, on the all tab', async () => {
    await search({ query: 'welding', type: 'all' });

    expect(engineSearch).toHaveBeenCalledTimes(1);
    const { index } = engineSearch.mock.calls[0][0] as { index: string[] };
    expect(index.sort()).toEqual(['athena_jobs', 'athena_posts', 'athena_users']);
  });

  it('answers courses, reels and mentors from the database on the all tab', async () => {
    prisma.course.findMany.mockResolvedValueOnce([COURSE]);
    engineSearch.mockImplementation(async () =>
      engineAnswer([
        { _index: 'athena_jobs', _id: 'job-1', _score: 7.5, _source: { title: 'Welder', description: 'Welding role' } },
      ])
    );

    const res = await search({ query: 'welding', type: 'all' });

    expect(prisma.course.findMany).toHaveBeenCalled();
    expect(prisma.video.findMany).toHaveBeenCalled();
    expect(prisma.mentorProfile.findMany).toHaveBeenCalled();
    // The database is not asked for what the engine answered.
    expect(prisma.job.findMany).not.toHaveBeenCalled();
    expect(res.results.map((result) => result.type).sort()).toEqual(['course', 'job']);
    expect(res.total).toBe(2);
  });

  it('answers a courses search from the database and never asks the engine', async () => {
    prisma.course.findMany.mockResolvedValueOnce([COURSE]);

    const res = await search({ query: 'welding', type: 'courses' });

    expect(engineSearch).not.toHaveBeenCalled();
    expect(res.results).toHaveLength(1);
    expect(res.results[0]).toMatchObject({ type: 'course', id: 'course-1' });
  });

  it.each(['videos', 'mentors'] as const)('answers a %s search from the database', async (type) => {
    await search({ query: 'welding', type });

    expect(engineSearch).not.toHaveBeenCalled();
    expect(type === 'videos' ? prisma.video.findMany : prisma.mentorProfile.findMany).toHaveBeenCalled();
  });

  it('still sends an indexed kind to the engine on its own tab', async () => {
    await search({ query: 'welding', type: 'jobs', page: 2, limit: 10 });

    const call = engineSearch.mock.calls[0][0] as { index: string[]; body: { from: number; size: number } };
    expect(call.index).toEqual(['athena_jobs']);
    expect(call.body).toMatchObject({ from: 10, size: 10 });
    expect(prisma.job.findMany).not.toHaveBeenCalled();
  });

  it('on the all tab asks the engine for everything up to the end of the page, then pages the merged list', async () => {
    await search({ query: 'welding', type: 'all', page: 3, limit: 10 });

    const call = engineSearch.mock.calls[0][0] as { body: { from: number; size: number } };
    expect(call.body).toMatchObject({ from: 0, size: 30 });
  });

  it('falls back to the database for everything when the engine fails', async () => {
    engineSearch.mockImplementation(async () => {
      throw new Error('cluster red');
    });

    await search({ query: 'welding', type: 'all' });

    expect(prisma.job.findMany).toHaveBeenCalled();
    expect(prisma.course.findMany).toHaveBeenCalled();
  });

  // The engine indexes a member's name and headline when she signs up, and it
  // knows nothing of the profile visibility she chose afterwards. A hit is kept
  // only when the database, asked again, still offers her to this person, and a
  // private profile is not offered.
  it('asks the database again about every member the engine found, and drops one with a private profile', async () => {
    engineSearch.mockImplementation(async () =>
      engineAnswer([
        { _index: 'athena_users', _id: 'open-member', _score: 3, _source: { displayName: 'Mei Welder' } },
        { _index: 'athena_users', _id: 'private-member', _score: 2, _source: { displayName: 'Mei Private' } },
      ])
    );
    // What the database still offers: the private one is filtered out by the query itself.
    prisma.user.findMany.mockImplementation(async () => [{ id: 'open-member' }]);

    const res = await search({ query: 'mei', type: 'users' });

    const where = prisma.user.findMany.mock.calls.find((call: any[]) => call[0]?.where?.AND?.[0]?.id?.in)?.[0].where;
    expect(JSON.stringify(where)).toContain(JSON.stringify({ NOT: { safetySettings: { is: { profileVisibility: 'private' } } } }));
    expect(res.results.map((result) => result.id)).toEqual(['open-member']);
  });

  // The index is written when a member is created or edited, and a suspension or
  // a ban is neither, so a document for a member a moderator removed outlives the
  // decision. The check against the database is what drops her.
  it('asks the database again whether a member the engine found is suspended or banned, for people, mentors and posts', async () => {
    engineSearch.mockImplementation(async () =>
      engineAnswer([
        { _index: 'athena_users', _id: 'banned-member', _score: 3, _source: { displayName: 'Mei Banned' } },
        { _index: 'athena_posts', _id: 'banned-post', _score: 2, _source: { content: 'mei welding' } },
      ])
    );
    prisma.user.findMany.mockImplementation(async () => []);
    prisma.post.findMany.mockImplementation(async () => []);

    const res = await search({ query: 'mei', type: 'all' });

    const open = JSON.stringify({ isSuspended: false, bannedAt: null });
    const userWhere = prisma.user.findMany.mock.calls.find((call: any[]) => call[0]?.where?.AND?.[0]?.id?.in)?.[0].where;
    const postWhere = prisma.post.findMany.mock.calls.find((call: any[]) => JSON.stringify(call[0]?.where).includes('banned-post'))?.[0].where;
    expect(JSON.stringify(userWhere)).toContain(open);
    expect(JSON.stringify(postWhere)).toContain(open);
    // The database no longer offers either, so neither is returned.
    expect(res.results.map((result) => result.id)).not.toContain('banned-member');
    expect(res.results.map((result) => result.id)).not.toContain('banned-post');
  });
});

// The engine has no floor of its own, so search sets one: no page is read past
// 500 rows. Pulling a page back to fit under it would answer "page 11" with the
// rows of page 10 again, and a client that keeps asking for the next page would
// never be told it had reached the end.
describe('how deep the engine is read', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    engineSearch.mockImplementation(async () => engineAnswer([]));
  });

  const asked = () => engineSearch.mock.calls[0][0] as { body: { from: number; size: number } };

  it('reads the last page that fits, whole', async () => {
    await search({ query: 'welding', type: 'jobs', page: 10, limit: 50 });

    expect(asked().body).toMatchObject({ from: 450, size: 50 });
  });

  it('asks for no rows when a page starts at the depth, rather than the last page again', async () => {
    await search({ query: 'welding', type: 'jobs', page: 11, limit: 50 });

    expect(asked().body).toMatchObject({ from: 0, size: 0 });
  });

  it('asks for no rows for a page number a million deep', async () => {
    await search({ query: 'welding', type: 'jobs', page: 10_000, limit: 50 });

    expect(asked().body).toMatchObject({ from: 0, size: 0 });
  });

  it('cuts a page that straddles the depth short instead of moving it back over the page before', async () => {
    // Pages of 30 start at 0, 30, ... 480: the page at 480 may hold only 20.
    await search({ query: 'welding', type: 'jobs', page: 17, limit: 30 });

    expect(asked().body).toMatchObject({ from: 480, size: 20 });
  });

  it('does not report more pages than can be read', async () => {
    engineSearch.mockImplementation(async () => ({ body: { hits: { hits: [], total: { value: 100_000 } } } }));

    const res = await search({ query: 'welding', type: 'jobs', page: 1, limit: 50 });

    expect(res.total).toBe(100_000);
    expect(res.totalPages).toBe(10);
  });
});
