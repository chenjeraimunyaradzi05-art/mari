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
    video: { findMany: jest.fn(async () => []) },
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
import { hiddenMemberWhere, search } from '../search.service';
import { authorVisibleWhere, mayBeShownToWhere, openAccountWhere } from '../audience.service';

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

  it('leaves out an account whose address nobody has confirmed, for a visitor and a member alike', async () => {
    // It cannot sign in, but the row exists from the moment of sign-up with
    // whatever name was typed into the form, so it must not be found by it.
    await search({ query: 'welding', type: 'users' });
    expect(hasClause(clausesOf(whereOf(prisma.user.findMany)), { emailVerified: true })).toBe(true);

    prisma.user.findMany.mockClear();
    await search({ query: 'welding', type: 'users', viewerId: 'her' });
    expect(hasClause(clausesOf(whereOf(prisma.user.findMany)), { emailVerified: true })).toBe(true);
  });

  it('asks the same of the mentor directory, which goes through the same filter', async () => {
    await search({ query: 'welding', type: 'mentors', viewerId: 'her' });

    expect(hasClause(clausesOf(whereOf(prisma.mentorProfile.findMany).user), { emailVerified: true })).toBe(true);
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

/**
 * The blueprint's discreet profile: hidden from the public, and known only to
 * the connections she has chosen. Safe Mode kept its promise for search only
 * where the member had also switched on hide-from-search, which the Safety
 * Centre's switch does not do, and her posts went on surfacing in post search
 * with her name and picture on them. Who comes back for a member in Safe Mode,
 * over real rows, is in tests/search.routes.test.ts; these are the clauses.
 */
describe('Search and a member in Safe Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([]);
    prisma.post.findMany.mockResolvedValue([]);
    prisma.mentorProfile.findMany.mockResolvedValue([]);
    prisma.video.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.follow.findMany.mockResolvedValue([]);
  });

  it('keeps her out of people search for a signed-out visitor, with nobody but a stranger to compare her to', async () => {
    await search({ query: 'mei', type: 'users' });

    expect(hasClause(clausesOf(whereOf(prisma.user.findMany)), mayBeShownToWhere(undefined))).toBe(true);
  });

  it('lets a signed-in member’s own id and her verified follows through', async () => {
    await search({ query: 'mei', type: 'users', viewerId: 'her' });

    const rule = clausesOf(whereOf(prisma.user.findMany)).find((c: any) => Array.isArray(c.OR) && c.OR.some((o: any) => o.id === 'her'));
    // The rule is the second half of the clause: the first is the open-account
    // check that sits in front of every audience rule.
    expect(rule).toEqual((mayBeShownToWhere('her') as { AND: unknown[] }).AND[1]);
  });

  it('applies the same rule to the mentor directory', async () => {
    await search({ query: 'welding', type: 'mentors', viewerId: 'her' });

    expect(hasClause(clausesOf(whereOf(prisma.mentorProfile.findMany).user), mayBeShownToWhere('her'))).toBe(true);
  });

  it('keeps her reels out of reel search, with the viewer’s own id and verified follows let through', async () => {
    await search({ query: 'welding', type: 'videos' });
    await search({ query: 'welding', type: 'videos', viewerId: 'her' });

    const [signedOut, signedIn] = prisma.video.findMany.mock.calls.map((call: any[]) => call[0].where.author);
    // The audience rule has Safe Mode's inside it, and the signed-in query keeps
    // the DV-page block clause beside it.
    expect(signedOut).toEqual(authorVisibleWhere(undefined));
    expect(signedIn.AND).toContainEqual(authorVisibleWhere('her'));
    expect(JSON.stringify(signedIn)).toContain(JSON.stringify(mayBeShownToWhere('her')));
  });

  it('keeps her posts out of post search for everyone who is not her connection', async () => {
    await search({ query: 'welding', type: 'posts' });
    await search({ query: 'welding', type: 'posts', viewerId: 'her' });

    const [signedOut, signedIn] = prisma.post.findMany.mock.calls.map((call: any[]) => clausesOf(call[0].where));
    // authorAudienceWhere carries it, the same clause the feed narrows with, so
    // a post that search returns is one the feed would have shown that person.
    expect(hasClause(signedOut, { author: mayBeShownToWhere(undefined) })).toBe(true);
    expect(hasClause(signedIn, { author: mayBeShownToWhere('her') })).toBe(true);
  });
});

/**
 * A private profile is a closed door: nobody but her opens it and nothing of
 * hers surfaces in a feed. People search was the window left open, because it
 * asked whether she had hidden herself from search and never what her profile
 * visibility was, so a member set to private came back by name, with her
 * picture and headline, to anyone who typed it. The clauses are asserted here,
 * in the query, for the reason the rest of this file gives.
 */
describe('Search and a private profile', () => {
  const privateProfile = { NOT: { safetySettings: { is: { profileVisibility: 'private' } } } };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([]);
    prisma.mentorProfile.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.follow.findMany.mockResolvedValue([]);
  });

  it('keeps her out of people search for a visitor and for a member alike', async () => {
    await search({ query: 'mei', type: 'users' });
    expect(hasClause(clausesOf(whereOf(prisma.user.findMany)), privateProfile)).toBe(true);

    prisma.user.findMany.mockClear();
    await search({ query: 'mei', type: 'users', viewerId: 'her' });
    expect(hasClause(clausesOf(whereOf(prisma.user.findMany)), privateProfile)).toBe(true);
  });

  it('keeps her out of the mentor directory search, which offers members by name the same way', async () => {
    await search({ query: 'welding', type: 'mentors', viewerId: 'her' });

    expect(hasClause(clausesOf(whereOf(prisma.mentorProfile.findMany).user), privateProfile)).toBe(true);
  });

  it('does not close the door on anyone who has not asked for it', async () => {
    await search({ query: 'mei', type: 'users' });

    // The clause names only a stored 'private'; a connections-only or public
    // profile, or one with no row at all, is not matched by it.
    const clause = clausesOf(whereOf(prisma.user.findMany)).find((c: any) => c.NOT?.safetySettings);
    expect(clause).toEqual(privateProfile);
  });
});

/**
 * Reel search took no viewer at all. A reel in the results carries its author's
 * name and picture, so the blocked account's reels came up for the woman who
 * had blocked him, and a private profile's reels for anyone who typed a word
 * from the caption. The clauses are asserted in the query for the reason the
 * rest of this file gives: applied after `take: 50` they would shorten the page.
 */
describe('Search and reels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.video.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.follow.findMany.mockResolvedValue([]);
  });

  it('keeps both sides of a block out of the results, in both stores', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'other-blocker' }]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['dv-only-block'] });

    await search({ query: 'welding', type: 'videos', viewerId: 'her' });

    const where = whereOf(prisma.video.findMany);
    expect(new Set(where.authorId.notIn)).toEqual(new Set(['him', 'other-blocker', 'dv-only-block']));
    // The direction the id list cannot name: a member who blocked her from the
    // DV safety page before the block reached the platform-wide list.
    expect(where.author.AND).toContainEqual({
      NOT: { dvSafetyProfile: { is: { blockedUserIds: { has: 'her' } } } },
    });
  });

  it('asks for no block clause when nobody is blocked, and none for a visitor', async () => {
    await search({ query: 'welding', type: 'videos' });
    await search({ query: 'welding', type: 'videos', viewerId: 'her' });

    for (const [args] of prisma.video.findMany.mock.calls) {
      expect(args.where.authorId).toBeUndefined();
    }
  });

  it('keeps a member whose profile is private out of the results, and a connections-only one to her followers', async () => {
    await search({ query: 'welding', type: 'videos', viewerId: 'her' });

    const audience = clausesOf(whereOf(prisma.video.findMany).author).find(
      (clause: any) => Array.isArray(clause.OR) && clause.OR.some((branch: any) => branch.safetySettings)
    );
    expect(audience.OR).toEqual([
      { safetySettings: { is: null } },
      { safetySettings: { is: { profileVisibility: 'public' } } },
      { id: 'her' },
      { safetySettings: { is: { profileVisibility: 'connections' } }, followers: { some: { followerId: 'her' } } },
    ]);
    // 'private' is in no branch, so it matches none of them.
    expect(JSON.stringify(audience)).not.toContain('private');
  });

  it('does not apply hide-from-search to reels: that switch is about her profile, and post search does not either', async () => {
    await search({ query: 'welding', type: 'videos', viewerId: 'her' });

    expect(JSON.stringify(whereOf(prisma.video.findMany))).not.toContain('hideFromSearch');
  });
});

/**
 * GET /users/:id answers "this profile is private" for a member whose isPublic is
 * false, and the search index drops her on the same flag, but the database search
 * (the one that runs in production) did not ask.
 */
describe('Search and a profile that is not public', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([]);
    prisma.mentorProfile.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.follow.findMany.mockResolvedValue([]);
  });

  it('keeps her out of people search for a visitor, and for a member too unless the member is her', async () => {
    await search({ query: 'mei', type: 'users' });
    expect(hasClause(clausesOf(whereOf(prisma.user.findMany)), { isPublic: true })).toBe(true);

    prisma.user.findMany.mockClear();
    await search({ query: 'mei', type: 'users', viewerId: 'her' });
    // A member always finds herself, whatever she has set; nobody else is offered a closed profile.
    expect(hasClause(clausesOf(whereOf(prisma.user.findMany)), { OR: [{ isPublic: true }, { id: 'her' }] })).toBe(true);
  });

  it('keeps her out of the mentor directory search too', async () => {
    await search({ query: 'welding', type: 'mentors', viewerId: 'her' });

    expect(hasClause(clausesOf(whereOf(prisma.mentorProfile.findMany).user), { OR: [{ isPublic: true }, { id: 'her' }] })).toBe(true);
  });

  it('is part of the one filter every list that offers members by name goes through', () => {
    expect(JSON.stringify(hiddenMemberWhere({ blockedIds: [], followingIds: [] }))).toContain('{"isPublic":true}');
    expect(JSON.stringify(hiddenMemberWhere({ viewerId: 'her', blockedIds: [], followingIds: [] }))).toContain(
      '{"OR":[{"isPublic":true},{"id":"her"}]}'
    );
  });
});

/**
 * Suspension and a ban are set by a moderator's decision and neither touches
 * isActive, so a list that asked only isActive went on offering a suspended
 * member by name and her posts and reels in the results. The check is part of
 * the audience rule every list already carries, which is what these hold: that it
 * is in the query, for every kind that names a member, for a signed-out visitor
 * and a signed-in one.
 */
describe('Search and a member who is suspended or banned', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([]);
    prisma.post.findMany.mockResolvedValue([]);
    prisma.video.findMany.mockResolvedValue([]);
    prisma.mentorProfile.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.follow.findMany.mockResolvedValue([]);
  });

  const open = { isSuspended: false, bannedAt: null };

  it('is the rule itself: neither a suspension nor a ban', () => {
    expect(openAccountWhere).toEqual(open);
    expect(mayBeShownToWhere(undefined).AND).toContainEqual(open);
    expect(mayBeShownToWhere('her').AND).toContainEqual(open);
  });

  it('leaves them out of people search, signed out and signed in', async () => {
    await search({ query: 'mei', type: 'users' });
    await search({ query: 'mei', type: 'users', viewerId: 'her' });

    for (const call of prisma.user.findMany.mock.calls) {
      expect(hasClause(clausesOf(call[0].where), open)).toBe(true);
    }
  });

  it('leaves them out of the mentor directory', async () => {
    await search({ query: 'welding', type: 'mentors', viewerId: 'her' });

    expect(hasClause(clausesOf(whereOf(prisma.mentorProfile.findMany).user), open)).toBe(true);
  });

  it('leaves their posts out of post search, so the words of a banned member do not come back by typing one of them', async () => {
    await search({ query: 'welding', type: 'posts' });
    await search({ query: 'welding', type: 'posts', viewerId: 'her' });

    for (const call of prisma.post.findMany.mock.calls) {
      expect(JSON.stringify(call[0].where)).toContain(JSON.stringify(open));
    }
  });

  it('leaves their reels out of reel search', async () => {
    await search({ query: 'welding', type: 'videos' });

    expect(JSON.stringify(prisma.video.findMany.mock.calls[0][0].where.author)).toContain(JSON.stringify(open));
  });
});
