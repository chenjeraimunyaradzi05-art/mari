/**
 * POST /api/video/:id/view used to add one to Video.viewCount on every call,
 * from anyone, with no account needed. viewCount is printed on the reel, sorts
 * the trending tab and feeds a creator's standing, so a loop could put any reel
 * at the top of trending in a minute and a creator refreshing her own page
 * watched her own numbers climb. The creator dashboard now replays the same
 * rule over the stored watches (creator-content-analytics.service), so the two
 * have to agree about what a view is.
 *
 * These pin the rule: every watch is recorded, but a view is counted only for
 * a signed-in member who is not the author, once per reel per
 * COUNTED_VIEW_WINDOW_MS.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    video: { findUnique: jest.fn(), update: jest.fn() },
    videoView: { findFirst: jest.fn(), create: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'viewer-1', role: 'USER', email: 'v@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    const id = req.headers['x-test-user'];
    if (typeof id === 'string') req.user = { id, role: 'USER', email: `${id}@athena.com` };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { COUNTED_VIEW_WINDOW_MS } from '../../services/creator-content-analytics.service';

const prisma: any = prismaTyped;

const REEL = { id: 'reel-1', authorId: 'creator-1', status: 'PUBLISHED', isHidden: false };
const WATCH = { watchDuration: 12, completionPct: 80 };

const watch = (as?: string) => {
  const req = request(app).post('/api/video/reel-1/view');
  return (as ? req.set('x-test-user', as) : req).send(WATCH);
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.video.findUnique.mockResolvedValue(REEL);
  prisma.video.update.mockResolvedValue({});
  prisma.videoView.findFirst.mockResolvedValue(null);
  prisma.videoView.create.mockResolvedValue({});
});

describe('POST /api/video/:id/view', () => {
  it('records and counts a signed-in member’s first watch of the day', async () => {
    const before = Date.now();
    await watch('amara').expect(200);

    expect(prisma.videoView.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ videoId: 'reel-1', userId: 'amara', watchDuration: 12, completionPct: 80 }),
    });
    expect(prisma.video.update).toHaveBeenCalledWith({
      where: { id: 'reel-1' },
      data: { viewCount: { increment: 1 } },
    });

    // The lookback is the shared window, measured from now.
    const where = prisma.videoView.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ videoId: 'reel-1', userId: 'amara' });
    const lookback = before - (where.createdAt.gte as Date).getTime();
    expect(lookback).toBeGreaterThanOrEqual(COUNTED_VIEW_WINDOW_MS - 1000);
    expect(lookback).toBeLessThanOrEqual(COUNTED_VIEW_WINDOW_MS + 1000);
  });

  it('records a rewatch inside the window but does not count it again', async () => {
    prisma.videoView.findFirst.mockResolvedValue({ id: 'earlier-watch' });

    await watch('amara').expect(200);

    expect(prisma.videoView.create).toHaveBeenCalledTimes(1);
    expect(prisma.video.update).not.toHaveBeenCalled();
  });

  it('never counts the author’s own watches, however many there are', async () => {
    await watch('creator-1').expect(200);
    await watch('creator-1').expect(200);

    expect(prisma.videoView.create).toHaveBeenCalledTimes(2);
    expect(prisma.video.update).not.toHaveBeenCalled();
  });

  it('records a signed-out watch but does not count it, since there is nobody to count it as', async () => {
    await watch().expect(200);

    expect(prisma.videoView.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ videoId: 'reel-1', userId: undefined }),
    });
    expect(prisma.videoView.findFirst).not.toHaveBeenCalled();
    expect(prisma.video.update).not.toHaveBeenCalled();
  });

  it('a hidden or unpublished reel is not found, and nothing is written', async () => {
    prisma.video.findUnique.mockResolvedValue({ ...REEL, isHidden: true });
    await watch('amara').expect(404);

    prisma.video.findUnique.mockResolvedValue({ ...REEL, status: 'PROCESSING' });
    await watch('amara').expect(404);

    expect(prisma.videoView.create).not.toHaveBeenCalled();
    expect(prisma.video.update).not.toHaveBeenCalled();
  });

  it('refuses a ping that does not say how long she watched', async () => {
    await request(app).post('/api/video/reel-1/view').set('x-test-user', 'amara').send({ completionPct: 50 }).expect(400);

    expect(prisma.videoView.create).not.toHaveBeenCalled();
  });
});
