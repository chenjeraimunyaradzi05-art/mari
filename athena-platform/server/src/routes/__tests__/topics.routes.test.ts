import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    video: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
    userFeedPreferences: { findUnique: jest.fn(async () => null), count: jest.fn(async () => 0), upsert: jest.fn() },
    like: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    postSave: { findMany: jest.fn(async () => []) },
    pollVote: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    audioTrack: { findMany: jest.fn(async () => []) },
    // A topic page reads the viewer's blocks, in both stores, and who she follows.
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    dvSafetyProfile: { findUnique: jest.fn(async () => null) },
    follow: { findMany: jest.fn(async () => []) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'viewer-1', role: 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) req.user = { id: req.headers['x-test-user'], role: 'USER', email: 'u@athena.com' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { reasonsFor } from '../../services/feed.service';
import { authorAudienceWhere, authorVisibleWhere } from '../../services/audience.service';
import { resetTrendingTopicsCache } from '../topic.routes';

const prisma: any = prismaTyped;
const as = (userId: string) => ({ 'x-test-user': userId });

describe('Topics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetTrendingTopicsCache();
    prisma.post.findMany.mockResolvedValue([]);
    prisma.video.findMany.mockResolvedValue([]);
    prisma.userFeedPreferences.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.follow.findMany.mockResolvedValue([]);
  });

  it('trending adds up hashtags across posts and reels, case-insensitively', async () => {
    prisma.post.findMany.mockResolvedValue([
      { id: 'p1', content: 'Got the offer #Salary #negotiation', createdAt: new Date() },
      { id: 'p2', content: 'Talk on #salary tomorrow', createdAt: new Date() },
      { id: 'p3', content: 'No tags here', createdAt: new Date() },
    ]);
    prisma.video.findMany.mockResolvedValue([
      { id: 'v1', hashtags: ['salary', 'interviews'], publishedAt: new Date() },
      { id: 'v2', hashtags: ['Interviews'], publishedAt: new Date() },
    ]);

    const res = await request(app).get('/api/topics/trending?days=7&limit=3').expect(200);

    expect(res.body.data).toEqual([
      { tag: 'salary', posts: 2, videos: 1, total: 3 },
      { tag: 'interviews', posts: 0, videos: 2, total: 2 },
      { tag: 'negotiation', posts: 1, videos: 0, total: 1 },
    ]);
  });

  it('a trending count that failed is a 500, not an empty list', async () => {
    prisma.post.findMany.mockRejectedValue(new Error('connection reset'));

    const res = await request(app).get('/api/topics/trending').expect(500);

    expect(res.body.data).toBeUndefined();
  });

  it('a topic page carries counts, follow state and related tags', async () => {
    prisma.post.findMany.mockResolvedValue([
      { id: 'p1', authorId: 'a', content: 'Ask for more #salary #negotiation', poll: null, author: { id: 'a' } },
      { id: 'p2', authorId: 'b', content: '#salary bands are public now #transparency', poll: null, author: { id: 'b' } },
    ]);
    prisma.post.count.mockResolvedValue(14);
    prisma.video.count.mockResolvedValue(3);
    prisma.userFeedPreferences.count.mockResolvedValue(27);
    prisma.userFeedPreferences.findUnique.mockResolvedValue({ followedHashtags: ['#Salary'] });

    const res = await request(app).get('/api/topics/%23Salary').set(as('viewer-1')).expect(200);

    expect(res.body.data.tag).toBe('salary');
    expect(res.body.data.counts).toEqual({ posts: 14, videos: 3, followers: 27 });
    expect(res.body.data.isFollowing).toBe(true);
    expect(res.body.data.related).toEqual(['negotiation', 'transparency']);
    expect(res.body.data.posts).toHaveLength(2);
    expect(res.body.data.posts[0].reactionCounts).toEqual({});
  });

  /**
   * A topic page is open to anyone, signed in or not, and lists whole posts and
   * reels with their authors. It asked only "public, not hidden, not in a group",
   * so a member whose profile was private or connections-only had her posts
   * listed to strangers, and a blocked account was listed to the woman who had
   * blocked him. The clauses are asserted in the query, for the reason the other
   * visibility tests give: applied to the page afterwards they would shorten it.
   */
  describe('a topic page and who may be shown', () => {
    /** Every clause in a where tree, ANDs flattened. */
    const clausesOf = (node: any): any[] => {
      if (!node || typeof node !== 'object') return [];
      if (Array.isArray(node)) return node.flatMap(clausesOf);
      return [node, ...clausesOf(node.AND)];
    };
    const postWhere = () => prisma.post.findMany.mock.calls[0][0].where;
    const reelWhere = () => prisma.video.findMany.mock.calls[0][0].where;

    it('holds the posts to the same audience rule the feed and search use, for a signed-out visitor', async () => {
      await request(app).get('/api/topics/salary').expect(200);

      const clauses = clausesOf(postWhere());
      expect(clauses).toContainEqual({ isHidden: false, isPublic: true });
      expect(clauses).toContainEqual(authorAudienceWhere(undefined, []));
      expect(clauses).toContainEqual({ content: { contains: '#salary', mode: 'insensitive' } });
      // No block clause for somebody who has blocked nobody.
      expect(clauses.some((clause) => clause.authorId)).toBe(false);
    });

    it('holds the reels to the same audience rule, for a signed-out visitor', async () => {
      await request(app).get('/api/topics/salary').expect(200);

      expect(reelWhere()).toMatchObject({ status: 'PUBLISHED', isHidden: false, hashtags: { has: 'salary' } });
      expect(reelWhere().author).toEqual(authorVisibleWhere(undefined));
    });

    it('leaves a suspended or banned member out of the posts and the reels, signed out and signed in', async () => {
      // A moderator's suspension or ban sets isSuspended or bannedAt and leaves
      // isActive alone, so a page that did not ask went on listing her.
      const open = JSON.stringify({ isSuspended: false, bannedAt: null });

      await request(app).get('/api/topics/salary').expect(200);
      await request(app).get('/api/topics/salary').set(as('viewer-1')).expect(200);

      for (const call of prisma.post.findMany.mock.calls) expect(JSON.stringify(call[0].where)).toContain(open);
      for (const call of prisma.video.findMany.mock.calls) expect(JSON.stringify(call[0].where.author)).toContain(open);
      for (const call of prisma.post.count.mock.calls) expect(JSON.stringify(call[0].where)).toContain(open);
      for (const call of prisma.video.count.mock.calls) expect(JSON.stringify(call[0].where.author)).toContain(open);
    });

    it('counts a page with the clause the page was read with, so the totals are not of posts she cannot see', async () => {
      await request(app).get('/api/topics/salary').set(as('viewer-1')).expect(200);

      expect(prisma.post.count.mock.calls[0][0].where).toEqual(postWhere());
      expect(prisma.video.count.mock.calls[0][0].where).toEqual(reelWhere());
    });

    it('leaves a member on either side of a block out of the posts and the reels, in both stores', async () => {
      prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
      prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'blocked-her' }]);
      prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['dv-only'] });

      await request(app).get('/api/topics/salary').set(as('viewer-1')).expect(200);

      const notIn = (where: any) => new Set(clausesOf(where).find((clause) => clause.authorId?.notIn)?.authorId.notIn);
      expect(notIn(postWhere())).toEqual(new Set(['him', 'blocked-her', 'dv-only']));
      expect(new Set(reelWhere().authorId.notIn)).toEqual(new Set(['him', 'blocked-her', 'dv-only']));
      // The direction the id list cannot name: a member who blocked her from the DV page only.
      const dvClause = { NOT: { author: { dvSafetyProfile: { is: { blockedUserIds: { has: 'viewer-1' } } } } } };
      expect(clausesOf(postWhere())).toContainEqual(dvClause);
      expect(JSON.stringify(reelWhere().author)).toContain(JSON.stringify({ NOT: dvClause.NOT.author }));
    });

    it('lets the posts of a connections-only author through for a viewer who follows her, and for no one else', async () => {
      prisma.follow.findMany.mockResolvedValue([{ followingId: 'mei' }]);

      await request(app).get('/api/topics/salary').set(as('viewer-1')).expect(200);

      expect(clausesOf(postWhere())).toContainEqual(authorAudienceWhere('viewer-1', ['mei']));
    });

    it('fails the page rather than listing everyone when the block lists cannot be read', async () => {
      prisma.userSafetySettings.findMany.mockRejectedValue(new Error('connection reset'));

      const res = await request(app).get('/api/topics/salary').set(as('viewer-1'));

      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(res.body.data).toBeUndefined();
      expect(prisma.post.findMany).not.toHaveBeenCalled();
      expect(prisma.video.findMany).not.toHaveBeenCalled();
    });
  });

  it('following writes the preference the feed reads, and unfollowing removes it', async () => {
    prisma.userFeedPreferences.findUnique.mockResolvedValue({ followedHashtags: ['interviews'] });
    prisma.userFeedPreferences.upsert.mockImplementation(async ({ update }: any) => update);

    const followed = await request(app).post('/api/topics/salary/follow').set(as('viewer-1')).expect(201);
    expect(followed.body.data).toEqual({ tag: 'salary', isFollowing: true, following: ['interviews', 'salary'] });
    expect(prisma.userFeedPreferences.upsert.mock.calls[0][0].update).toEqual({ followedHashtags: ['interviews', 'salary'] });

    prisma.userFeedPreferences.findUnique.mockResolvedValue({ followedHashtags: ['interviews', 'salary'] });
    const unfollowed = await request(app).delete('/api/topics/salary/follow').set(as('viewer-1')).expect(200);
    expect(unfollowed.body.data.following).toEqual(['interviews']);
  });

  it('the feed names a followed topic as the reason', () => {
    const post = {
      id: 'p',
      authorId: 'a',
      type: 'TEXT',
      content: 'Bands published #Salary',
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      createdAt: new Date(Date.now() - 5 * 3600000),
      author: { displayName: 'Mei' },
    };
    expect(reasonsFor(post, { followingIds: [], followedHashtags: ['salary'] })).toEqual(['You follow #salary']);
    expect(reasonsFor(post, { followingIds: [], followedHashtags: ['interviews'] })).toEqual(['Recent in the community']);
  });
});
