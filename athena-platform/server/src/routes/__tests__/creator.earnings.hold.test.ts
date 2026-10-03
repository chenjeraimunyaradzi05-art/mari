/**
 * What a creator's earnings screen is told while ATHENA is looking into a card
 * payment connected to the gifts a creator was sent (see payment-disputes.service).
 *
 * The balance is the creator's and keeps growing; what stops is the withdrawal, and
 * requestPayout refuses it. The screen is told so that it does not offer a button
 * that can only fail, and is not told why: the reason names a dispute by its Stripe
 * id and is a note for ATHENA's team.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    creatorProfile: { findUnique: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'creator-1', role: 'USER', email: 'creator@athena.com' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

// 500,000 points is well past the minimum payout whatever a point is worth.
const profile = (over: Record<string, unknown> = {}) => ({
  id: 'cp-1',
  userId: 'creator-1',
  totalEarnings: 500_000,
  pendingPayout: 500_000,
  payoutHold: false,
  payoutHoldReason: null,
  payouts: [],
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/creator/earnings', () => {
  it('offers a withdrawal when the balance is past the minimum and nothing is paused', async () => {
    prisma.creatorProfile.findUnique.mockResolvedValue(profile());

    const res = await request(app).get('/api/creator/earnings').expect(200);

    expect(res.body.data).toMatchObject({ canRequestPayout: true, payoutHold: false });
  });

  it('says the withdrawal is paused, and does not offer one, while ATHENA looks into a payment connected to the gifts', async () => {
    prisma.creatorProfile.findUnique.mockResolvedValue(
      profile({ payoutHold: true, payoutHoldReason: 'A card dispute on a gift balance purchase (dp_1)' })
    );

    const res = await request(app).get('/api/creator/earnings').expect(200);

    expect(res.body.data).toMatchObject({ canRequestPayout: false, payoutHold: true });
    // The balance is untouched: it is shown, and it is the creator's.
    expect(res.body.data.pendingPayout).toBeGreaterThan(0);
    // And the staff note is not sent to the creator.
    expect(JSON.stringify(res.body)).not.toContain('dp_1');
  });
});
