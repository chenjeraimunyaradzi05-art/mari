import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    post: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(async () => []),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    like: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    postSave: { findMany: jest.fn(async () => []) },
    pollVote: { groupBy: jest.fn(async () => []), findMany: jest.fn(async () => []) },
    // findFirst answers "is she in Safe Mode?"; findMany "which of these authors may the viewer be shown?".
    user: {
      findUnique: jest.fn(async () => ({ displayName: 'Sarah D.', firstName: 'Sarah', lastName: 'Demo' })),
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
    notification: { create: jest.fn() },
    userSafetySettings: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    // A notification is never sent across a block, in either store.
    dvSafetyProfile: { findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    // Whether the viewer follows the original's author (a connections-only profile).
    follow: { findUnique: jest.fn(async () => null), findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
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

jest.mock('../../services/moderation.service', () => ({
  assertContentAllowed: jest.fn(async () => undefined),
}));

jest.mock('../../services/link-preview.service', () => ({
  enrichPostLinkPreview: jest.fn(),
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { decoratePosts } from '../../services/post-decoration.service';
import { authorAudienceWhere } from '../../services/audience.service';

const prisma: any = prismaTyped;
const VIEWER = 'viewer-1';
const AUTHOR = 'author-1';
const as = (userId: string) => ({ 'x-test-user': userId });

const author = { id: AUTHOR, firstName: 'Mei', lastName: 'Chen', displayName: 'Mei C.', avatar: null, headline: null };

const original = (overrides: Record<string, unknown> = {}) => ({
  id: 'orig',
  authorId: AUTHOR,
  content: 'The original words',
  isHidden: false,
  isPublic: true,
  repostOfId: null,
  ...overrides,
});

describe('Reposts and quotes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.post.findMany.mockResolvedValue([]);
    // Nobody has closed their profile or blocked anyone unless a test says so.
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.dvSafetyProfile.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findFirst.mockResolvedValue(null);
    prisma.follow.findUnique.mockResolvedValue(null);
    prisma.follow.findMany.mockResolvedValue([]);
    prisma.user.findFirst.mockResolvedValue(null);
    // The original's author may be shown to the viewer unless a test says otherwise.
    prisma.user.findMany.mockResolvedValue([{ id: AUTHOR }]);
  });

  it('reposts a public post once, counts it on the original and tells the author', async () => {
    prisma.post.findUnique.mockResolvedValue(original());
    prisma.post.findFirst.mockResolvedValue(null);
    prisma.post.create.mockResolvedValue({
      id: 'rp',
      authorId: VIEWER,
      content: '',
      repostOfId: 'orig',
      author: { ...author, id: VIEWER },
      repostOf: { ...original(), author },
    });
    prisma.post.update.mockResolvedValue({});

    const res = await request(app).post('/api/posts/orig/repost').set(as(VIEWER)).expect(201);

    expect(res.body.message).toBe('Reposted');
    expect(res.body.data.repostOf.content).toBe('The original words');
    expect(prisma.post.create.mock.calls[0][0].data).toMatchObject({ authorId: VIEWER, content: '', repostOfId: 'orig' });
    expect(prisma.post.update.mock.calls[0][0]).toMatchObject({ where: { id: 'orig' }, data: { repostCount: { increment: 1 } } });
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: AUTHOR, type: 'REPOST' });
  });

  // The pseudonymous display name: a post's author is shown to other members by her
  // public name, and the legal first and last name never leave the server.
  it('shows the original\'s author by her public name, and the viewer her own record whole', async () => {
    prisma.post.findUnique.mockResolvedValue(original());
    prisma.post.findFirst.mockResolvedValue(null);
    prisma.post.create.mockResolvedValue({
      id: 'rp',
      authorId: VIEWER,
      content: '',
      repostOfId: 'orig',
      author: { id: VIEWER, firstName: 'Vee', lastName: 'Own', displayName: 'Vee', avatar: null, headline: null },
      repostOf: { ...original(), author: { id: AUTHOR, firstName: 'Jane', lastName: 'Doe', displayName: 'Willow Rain', avatar: null, headline: 'Founder' } },
    });
    prisma.post.update.mockResolvedValue({});

    const res = await request(app).post('/api/posts/orig/repost').set(as(VIEWER)).expect(201);

    expect(res.body.data.repostOf.author).toEqual({ id: AUTHOR, firstName: 'Willow Rain', lastName: '', displayName: 'Willow Rain', avatar: null, headline: 'Founder' });
    expect(JSON.stringify(res.body.data.repostOf)).not.toMatch(/Doe|Jane/);
    expect(res.body.data.author).toMatchObject({ firstName: 'Vee', lastName: 'Own' });
  });

  it('a second plain repost is the same repost, not another row', async () => {
    prisma.post.findUnique.mockResolvedValue(original());
    prisma.post.findFirst.mockResolvedValue({ id: 'rp', authorId: VIEWER, content: '', repostOfId: 'orig', author, repostOf: { ...original(), author } });

    const res = await request(app).post('/api/posts/orig/repost').set(as(VIEWER)).expect(200);

    expect(res.body.message).toBe('Already reposted');
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('a quote keeps its own words and points at the original', async () => {
    prisma.post.findUnique.mockResolvedValue(original());
    prisma.post.create.mockResolvedValue({
      id: 'q1',
      authorId: VIEWER,
      content: 'Worth reading',
      repostOfId: 'orig',
      author,
      repostOf: { ...original(), author },
    });
    prisma.post.update.mockResolvedValue({});

    const res = await request(app).post('/api/posts/orig/repost').set(as(VIEWER)).send({ content: 'Worth reading' }).expect(201);

    expect(res.body.message).toBe('Quote posted');
    expect(prisma.post.findFirst).not.toHaveBeenCalled();
    expect(prisma.post.create.mock.calls[0][0].data).toMatchObject({ content: 'Worth reading', repostOfId: 'orig' });
    expect(prisma.notification.create.mock.calls[0][0].data.message).toBe('Sarah D. quoted your post');
  });

  it('reposting a plain repost reposts the original underneath it', async () => {
    prisma.post.findUnique
      .mockResolvedValueOnce({ id: 'rp', authorId: 'someone', content: '', isHidden: false, isPublic: true, repostOfId: 'orig' })
      .mockResolvedValueOnce(original());
    prisma.post.findFirst.mockResolvedValue(null);
    prisma.post.create.mockResolvedValue({ id: 'rp2', authorId: VIEWER, content: '', repostOfId: 'orig', author, repostOf: null });
    prisma.post.update.mockResolvedValue({});

    await request(app).post('/api/posts/rp/repost').set(as(VIEWER)).expect(201);

    expect(prisma.post.create.mock.calls[0][0].data.repostOfId).toBe('orig');
  });

  it('a private or hidden post cannot be reposted', async () => {
    prisma.post.findUnique.mockResolvedValue(original({ isPublic: false }));
    await request(app).post('/api/posts/orig/repost').set(as(VIEWER)).expect(404);
  });

  // A repost re-publishes the original's words to the reposter's followers. The
  // original's author chose who may read them: a follower of a connections-only
  // member could repost her post, and anyone holding the id of a private
  // profile's post could repost that.
  describe('and the original author’s audience', () => {
    it('refuses a post whose author has a private profile', async () => {
      prisma.post.findUnique.mockResolvedValue(original());
      prisma.userSafetySettings.findUnique.mockResolvedValue({ profileVisibility: 'private' });

      await request(app).post('/api/posts/orig/repost').set(as(VIEWER)).expect(404);

      expect(prisma.post.create).not.toHaveBeenCalled();
    });

    it('refuses a connections-only author’s post to a viewer who does not follow her, and allows it to one who does', async () => {
      prisma.post.findUnique.mockResolvedValue(original());
      prisma.post.findFirst.mockResolvedValue(null);
      prisma.userSafetySettings.findUnique.mockResolvedValue({ profileVisibility: 'connections' });

      await request(app).post('/api/posts/orig/repost').set(as(VIEWER)).expect(404);
      expect(prisma.post.create).not.toHaveBeenCalled();

      prisma.follow.findUnique.mockResolvedValue({ followerId: VIEWER });
      prisma.post.create.mockResolvedValue({ id: 'rp', authorId: VIEWER, content: '', repostOfId: 'orig', author, repostOf: null });
      prisma.post.update.mockResolvedValue({});
      await request(app).post('/api/posts/orig/repost').set(as(VIEWER)).expect(201);
    });

    it('refuses a post whose author is in Safe Mode to a viewer who is not her verified connection', async () => {
      prisma.post.findUnique.mockResolvedValue(original());
      prisma.user.findFirst.mockResolvedValue({ id: AUTHOR });

      await request(app).post('/api/posts/orig/repost').set(as(VIEWER)).expect(404);

      expect(prisma.post.create).not.toHaveBeenCalled();
    });

    it('does not name a blocked account in the mentions of a quote, nor notify it', async () => {
      const blocked = '11111111-1111-4111-8111-111111111111';
      prisma.post.findUnique.mockResolvedValue(original());
      prisma.user.findMany.mockResolvedValue([{ id: blocked }]);
      prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: [blocked] });
      prisma.post.create.mockImplementation(async (args: any) => ({ id: 'q1', ...args.data, author, repostOf: null }));
      prisma.post.update.mockResolvedValue({});

      await request(app).post('/api/posts/orig/repost').set(as(VIEWER)).send({ content: `Look @[Him](${blocked})` }).expect(201);

      expect(prisma.post.create.mock.calls[0][0].data.mentionedUserIds).toEqual([]);
      expect(prisma.notification.create.mock.calls.map((call: any[]) => call[0].data.userId)).not.toContain(blocked);
    });
  });

  describe('the list of who reposted', () => {
    const rows = [{ id: 'rp1', content: 'Worth a read', createdAt: new Date('2026-10-01T00:00:00Z'), author }];

    /** Every clause in a where tree, ANDs flattened. */
    const clausesOf = (node: any): any[] => {
      if (!node || typeof node !== 'object') return [];
      if (Array.isArray(node)) return node.flatMap(clausesOf);
      return [node, ...clausesOf(node.AND)];
    };

    it('is held to the audience rule and the viewer’s blocks, in the query, for a signed-out reader too', async () => {
      prisma.post.findUnique.mockResolvedValue(original());
      prisma.post.findMany.mockResolvedValue(rows);

      const res = await request(app).get('/api/posts/orig/reposts').expect(200);

      expect(res.body.data).toEqual([expect.objectContaining({ id: 'rp1', excerpt: 'Worth a read', isQuote: true })]);
      const clauses = clausesOf(prisma.post.findMany.mock.calls[0][0].where);
      expect(clauses).toContainEqual({ isHidden: false, isPublic: true });
      expect(clauses).toContainEqual({ repostOfId: 'orig' });
      expect(clauses).toContainEqual(authorAudienceWhere(undefined, []));
    });

    it('leaves out a repost by someone on either side of a block with the viewer, in both stores', async () => {
      prisma.post.findUnique.mockResolvedValue(original());
      prisma.post.findMany.mockResolvedValue(rows);
      prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['him'] });
      // The mock does not read the query, so say which of the two asks gets the row:
      // "who blocked her" (a blockedUsers filter on its own) and not "is the original's author blocked".
      prisma.userSafetySettings.findMany.mockImplementation(async (args: any) => (args.where.OR ? [] : [{ userId: 'blocked-her' }]));
      prisma.dvSafetyProfile.findUnique.mockResolvedValue({ blockedUserIds: ['dv-only'] });

      await request(app).get('/api/posts/orig/reposts').set(as(VIEWER)).expect(200);

      const clauses = clausesOf(prisma.post.findMany.mock.calls[0][0].where);
      const notIn = clauses.find((clause) => clause.authorId?.notIn)?.authorId.notIn;
      expect(new Set(notIn)).toEqual(new Set(['him', 'blocked-her', 'dv-only']));
      expect(clauses).toContainEqual({ NOT: { author: { dvSafetyProfile: { is: { blockedUserIds: { has: VIEWER } } } } } });
    });

    it.each([
      ['a hidden post', () => prisma.post.findUnique.mockResolvedValue(original({ isHidden: true }))],
      ['a private post', () => prisma.post.findUnique.mockResolvedValue(original({ isPublic: false }))],
      ['a group’s post', () => prisma.post.findUnique.mockResolvedValue(original({ groupId: 'g1' }))],
      ['a post that does not exist', () => prisma.post.findUnique.mockResolvedValue(null)],
      [
        'a post by a member with a private profile',
        () => {
          prisma.post.findUnique.mockResolvedValue(original());
          prisma.userSafetySettings.findUnique.mockResolvedValue({ profileVisibility: 'private' });
        },
      ],
      [
        'a post by a member the viewer has blocked',
        () => {
          prisma.post.findUnique.mockResolvedValue(original());
          prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: VIEWER }]);
        },
      ],
    ])('is not found for %s, so the list does not confirm it', async (_name, arrange) => {
      arrange();
      prisma.post.findMany.mockResolvedValue(rows);

      const res = await request(app).get('/api/posts/orig/reposts').set(as(VIEWER)).expect(404);

      expect(res.body.data).toBeUndefined();
      expect(prisma.post.findMany).not.toHaveBeenCalled();
    });

    it('still lists the reposts to the author of a post she keeps to herself', async () => {
      prisma.post.findUnique.mockResolvedValue(original({ isPublic: false }));
      prisma.post.findMany.mockResolvedValue(rows);

      await request(app).get('/api/posts/orig/reposts').set(as(AUTHOR)).expect(200);
    });
  });

  it('taking a repost back removes the row and lowers the count', async () => {
    prisma.post.findFirst.mockResolvedValue({ id: 'rp' });
    prisma.post.delete.mockResolvedValue({});
    prisma.post.updateMany.mockResolvedValue({ count: 1 });

    await request(app).delete('/api/posts/orig/repost').set(as(VIEWER)).expect(200);

    expect(prisma.post.delete.mock.calls[0][0]).toEqual({ where: { id: 'rp' } });
    expect(prisma.post.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'orig' }, data: { repostCount: { decrement: 1 } } });
  });

  it('deleting a quote takes it off the original’s count', async () => {
    prisma.post.findUnique.mockResolvedValue({ authorId: VIEWER, repostOfId: 'orig' });
    prisma.post.deleteMany.mockResolvedValue({ count: 0 });
    prisma.post.delete.mockResolvedValue({});
    prisma.post.updateMany.mockResolvedValue({ count: 1 });

    await request(app).delete('/api/posts/q1').set(as(VIEWER)).expect(200);

    expect(prisma.post.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'orig' }, data: { repostCount: { decrement: 1 } } });
  });

  it('decoration marks what the viewer reposted and hides a withdrawn original', async () => {
    prisma.post.findMany.mockResolvedValue([{ repostOfId: 'a' }]);

    const [a, b, c] = await decoratePosts(
      [
        { id: 'a', poll: null },
        { id: 'b', poll: null, repostOfId: 'gone', repostOf: { id: 'gone', isHidden: true } },
        { id: 'c', poll: null, repostOfId: 'ok', repostOf: { id: 'ok', isHidden: false, isPublic: true, content: 'fine' } },
      ],
      VIEWER
    );

    expect(a.isReposted).toBe(true);
    expect(b.repostOf).toBeNull();
    expect(b.repostUnavailable).toBe(true);
    expect(c.repostOf).toMatchObject({ content: 'fine' });
    expect(c.repostUnavailable).toBe(false);
  });

  // The reposter's audience does not widen the original's. A repost carries the
  // original's words and its author's name onto a page the original author may
  // never have chosen, so the embed is held to the author's own audience for the
  // person looking: the same marker a withdrawn original gets.
  describe('decoration and the original author’s audience', () => {
    const repostOf = (authorId: string) => ({ id: 'o', authorId, isHidden: false, isPublic: true, content: 'Her words' });
    const page = (authorId: string) => [{ id: 'r', poll: null, repostOfId: 'o', repostOf: repostOf(authorId) }];

    it('shows the original when its author may be shown to the viewer', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: AUTHOR }]);

      const [row] = await decoratePosts(page(AUTHOR), VIEWER);

      expect(row.repostOf).toMatchObject({ content: 'Her words' });
      expect(row.repostUnavailable).toBe(false);
      expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({ id: { in: [AUTHOR] } });
    });

    it('swaps it for the marker when its author is outside the viewer’s audience (a private or connections-only profile)', async () => {
      prisma.user.findMany.mockResolvedValue([]); // the audience filter matched nobody

      const [row] = await decoratePosts(page(AUTHOR), VIEWER);

      expect(row.repostOf).toBeNull();
      expect(row.repostUnavailable).toBe(true);
      expect(JSON.stringify(row)).not.toContain('Her words');
    });

    it('swaps it for the marker when its author is on either side of a block with the viewer, whatever the profile says', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: AUTHOR }]);
      prisma.dvSafetyProfile.findMany.mockResolvedValue([{ userId: AUTHOR }]); // she blocked the viewer from the DV page

      const [row] = await decoratePosts(page(AUTHOR), VIEWER);

      expect(row.repostOf).toBeNull();
      expect(row.repostUnavailable).toBe(true);
    });

    it('never hides the viewer’s own post from her, and asks nothing when no repost is on the page', async () => {
      const [mine] = await decoratePosts(page(VIEWER), VIEWER);
      expect(mine.repostOf).toMatchObject({ content: 'Her words' });

      await decoratePosts([{ id: 'plain', poll: null }], VIEWER);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('asks the same of a signed-out viewer, who has blocked nobody', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const [row] = await decoratePosts(page(AUTHOR), undefined);

      expect(row.repostOf).toBeNull();
      expect(prisma.userSafetySettings.findUnique).not.toHaveBeenCalled();
    });
  });
});
