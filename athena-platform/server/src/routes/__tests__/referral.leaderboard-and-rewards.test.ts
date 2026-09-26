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
      referral: { findUnique: jest.fn() },
      user: { findMany: jest.fn() },
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
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', displayName: null, firstName: 'Priya', lastName: 'Raman', avatar: null, referralCredits: 300, _count: { referralsMade: 3 } },
      { id: 'u2', displayName: 'Jo from Logan', firstName: 'Joanne', lastName: 'Smith', avatar: null, referralCredits: 100, _count: { referralsMade: 1 } },
    ]);
  });

  it('is not open to anyone who is not signed in', async () => {
    await request(app).get('/api/referrals/leaderboard').set({ 'x-test-anon': '1' }).expect(401);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('leaves out members who asked to be hidden from search', async () => {
    await request(app).get('/api/referrals/leaderboard').expect(200);

    const where = JSON.stringify(prisma.user.findMany.mock.calls[0][0].where);
    expect(where).toContain('hideFromSearch');
  });

  it('never publishes a full legal name', async () => {
    const res = await request(app).get('/api/referrals/leaderboard').expect(200);

    expect(res.body.map((row: any) => row.name)).toEqual(['Priya R.', 'Jo from Logan']);
    expect(JSON.stringify(res.body)).not.toContain('Raman');
    expect(JSON.stringify(res.body)).not.toContain('Smith');
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
