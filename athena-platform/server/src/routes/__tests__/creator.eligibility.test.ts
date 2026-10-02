import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * Terms 5.1 makes being an adult and accepting the Creator Terms Addendum
 * conditions of being paid as a creator. These hold that the server, not the
 * screen, enforces them at each door money passes through: turning on creator
 * mode, Stripe onboarding, sending a gift and asking for a payout. A refusal
 * creates nothing, moves nothing, and says where to go.
 */

const prismaMock: any = {
  user: { findUnique: jest.fn() },
  creatorProfile: { findUnique: jest.fn() },
};

jest.mock('../../utils/prisma', () => ({ prisma: prismaMock }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'her', role: 'USER', email: 'her@ourdomain.org' };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../../middleware/moneyLimits', () => ({
  giftCeiling: (_req: any, _res: any, next: any) => next(),
  payoutCeiling: (_req: any, _res: any, next: any) => next(),
  startingAPayment: () => (_req: any, _res: any, next: any) => next(),
}));

const enableCreatorMode = jest.fn(async (..._args: unknown[]) => ({ id: 'cp-1', userId: 'her' }));
const requestPayout = jest.fn(async (..._args: unknown[]) => ({ id: 'payout-1', amount: 50 }));
const generateStripeOnboardingLink = jest.fn(async (..._args: unknown[]) => 'https://connect.stripe.com/setup/s/x');
const sendGift = jest.fn(async (..._args: unknown[]) => ({ transaction: { id: 'gt-1' }, gift: { name: 'Star' }, creatorShare: 4, tier: {} }));
jest.mock('../../services/creator.service', () => ({
  enableCreatorMode: (...args: unknown[]) => enableCreatorMode(...args),
  requestPayout: (...args: unknown[]) => requestPayout(...args),
  generateStripeOnboardingLink: (...args: unknown[]) => generateStripeOnboardingLink(...args),
  sendGift: (...args: unknown[]) => sendGift(...args),
  GIFT_TYPES: {},
  CREATOR_TIERS: [],
}));
jest.mock('../../services/socket.service', () => ({ sendNotification: jest.fn(async () => undefined) }));

import creatorRoutes from '../creator.routes';
import { errorHandler } from '../../middleware/errorHandler';
import { CREATOR_TERMS_PATH, CREATOR_TERMS_VERSION } from '../../config/creator-terms';
import { WOMAN_VERIFIED_REQUIRED_ENV } from '../../config/woman-gate-policy';

const ADULT = new Date('1990-05-12');
const seventeen = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 17);
  return d;
};

const RECEIVER = '7b1f3d0e-6c2a-4f8e-9a1b-2c3d4e5f6a7b';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/creator', creatorRoutes);
  a.use(errorHandler);
  return a;
}

function dateOfBirth(value: Date | null) {
  prismaMock.user.findUnique.mockResolvedValue({ dateOfBirth: value, womanVerificationStatus: 'UNVERIFIED' });
}

function acceptedVersion(version: string | null) {
  prismaMock.creatorProfile.findUnique.mockResolvedValue({ creatorTermsVersion: version });
}

const accepted = { acceptCreatorTerms: true, termsVersion: CREATOR_TERMS_VERSION };

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env[WOMAN_VERIFIED_REQUIRED_ENV];
  dateOfBirth(ADULT);
  acceptedVersion(CREATOR_TERMS_VERSION);
});

describe('POST /api/creator/enable', () => {
  it('refuses to turn on creator mode without the addendum accepted, and creates nothing', async () => {
    const silent = await request(app()).post('/api/creator/enable').send({}).expect(400);
    expect(silent.body.message ?? silent.body.error).toMatch(/Creator Terms Addendum/);

    await request(app()).post('/api/creator/enable').send({ acceptCreatorTerms: false, termsVersion: CREATOR_TERMS_VERSION }).expect(400);
    expect(enableCreatorMode).not.toHaveBeenCalled();
  });

  it('refuses an acceptance of a version that is not the current text', async () => {
    const res = await request(app()).post('/api/creator/enable').send({ acceptCreatorTerms: true, termsVersion: '2020-01-01' }).expect(400);
    expect(res.body.message ?? res.body.error).toMatch(/has changed/);
    expect(enableCreatorMode).not.toHaveBeenCalled();
  });

  it('refuses an account with no date of birth before anything is created at Stripe', async () => {
    dateOfBirth(null);

    const res = await request(app()).post('/api/creator/enable').send(accepted).expect(403);
    expect(res.body.code).toBe('DATE_OF_BIRTH_REQUIRED');
    expect(enableCreatorMode).not.toHaveBeenCalled();
  });

  it('refuses an account whose date of birth is not an adult’s', async () => {
    dateOfBirth(seventeen());

    const res = await request(app()).post('/api/creator/enable').send(accepted).expect(403);
    expect(res.body.code).toBe('MINIMUM_AGE_NOT_MET');
    expect(enableCreatorMode).not.toHaveBeenCalled();
  });

  it('turns creator mode on for an adult who accepted the current version, recording that version with the profile', async () => {
    await request(app()).post('/api/creator/enable').send(accepted).expect(201);
    expect(enableCreatorMode).toHaveBeenCalledWith('her', undefined, CREATOR_TERMS_VERSION);
  });
});

describe('POST /api/creator/payouts/request', () => {
  it('sends a creator who accepted an earlier version to the addendum before she is paid, and pays nothing', async () => {
    acceptedVersion('2025-01-01');

    const res = await request(app()).post('/api/creator/payouts/request').expect(403);
    expect(res.body).toMatchObject({ code: 'CREATOR_TERMS_REQUIRED', version: CREATOR_TERMS_VERSION, setup: CREATOR_TERMS_PATH });
    expect(requestPayout).not.toHaveBeenCalled();
  });

  it('does the same for a creator from before the addendum existed, who never recorded one', async () => {
    acceptedVersion(null);

    const res = await request(app()).post('/api/creator/payouts/request').expect(403);
    expect(res.body.code).toBe('CREATOR_TERMS_REQUIRED');
    expect(requestPayout).not.toHaveBeenCalled();
  });

  it('refuses an account with no date of birth before it asks about the addendum', async () => {
    dateOfBirth(null);
    acceptedVersion(null);

    const res = await request(app()).post('/api/creator/payouts/request').expect(403);
    expect(res.body.code).toBe('DATE_OF_BIRTH_REQUIRED');
    expect(prismaMock.creatorProfile.findUnique).not.toHaveBeenCalled();
  });

  it('pays out an adult creator on the current version', async () => {
    await request(app()).post('/api/creator/payouts/request').expect(200);
    expect(requestPayout).toHaveBeenCalledWith('her');
  });
});

describe('POST /api/creator/onboard', () => {
  it('does not start Stripe onboarding for a creator who has not accepted the current addendum', async () => {
    acceptedVersion('2025-01-01');

    const res = await request(app()).post('/api/creator/onboard').expect(403);
    expect(res.body.code).toBe('CREATOR_TERMS_REQUIRED');
    expect(generateStripeOnboardingLink).not.toHaveBeenCalled();
  });

  it('starts it for one who has', async () => {
    const res = await request(app()).post('/api/creator/onboard').expect(200);
    expect(res.body.url).toMatch(/^https:\/\/connect\.stripe\.com\//);
  });
});

describe('POST /api/creator/gifts/send', () => {
  it('is asked of an adult account like every other way money moves', async () => {
    dateOfBirth(null);

    const res = await request(app()).post('/api/creator/gifts/send').send({ receiverId: RECEIVER, giftType: 'star' }).expect(403);
    expect(res.body.code).toBe('DATE_OF_BIRTH_REQUIRED');
    expect(sendGift).not.toHaveBeenCalled();
  });

  it('sends a gift from an adult account', async () => {
    await request(app()).post('/api/creator/gifts/send').send({ receiverId: RECEIVER, giftType: 'star' }).expect(200);
    expect(sendGift).toHaveBeenCalledWith('her', RECEIVER, 'star', undefined);
  });
});
