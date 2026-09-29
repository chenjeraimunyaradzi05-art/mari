import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { modelOver, type Row } from './support/prisma-where';

/**
 * /api/search, which had no test of any kind.
 *
 * Search is where a member who has left someone is most exposed: it is how he
 * would look for her. So the question these tests ask is not whether a search
 * finds things but who it keeps out, and they ask it against the handler's real
 * `where` clauses, run over a small set of members by tests/support/prisma-where
 * rather than inspected for their shape. Each exclusion below has broken at
 * least once before, as the comments in services/search.service.ts record:
 *
 *   - either side of a block, whether the block was placed from the Safety
 *     Centre (UserSafetySettings.blockedUsers) or from the DV safety page
 *     (DvSafetyProfile.blockedUserIds), and in both directions;
 *   - a member who asked to be hidden from search, from either of the two
 *     pages that offer the switch;
 *   - a post its author kept private, a post in a group, and a connections-only
 *     author's post shown to anyone but her followers;
 *   - the media filter replacing the keyword match instead of narrowing it.
 *
 * And the one about failure: when the block list cannot be read, the search
 * fails. An empty list standing in for one that could not be read would put a
 * blocked account back in front of the woman who blocked him.
 *
 * Not covered here, because it is not true yet: reels. searchVideos takes no
 * viewer, so a blocked member's reels still come back in search. That is
 * handed to the owner of search.service.ts with the fix.
 */

let users: Row[] = [];
let posts: Row[] = [];
let mentors: Row[] = [];
let safetySettings: Row[] = [];
let dvProfiles: Row[] = [];
let follows: Row[] = [];
const failures = { blockLookup: false };

jest.mock('../src/utils/prisma', () => {
  const { modelOver: over } = jest.requireActual('./support/prisma-where') as typeof import('./support/prisma-where');
  const safety = over(() => safetySettings);
  return {
    prisma: {
      user: over(() => users),
      post: over(() => posts),
      mentorProfile: over(() => mentors),
      dvSafetyProfile: over(() => dvProfiles),
      follow: over(() => follows),
      userSafetySettings: {
        ...safety,
        findMany: async (args: { where?: unknown }) => {
          if (failures.blockLookup) throw new Error('connection reset while reading the block list');
          return safety.findMany(args);
        },
      },
      job: over(() => []),
      course: over(() => []),
      video: over(() => []),
      skill: over(() => [{ name: 'Gardening' }, { name: 'Garden design' }]),
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

// No engine: search runs on the database, which is how production runs today
// (OPENSEARCH_ENABLED is "false" in render.yaml).
jest.mock('../src/utils/opensearch', () => {
  const actual = jest.requireActual('../src/utils/opensearch') as Record<string, unknown>;
  return { ...actual, getOpenSearchClient: () => null };
});

jest.mock('../src/utils/cache', () => {
  const actual = jest.requireActual('../src/utils/cache') as Record<string, unknown>;
  return { ...actual, cacheGetOrSet: async (_key: string, fetch: () => Promise<unknown>) => fetch() };
});

jest.mock('../src/routes/topic.routes', () => {
  const actual = jest.requireActual('../src/routes/topic.routes') as Record<string, unknown>;
  return {
    __esModule: true,
    ...actual,
    trendingTopics: async () => [
      { tag: 'gardening', posts: 4, videos: 1 },
      { tag: 'careers', posts: 3, videos: 0 },
    ],
  };
});

jest.mock('../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../src/index';

const CREATED = new Date('2026-09-01T00:00:00.000Z');

function member(id: string, over: Partial<Row> = {}): Row {
  return {
    id,
    displayName: `${id[0].toUpperCase()}${id.slice(1)} the gardener`,
    bio: null,
    headline: 'Community gardener',
    avatar: null,
    role: 'USER',
    persona: null,
    isVerified: false,
    isActive: true,
    createdAt: CREATED,
    skills: [],
    profile: null,
    dvSafetyProfile: null,
    safetySettings: null,
    _count: { followers: 0, posts: 0 },
    ...over,
  };
}

function post(id: string, author: Row, over: Partial<Row> = {}): Row {
  return {
    id,
    authorId: author.id,
    author,
    content: `${id}: notes from the gardener`,
    type: 'TEXT',
    isHidden: false,
    isPublic: true,
    groupId: null,
    mediaUrls: [],
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    createdAt: CREATED,
    ...over,
  };
}

function mentorOf(user: Row): Row {
  return {
    id: `mentor-${user.id}`,
    userId: user.id,
    user,
    isAvailable: true,
    sessionCount: 0,
    rating: null,
    hourlyRate: 0,
    createdAt: CREATED,
  };
}

/**
 * Ada is the member searching. Around her:
 *   mallory  — she blocked him from the Safety Centre
 *   trent    — he blocked her from the Safety Centre
 *   dan      — she blocked him from her DV safety page only
 *   eve      — eve blocked Ada from her own DV safety page only
 *   hana     — asked to be hidden from search on the privacy page
 *   ines     — asked to be hidden from search on the DV safety page
 *   olga     — deactivated
 *   carol    — posts to connections only; Ada follows her
 *   grace    — nobody's business: an ordinary, visible member
 */
function seed() {
  // Each store is one list of rows, and the same objects hang off the members
  // as their relations, so a lookup by id and a relation filter read the same
  // thing — as they would in the database.
  const adaSettings = { userId: 'ada', blockedUsers: ['mallory'], profileVisibility: 'public' };
  const trentSettings = { userId: 'trent', blockedUsers: ['ada'], profileVisibility: 'public' };
  const carolSettings = { userId: 'carol', blockedUsers: [], profileVisibility: 'connections' };
  const adaDv = { userId: 'ada', hideFromSearch: false, blockedUserIds: ['dan'] };
  const eveDv = { userId: 'eve', hideFromSearch: false, blockedUserIds: ['ada'] };
  const inesDv = { userId: 'ines', hideFromSearch: true, blockedUserIds: [] };

  const ada = member('ada', { safetySettings: adaSettings, dvSafetyProfile: adaDv });
  const mallory = member('mallory');
  const trent = member('trent', { safetySettings: trentSettings });
  const dan = member('dan');
  const eve = member('eve', { dvSafetyProfile: eveDv });
  const hana = member('hana', { profile: { userId: 'hana', hideFromSearch: true } });
  const ines = member('ines', { dvSafetyProfile: inesDv });
  const olga = member('olga', { isActive: false });
  const carol = member('carol', { safetySettings: carolSettings });
  const grace = member('grace');

  users = [ada, mallory, trent, dan, eve, hana, ines, olga, carol, grace];
  safetySettings = [adaSettings, trentSettings, carolSettings];
  dvProfiles = [adaDv, eveDv, inesDv];
  follows = [{ followerId: 'ada', followingId: 'carol' }];

  posts = [
    post('p-grace', grace),
    post('p-mallory', mallory),
    post('p-trent', trent),
    post('p-dan', dan),
    post('p-eve', eve),
    post('p-private', grace, { isPublic: false }),
    post('p-hidden', grace, { isHidden: true }),
    post('p-group', grace, { groupId: 'g1' }),
    post('p-carol', carol),
    post('p-photo-unrelated', grace, { type: 'IMAGE', content: 'holiday photo at the beach' }),
    post('p-photo-garden', grace, { type: 'IMAGE', content: 'the gardener at work, with photos' }),
  ];

  mentors = [mentorOf(grace), mentorOf(mallory), mentorOf(trent), mentorOf(eve), mentorOf(hana), mentorOf(ines)];
}

const as = (id: string) => ({ 'x-test-user': id });

function idsOf(body: { results: Array<{ type: string; id: string; metadata: Record<string, unknown> }> }, type: string): string[] {
  return body.results.filter((result) => result.type === type).map((result) => result.id).sort();
}

describe('GET /api/search keeps blocked and hidden members out of the results', () => {
  beforeEach(() => {
    seed();
    failures.blockLookup = false;
  });

  it('refuses a search with no query', async () => {
    for (const path of ['/api/search', '/api/search/users', '/api/search/posts', '/api/search/mentors']) {
      const res = await request(app).get(path).expect(400);
      expect(res.body.message).toMatch(/query is required/i);
    }
  });

  it('shows a signed-out visitor every visible member, and nobody hidden or deactivated', async () => {
    const res = await request(app).get('/api/search/users').query({ q: 'gardener' }).expect(200);

    // A stranger has blocked nobody and nobody has blocked her, so only the
    // hide switches and deactivation narrow what she sees.
    expect(idsOf(res.body, 'user')).toEqual(['ada', 'carol', 'dan', 'eve', 'grace', 'mallory', 'trent']);
  });

  it('never shows Ada either side of a block, from either store, in either direction', async () => {
    const res = await request(app).get('/api/search/users').set(as('ada')).query({ q: 'gardener' }).expect(200);

    const found = idsOf(res.body, 'user');
    expect(found).toEqual(['ada', 'carol', 'grace']);
    for (const kept of ['mallory', 'trent', 'dan', 'eve', 'hana', 'ines', 'olga']) {
      expect(found).not.toContain(kept);
    }
  });

  it('never shows Ada to the man she blocked, or to the woman who blocked her', async () => {
    for (const searcher of ['mallory', 'dan', 'eve', 'trent']) {
      const res = await request(app).get('/api/search/users').set(as(searcher)).query({ q: 'gardener' }).expect(200);
      expect(idsOf(res.body, 'user')).not.toContain('ada');
    }
  });

  it('applies the same rules on the all tab', async () => {
    const res = await request(app).get('/api/search').set(as('ada')).query({ q: 'gardener' }).expect(200);

    expect(idsOf(res.body, 'user')).toEqual(['ada', 'carol', 'grace']);
    expect(idsOf(res.body, 'mentor')).toEqual(['mentor-grace']);
    // Her own posts would come back too; she has none here. Carol's is shown
    // because Ada follows her; nothing private, hidden or from a group is.
    expect(idsOf(res.body, 'post')).toEqual(['p-carol', 'p-grace', 'p-photo-garden']);
  });

  it('keeps blocked and hidden mentors out of the mentor directory search', async () => {
    const res = await request(app).get('/api/search/mentors').set(as('ada')).query({ q: 'gardener' }).expect(200);
    expect(idsOf(res.body, 'mentor')).toEqual(['mentor-grace']);

    const anonymous = await request(app).get('/api/search/mentors').query({ q: 'gardener' }).expect(200);
    expect(idsOf(anonymous.body, 'mentor')).toEqual(['mentor-eve', 'mentor-grace', 'mentor-mallory', 'mentor-trent']);
  });
});

describe('GET /api/search/posts shows only what the author let this viewer read', () => {
  beforeEach(() => {
    seed();
    failures.blockLookup = false;
  });

  it('gives a signed-out visitor public, visible, non-group posts from public authors only', async () => {
    const res = await request(app).get('/api/search/posts').query({ q: 'gardener' }).expect(200);

    expect(idsOf(res.body, 'post')).toEqual(['p-dan', 'p-eve', 'p-grace', 'p-mallory', 'p-photo-garden', 'p-trent']);
  });

  it("gives Ada her follow's connections-only post, and nothing from either side of a block", async () => {
    const res = await request(app).get('/api/search/posts').set(as('ada')).query({ q: 'gardener' }).expect(200);

    expect(idsOf(res.body, 'post')).toEqual(['p-carol', 'p-grace', 'p-photo-garden']);
  });

  it('narrows to media when asked, without dropping the keyword', async () => {
    const res = await request(app)
      .get('/api/search/posts')
      .set(as('ada'))
      .query({ q: 'gardener', hasMedia: 'true' })
      .expect(200);

    // The unrelated beach photo would appear if the media filter replaced the
    // keyword match, as it once did for every image and video post there was.
    expect(idsOf(res.body, 'post')).toEqual(['p-photo-garden']);
  });
});

describe('A search whose safety lookup fails, fails', () => {
  beforeEach(() => {
    seed();
  });

  it('answers with an error rather than an unfiltered page', async () => {
    failures.blockLookup = true;

    const res = await request(app).get('/api/search').set(as('ada')).query({ q: 'gardener' });

    expect(res.status).toBe(500);
    expect(res.body.results).toBeUndefined();
  });

  it('does not need the lookup for a signed-out visitor, who has no blocks', async () => {
    failures.blockLookup = true;

    const res = await request(app).get('/api/search/users').query({ q: 'gardener' }).expect(200);
    expect(idsOf(res.body, 'user')).toContain('grace');
  });
});

describe('Suggestions and trending name only things that exist', () => {
  beforeEach(() => {
    seed();
  });

  it('suggests nothing for an empty or one-letter prefix', async () => {
    expect((await request(app).get('/api/search/suggestions').expect(200)).body).toEqual({ suggestions: [] });
    expect((await request(app).get('/api/search/suggestions').query({ q: 'g' }).expect(200)).body).toEqual({ suggestions: [] });
  });

  it('suggests skills and this week\'s hashtags that match, once each', async () => {
    const res = await request(app).get('/api/search/suggestions').query({ q: 'garden' }).expect(200);

    // "Gardening" the skill and "gardening" the hashtag are one suggestion.
    expect(res.body.suggestions).toEqual(['Gardening', 'Garden design']);
  });

  it('reports the hashtags the community used this week as trending', async () => {
    const res = await request(app).get('/api/search/trending').expect(200);
    expect(res.body).toEqual({ trending: ['gardening', 'careers'] });
  });
});
