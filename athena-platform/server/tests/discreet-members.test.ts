import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Row } from './support/prisma-where';

/**
 * A member in Safe Mode is discreet: hidden from the public, and known only to
 * the connections she has chosen.
 *
 * The blueprint promised a profile "hidden from the public and searchable only
 * by verified connections", and it was kept for search alone. People you may
 * know, the leaderboard, a link to her profile, her reels and her posts in the
 * feed each asked a different question and went on naming her to strangers. The
 * rule now lives in one place (services/audience.service.ts) and these suites
 * run the clauses the routes really send over a small set of members, the way
 * the database would, so what is asserted is who comes back:
 *
 *   - this file: suggestions, the profile by id, reels (lists, feed, one reel)
 *     and a group's member list;
 *   - tests/search.routes.test.ts: people, posts and mentors in search;
 *   - tests/engagement.routes.test.ts: the leaderboards (the creator
 *     leaderboard, the other public one, is here).
 *
 * Who counts as a verified connection is a product decision that is still the
 * owner's: for now it is a member she has approved as a follower who has also
 * passed the women-only check. `vera` is one; `una` follows her and has not
 * passed it; `stan` follows nobody.
 */

let users: Row[] = [];
let follows: Row[] = [];
let safetySettings: Row[] = [];
let dvProfiles: Row[] = [];
let videos: Row[] = [];
let saves: Row[] = [];
let mentorProfiles: Row[] = [];
let creatorProfiles: Row[] = [];
let postSaves: Row[] = [];
let groupMembers: Row[] = [];
let popular: Array<{ followingId: string; _count: { _all: number } }> = [];
const failures = { safeModeLookup: false, blockLookup: false };

jest.mock('../src/utils/prisma', () => {
  const { modelOver: over } = jest.requireActual('./support/prisma-where') as typeof import('./support/prisma-where');
  const userTable = over(() => users);
  return {
    prisma: {
      user: {
        ...userTable,
        // "Is she in Safe Mode?" is asked with findFirst. A lookup that cannot
        // answer must fail the request, never read as "no".
        findFirst: async (args?: { where?: unknown }) => {
          if (failures.safeModeLookup) throw new Error('connection reset while reading Safe Mode');
          return userTable.findFirst(args);
        },
      },
      follow: {
        ...over(() => follows),
        groupBy: async () => popular,
      },
      followRequest: { findUnique: async () => null },
      userSafetySettings: {
        ...over(() => safetySettings),
        findMany: async (args?: { where?: unknown }) => {
          if (failures.blockLookup) throw new Error('connection reset while reading the block list');
          return over(() => safetySettings).findMany(args);
        },
      },
      dvSafetyProfile: over(() => dvProfiles),
      video: over(() => videos),
      videoLike: over(() => []),
      videoSave: over(() => saves),
      mentorProfile: over(() => mentorProfiles),
      creatorProfile: over(() => creatorProfiles),
      postSave: over(() => postSaves),
      // What decoratePosts asks of the rest of the post tables: nothing is liked,
      // voted on or reposted here.
      like: { groupBy: async () => [], findMany: async () => [] },
      pollVote: { groupBy: async () => [], findMany: async () => [] },
      post: { findMany: async () => [] },
      userFeedPreferences: { findUnique: async () => null },
      groupMember: {
        ...over(() => groupMembers),
        // The membership check reads the compound key.
        findUnique: async (args: { where: { groupId_userId: { groupId: string; userId: string } } }) =>
          groupMembers.find((m) => m.groupId === args.where.groupId_userId.groupId && m.userId === args.where.groupId_userId.userId) ?? null,
      },
    },
  };
});

jest.mock('../src/middleware/auth', () => {
  const actual = jest.requireActual('../src/middleware/auth') as Record<string, unknown>;
  type Req = { headers: Record<string, unknown>; user?: unknown };
  const signedIn = (req: Req) => {
    const id = req.headers['x-test-user'];
    if (typeof id === 'string') req.user = { id, email: `${id}@example.com`, role: req.headers['x-test-role'] ?? 'USER' };
  };
  return {
    ...actual,
    authenticate: (req: Req, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) => {
      signedIn(req);
      if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
      next();
    },
    optionalAuth: (req: Req, _res: unknown, next: () => void) => {
      signedIn(req);
      next();
    },
  };
});

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../src/index';

const CREATED = new Date('2026-09-01T00:00:00.000Z');
const as = (id: string, role = 'USER') => ({ 'x-test-user': id, 'x-test-role': role });

function member(id: string, extra: Partial<Row> = {}): Row {
  return {
    id,
    isActive: true,
    // A real member has confirmed her address: sign-in refuses her until she has,
    // and the lists leave an unconfirmed account out (hiddenMemberWhere).
    emailVerified: true,
    // Neither suspended nor banned, as every account starts: moderation sets these, and
    // the lists leave a suspended or banned member out (openAccountWhere).
    isSuspended: false,
    bannedAt: null,
    isPublic: true,
    displayName: `Member ${id}`,
    firstName: id,
    lastName: 'Example',
    avatar: null,
    headline: `Headline of ${id}`,
    bio: null,
    role: 'USER',
    persona: 'EARLY_CAREER',
    city: 'Brisbane',
    state: 'QLD',
    country: 'AU',
    createdAt: CREATED,
    womanVerificationStatus: 'VERIFIED',
    dvSafetyProfile: null,
    profile: null,
    safetySettings: null,
    followers: [] as Row[],
    skills: [],
    education: [],
    experience: [],
    posts: [],
    _count: { followers: 0, following: 0, posts: 0 },
    ...extra,
  };
}

/** `follower` follows `followee`: the row in the follow table, and the same row hung off the followee as a relation. */
function follow(follower: Row, followee: Row) {
  const row = { followerId: follower.id, followingId: followee.id, follower: { womanVerificationStatus: follower.womanVerificationStatus, displayName: follower.displayName, firstName: follower.firstName } };
  follows.push(row);
  (followee.followers as Row[]).push(row);
}

function reelOf(author: Row): Row {
  return { id: `reel-${author.id}`, status: 'PUBLISHED', isHidden: false, authorId: author.id, author, type: 'REEL', hashtags: [], publishedAt: new Date(), createdAt: CREATED };
}

/**
 *   her        — Safe Mode, switched on from the DV safety page
 *   also-her   — Safe Mode, switched on from the Safety Centre, which writes the other column
 *   hider      — asked to be hidden from search; not in Safe Mode
 *   closed     — a private profile
 *   plain      — an ordinary member
 *   also-plain — another
 *   vera       — follows her and also-her, and has passed the women-only check
 *   una        — follows them and has not
 *   stan       — follows nobody; looks for people
 */
function seed() {
  const herDv = { userId: 'her', isSafeMode: true, hideFromSearch: false, blockedUserIds: [] as string[] };
  const her = member('her', { dvSafetyProfile: herDv });
  const alsoHer = member('also-her', { profile: { userId: 'also-her', isSafeMode: true, hideFromSearch: false } });
  const hider = member('hider', { profile: { userId: 'hider', isSafeMode: false, hideFromSearch: true } });
  const closedSettings = { userId: 'closed', blockedUsers: [] as string[], profileVisibility: 'private' };
  const closed = member('closed', { safetySettings: closedSettings });
  const plain = member('plain');
  const alsoPlain = member('also-plain');
  const vera = member('vera', { persona: 'MID_CAREER', city: 'Cairns' });
  const una = member('una', { persona: 'MID_CAREER', city: 'Cairns', womanVerificationStatus: 'UNVERIFIED' });
  const stan = member('stan');

  users = [her, alsoHer, hider, closed, plain, alsoPlain, vera, una, stan];
  follows = [];
  safetySettings = [closedSettings];
  dvProfiles = [herDv];
  for (const follower of [vera, una]) {
    follow(follower, her);
    follow(follower, alsoHer);
  }
  popular = users.map((u) => ({ followingId: String(u.id), _count: { _all: 500 } }));
  videos = [her, alsoHer, hider, plain].map(reelOf);
  saves = [];
  mentorProfiles = [];
  creatorProfiles = [];
  postSaves = [];
  groupMembers = [];
  failures.safeModeLookup = false;
  failures.blockLookup = false;
}

const idsOf = (rows: Array<{ id: string }>) => rows.map((r) => r.id).sort();

describe('People you may know', () => {
  beforeEach(seed);

  it('offers a stranger members who are fine to offer, and not her, her twin, a member who hid herself or a private profile', async () => {
    const res = await request(app).get('/api/users/suggested').set(as('stan')).query({ limit: '20' }).expect(200);

    const offered = idsOf(res.body.data);
    // Vera and Una are in another city and career stage, and arrive as "widely
    // followed"; what must not arrive is any of the four.
    expect(offered).toEqual(expect.arrayContaining(['also-plain', 'plain']));
    for (const left of ['her', 'also-her', 'hider', 'closed']) expect(offered).not.toContain(left);
    // Nothing of her in the response, by name, headline or city.
    const wire = JSON.stringify(res.body);
    expect(wire).not.toContain('Headline of her');
    expect(wire).not.toContain('Headline of also-her');
  });

  it('fills the page past the members it had to leave out', async () => {
    // Her and the others rank first; the page is two, and both must be members who may be shown.
    popular = [
      { followingId: 'her', _count: { _all: 900 } },
      { followingId: 'also-her', _count: { _all: 800 } },
      { followingId: 'hider', _count: { _all: 700 } },
      { followingId: 'closed', _count: { _all: 600 } },
      { followingId: 'plain', _count: { _all: 100 } },
      { followingId: 'also-plain', _count: { _all: 90 } },
    ];
    // No career stage and no city, so only the popular fill is offering anyone.
    (users.find((u) => u.id === 'stan') as Row).persona = null;
    (users.find((u) => u.id === 'stan') as Row).city = null;

    const res = await request(app).get('/api/users/suggested').set(as('stan')).query({ limit: '2' }).expect(200);

    expect(idsOf(res.body.data)).toEqual(['also-plain', 'plain']);
  });

  it('does not offer anyone at all when the block lists cannot be read', async () => {
    failures.blockLookup = true;

    const res = await request(app).get('/api/users/suggested').set(as('stan'));

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.data).toBeUndefined();
  });
});

describe('A member’s profile, by its id', () => {
  beforeEach(seed);

  it('is closed to a stranger holding the id, and to a signed-out visitor, with the answer a private profile gets', async () => {
    for (const target of ['her', 'also-her']) {
      const stranger = await request(app).get(`/api/users/${target}`).set(as('stan')).expect(403);
      expect(stranger.body.message).toBe('This profile is private');
      await request(app).get(`/api/users/${target}`).expect(403);
    }
  });

  it('gives a stranger nothing of her in the refusal', async () => {
    const res = await request(app).get('/api/users/her').set(as('stan')).expect(403);

    const wire = JSON.stringify(res.body);
    for (const own of ['Headline of her', 'Brisbane', 'Member her']) expect(wire).not.toContain(own);
  });

  it('is closed to a follower of hers who has not passed the women-only check', async () => {
    await request(app).get('/api/users/her').set(as('una')).expect(403);
  });

  it('is open to herself and to a follower of hers who has passed it', async () => {
    const herself = await request(app).get('/api/users/her').set(as('her')).expect(200);
    expect(herself.body.data.id).toBe('her');

    const friend = await request(app).get('/api/users/her').set(as('vera')).expect(200);
    expect(friend.body.data.id).toBe('her');
  });

  it('is unchanged for a member who is not in Safe Mode', async () => {
    await request(app).get('/api/users/plain').set(as('stan')).expect(200);
    await request(app).get('/api/users/plain').expect(200);
    // A member who only hid herself from search is still reachable by link, as before.
    await request(app).get('/api/users/hider').set(as('stan')).expect(200);
  });

  it('keeps a private profile closed to her verified follower as well', async () => {
    follow(users.find((u) => u.id === 'vera') as Row, users.find((u) => u.id === 'closed') as Row);

    await request(app).get('/api/users/closed').set(as('vera')).expect(403);
  });

  it('refuses rather than opens the profile when Safe Mode cannot be read', async () => {
    failures.safeModeLookup = true;

    const res = await request(app).get('/api/users/her').set(as('stan'));

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.data).toBeUndefined();
  });
});

describe('Reels', () => {
  beforeEach(seed);

  const fromList = async (path: string, viewer?: string) => {
    const req = request(app).get(path);
    const res = await (viewer ? req.set(as(viewer)) : req).expect(200);
    return idsOf(res.body.data);
  };

  it('keeps her reels out of For You, signed in or not, whichever page she turned Safe Mode on from', async () => {
    expect(await fromList('/api/video/feed')).toEqual(['reel-hider', 'reel-plain']);
    expect(await fromList('/api/video/feed', 'stan')).toEqual(['reel-hider', 'reel-plain']);
    expect(await fromList('/api/video/feed', 'una')).toEqual(['reel-hider', 'reel-plain']);
  });

  it('keeps them out of Trending and the by-author list as well', async () => {
    expect(await fromList('/api/video/feed?feed=trending', 'stan')).toEqual(['reel-hider', 'reel-plain']);
    expect(await fromList('/api/video/trending', 'stan')).toEqual(['reel-hider', 'reel-plain']);
    expect(await fromList('/api/video/user/her', 'stan')).toEqual([]);
    expect(await fromList('/api/video/user/also-her')).toEqual([]);
    expect(await fromList('/api/video/category/reel', 'stan')).toEqual(['reel-hider', 'reel-plain']);
  });

  it('shows them to her and to a follower of hers who has passed the women-only check', async () => {
    expect(await fromList('/api/video/feed', 'her')).toEqual(['reel-her', 'reel-hider', 'reel-plain']);
    expect(await fromList('/api/video/feed', 'vera')).toEqual(['reel-her', 'reel-also-her', 'reel-hider', 'reel-plain'].sort());
    expect(await fromList('/api/video/user/her', 'vera')).toEqual(['reel-her']);
  });

  it('does not take away the reels of a member who only asked to be hidden from search', async () => {
    expect(await fromList('/api/video/user/hider', 'stan')).toEqual(['reel-hider']);
  });

  it('answers a link to her reel as a reel that does not exist, for a stranger and for a signed-out visitor', async () => {
    const res = await request(app).get('/api/video/reel-her').set(as('stan')).expect(404);
    expect(res.body.message).toBe('Video not found');
    await request(app).get('/api/video/reel-also-her').expect(404);
    await request(app).get('/api/video/reel-her').set(as('una')).expect(404);
  });

  it('opens it for herself, her verified follower and staff, and opens an ordinary member’s for anyone', async () => {
    await request(app).get('/api/video/reel-her').set(as('her')).expect(200);
    await request(app).get('/api/video/reel-her').set(as('vera')).expect(200);
    await request(app).get('/api/video/reel-her').set(as('staff', 'ADMIN')).expect(200);
    await request(app).get('/api/video/reel-plain').expect(200);
  });

  it('fails the request rather than opening the reel when her Safe Mode cannot be read', async () => {
    failures.safeModeLookup = true;

    const res = await request(app).get('/api/video/reel-her').set(as('stan'));

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.data).toBeUndefined();
  });
});

describe('Reels that name their author somewhere other than the main lists', () => {
  beforeEach(seed);

  const onSound = (viewer?: string) => {
    const req = request(app).get('/api/sounds/snd-1/videos');
    return (viewer ? req.set(as(viewer)) : req).expect(200).then((res) => idsOf(res.body.data));
  };

  it('keeps her reels off a sound’s page, which names the author of every reel on it', async () => {
    for (const v of videos) v.audioTrackId = 'snd-1';

    expect(await onSound('stan')).toEqual(['reel-hider', 'reel-plain']);
    expect(await onSound()).toEqual(['reel-hider', 'reel-plain']);
    expect(await onSound('una')).toEqual(['reel-hider', 'reel-plain']);
    // Herself and her verified follower still find her there.
    expect(await onSound('her')).toEqual(['reel-her', 'reel-hider', 'reel-plain']);
    expect(await onSound('vera')).toEqual(['reel-her', 'reel-also-her', 'reel-hider', 'reel-plain'].sort());
  });

  it('keeps a reel from someone who blocked the viewer off a sound’s page as well', async () => {
    for (const v of videos) v.audioTrackId = 'snd-1';
    const plainSettings = { userId: 'plain', blockedUsers: ['stan'], profileVisibility: 'public' };
    safetySettings.push(plainSettings);

    expect(await onSound('stan')).toEqual(['reel-hider']);
  });

  it('drops a saved reel from the list of a member who may no longer be shown its author', async () => {
    const reel = (id: string) => videos.find((v) => v.id === id) as Row;
    saves = ['reel-her', 'reel-plain'].map((id) => ({ userId: 'stan', videoId: id, video: reel(id) }));
    saves.push({ userId: 'vera', videoId: 'reel-her', video: reel('reel-her') });

    const strangers = await request(app).get('/api/video/bookmarked').set(as('stan')).expect(200);
    expect(idsOf(strangers.body.data)).toEqual(['reel-plain']);

    // The follower she approved, who has passed the check, keeps what she saved.
    const friend = await request(app).get('/api/video/bookmarked').set(as('vera')).expect(200);
    expect(idsOf(friend.body.data)).toEqual(['reel-her']);
  });

  it('drops a saved post from the list of a member who may no longer be shown its author', async () => {
    const postBy = (author: Row) => ({ id: `post-${author.id}`, authorId: author.id, author, content: 'hello', isHidden: false, isPublic: true, createdAt: CREATED, mediaUrls: [] });
    const user = (id: string) => users.find((u) => u.id === id) as Row;
    postSaves = [
      { userId: 'stan', postId: 'post-her', collectionId: null, post: postBy(user('her')) },
      { userId: 'stan', postId: 'post-plain', collectionId: null, post: postBy(user('plain')) },
      { userId: 'vera', postId: 'post-her', collectionId: null, post: postBy(user('her')) },
    ];
    safetySettings.push({ userId: 'also-plain', blockedUsers: ['stan'], profileVisibility: 'public' });
    postSaves.push({ userId: 'stan', postId: 'post-also-plain', collectionId: null, post: postBy(user('also-plain')) });

    const stranger = await request(app).get('/api/posts/me/saved').set(as('stan')).expect(200);
    expect(idsOf(stranger.body.data)).toEqual(['post-plain']);

    const friend = await request(app).get('/api/posts/me/saved').set(as('vera')).expect(200);
    expect(idsOf(friend.body.data)).toEqual(['post-her']);
  });

  it('does not name her as the original of a duet to a stranger', async () => {
    const duet = reelOf(users.find((u) => u.id === 'plain') as Row);
    duet.id = 'reel-duet';
    duet.duetOfVideoId = 'reel-her';
    videos.push(duet);

    const forStranger = await request(app).get('/api/video/reel-duet').set(as('stan')).expect(200);
    expect(forStranger.body.data.duetOf).toBeNull();
    expect(JSON.stringify(forStranger.body)).not.toContain('Member her');

    const forFriend = await request(app).get('/api/video/reel-duet').set(as('vera')).expect(200);
    expect(forFriend.body.data.duetOf).toMatchObject({ id: 'reel-her' });
  });
});

describe('A mentor’s page, by its link', () => {
  beforeEach(() => {
    seed();
    mentorProfiles = ['her', 'plain'].map((id) => ({
      id: `mentor-${id}`,
      userId: id,
      specializations: [],
      isAvailable: true,
      hourlyRate: null,
      stripeAccountId: null,
      user: { ...(users.find((u) => u.id === id) as Row), isSuspended: false, bannedAt: null },
    }));
  });

  it('is closed to a stranger holding her link, and to a signed-out visitor, as a page that does not exist', async () => {
    await request(app).get('/api/mentors/profile/her').set(as('stan')).expect(404);
    await request(app).get('/api/mentors/profile/her').expect(404);
    await request(app).get('/api/mentors/mentor-her').set(as('stan')).expect(404);
    await request(app).get('/api/mentors/mentor-her').expect(404);
    await request(app).get('/api/mentors/profile/her').set(as('una')).expect(404);
  });

  it('is open to herself, her verified follower and staff, and an ordinary mentor’s to anyone', async () => {
    await request(app).get('/api/mentors/profile/her').set(as('her')).expect(200);
    await request(app).get('/api/mentors/mentor-her').set(as('vera')).expect(200);
    await request(app).get('/api/mentors/profile/her').set(as('staff', 'ADMIN')).expect(200);
    await request(app).get('/api/mentors/profile/plain').expect(200);
    await request(app).get('/api/mentors/mentor-plain').set(as('stan')).expect(200);
  });

  it('is closed across a block, from either store', async () => {
    safetySettings.push({ userId: 'plain', blockedUsers: ['stan'], profileVisibility: 'public' });

    await request(app).get('/api/mentors/profile/plain').set(as('stan')).expect(404);
    await request(app).get('/api/mentors/profile/plain').set(as('vera')).expect(200);
  });

  it('refuses rather than opens the page when Safe Mode cannot be read', async () => {
    failures.safeModeLookup = true;

    const res = await request(app).get('/api/mentors/profile/her').set(as('stan'));

    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});

describe('A creator’s page, by its link', () => {
  beforeEach(() => {
    seed();
    creatorProfiles = ['her', 'plain'].map((id) => ({
      id: `creator-${id}`,
      userId: id,
      isMonetized: false,
      user: { ...(users.find((u) => u.id === id) as Row), followers: [], posts: [] },
    }));
  });

  it('is closed to a stranger holding the link, and to a signed-out visitor, as a page that does not exist', async () => {
    await request(app).get('/api/creator/profile/her').set(as('stan')).expect(404);
    await request(app).get('/api/creator/profile/her').expect(404);
    await request(app).get('/api/creator/profile/her').set(as('una')).expect(404);
  });

  it('is open to herself, her verified follower and staff, and an ordinary creator’s to anyone', async () => {
    await request(app).get('/api/creator/profile/her').set(as('her')).expect(200);
    await request(app).get('/api/creator/profile/her').set(as('vera')).expect(200);
    await request(app).get('/api/creator/profile/her').set(as('staff', 'ADMIN')).expect(200);
    const plain = await request(app).get('/api/creator/profile/plain').expect(200);
    expect(plain.body.data.displayName).toBe('Member plain');
  });

  it('is closed across a block', async () => {
    safetySettings.push({ userId: 'plain', blockedUsers: ['stan'], profileVisibility: 'public' });

    await request(app).get('/api/creator/profile/plain').set(as('stan')).expect(404);
  });
});

describe('A group’s member list', () => {
  const GROUP = 'g1';

  beforeEach(() => {
    seed();
    const inGroup = (u: Row) => ({
      groupId: GROUP,
      userId: u.id,
      role: 'MEMBER',
      isBanned: false,
      isMuted: false,
      joinedAt: CREATED,
      group: { allowMemberInvites: true },
      user: u,
    });
    groupMembers = ['stan', 'plain', 'her', 'closed'].map((id) => inGroup(users.find((u) => u.id === id) as Row));
    // Stan blocked plain from the Safety Centre; closed blocked Stan from her DV page.
    const stanSettings = { userId: 'stan', blockedUsers: ['plain'], profileVisibility: 'public' };
    safetySettings.push(stanSettings);
    const closedDv = { userId: 'closed', isSafeMode: false, hideFromSearch: false, blockedUserIds: ['stan'] };
    dvProfiles.push(closedDv);
    (users.find((u) => u.id === 'closed') as Row).dvSafetyProfile = closedDv;
  });

  it('leaves out someone she blocked and someone who blocked her, from either store', async () => {
    const res = await request(app).get(`/api/groups/${GROUP}/members`).set(as('stan')).expect(200);

    expect(res.body.data.map((m: { userId: string }) => m.userId).sort()).toEqual(['her', 'stan']);
  });

  it('keeps a member in Safe Mode on the list: the room is one she chose, and her name is on everything she writes there', async () => {
    const res = await request(app).get(`/api/groups/${GROUP}/members`).set(as('stan')).expect(200);

    expect(res.body.data.map((m: { userId: string }) => m.userId)).toContain('her');
  });
});

describe('The creator leaderboard', () => {
  beforeEach(seed);

  it('is public, and names only creators a stranger searching by name could find', async () => {
    for (const u of users) {
      u.role = 'CREATOR';
      u.creatorProfile = { id: `profile-${u.id}` };
    }

    // No sign-in at all: the route is open to anyone.
    const res = await request(app).get('/api/creator/leaderboard').expect(200);

    const named = (res.body.data.creators as Array<{ id: string }>).map((c) => c.id).sort();
    // Not her, not her twin, not the member who hid herself, not the private profile.
    expect(named).toEqual(['also-plain', 'plain', 'stan', 'una', 'vera']);
    const wire = JSON.stringify(res.body);
    expect(wire).not.toContain('Headline of her');
    expect(wire).not.toContain('Headline of also-her');
  });

  it('leaves out a creator who blocked the viewer, and one the viewer blocked, from either store', async () => {
    for (const u of users) {
      u.role = 'CREATOR';
      u.creatorProfile = { id: `profile-${u.id}` };
    }
    // Plain blocked Stan from the Safety Centre; Stan blocked also-plain from his own list.
    safetySettings.push({ userId: 'plain', blockedUsers: ['stan'], profileVisibility: 'public' });
    safetySettings.push({ userId: 'stan', blockedUsers: ['also-plain'], profileVisibility: 'public' });
    // Una blocked Stan from her DV safety page, before it reached the platform-wide list.
    const unaDv = { userId: 'una', isSafeMode: false, hideFromSearch: false, blockedUserIds: ['stan'] };
    dvProfiles.push(unaDv);
    (users.find((u) => u.id === 'una') as Row).dvSafetyProfile = unaDv;

    const res = await request(app).get('/api/creator/leaderboard').set(as('stan')).expect(200);

    const named = (res.body.data.creators as Array<{ id: string }>).map((c) => c.id).sort();
    expect(named).toEqual(['stan', 'vera']);
  });

  it('does not name any creator when the viewer’s block lists cannot be read', async () => {
    for (const u of users) {
      u.role = 'CREATOR';
      u.creatorProfile = { id: `profile-${u.id}` };
    }
    failures.blockLookup = true;

    const res = await request(app).get('/api/creator/leaderboard').set(as('stan'));

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.data).toBeUndefined();
  });

  it('does not list members who are not creators', async () => {
    const res = await request(app).get('/api/creator/leaderboard').expect(200);

    expect(res.body.data.creators).toEqual([]);
  });
});
