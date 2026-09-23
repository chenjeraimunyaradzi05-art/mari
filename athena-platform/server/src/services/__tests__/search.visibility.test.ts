/**
 * What search is allowed to return.
 *
 * Three separate promises were being made and none of them was kept: a member
 * who turned on "hide me from search" was still returned by name, a post its
 * author had marked private was served to signed-out strangers as an excerpt
 * with her picture on it, and a blocked account came back in the search results
 * of the woman who had blocked him. The assertions below are on the where
 * clause rather than on rows, because the filtering has to happen in the query
 * — applied after `take: 50` it would quietly shorten the page instead.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findMany: jest.fn(async () => []) },
    post: { findMany: jest.fn(async () => []) },
    mentorProfile: { findMany: jest.fn(async () => []) },
    dvSafetyProfile: { findUnique: jest.fn(async () => null) },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    follow: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../utils/opensearch', () => ({
  // The Prisma path, which is what runs whenever OpenSearch is not connected.
  getOpenSearchClient: () => null,
  IndexNames: { USERS: 'athena_users', JOBS: 'athena_jobs', POSTS: 'athena_posts', COURSES: 'athena_courses', VIDEOS: 'athena_videos', MENTORS: 'athena_mentors' },
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

/** The one where clause the searcher built, as Prisma received it. */
const whereOf = (model: { mock: { calls: any[][] } }) => model.mock.calls[0][0].where;

/**
 * Every clause in a where tree, with nested ANDs flattened. The visibility
 * filter is composed as its own AND group and dropped into the searcher's
 * list, so the clauses these tests look for sit a level or two down; what
 * matters is that each one is being ANDed in somewhere, not how deep.
 */
const clausesOf = (node: any): any[] => {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(clausesOf);
  return [node, ...clausesOf(node.AND)];
};

/** Whether the tree contains a clause matching `shape`. */
const hasClause = (clauses: any[], shape: Record<string, unknown>) =>
  clauses.some((clause) => {
    try {
      expect(clause).toMatchObject(shape);
      return true;
    } catch {
      return false;
    }
  });

describe('Search and "hide me from search"', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([]);
    prisma.post.findMany.mockResolvedValue([]);
    prisma.mentorProfile.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.follow.findMany.mockResolvedValue([]);
  });

  it('excludes a member hidden by either store, for a signed-out visitor', async () => {
    await search({ query: 'welding', type: 'users' });

    const clauses = clausesOf(whereOf(prisma.user.findMany));
    // Both columns, because the DV safety page writes one and the privacy page
    // writes the other, and a woman who used either was told she was hidden.
    expect(hasClause(clauses, { NOT: { dvSafetyProfile: { is: { hideFromSearch: true } } } })).toBe(true);
    expect(hasClause(clauses, { NOT: { profile: { is: { hideFromSearch: true } } } })).toBe(true);
  });

  it('keeps both sides of a block out of each other’s results', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'other-blocker' }]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['dv-only-block'] });

    await search({ query: 'mei', type: 'users', viewerId: 'her' });

    const clauses = clausesOf(whereOf(prisma.user.findMany));
    const notIn = clauses.find((c: any) => c.id?.notIn)?.id.notIn;
    // The list she wrote, the people who blocked her, and a DV block whose
    // platform-wide mirror is best-effort and may never have landed.
    expect(new Set(notIn)).toEqual(new Set(['him', 'other-blocker', 'dv-only-block']));
    expect(hasClause(clauses, { NOT: { dvSafetyProfile: { is: { blockedUserIds: { has: 'her' } } } } })).toBe(true);
  });

  it('applies the same filter to the mentor directory the privacy switch names', async () => {
    await search({ query: 'welding', type: 'mentors', viewerId: 'her' });

    const clauses = clausesOf(whereOf(prisma.mentorProfile.findMany).user);
    expect(hasClause(clauses, { NOT: { profile: { is: { hideFromSearch: true } } } })).toBe(true);
    expect(hasClause(clauses, { NOT: { dvSafetyProfile: { is: { hideFromSearch: true } } } })).toBe(true);
  });
});

describe('Search and private posts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.post.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.follow.findMany.mockResolvedValue([]);
  });

  it('asks only for public posts whose author’s audience the viewer is inside', async () => {
    await search({ query: 'welding', type: 'posts' });

    const clauses = clausesOf(whereOf(prisma.post.findMany));
    expect(hasClause(clauses, { isHidden: false, isPublic: true })).toBe(true);
    // authorAudienceWhere supplies groupId: null, so a group's conversation
    // stays on the group's page.
    expect(hasClause(clauses, { groupId: null })).toBe(true);
  });

  it('keeps the keyword match when hasMedia is asked for', async () => {
    // The two filters used to be sibling OR keys in one object literal, so the
    // media one replaced the keyword one outright and ?hasMedia=true returned
    // every image and video post on the platform, private ones included.
    await search({ query: 'welding', type: 'posts', filters: { hasMedia: true } });

    const clauses = clausesOf(whereOf(prisma.post.findMany));
    const keywordClause = clauses.find((c: any) => c.OR?.[0]?.content);
    expect(keywordClause.OR[0].content.contains).toBe('welding');
    expect(hasClause(clauses, { OR: [{ type: 'IMAGE' }, { type: 'VIDEO' }] })).toBe(true);
  });

  it('drops a blocked author’s posts from the blocker’s results', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });

    await search({ query: 'welding', type: 'posts', viewerId: 'her' });

    const clauses = clausesOf(whereOf(prisma.post.findMany));
    expect(hasClause(clauses, { authorId: { notIn: ['him'] } })).toBe(true);
    expect(hasClause(clauses, { NOT: { author: { dvSafetyProfile: { is: { blockedUserIds: { has: 'her' } } } } } })).toBe(true);
  });
});
