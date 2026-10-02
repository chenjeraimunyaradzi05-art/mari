/**
 * A post its author kept to herself, or showed only to the people she chose,
 * must not turn up anywhere else.
 *
 * Every other route that opens one post already treats isPublic=false as the
 * author's alone and a connections-only or private profile as closed to anyone
 * outside it. The lists did not agree: the signed-in For You query asked for
 * "public, or by anyone the viewer follows" under a comment that said private
 * posts from followed members were meant to be included, so every follower was
 * shown a post whose author had unticked "Post publicly"; the personalised
 * in-network query and the Following tab asked no isPublic question at all; the
 * topic page, the list of who reposted, "posts mentioning me" and the saved
 * list asked only some of it; and the impression counter and the staff
 * dashboard did not look at it.
 *
 * So these suites hold a small set of members and posts, run the handlers' real
 * where clauses over them (tests/support/prisma-where), and assert on what each
 * surface returns, for the reason tests/search.routes.test.ts gives: a test that
 * asserts the shape of a clause proves it was written, not that it keeps the
 * right post out. One matrix, one world, every surface a post can come back on:
 *
 *   ada     the viewer. Follows grace, carol and pia; blocked mallory in the
 *           Safety Centre and dvdan from her DV safety page; eve blocked her
 *           from the DV page only.
 *   grace   an ordinary public profile. Has a private post, a hidden one, and
 *           posts in a public and in a private group Ada is not in.
 *   carol   connections-only; Ada follows her.
 *   cass    connections-only; Ada does not follow her.
 *   pia     private profile; Ada follows her anyway.
 *   fay     an ordinary public profile and a stranger to Ada.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { modelOver, type Row } from './support/prisma-where';

let users: Row[] = [];
let posts: Row[] = [];
let follows: Row[] = [];
let safetySettings: Row[] = [];
let dvProfiles: Row[] = [];
let saves: Row[] = [];
const created: Row[] = [];

jest.mock('../src/utils/prisma', () => {
  const { modelOver: over } = jest.requireActual('./support/prisma-where') as typeof import('./support/prisma-where');
  const followModel = over(() => follows);
  return {
    prisma: {
      user: over(() => users),
      post: { ...over(() => posts), updateMany: jest.fn(async () => ({ count: 0 })) },
      follow: {
        ...followModel,
        // isFollower looks the follow up by its compound key.
        findUnique: async (args: { where: { followerId_followingId: { followerId: string; followingId: string } } }) => {
          const key = args.where.followerId_followingId;
          return follows.find((row) => row.followerId === key.followerId && row.followingId === key.followingId) ?? null;
        },
      },
      userSafetySettings: over(() => safetySettings),
      dvSafetyProfile: over(() => dvProfiles),
      postSave: over(() => saves),
      like: { findMany: async () => [], groupBy: async () => [] },
      pollVote: { findMany: async () => [], groupBy: async () => [] },
      commentLike: { findMany: async () => [] },
      userFeedPreferences: { findUnique: async () => null, count: async () => 0 },
      audioTrack: { findMany: async () => [] },
      // The reels half of a topic page: none here, the posts are the subject.
      video: { findMany: async () => [], count: async () => 0 },
      postImpression: {
        findMany: async () => [],
        createMany: async (args: { data: Row[] }) => {
          created.push(...args.data);
          return { count: args.data.length };
        },
      },
    },
  };
});

jest.mock('../src/middleware/auth', () => {
  const actual = jest.requireActual('../src/middleware/auth') as Record<string, unknown>;
  const signedIn = (req: { headers: Record<string, unknown>; user?: unknown }) => {
    const id = req.headers['x-test-user'];
    if (typeof id === 'string') req.user = { id, email: `${id}@example.com`, role: 'USER' };
  };
  return {
    ...actual,
    authenticate: (req: { headers: Record<string, unknown>; user?: unknown }, res: { status: (n: number) => { json: (b: unknown) => void } }, next: () => void) => {
      signedIn(req);
      if (!req.user) return res.status(401).json({ success: false });
      return next();
    },
    optionalAuth: (req: { headers: Record<string, unknown>; user?: unknown }, _res: unknown, next: () => void) => {
      signedIn(req);
      next();
    },
  };
});

jest.mock('../src/middleware/rateLimiter', () => {
  const actual = jest.requireActual('../src/middleware/rateLimiter') as Record<string, unknown>;
  const pass = (_req: unknown, _res: unknown, next: () => void) => next();
  return { ...actual, searchLimiter: pass };
});

jest.mock('../src/utils/cache', () => {
  const actual = jest.requireActual('../src/utils/cache') as Record<string, unknown>;
  return { ...actual, cacheGetOrSet: async (_key: string, fetch: () => Promise<unknown>) => fetch() };
});

// The ranker is not the subject: the order does not matter, the candidates do.
jest.mock('../src/services/feed-ml.service', () => ({
  rerankWithMl: jest.fn(async (candidates: unknown) => ({ applied: false, posts: candidates, reasons: new Map() })),
}));

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../src/index';
import { generateFeed, getTrendingPosts } from '../src/services/feed.service';
import { getTopContent } from '../src/services/analytics.service';
import { blockedEitherWayIds } from '../src/services/audience.service';
import { resetTrendingTopicsCache } from '../src/routes/topic.routes';

const AN_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000);

function member(id: string, over: Partial<Row> = {}): Row {
  return {
    id,
    displayName: `${id[0].toUpperCase()}${id.slice(1)}`,
    avatar: null,
    headline: null,
    persona: null,
    role: 'USER',
    isActive: true,
    emailVerified: true,
    // Neither suspended nor banned, as every account starts: moderation sets these, and
    // the lists leave a suspended or banned member out (openAccountWhere).
    isSuspended: false,
    bannedAt: null,
    isPublic: true,
    safetySettings: null,
    dvSafetyProfile: null,
    profile: null,
    followers: [],
    following: [],
    likes: [],
    skills: [],
    ...over,
  };
}

function post(id: string, author: Row, over: Partial<Row> = {}): Row {
  return {
    id,
    authorId: author.id,
    author,
    type: 'TEXT',
    content: `${id} on the allotment #garden`,
    mediaUrls: [],
    isPublic: true,
    isHidden: false,
    isPinned: false,
    isSensitive: false,
    groupId: null,
    group: null,
    repostOfId: null,
    mentionedUserIds: [],
    likeCount: 1,
    commentCount: 0,
    shareCount: 0,
    viewCount: 0,
    repostCount: 0,
    createdAt: AN_HOUR_AGO,
    ...over,
  };
}

const idsOf = (rows: Array<{ id: string }>) => rows.map((row) => row.id).sort();

function seed() {
  const adaSettings = { userId: 'ada', blockedUsers: ['mallory'], profileVisibility: 'public' };
  const carolSettings = { userId: 'carol', blockedUsers: [], profileVisibility: 'connections' };
  const cassSettings = { userId: 'cass', blockedUsers: [], profileVisibility: 'connections' };
  const piaSettings = { userId: 'pia', blockedUsers: [], profileVisibility: 'private' };
  const adaDv = { userId: 'ada', hideFromSearch: false, blockedUserIds: ['dvdan'] };
  const eveDv = { userId: 'eve', hideFromSearch: false, blockedUserIds: ['ada'] };

  const ada = member('ada', { safetySettings: adaSettings, dvSafetyProfile: adaDv });
  const grace = member('grace');
  const carol = member('carol', { safetySettings: carolSettings });
  const cass = member('cass', { safetySettings: cassSettings });
  const pia = member('pia', { safetySettings: piaSettings });
  const fay = member('fay');
  const mallory = member('mallory');
  const dvdan = member('dvdan');
  const eve = member('eve', { dvSafetyProfile: eveDv });

  // The same objects hang off the members as relations, so a relation filter and
  // a lookup by id read the same thing, as they would in the database.
  carol.followers = [{ followerId: 'ada', follower: { womanVerificationStatus: 'VERIFIED' } }];
  ada.following = ['grace', 'carol', 'pia', 'mallory', 'dvdan'].map((followingId) => ({ followingId }));

  users = [ada, grace, carol, cass, pia, fay, mallory, dvdan, eve];
  safetySettings = [adaSettings, carolSettings, cassSettings, piaSettings];
  dvProfiles = [adaDv, eveDv];
  follows = ['grace', 'carol', 'pia', 'mallory', 'dvdan'].map((followingId) => ({ followerId: 'ada', followingId }));

  const publicGroup = { id: 'g-pub', isHidden: false, privacy: 'PUBLIC', members: [{ userId: 'grace', isBanned: false }] };
  const privateGroup = { id: 'g-priv', isHidden: false, privacy: 'PRIVATE', members: [{ userId: 'grace', isBanned: false }] };

  // Every author's ordinary post names Ada, so the mention list has something to filter.
  const named = { mentionedUserIds: ['ada'] };
  posts = [
    post('ada-public', ada),
    post('ada-private', ada, { isPublic: false }),
    post('grace-public', grace, named),
    post('grace-private', grace, { isPublic: false, ...named }),
    post('grace-hidden', grace, { isHidden: true, ...named }),
    post('grace-group-public', grace, { groupId: 'g-pub', group: publicGroup, ...named }),
    post('grace-group-private', grace, { groupId: 'g-priv', group: privateGroup, ...named }),
    post('carol-public', carol, named),
    post('cass-public', cass, named),
    post('pia-public', pia, named),
    post('fay-public', fay, named),
    post('mallory-public', mallory, named),
    post('dvdan-public', dvdan, named),
    post('eve-public', eve, named),
  ];

  // Ada saved every one of them; what comes back is what she may still be shown.
  saves = posts.map((saved) => ({ id: `save-${saved.id}`, userId: 'ada', postId: saved.id, collectionId: null, createdAt: AN_HOUR_AGO, post: saved }));
  created.length = 0;
}

const as = (id: string) => ({ 'x-test-user': id });

beforeEach(() => {
  seed();
  resetTrendingTopicsCache();
});

describe('the Following tab', () => {
  const tab = async (viewer: string) => {
    const res = await request(app).get('/api/posts/feed').query({ tab: 'following' }).set(as(viewer)).expect(200);
    return idsOf(res.body.data);
  };

  it('shows her own posts and the people she follows, and nothing a follower is not allowed to read', async () => {
    // Not grace's private, hidden or group posts; not pia's, whose profile is
    // private; not mallory's or dvdan's, whom she blocked, whichever page she
    // did it from. Carol's is connections-only and Ada follows her.
    expect(await tab('ada')).toEqual(['ada-private', 'ada-public', 'carol-public', 'grace-public']);
  });

  it('never shows a follower a post its author kept private, even though she follows the author', async () => {
    expect(await tab('ada')).not.toContain('grace-private');
  });
});

describe('the For You feed', () => {
  const forYou = async (viewer: string, algorithm?: string) => {
    const res = await request(app)
      .get('/api/posts/feed')
      .query({ tab: 'for-you', ...(algorithm ? { algorithm } : {}) })
      .set(as(viewer))
      .expect(200);
    return idsOf(res.body.data);
  };

  it.each(['engagement', 'chronological'])('shows her own posts and public ones she is allowed to read, ranked by %s', async (algorithm) => {
    // Her own private post is hers to see. Not a followed member's private post
    // (the defect), not a private profile's, not a connections-only author she
    // does not follow, not the two she blocked or the one who blocked her (eve,
    // from the DV page only), not group posts, which stay on the group's page.
    expect(await forYou('ada', algorithm)).toEqual(['ada-private', 'ada-public', 'carol-public', 'fay-public', 'grace-public']);
  });

  it('asks the personalised in-network query the same question', async () => {
    const result = await generateFeed({
      userId: 'ada',
      algorithm: 'personalized',
      limit: 50,
      excludeAuthorIds: await blockedEitherWayIds('ada'),
    });

    const shown = idsOf(result.posts);
    expect(shown).not.toContain('grace-private');
    expect(shown).not.toContain('pia-public');
    expect(shown).not.toContain('mallory-public');
    expect(shown).toContain('grace-public');
  });

  it('shows a signed-out visitor only public posts by public profiles', async () => {
    const res = await request(app).get('/api/posts/feed').query({ tab: 'for-you' }).expect(200);

    expect(idsOf(res.body.data)).toEqual([
      'ada-public',
      'dvdan-public',
      'eve-public',
      'fay-public',
      'grace-public',
      'mallory-public',
    ]);
  });

  it('keeps a block made from the DV safety page alone out of her feed, in both directions', async () => {
    const shown = await forYou('ada');

    expect(shown).not.toContain('dvdan-public'); // she blocked him there only
    expect(shown).not.toContain('eve-public'); // she blocked Ada there only
  });
});

describe('trending', () => {
  it('is made of public posts by public profiles, whoever is asking, and never a private or group post', async () => {
    const trending = await getTrendingPosts(24, 50);

    // The list is one shared copy, so it cannot know who is reading it: only
    // what a stranger may be shown.
    expect(idsOf(trending)).toEqual(['ada-public', 'dvdan-public', 'eve-public', 'fay-public', 'grace-public', 'mallory-public']);
  });
});

describe('a topic page', () => {
  const topicFor = async (viewer?: string) => {
    const req = request(app).get('/api/topics/garden');
    const res = await (viewer ? req.set(as(viewer)) : req).expect(200);
    return res.body.data as { posts: Array<{ id: string }>; counts: { posts: number } };
  };

  it('lists a signed-out visitor only public posts by public profiles', async () => {
    const topic = await topicFor();

    expect(idsOf(topic.posts)).toEqual(['ada-public', 'dvdan-public', 'eve-public', 'fay-public', 'grace-public', 'mallory-public']);
    expect(topic.counts.posts).toBe(6);
  });

  it('adds a connections-only author to the page of a viewer who follows her, and takes out whoever she blocked', async () => {
    const topic = await topicFor('ada');

    expect(idsOf(topic.posts)).toEqual(['ada-public', 'carol-public', 'fay-public', 'grace-public']);
    // The total is of what she can see, not of everything under the tag.
    expect(topic.counts.posts).toBe(4);
  });

  it('never lists a private, hidden or group post, or a private profile’s post, to anyone', async () => {
    for (const viewer of [undefined, 'ada', 'fay']) {
      const shown = idsOf((await topicFor(viewer)).posts);
      for (const kept of ['grace-private', 'grace-hidden', 'grace-group-public', 'grace-group-private', 'pia-public', 'ada-private']) {
        expect(shown).not.toContain(kept);
      }
    }
  });
});

describe('the list of who reposted', () => {
  beforeEach(() => {
    const byAuthor = (id: string) => users.find((user) => user.id === id) as Row;
    posts.push(
      ...['carol', 'pia', 'mallory', 'fay'].map((id) =>
        post(`rp-${id}`, byAuthor(id), { repostOfId: 'grace-public', content: 'Worth a read' })
      )
    );
  });

  const repostsFor = async (original: string, viewer?: string) => {
    const req = request(app).get(`/api/posts/${original}/reposts`);
    return await (viewer ? req.set(as(viewer)) : req);
  };

  it('is held to each reposter’s audience and to the viewer’s blocks', async () => {
    const res = await repostsFor('grace-public', 'ada').then((r) => r);
    expect(res.status).toBe(200);
    // Carol's is connections-only and Ada follows her; Pia's profile is private;
    // Mallory is blocked.
    expect(idsOf(res.body.data)).toEqual(['rp-carol', 'rp-fay']);
  });

  it('shows a signed-out reader only public profiles’ reposts', async () => {
    const res = await repostsFor('grace-public').then((r) => r);
    expect(res.status).toBe(200);
    expect(idsOf(res.body.data)).toEqual(['rp-fay', 'rp-mallory']);
  });

  it.each(['grace-private', 'grace-hidden', 'grace-group-public', 'pia-public', 'mallory-public'])(
    'does not confirm that %s exists, to a viewer who may not open it',
    async (original) => {
      const res = await repostsFor(original, 'ada');
      expect(res.status).toBe(404);
    }
  );
});

describe('"posts mentioning me"', () => {
  it('lists only the mentions she may still be shown', async () => {
    const res = await request(app).get('/api/posts/me/mentions').set(as('ada')).expect(200);

    // Grace's, Carol's (she follows her), Fay's, and Grace's in a public group.
    // Not the private, hidden or private-group posts that name her, not Cass's
    // (connections-only, not followed), not Pia's (private profile), and not a
    // blocked account's, however the block was made.
    expect(idsOf(res.body.data)).toEqual(['carol-public', 'fay-public', 'grace-group-public', 'grace-public']);
  });

  it('lists a private group’s mention once she is a member of it, and not before', async () => {
    const group = (posts.find((row) => row.id === 'grace-group-private') as Row).group as { members: Row[] };
    group.members.push({ userId: 'ada', isBanned: false });

    const res = await request(app).get('/api/posts/me/mentions').set(as('ada')).expect(200);

    expect(idsOf(res.body.data)).toContain('grace-group-private');

    group.members[1].isBanned = true;
    const banned = await request(app).get('/api/posts/me/mentions').set(as('ada')).expect(200);
    expect(idsOf(banned.body.data)).not.toContain('grace-group-private');
  });
});

describe('the saved list', () => {
  it('keeps a saved post only while she may still be shown it', async () => {
    const res = await request(app).get('/api/posts/me/saved').set(as('ada')).expect(200);

    // Everything she saved that is still hers to read: her own posts (private
    // included), and the public ones whose authors let her see them.
    expect(idsOf(res.body.data)).toEqual([
      'ada-private',
      'ada-public',
      'carol-public',
      'fay-public',
      'grace-group-public',
      'grace-public',
    ]);
  });

  it('drops a post its author has since made private, hidden or taken into a private group', async () => {
    const res = await request(app).get('/api/posts/me/saved').set(as('ada')).expect(200);

    for (const gone of ['grace-private', 'grace-hidden', 'grace-group-private', 'pia-public', 'cass-public', 'mallory-public', 'dvdan-public', 'eve-public']) {
      expect(idsOf(res.body.data)).not.toContain(gone);
    }
  });
});

describe('impressions', () => {
  const count = async (viewer: string, ids: string[]) => {
    created.length = 0;
    await request(app).post('/api/posts/impressions').set(as(viewer)).send({ ids, source: 'feed' }).expect(204);
    return created.map((row) => row.postId as string).sort();
  };

  it('counts a showing only of a post that was public to be shown, and never of a private one', async () => {
    const counted = await count('fay', posts.map((row) => row.id as string));

    // Not the private or hidden posts, and not the private group's, which Fay is
    // not a member of. The ids come from the request, so a caller could
    // otherwise raise the reach of a post its author kept to herself.
    // (Her own post, fay-public, is never counted: an author is not her own reach.)
    expect(counted).toEqual([
      'ada-public',
      'carol-public',
      'cass-public',
      'dvdan-public',
      'eve-public',
      'grace-group-public',
      'grace-public',
      'mallory-public',
      'pia-public',
    ]);
    expect(counted).not.toContain('grace-private');
    expect(counted).not.toContain('ada-private');
    expect(counted).not.toContain('grace-hidden');
    expect(counted).not.toContain('grace-group-private');
  });

  it('counts a private group’s post for a member of it', async () => {
    const group = (posts.find((row) => row.id === 'grace-group-private') as Row).group as { members: Row[] };
    group.members.push({ userId: 'fay', isBanned: false });

    expect(await count('fay', ['grace-group-private'])).toEqual(['grace-group-private']);
  });
});

describe('the staff dashboard’s top content', () => {
  it('is made of public posts outside groups, never a private or group post', async () => {
    const { topPosts } = await getTopContent('week', 50);

    expect(idsOf(topPosts as Array<{ id: string }>)).toEqual([
      'ada-public',
      'carol-public',
      'cass-public',
      'dvdan-public',
      'eve-public',
      'fay-public',
      'grace-public',
      'mallory-public',
      'pia-public',
    ]);
  });
});

describe('a post made private afterwards', () => {
  it('drops out of the Following tab and the topic page the moment its author unticks "Post publicly"', async () => {
    (posts.find((row) => row.id === 'grace-public') as Row).isPublic = false;

    const tab = await request(app).get('/api/posts/feed').query({ tab: 'following' }).set(as('ada')).expect(200);
    const topic = await request(app).get('/api/topics/garden').expect(200);

    expect(idsOf(tab.body.data)).not.toContain('grace-public');
    expect(idsOf(topic.body.data.posts)).not.toContain('grace-public');
  });
});
