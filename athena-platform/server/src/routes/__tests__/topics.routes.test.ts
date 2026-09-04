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

const prisma: any = prismaTyped;
const as = (userId: string) => ({ 'x-test-user': userId });

describe('Topics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.post.findMany.mockResolvedValue([]);
    prisma.video.findMany.mockResolvedValue([]);
    prisma.userFeedPreferences.findUnique.mockResolvedValue(null);
  });

  it('trending adds up hashtags across posts and reels, case-insensitively', async () => {
    prisma.post.findMany.mockResolvedValue([
      { content: 'Got the offer #Salary #negotiation' },
      { content: 'Talk on #salary tomorrow' },
      { content: 'No tags here' },
    ]);
    prisma.video.findMany.mockResolvedValue([{ hashtags: ['salary', 'interviews'] }, { hashtags: ['Interviews'] }]);

    const res = await request(app).get('/api/topics/trending?days=7&limit=3').expect(200);

    expect(res.body.data).toEqual([
      { tag: 'salary', posts: 2, videos: 1, total: 3 },
      { tag: 'interviews', posts: 0, videos: 2, total: 2 },
      { tag: 'negotiation', posts: 1, videos: 0, total: 1 },
    ]);
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
