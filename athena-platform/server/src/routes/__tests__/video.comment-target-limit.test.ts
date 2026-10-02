/**
 * Commenting under the same creator's reels again and again.
 *
 * The same ceiling as comments under her posts, and the same count: a campaign
 * against one woman does not become allowed because it is aimed at her reels.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    video: { findUnique: jest.fn(), update: jest.fn() },
    videoComment: { findUnique: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn(async () => null) },
    userSafetySettings: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    dvSafetyProfile: {
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
    follow: { findUnique: jest.fn(async () => null), findFirst: jest.fn(async () => null) },
    notification: { create: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: req.headers['x-test-user'] || 'stranger-1', role: 'USER', email: 'u@athena.com' };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, __res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../services/moderation.service', () => ({
  assertContentAllowed: jest.fn(async () => undefined),
}));

// The ceiling stands down when there is no Redis (tests), so each case says what it answers.
jest.mock('../../middleware/socialLimits', () => {
  const actual: any = jest.requireActual('../../middleware/socialLimits');
  return { ...actual, withinTargetLimit: jest.fn(async () => true) };
});

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { withinTargetLimit } from '../../middleware/socialLimits';
import { assertContentAllowed } from '../../services/moderation.service';

const prisma: any = prismaTyped;
const limit = withinTargetLimit as unknown as jest.Mock<(...args: unknown[]) => Promise<boolean>>;
const as = (user: string) => ({ 'x-test-user': user });
const CREATOR = 'creator-1';

describe('POST /api/video/:id/comments and the same creator again and again', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    limit.mockResolvedValue(true);
    prisma.video.findUnique.mockResolvedValue({ id: 'v1', authorId: CREATOR, status: 'PUBLISHED', isHidden: false });
    prisma.video.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({ displayName: 'Aisha', firstName: 'Aisha' });
    prisma.videoComment.create.mockImplementation(async ({ data }: any) => ({ id: 'c-new', ...data }));
  });

  it('is counted against the creator, and refused with a 429 past the ceiling', async () => {
    limit.mockResolvedValue(false);

    const res = await request(app).post('/api/video/v1/comments').set(as('reader')).send({ content: 'Nice' }).expect(429);

    expect(limit).toHaveBeenCalledWith('comment', 'reader', CREATOR);
    expect(res.body.message).toMatch(/rest/i);
    expect(prisma.videoComment.create).not.toHaveBeenCalled();
    expect(assertContentAllowed).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('lets a comment through while the pair is inside the ceiling', async () => {
    await request(app).post('/api/video/v1/comments').set(as('reader')).send({ content: 'Nice' }).expect(201);

    expect(limit).toHaveBeenCalledWith('comment', 'reader', CREATOR);
    expect(prisma.videoComment.create).toHaveBeenCalled();
  });

  it('never limits the creator in the comments under her own reel', async () => {
    limit.mockResolvedValue(false);

    await request(app).post('/api/video/v1/comments').set(as(CREATOR)).send({ content: 'Thanks all' }).expect(201);

    expect(limit).not.toHaveBeenCalled();
  });
});
