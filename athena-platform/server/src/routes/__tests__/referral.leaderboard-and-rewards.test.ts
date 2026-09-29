import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => {
  const tx = {
    referral: { updateMany: jest.fn() },
    user: { update: jest.fn() },
    notification: { create: jest.fn() },
  };
  return {
    prisma: {
      __tx: tx,
      referral: { findUnique: jest.fn(), groupBy: jest.fn() },
      user: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      follow: { findMany: jest.fn() },
      dvSafetyProfile: { findUnique: jest.fn() },
      userSafetySettings: { findUnique: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(async (work: any) => work(tx)),
    },
  };
});

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (req.headers['x-test-anon']) return res.status(401).json({ message: 'Sign in' });
    req.user = { id: req.headers['x-test-user'] || 'viewer-1', role: req.headers['x-test-role'] || 'USER', email: 'v@example.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ message: 'no' }),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const tx = prisma.__tx;

describe('The referral leaderboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.follow.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.referral.groupBy.mockResolvedValue([
      { referrerId: 'u1', _count: { referrerId: 3 }, _max: { completedAt: new Date('2026-09-01') } },
      { referrerId: 'u2', _count: { referrerId: 1 }, _max: { completedAt: new Date('2026-09-02') } },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'u2', displayName: 'Jo from Logan', firstName: 'Joanne', lastName: 'Smith', avatar: null, referralCredits: 100 },
      { id: 'u1', displayName: null, firstName: 'Priya', lastName: 'Raman', avatar: null, referralCredits: 300 },
    ]);
  });

  it('is not open to anyone who is not signed in', async () => {
    await request(app).get('/api/referrals/leaderboard').set({ 'x-test-anon': '1' }).expect(401);
    expect(prisma.referral.groupBy).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('leaves out members who asked to be hidden from search', async () => {
    await request(app).get('/api/referrals/leaderboard').expect(200);

    const where = prisma.referral.groupBy.mock.calls[0][0].where;
    expect(where.status).toBe('COMPLETED');
    expect(JSON.stringify(where.referrer)).toContain('hideFromSearch');
  });

  it('never publishes a full legal name', async () => {
    const res = await request(app).get('/api/referrals/leaderboard').expect(200);

    expect(res.body.map((row: any) => row.name)).toEqual(['Priya R.', 'Jo from Logan']);
    expect(JSON.stringify(res.body)).not.toContain('Raman');
    expect(JSON.stringify(res.body)).not.toContain('Smith');
  });

  it('ranks by completed referrals, the figure it shows, not by credits', async () => {
    // Jo holds as many credits as Priya with half the referrals, because she
    // was referred herself. Ranked by credits the order was a coin toss
    // between two rows that print different counts.
    prisma.referral.groupBy.mockResolvedValue([
      { referrerId: 'u1', _count: { referrerId: 2 }, _max: { completedAt: new Date('2026-09-01') } },
      { referrerId: 'u2', _count: { referrerId: 1 }, _max: { completedAt: new Date('2026-09-02') } },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'u2', displayName: 'Jo from Logan', firstName: 'Joanne', lastName: 'Smith', avatar: null, referralCredits: 200 },
      { id: 'u1', displayName: null, firstName: 'Priya', lastName: 'Raman', avatar: null, referralCredits: 200 },
    ]);

    const res = await request(app).get('/api/referrals/leaderboard').expect(200);

    expect(res.body.map((row: any) => [row.rank, row.id, row.referrals])).toEqual([
      [1, 'u1', 2],
      [2, 'u2', 1],
    ]);
    const args = prisma.referral.groupBy.mock.calls[0][0];
    expect(args.orderBy[0]).toEqual({ _count: { referrerId: 'desc' } });
    expect(JSON.stringify(args.orderBy)).not.toContain('referralCredits');
  });

  it('leaves out a referrer whose account is gone and keeps the ranks consecutive', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'u2', displayName: 'Jo from Logan', firstName: 'Joanne', lastName: 'Smith', avatar: null, referralCredits: 100 },
    ]);

    const res = await request(app).get('/api/referrals/leaderboard').expect(200);

    expect(res.body).toEqual([expect.objectContaining({ rank: 1, id: 'u2', referrals: 1 })]);
  });

  it('answers an empty board without a second lookup', async () => {
    prisma.referral.groupBy.mockResolvedValue([]);

    const res = await request(app).get('/api/referrals/leaderboard').expect(200);

    expect(res.body).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('A referrer’s own referral history', () => {
  const referred = (referralId: string, id: string, firstName: string, lastName: string) => ({
    id: referralId,
    status: 'COMPLETED',
    rewardGranted: true,
    createdAt: new Date('2026-08-01'),
    completedAt: new Date('2026-08-02'),
    referred: { id, firstName, lastName, avatar: `https://cdn.example/${id}.jpg` },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.follow.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({
      referralCode: 'ABCD1234',
      referralCredits: 200,
      referralsMade: [referred('r1', 'friend-1', 'Mia', 'Nguyen'), referred('r2', 'hidden-1', 'Leah', 'Brown')],
    });
  });

  it('no longer names or pictures a member who has hidden herself or blocked her referrer', async () => {
    // Only the friend passes the hide-from-search and block filter.
    prisma.user.findMany.mockResolvedValue([{ id: 'friend-1' }]);

    const res = await request(app).get('/api/referrals/me').set({ 'x-test-user': 'referrer-1' }).expect(200);

    const where = JSON.stringify(prisma.user.findMany.mock.calls[0][0].where);
    expect(where).toContain('friend-1');
    expect(where).toContain('hidden-1');
    expect(where).toContain('hideFromSearch');
    // Her own DV-page block list, which may not have reached the shared one.
    expect(where).toContain('referrer-1');

    expect(res.body.referrals[0].referred).toEqual({
      id: 'friend-1',
      firstName: 'Mia',
      lastName: 'Nguyen',
      avatar: 'https://cdn.example/friend-1.jpg',
    });
    expect(res.body.referrals[1].referred).toEqual({ id: null, firstName: 'A member you referred', lastName: '', avatar: null });
    expect(JSON.stringify(res.body)).not.toContain('Leah');
    expect(JSON.stringify(res.body)).not.toContain('hidden-1');
    // Still the referrer's record: it counts and its status still shows.
    expect(res.body.stats.completedReferrals).toBe(2);
    expect(res.body.referrals[1].status).toBe('COMPLETED');
  });

  it('withholds a member the referrer has blocked', async () => {
    prisma.userSafetySettings.findUnique.mockResolvedValue({ blockedUsers: ['friend-1'] });
    prisma.user.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/referrals/me').set({ 'x-test-user': 'referrer-1' }).expect(200);

    const where = JSON.stringify(prisma.user.findMany.mock.calls[0][0].where);
    expect(where).toContain('notIn');
    expect(res.body.referrals.every((r: any) => r.referred.id === null)).toBe(true);
  });

  it('fails rather than show names when the block list cannot be read', async () => {
    prisma.userSafetySettings.findUnique.mockRejectedValue(new Error('database unavailable'));

    const res = await request(app).get('/api/referrals/me').set({ 'x-test-user': 'referrer-1' });

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(JSON.stringify(res.body)).not.toContain('Nguyen');
  });

  it('makes no safety lookup for a member who has referred nobody', async () => {
    prisma.user.findUnique.mockResolvedValue({ referralCode: 'ABCD1234', referralCredits: 100, referralsMade: [] });

    const res = await request(app).get('/api/referrals/me').expect(200);

    expect(res.body.referrals).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('An admin completing a referral', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.referral.findUnique.mockResolvedValue({
      id: 'r1', referrerId: 'referrer-1', referredId: 'referred-1', status: 'PENDING', referred: { firstName: 'Mia' },
    });
    tx.referral.updateMany.mockResolvedValue({ count: 1 });
    tx.user.update.mockResolvedValue({});
    tx.notification.create.mockResolvedValue({});
  });

  it('pays the referrer and does not pay the referred member a second time', async () => {
    await request(app).post('/api/referrals/r1/complete').set({ 'x-test-role': 'ADMIN' }).expect(200);

    const paid = tx.user.update.mock.calls.map((call: any[]) => call[0].where.id);
    // She was credited when she registered with the code.
    expect(paid).toEqual(['referrer-1']);
  });
});
