import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The forums, the support circles and the challenges are rooms full of strangers
 * who write about their own lives, and they name themselves to each other. They
 * were the one place a block did not reach: a woman who had blocked a man could
 * still read his posts under a name she knew, find him in the circle she was
 * about to join, and be written to by a reply under her own post.
 *
 * What is held here: either side of a block (in the platform list or in the DV
 * safety page's own) is not in the lists, answers as a post, circle or challenge
 * that is not there, cannot be replied to or supported, is not put in a circle
 * with her, and is not on a leaderboard with her. Staff are not held to it, since
 * they reach every post to moderate it.
 */

const state: { posts: any[]; replies: any[]; circles: any[]; challenges: any[] } = { posts: [], replies: [], circles: [], challenges: [] };

jest.mock('../../utils/prisma', () => {
  const empty = () => ({
    findMany: jest.fn(async () => []),
    findFirst: jest.fn(async () => null),
    findUnique: jest.fn(async () => null),
    count: jest.fn(async () => 0),
    create: jest.fn(async ({ data }: any) => ({ id: 'new', ...data })),
    update: jest.fn(async () => ({})),
    upsert: jest.fn(async ({ create }: any) => create),
    delete: jest.fn(async () => ({})),
    groupBy: jest.fn(async () => []),
  });
  const dedicated: Record<string, any> = {
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    dvSafetyProfile: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null) },
    user: { findUnique: jest.fn(async () => ({ timezone: 'Australia/Brisbane' })), findMany: jest.fn(async () => []) },
    healthSettings: { findUnique: jest.fn(async () => ({ id: 's1', hiddenWarnings: [], anonymousByDefault: false })), create: jest.fn() },
    wellnessForum: {
      findUnique: jest.fn(async () => ({ id: 'f1', slug: 'anxiety', name: 'Anxiety', topic: 'anxiety', description: '', guidelines: '', isActive: true, sortOrder: 1, postCount: 0 })),
    },
  };
  const prisma = new Proxy(dedicated, {
    get: (target, name: string) => {
      if (!(name in target)) target[name] = empty();
      return target[name];
    },
  });
  return { prisma };
});

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'her', role: req.headers['x-test-role'] || 'USER', email: 'x@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../services/engagement.service', () => ({
  ...(jest.requireActual('../../services/engagement.service') as object),
  awardAchievement: jest.fn(async () => false),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const as = (userId: string, role?: string) => ({ 'x-test-user': userId, ...(role ? { 'x-test-role': role } : {}) });

const author = (id: string) => ({ id, firstName: id, displayName: null, avatar: null, role: 'USER', practitionerProfile: null });
const post = (id: string, authorId: string, over: Record<string, unknown> = {}) => ({
  id, forumId: 'f1', authorId, isAnonymous: false, title: `Post ${id}`, body: 'Some words about a hard week.', contentWarning: null,
  isHidden: false, hiddenReason: null, isPinned: false, isLocked: false, crisisFlagged: false, replyCount: 0, supportCount: 0,
  lastReplyAt: null, createdAt: new Date(), updatedAt: new Date(), author: author(authorId), forum: { slug: 'anxiety', name: 'Anxiety' }, ...over,
});
const circle = (id: string, facilitatorId: string, memberIds: string[] = [facilitatorId], over: Record<string, unknown> = {}) => ({
  id, name: `Circle ${id}`, topic: 'anxiety', description: 'A small circle', facilitatorId, capacity: 6, weeks: 8, startsOn: new Date(Date.now() - 86400000), meetingDay: 2, meetingTime: '19:00',
  format: 'VIDEO', meetingLink: 'https://meet.example/x', location: null, status: 'RUNNING', isFeatured: false, createdAt: new Date(),
  facilitator: author(facilitatorId),
  members: memberIds.map((userId) => ({ userId, leftAt: null, role: userId === facilitatorId ? 'FACILITATOR' : 'MEMBER', joinedAt: new Date(), continueRequested: false, user: author(userId) })),
  checkIns: [] as any[],
  ...over,
});
const challenge = (id: string, createdById: string, memberIds: string[] = [createdById]) => ({
  id, name: `Challenge ${id}`, description: 'Seven days of water', habitTemplateKey: null, startsOn: new Date(Date.now() - 86400000), endsOn: new Date(Date.now() + 6 * 86400000),
  isPublic: true, createdById, createdAt: new Date(), createdBy: author(createdById),
  members: memberIds.map((userId) => ({ userId, habitId: null, user: author(userId) })),
});

// The ways a block is written, and the directions it runs.
const blocks: Array<[string, () => void]> = [
  ['she has blocked him', () => prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] })],
  ['he has blocked her', () => prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'him' }])],
  ['he blocked her from the DV safety page alone', () => prisma.dvSafetyProfile.findMany.mockResolvedValue([{ userId: 'him' }])],
];

beforeEach(() => {
  jest.clearAllMocks();
  state.posts = [];
  state.replies = [];
  state.circles = [];
  state.challenges = [];
  // clearAllMocks keeps an implementation a test set: nobody is blocked unless a test says so.
  prisma.userSafetySettings.findUnique.mockResolvedValue(null);
  prisma.userSafetySettings.findMany.mockResolvedValue([]);
  prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
  prisma.dvSafetyProfile.findMany.mockResolvedValue([]);
  prisma.wellnessPost.findMany.mockImplementation(async () => state.posts);
  prisma.wellnessPost.count.mockImplementation(async () => state.posts.length);
  prisma.wellnessPost.findUnique.mockImplementation(async ({ where }: any) => state.posts.find((p) => p.id === where.id) ?? null);
  prisma.wellnessPost.update.mockResolvedValue({ supportCount: 1 });
  prisma.wellnessReply.findMany.mockImplementation(async () => state.replies);
  prisma.wellnessReply.count.mockImplementation(async () => state.replies.length);
  prisma.wellnessReply.create.mockImplementation(async ({ data }: any) => ({ id: 'reply-new', isHidden: false, createdAt: new Date(), ...data, author: author(data.authorId) }));
  prisma.wellnessCircle.findMany.mockImplementation(async () => state.circles);
  prisma.wellnessCircle.findUnique.mockImplementation(async ({ where }: any) => state.circles.find((c) => c.id === where.id) ?? null);
  prisma.wellnessChallenge.findMany.mockImplementation(async () => state.challenges);
  prisma.wellnessChallenge.findUnique.mockImplementation(async ({ where }: any) => state.challenges.find((c) => c.id === where.id) ?? null);
});

describe('the forums, across a block', () => {
  it.each(blocks)('leaves what either of them wrote out of the list of posts, in the query, when %s', async (_name, block) => {
    block();
    state.posts = [post('p1', 'someone')];

    await request(app).get('/api/wellness/forums/anxiety').set(as('her')).expect(200);

    const where = prisma.wellnessPost.findMany.mock.calls[0][0].where;
    expect(where.authorId).toEqual({ notIn: ['him'] });
    // And the count that says how many there are is the number she can read.
    expect(prisma.wellnessPost.count.mock.calls[0][0].where.authorId).toEqual({ notIn: ['him'] });
    // What was already there is kept: a hidden post is still hidden from everyone but its author.
    expect(where.OR).toEqual([{ isHidden: false }, { authorId: 'her' }]);
  });

  it('asks for no exclusion when nobody is blocked, so the query is what it was', async () => {
    await request(app).get('/api/wellness/forums/anxiety').set(as('her')).expect(200);

    expect(prisma.wellnessPost.findMany.mock.calls[0][0].where).not.toHaveProperty('authorId');
  });

  it.each(blocks)('answers a post by the other side as one that is not there, when %s', async (_name, block) => {
    block();
    state.posts = [post('p1', 'him')];

    const res = await request(app).get('/api/wellness/forum-posts/p1').set(as('her')).expect(404);

    expect(res.body.message).toBe('Post not found');
  });

  it('leaves the replies of the other side out of a thread she can read, and keeps the rest', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
    state.posts = [post('p1', 'someone')];

    await request(app).get('/api/wellness/forum-posts/p1').set(as('her')).expect(200);

    const where = prisma.wellnessReply.findMany.mock.calls[0][0].where;
    expect(where.authorId).toEqual({ notIn: ['him'] });
    expect(prisma.wellnessReply.count.mock.calls[0][0].where.authorId).toEqual({ notIn: ['him'] });
  });

  it.each(blocks)('refuses a reply under the post of the other side, stores nothing and rings nobody, when %s', async (_name, block) => {
    block();
    state.posts = [post('p1', 'him')];

    const res = await request(app).post('/api/wellness/forum-posts/p1/replies').set(as('her')).send({ body: 'I am so sorry you are going through this.' }).expect(404);

    expect(res.body.message).toBe('Post not found');
    expect(prisma.wellnessReply.create).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('still takes a reply under a post by someone she has not blocked, and tells that author', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
    state.posts = [post('p1', 'someone')];

    await request(app).post('/api/wellness/forum-posts/p1/replies').set(as('her')).send({ body: 'I am so sorry you are going through this.' }).expect(201);

    expect(prisma.wellnessReply.create).toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it.each(blocks)('refuses a show of support under the post of the other side, when %s', async (_name, block) => {
    block();
    state.posts = [post('p1', 'him')];

    await request(app).post('/api/wellness/forum-posts/p1/support').set(as('her')).expect(404);

    expect(prisma.wellnessSupport.create).not.toHaveBeenCalled();
  });

  it('does not answer with every post when the block lists cannot be read', async () => {
    prisma.dvSafetyProfile.findUnique.mockRejectedValue(new Error('connection reset'));
    state.posts = [post('p1', 'him')];

    await request(app).get('/api/wellness/forums/anxiety').set(as('her')).expect(500);

    expect(prisma.wellnessPost.findMany).not.toHaveBeenCalled();
  });

  it('does not hold a moderator to it, who reaches every post to moderate it', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
    state.posts = [post('p1', 'him')];

    await request(app).get('/api/wellness/forum-posts/p1').set(as('her', 'MODERATOR')).expect(200);
    await request(app).get('/api/wellness/forums/anxiety').set(as('her', 'MODERATOR')).expect(200);

    expect(prisma.wellnessPost.findMany.mock.calls[0][0].where).not.toHaveProperty('authorId');
    expect(prisma.dvSafetyProfile.findUnique).not.toHaveBeenCalled();
  });
});

describe('the support circles, across a block', () => {
  it.each(blocks)('does not list a circle run by the other side, when %s', async (_name, block) => {
    block();

    await request(app).get('/api/wellness/circles').set(as('her')).expect(200);

    expect(prisma.wellnessCircle.findMany.mock.calls[0][0].where.facilitatorId).toEqual({ notIn: ['him'] });
  });

  it.each(blocks)('answers a circle run by the other side as one that is not there, when %s', async (_name, block) => {
    block();
    state.circles = [circle('c1', 'him', ['him', 'her'])];

    const res = await request(app).get('/api/wellness/circles/c1').set(as('her')).expect(404);

    expect(res.body.message).toBe('Circle not found');
  });

  it.each(blocks)('does not put her in a circle with the other side, whoever started it, when %s', async (_name, block) => {
    block();
    // He is an ordinary member, not the facilitator: the circle is still one she must not join.
    state.circles = [circle('c1', 'someone', ['someone', 'him'])];

    const res = await request(app).post('/api/wellness/circles/c1/join').set(as('her')).expect(404);

    expect(res.body.message).toBe('Circle not found');
    expect(prisma.wellnessCircleMember.upsert).not.toHaveBeenCalled();
  });

  it('still lets her join a circle with nobody across a block in it', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
    state.circles = [circle('c1', 'someone', ['someone', 'a-friend'])];
    prisma.wellnessCircleMember.upsert.mockImplementation(async ({ create }: any) => {
      state.circles[0].members.push({ userId: create.userId, leftAt: null });
      return create;
    });

    await request(app).post('/api/wellness/circles/c1/join').set(as('her')).expect(200);

    expect(prisma.wellnessCircleMember.upsert).toHaveBeenCalled();
  });

  it('leaves the other side out of the members and the check-ins of a circle she is in', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
    const checkIn = (id: string, userId: string) => ({ id, userId, week: 1, mood: 3, wins: `wins of ${userId}`, blockers: `blockers of ${userId}`, nextStep: 'rest', createdAt: new Date(), user: author(userId) });
    state.circles = [circle('c1', 'someone', ['someone', 'her', 'him'], { checkIns: [checkIn('k1', 'someone'), checkIn('k2', 'him'), checkIn('k3', 'her')] })];

    const res = await request(app).get('/api/wellness/circles/c1?today=' + new Date(Date.now() - 3600000).toISOString().slice(0, 10)).set(as('her')).expect(200);

    const text = JSON.stringify(res.body.data);
    expect(res.body.data.members.map((m: any) => m.id).sort()).toEqual(['her', 'someone']);
    expect(text).not.toContain('wins of him');
    expect(text).not.toContain('blockers of him');
    // Hers, and everyone else's, are there.
    expect(text).toContain('wins of someone');
    expect(res.body.data.myCheckIns.map((c: any) => c.id)).toEqual(['k3']);
  });

  it('does not hold a moderator to it', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
    state.circles = [circle('c1', 'him', ['him'])];

    await request(app).get('/api/wellness/circles/c1').set(as('her', 'ADMIN')).expect(200);
  });
});

describe('the challenges, across a block', () => {
  it.each(blocks)('does not list a challenge started by the other side, when %s', async (_name, block) => {
    block();

    await request(app).get('/api/wellness/challenges').set(as('her')).expect(200);

    const where = prisma.wellnessChallenge.findMany.mock.calls[0][0].where;
    expect(where.AND[1]).toEqual({ createdById: { notIn: ['him'] } });
  });

  it.each(blocks)('answers a challenge started by the other side as one that is not there, and will not let her join, when %s', async (_name, block) => {
    block();
    state.challenges = [challenge('x1', 'him')];

    await request(app).get('/api/wellness/challenges/x1').set(as('her')).expect(404);
    await request(app).post('/api/wellness/challenges/x1/join').set(as('her')).send({}).expect(404);

    expect(prisma.wellnessChallengeMember.create).not.toHaveBeenCalled();
  });

  it('leaves the other side off the leaderboard of a challenge she is in', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
    state.challenges = [challenge('x1', 'someone', ['someone', 'her', 'him'])];

    const res = await request(app).get('/api/wellness/challenges/x1').set(as('her')).expect(200);

    const names = res.body.data.leaderboard.map((row: any) => row.name);
    expect(names).toHaveLength(2);
    expect(names).not.toContain('him');
  });
});
