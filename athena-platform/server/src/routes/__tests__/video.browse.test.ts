import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    // The block checks read the DV safety profile's list as well as the
    // platform one, in both directions; nobody is blocked here.
    dvSafetyProfile: { findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null) },
    userSafetySettings: { findUnique: jest.fn(async () => null), findMany: jest.fn(async () => []) },
    video: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), delete: jest.fn() },
    // findFirst answers "is she in Safe Mode?" on the user table and "does this
    // viewer follow her, with the women-only check passed?" on the follow table.
    user: { findFirst: jest.fn(async () => null) },
    videoSave: { findMany: jest.fn(), count: jest.fn() },
    // Every signed-in listing is decorated with the viewer's like state.
    videoLike: { findMany: jest.fn(async () => []) },
    follow: { findMany: jest.fn(), findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = {
      id: req.headers['x-test-user'] || 'viewer-1',
      role: req.headers['x-test-role'] || 'USER',
      email: 'u@athena.com',
    };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user']) {
      req.user = {
        id: req.headers['x-test-user'],
        role: req.headers['x-test-role'] || 'USER',
        email: 'u@athena.com',
      };
    }
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
import { authorVisibleWhere, mayBeShownToWhere } from '../../services/audience.service';

const prisma: any = prismaTyped;

const VIEWER = 'viewer-1';
const AUTHOR = 'author-1';

const as = (userId: string, role = 'USER') => ({ 'x-test-user': userId, 'x-test-role': role });

/**
 * The list routes send { AND: [what the route asks for, what the viewer may be
 * shown] }, for a signed-out visitor as much as for a member, because a member
 * in Safe Mode is kept off every list. This is the first half.
 */
const askedFor = (call: number = 0) => (prisma.video.findMany as any).mock.calls[call][0].where.AND[0];

describe('Video browse routes are not swallowed by /:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.video.findMany as any).mockResolvedValue([]);
    (prisma.video.count as any).mockResolvedValue(0);
  });

  it('GET /trending filters to a period window and ranks by engagement', async () => {
    await request(app).get('/api/video/trending?period=week').expect(200);

    // Never routed into the lookup-by-id handler.
    expect(prisma.video.findUnique).not.toHaveBeenCalled();

    const args = (prisma.video.findMany as any).mock.calls[0][0];
    expect(askedFor().status).toBe('PUBLISHED');
    expect(askedFor().publishedAt.gte).toBeInstanceOf(Date);
    expect(args.orderBy[0]).toEqual({ engagementScore: 'desc' });
  });

  it('GET /trending rejects an unknown period rather than silently defaulting', async () => {
    await request(app).get('/api/video/trending?period=decade').expect(400);
  });

  it('GET /trending defaults to a week when no period is given', async () => {
    await request(app).get('/api/video/trending').expect(200);

    const since = askedFor().publishedAt.gte;
    const daysAgo = (Date.now() - since.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(daysAgo)).toBe(7);
  });

  it('GET /bookmarked returns the videos, not the join rows', async () => {
    (prisma.videoSave.findMany as any).mockResolvedValue([
      { video: { id: 'v1', title: 'Saved one', author: { id: AUTHOR } } },
    ]);
    (prisma.videoSave.count as any).mockResolvedValue(1);

    const res = await request(app).get('/api/video/bookmarked').set(as(VIEWER)).expect(200);

    expect(res.body.data).toEqual([
      { id: 'v1', title: 'Saved one', author: { id: AUTHOR }, isLiked: false, isSaved: true, sound: null, duetOf: null },
    ]);
    expect(prisma.video.findUnique).not.toHaveBeenCalled();
  });

  it('GET /category/:category filters by VideoType when the name is one', async () => {
    await request(app).get('/api/video/category/career-story').expect(200);

    const where = askedFor();
    expect(where.type).toBe('CAREER_STORY');
    expect(where.hashtags).toBeUndefined();
  });

  it('GET /category/:category falls back to a hashtag for anything else', async () => {
    await request(app).get('/api/video/category/Welding').expect(200);

    const where = askedFor();
    expect(where.hashtags).toEqual({ has: 'welding' });
    expect(where.type).toBeUndefined();
  });

  it('GET /user/:userId shows only published videos to other people', async () => {
    await request(app).get(`/api/video/user/${AUTHOR}`).set(as(VIEWER)).expect(200);

    const where = (prisma.video.findMany as any).mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({ status: 'PUBLISHED', isHidden: false, authorId: AUTHOR });
    // A signed-in viewer's lists also leave out anyone on either side of a block.
    expect(where.AND[1].author.AND[0]).toEqual({
      NOT: { dvSafetyProfile: { is: { blockedUserIds: { has: VIEWER } } } },
    });
  });

  it('GET /user/:userId shows authors their own unpublished uploads', async () => {
    await request(app).get(`/api/video/user/${AUTHOR}`).set(as(AUTHOR)).expect(200);

    expect(askedFor()).toEqual({ authorId: AUTHOR, isHidden: false });
  });

  it('GET /user/:userId shows admins everything too', async () => {
    await request(app).get(`/api/video/user/${AUTHOR}`).set(as(VIEWER, 'ADMIN')).expect(200);

    expect(askedFor().status).toBeUndefined();
  });
});

describe('Video deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.video.delete as any).mockResolvedValue({});
  });

  it('lets the author delete their own video', async () => {
    (prisma.video.findUnique as any).mockResolvedValue({ id: 'v1', authorId: AUTHOR });

    await request(app).delete('/api/video/v1').set(as(AUTHOR)).expect(200);

    expect(prisma.video.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
  });

  it("refuses to delete someone else's video", async () => {
    (prisma.video.findUnique as any).mockResolvedValue({ id: 'v1', authorId: AUTHOR });

    await request(app).delete('/api/video/v1').set(as(VIEWER)).expect(403);

    expect(prisma.video.delete).not.toHaveBeenCalled();
  });

  it('lets an admin delete any video', async () => {
    (prisma.video.findUnique as any).mockResolvedValue({ id: 'v1', authorId: AUTHOR });

    await request(app).delete('/api/video/v1').set(as(VIEWER, 'ADMIN')).expect(200);
  });

  it('404s for a video that does not exist', async () => {
    (prisma.video.findUnique as any).mockResolvedValue(null);

    await request(app).delete('/api/video/nope').set(as(AUTHOR)).expect(404);
  });
});

describe('A member in Safe Mode is discreet on the reels lists too', () => {
  // Who comes back for a member in Safe Mode, over real rows, is in
  // tests/discreet-members.test.ts. These are the route's own promises: that
  // every list carries the rule, signed in or not, and that a link to a reel
  // answers a stranger as a reel that does not exist.

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.video.findMany as any).mockResolvedValue([]);
    (prisma.video.count as any).mockResolvedValue(0);
    (prisma.user.findFirst as any).mockResolvedValue(null);
    (prisma.follow.findFirst as any).mockResolvedValue(null);
  });

  it('sends the rule with every list for a signed-out visitor, who is a stranger to her like anyone', async () => {
    await request(app).get(`/api/video/user/${AUTHOR}`).expect(200);
    await request(app).get('/api/video/category/career-story').expect(200);
    await request(app).get('/api/video/trending').expect(200);

    expect((prisma.video.findMany as any).mock.calls).toHaveLength(3);
    for (const [args] of (prisma.video.findMany as any).mock.calls) {
      // The whole audience rule, not Safe Mode alone: a member whose profile is
      // private or connections-only is as closed to a stranger as she is.
      expect(args.where.AND[1]).toEqual({ author: authorVisibleWhere(undefined) });
    }
  });

  it('sends it with every list for a signed-in member too, beside the block clause', async () => {
    await request(app).get(`/api/video/user/${AUTHOR}`).set(as(VIEWER)).expect(200);

    const { author } = (prisma.video.findMany as any).mock.calls[0][0].where.AND[1];
    expect(author.AND).toContainEqual(authorVisibleWhere(VIEWER));
    // ...and that rule contains Safe Mode's, so the two cannot drift apart.
    expect(JSON.stringify(authorVisibleWhere(VIEWER))).toContain(JSON.stringify(mayBeShownToWhere(VIEWER)));
  });

  it('keeps a member whose profile is private out of every list, and a connections-only one to her followers', async () => {
    await request(app).get('/api/video/trending').set(as(VIEWER)).expect(200);

    const { author } = (prisma.video.findMany as any).mock.calls[0][0].where.AND[1];
    const audience = author.AND.flatMap((clause: any) => clause.AND ?? [clause]).find(
      (clause: any) => Array.isArray(clause.OR) && clause.OR.some((branch: any) => branch.safetySettings)
    );
    // Open to everyone: no settings row, or a public profile. Closed to all but herself and
    // her followers: a connections-only profile. A private one is in no branch at all.
    expect(audience.OR).toEqual([
      { safetySettings: { is: null } },
      { safetySettings: { is: { profileVisibility: 'public' } } },
      { id: VIEWER },
      { safetySettings: { is: { profileVisibility: 'connections' } }, followers: { some: { followerId: VIEWER } } },
    ]);
    expect(JSON.stringify(audience)).not.toContain('private');
  });

  it('counts a page with the clause the page was read with', async () => {
    await request(app).get('/api/video/category/career-story').expect(200);

    expect((prisma.video.count as any).mock.calls[0][0].where).toEqual((prisma.video.findMany as any).mock.calls[0][0].where);
  });

  describe('a link to a reel', () => {
    const reel = { id: 'reel-1', status: 'PUBLISHED', isHidden: false, authorId: AUTHOR, author: { id: AUTHOR } };

    beforeEach(() => {
      (prisma.video.findUnique as any).mockResolvedValue(reel);
      // Her profile is open unless a test says otherwise.
      (prisma.userSafetySettings.findUnique as any).mockResolvedValue(null);
      (prisma.follow.findUnique as any).mockResolvedValue(null);
    });

    it('answers a stranger as a reel that does not exist when its author is in Safe Mode', async () => {
      (prisma.user.findFirst as any).mockResolvedValue({ id: AUTHOR });

      const res = await request(app).get('/api/video/reel-1').set(as(VIEWER)).expect(404);

      expect(res.body.message).toBe('Video not found');
      await request(app).get('/api/video/reel-1').expect(404);
    });

    it('asks about her Safe Mode in both places it is stored', async () => {
      (prisma.user.findFirst as any).mockResolvedValue({ id: AUTHOR });

      await request(app).get('/api/video/reel-1').set(as(VIEWER)).expect(404);

      expect((prisma.user.findFirst as any).mock.calls[0][0]).toEqual({
        where: {
          id: AUTHOR,
          OR: [{ dvSafetyProfile: { is: { isSafeMode: true } } }, { profile: { is: { isSafeMode: true } } }],
        },
        select: { id: true },
      });
    });

    it('opens for a follower of hers who has passed the women-only check, for herself and for staff', async () => {
      (prisma.user.findFirst as any).mockResolvedValue({ id: AUTHOR });
      (prisma.follow.findFirst as any).mockResolvedValue({ followerId: VIEWER });

      await request(app).get('/api/video/reel-1').set(as(VIEWER)).expect(200);
      expect((prisma.follow.findFirst as any).mock.calls[0][0].where).toEqual({
        followingId: AUTHOR,
        followerId: VIEWER,
        follower: { womanVerificationStatus: 'VERIFIED' },
      });

      (prisma.follow.findFirst as any).mockResolvedValue(null);
      await request(app).get('/api/video/reel-1').set(as(AUTHOR)).expect(200);
      await request(app).get('/api/video/reel-1').set(as('staff', 'ADMIN')).expect(200);
    });

    it('answers a stranger as a reel that does not exist when its author’s profile is private, but opens it for her', async () => {
      (prisma.userSafetySettings.findUnique as any).mockResolvedValue({ profileVisibility: 'private' });

      const res = await request(app).get('/api/video/reel-1').set(as(VIEWER)).expect(404);
      expect(res.body.message).toBe('Video not found');
      await request(app).get('/api/video/reel-1').expect(404);

      await request(app).get('/api/video/reel-1').set(as(AUTHOR)).expect(200);
    });

    it('opens a connections-only author’s reel for her followers and not for anyone else', async () => {
      (prisma.userSafetySettings.findUnique as any).mockResolvedValue({ profileVisibility: 'connections' });

      await request(app).get('/api/video/reel-1').set(as(VIEWER)).expect(404);

      (prisma.follow.findUnique as any).mockResolvedValue({ followerId: VIEWER });
      await request(app).get('/api/video/reel-1').set(as(VIEWER)).expect(200);
    });

    it('is open to everyone when its author is not in Safe Mode', async () => {
      await request(app).get('/api/video/reel-1').set(as(VIEWER)).expect(200);
      await request(app).get('/api/video/reel-1').expect(200);
    });

    it('fails the request rather than opening the reel when her Safe Mode cannot be read', async () => {
      (prisma.user.findFirst as any).mockRejectedValue(new Error('database unavailable'));

      const res = await request(app).get('/api/video/reel-1').set(as(VIEWER));

      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(res.body.data).toBeUndefined();
    });
  });
});
