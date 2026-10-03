/**
 * Who can see whose follower lists, and who the @ autocomplete will name.
 *
 * Both follower lists were open to anyone on the internet for any member, so a
 * private or connections-only profile refused its own page and still handed
 * out the names, photos and headlines of everyone around her. And the mention
 * autocomplete answered from every active account, so a man she had blocked
 * could type her first name into a comment box and be given her id — the key
 * to both of those lists. These pin the closed doors: an account is needed,
 * the profile's own visibility rule applies, a block in either direction is a
 * 404, and nobody search would hide is listed or suggested.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    follow: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    const id = req.headers['x-test-user'];
    if (!id) return res.status(401).json({ success: false, message: 'Authentication required' });
    req.user = { id, role: 'USER', email: `${id}@athena.test` };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

const viewerContextFor = jest.fn(async (viewerId?: string) => ({ viewerId, blockedIds: [] as string[], followingIds: [] as string[] }));
jest.mock('../../services/search.service', () => ({
  ...(jest.requireActual('../../services/search.service') as object),
  viewerContextFor: (viewerId?: string) => viewerContextFor(viewerId),
}));

const profileAccess = jest.fn(async (_viewerId: string | undefined, _targetId: string) => ({
  visibility: 'public' as const,
  access: 'full' as 'full' | 'limited' | 'closed',
  isFollower: false,
}));
jest.mock('../../services/audience.service', () => ({
  ...(jest.requireActual('../../services/audience.service') as object),
  profileAccess: (viewerId: string | undefined, targetId: string) => profileAccess(viewerId, targetId),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const as = (id: string) => ({ 'x-test-user': id });

function target(overrides: Record<string, unknown> = {}) {
  return { id: 'her', isPublic: true, dvSafetyProfile: null, ...overrides };
}

/** Every `where` a list or a count was asked with, as text, to look for a condition anywhere inside it. */
const whereText = (mock: jest.Mock) => JSON.stringify(mock.mock.calls.map((call: any) => call[0].where));

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue(target());
  prisma.follow.findMany.mockResolvedValue([]);
  prisma.follow.count.mockResolvedValue(0);
  viewerContextFor.mockImplementation(async (viewerId?: string) => ({ viewerId, blockedIds: [], followingIds: [] }));
  profileAccess.mockResolvedValue({ visibility: 'public', access: 'full', isFollower: false });
});

describe.each(['followers', 'following'])('GET /api/users/:id/%s', (list) => {
  it('asks for an account', async () => {
    await request(app).get(`/api/users/her/${list}`).expect(401);
    expect(prisma.follow.findMany).not.toHaveBeenCalled();
  });

  it('answers 404 for a member who does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await request(app).get(`/api/users/nobody/${list}`).set(as('viewer')).expect(404);
    expect(prisma.follow.findMany).not.toHaveBeenCalled();
  });

  it('keeps a private profile’s lists as closed as the profile', async () => {
    prisma.user.findUnique.mockResolvedValue(target({ isPublic: false }));
    const res = await request(app).get(`/api/users/her/${list}`).set(as('viewer')).expect(403);
    expect(res.body.message).toBe('This profile is private');
    expect(prisma.follow.findMany).not.toHaveBeenCalled();
  });

  it('keeps a connections-only profile’s lists from someone who does not follow her', async () => {
    profileAccess.mockResolvedValue({ visibility: 'connections', access: 'limited', isFollower: false } as any);
    await request(app).get(`/api/users/her/${list}`).set(as('viewer')).expect(403);
    expect(prisma.follow.findMany).not.toHaveBeenCalled();
  });

  it('answers as though she does not exist to someone she has blocked, or who has blocked her', async () => {
    viewerContextFor.mockResolvedValueOnce({ viewerId: 'him', blockedIds: ['her'], followingIds: [] });
    await request(app).get(`/api/users/her/${list}`).set(as('him')).expect(404);

    // A safety block written only to her DV profile counts the same.
    prisma.user.findUnique.mockResolvedValue(target({ dvSafetyProfile: { blockedUserIds: ['him'] } }));
    await request(app).get(`/api/users/her/${list}`).set(as('him')).expect(404);

    expect(prisma.follow.findMany).not.toHaveBeenCalled();
  });

  it('refuses rather than answering when the block list cannot be read', async () => {
    viewerContextFor.mockRejectedValueOnce(new Error('database unavailable'));
    await request(app).get(`/api/users/her/${list}`).set(as('viewer')).expect(500);
    expect(prisma.follow.findMany).not.toHaveBeenCalled();
  });

  it('leaves out anyone the viewer could not find in search, in the list and in its count', async () => {
    viewerContextFor.mockResolvedValueOnce({ viewerId: 'viewer', blockedIds: ['blocked-one'], followingIds: [] });

    await request(app).get(`/api/users/her/${list}`).set(as('viewer')).expect(200);

    for (const mock of [prisma.follow.findMany, prisma.follow.count]) {
      const text = whereText(mock);
      expect(text).toContain('blocked-one');
      expect(text).toContain('"hideFromSearch":true');
      expect(text).toContain('"isActive":true');
      // And anyone a moderator suspended or banned, who is not in search either.
      expect(text).toContain(JSON.stringify({ isSuspended: false, bannedAt: null }));
    }
    expect(prisma.follow.findMany.mock.calls[0][0].where).toEqual(prisma.follow.count.mock.calls[0][0].where);
  });

  it('shows her own lists whole, apart from blocks, so a follower who hid from search cannot watch unseen', async () => {
    viewerContextFor.mockResolvedValueOnce({ viewerId: 'her', blockedIds: ['blocked-one'], followingIds: [] });

    await request(app).get(`/api/users/her/${list}`).set(as('her')).expect(200);

    const text = whereText(prisma.follow.findMany);
    expect(text).toContain('blocked-one');
    expect(text).not.toContain('hideFromSearch');
    expect(profileAccess).not.toHaveBeenCalled();
  });
});

describe('GET /api/users/suggest (the @ autocomplete)', () => {
  it('never names someone across a block, or someone who asked to be hidden', async () => {
    viewerContextFor.mockResolvedValueOnce({ viewerId: 'him', blockedIds: ['her'], followingIds: [] });

    await request(app).get('/api/users/suggest?q=Sar').set(as('him')).expect(200);

    expect(prisma.user.findMany).toHaveBeenCalledTimes(2);
    for (const call of prisma.user.findMany.mock.calls as any[]) {
      const text = JSON.stringify(call[0].where);
      expect(text).toContain('"notIn":["her"]');
      expect(text).toContain('"hideFromSearch":true');
      // Her own DV block list is honoured even where the platform list missed it.
      expect(text).toContain('"blockedUserIds":{"has":"him"}');
    }
  });

  // A suspension or a ban sets isSuspended or bannedAt and leaves isActive alone,
  // so a box that asked only isActive went on offering a member a moderator had
  // removed, by the start of her name, to the woman she was removed for.
  it('does not name a suspended or banned member, in either list', async () => {
    await request(app).get('/api/users/suggest?q=Sar').set(as('him')).expect(200);

    expect(prisma.user.findMany).toHaveBeenCalledTimes(2);
    for (const call of prisma.user.findMany.mock.calls as any[]) {
      expect(JSON.stringify(call[0].where)).toContain(JSON.stringify({ isSuspended: false, bannedAt: null }));
    }
  });

  // People search leaves a private profile out; the box that names members by the
  // start of their name must not be the way round that.
  it('does not name a member whose profile is private, in either list', async () => {
    await request(app).get('/api/users/suggest?q=Sar').set(as('him')).expect(200);

    expect(prisma.user.findMany).toHaveBeenCalledTimes(2);
    for (const call of prisma.user.findMany.mock.calls as any[]) {
      expect(JSON.stringify(call[0].where)).toContain(
        JSON.stringify({ NOT: { safetySettings: { is: { profileVisibility: 'private' } } } })
      );
    }
  });

  it('fails rather than suggesting without the block list', async () => {
    viewerContextFor.mockRejectedValueOnce(new Error('database unavailable'));

    await request(app).get('/api/users/suggest?q=Sar').set(as('him')).expect(500);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
