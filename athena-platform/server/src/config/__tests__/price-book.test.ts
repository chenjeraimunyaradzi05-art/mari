import { describe, it, expect, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The price book is the one place a figure about what ATHENA charges, keeps or
 * promises is written down. These tests hold three things:
 *
 *  1. the arithmetic (a gift point is a cent, and a cent is never lost to
 *     floating point),
 *  2. that the code which moves money reads the book, and that nothing else
 *     quietly carries a number of its own, and
 *  3. that the copy the web app prints (client/src/lib/pricing.ts, the Terms and
 *     the mentor agreement) equals the book, because the web app cannot import
 *     from this package and a copy that drifts is how the pricing page came to
 *     promise a refund the Terms did not offer.
 */

jest.mock('../../utils/prisma', () => ({ prisma: {} }));
jest.mock('../../utils/stripe', () => ({
  getStripe: () => ({}),
  isStripeConfigured: () => false,
  STRIPE_API_VERSION: '2023-10-16',
}));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../services/socket.service', () => ({ sendNotification: jest.fn() }));
jest.mock('../../services/stripe-connect.service', () => ({
  resolveConnectedAccountId: jest.fn(),
  createConnectedAccount: jest.fn(),
  refreshConnectedAccount: jest.fn(),
}));

import {
  CREATOR_REVENUE_SHARE_PERCENT,
  CREATOR_SHARE_RANGE_PERCENT,
  ESCROW_DEFAULT_FEE_PERCENT,
  FORMATION_FEES_CENTS,
  GIFT_POINT_CENTS,
  GIFT_POINT_VALUE_AUD,
  MENTOR_PLATFORM_FEE_RATE,
  MINIMUM_PAYOUT_AUD,
  PRICE_CURRENCY,
  REFUND_DAYS,
  TRIAL_DAYS,
  centsForGiftPoints,
  giftPointsForCents,
  gstPositionFor,
  publicPriceBook,
} from '../price-book';
import { CREATOR_TIERS } from '../../services/creator.service';

const serverSrc = path.resolve(__dirname, '..', '..');
const clientSrc = path.resolve(serverSrc, '..', '..', 'client', 'src');

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      found.push(...sourceFiles(full));
    } else if (/\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/** The value of `export const NAME = <number>;` in a source file. */
function exportedNumber(source: string, name: string): number {
  const match = new RegExp(`export const ${name} = ([0-9.]+);`).exec(source);
  if (!match) throw new Error(`${name} is not exported as a plain number`);
  return Number(match[1]);
}

describe('gift points', () => {
  it('are a cent each, bought and paid out in Australian dollars', () => {
    expect(PRICE_CURRENCY).toBe('AUD');
    expect(GIFT_POINT_CENTS).toBe(1);
    expect(GIFT_POINT_VALUE_AUD).toBe(0.01);
  });

  it('turn cents into points without losing one to floating point', () => {
    // 0.29 / 0.01 is 28.999999999999996, so a purchase worked out in dollars
    // credited a point too few.
    expect(giftPointsForCents(29)).toBe(29);
    expect(giftPointsForCents(555)).toBe(555);
    expect(giftPointsForCents(100_000)).toBe(100_000);
    expect(giftPointsForCents(0)).toBe(0);
  });

  it('turn points back into the same cents, so what is paid out is what was bought', () => {
    for (const cents of [1, 29, 555, 5_000, 123_456]) {
      expect(centsForGiftPoints(giftPointsForCents(cents))).toBe(cents);
    }
  });
});

describe('what a creator keeps', () => {
  it('is quoted as a range that matches the tiers, lowest to highest', () => {
    expect(CREATOR_SHARE_RANGE_PERCENT.min).toBe(Math.min(...Object.values(CREATOR_REVENUE_SHARE_PERCENT)));
    expect(CREATOR_SHARE_RANGE_PERCENT.max).toBe(Math.max(...Object.values(CREATOR_REVENUE_SHARE_PERCENT)));
    expect(CREATOR_SHARE_RANGE_PERCENT.min).toBeLessThan(CREATOR_SHARE_RANGE_PERCENT.max);
  });

  it('is what the code pays: every tier in creator.service reads the book', () => {
    const byName = Object.fromEntries(CREATOR_TIERS.map((tier) => [tier.name, tier.revShare]));
    expect(byName).toEqual({ ...CREATOR_REVENUE_SHARE_PERCENT });
  });
});

describe('GST', () => {
  it('says no GST is added while ATHENA is not registered', () => {
    const position = gstPositionFor(false);
    expect(position.registered).toBe(false);
    expect(position.statement).toMatch(/AUD/);
    expect(position.statement).toMatch(/not registered for GST/);
  });

  it('says prices include GST once registered, and never both', () => {
    const position = gstPositionFor(true);
    expect(position.registered).toBe(true);
    expect(position.statement).toMatch(/include GST/);
    expect(position.statement).not.toMatch(/not registered/);
  });
});

describe('the public book', () => {
  it('serves the book as one object, whole', () => {
    expect(publicPriceBook(false)).toEqual({
      currency: 'AUD',
      trialDays: TRIAL_DAYS,
      refundDays: REFUND_DAYS,
      gst: gstPositionFor(false),
      fees: {
        mentoringPlatformPercent: Math.round(MENTOR_PLATFORM_FEE_RATE * 100),
        marketplacePlatformPercent: ESCROW_DEFAULT_FEE_PERCENT,
        creatorSharePercent: { ...CREATOR_REVENUE_SHARE_PERCENT },
        giftPointValueAud: GIFT_POINT_VALUE_AUD,
        minimumPayoutAud: MINIMUM_PAYOUT_AUD,
      },
    });
  });

  it('is plain data: it can be sent to a browser as it is', () => {
    const roundTrip = JSON.parse(JSON.stringify(publicPriceBook(true)));
    expect(roundTrip).toEqual(publicPriceBook(true));
  });

  it('holds sane figures, so a typo is caught before it is charged', () => {
    expect(TRIAL_DAYS).toBeGreaterThan(0);
    expect(TRIAL_DAYS).toBeLessThanOrEqual(90);
    expect(REFUND_DAYS).toBeGreaterThanOrEqual(0);
    expect(MENTOR_PLATFORM_FEE_RATE).toBeGreaterThan(0);
    expect(MENTOR_PLATFORM_FEE_RATE).toBeLessThan(0.5);
    expect(ESCROW_DEFAULT_FEE_PERCENT).toBeGreaterThan(0);
    expect(ESCROW_DEFAULT_FEE_PERCENT).toBeLessThan(50);
    expect(MINIMUM_PAYOUT_AUD).toBeGreaterThan(0);
    for (const cents of Object.values(FORMATION_FEES_CENTS)) {
      expect(Number.isInteger(cents)).toBe(true);
      expect(cents).toBeGreaterThan(0);
    }
  });
});

describe('nothing else carries a number of its own', () => {
  // The names these figures lived under, each of which was a private copy that
  // had to be kept equal by a comment.
  const COPIES = [
    /\bconst\s+TRIAL_DAYS\s*=\s*[0-9]/,
    /\bconst\s+REFUND_DAYS\s*=\s*[0-9]/,
    /\bconst\s+MENTOR_PLATFORM_FEE_RATE\s*=\s*[0-9]/,
    /\bconst\s+PLATFORM_FEE_PERCENT\s*=\s*[0-9]/,
    /\bconst\s+GIFT_POINT_VALUE\s*=\s*[0-9]/,
    /\bconst\s+AUD_PER_GIFT_POINT\s*=\s*[0-9]/,
    /\bconst\s+POINT_VALUE_AUD\s*=\s*[0-9]/,
    /\bconst\s+MINIMUM_PAYOUT(?:_POINTS)?\s*=\s*[0-9]/,
    /\bconst\s+FORMATION_FEES\b[^=]*=\s*\{/,
  ];

  it('is defined outside the price book only by importing it', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(serverSrc)) {
      if (file.endsWith(path.join('config', 'price-book.ts'))) continue;
      const source = read(file);
      for (const pattern of COPIES) {
        if (pattern.test(source)) offenders.push(`${path.relative(serverSrc, file)} matches ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('prices a gift point from the book wherever points become dollars', () => {
    const stray: string[] = [];
    for (const file of sourceFiles(serverSrc)) {
      if (file.endsWith(path.join('config', 'price-book.ts'))) continue;
      const source = read(file);
      // Points are multiplied by the book's value; a bare 0.01 beside a points
      // figure is a private copy of it.
      if (/(giftValue|totalEarnings|pendingPayout|giftBalance|creatorShare|platformShare)[^\n;]*\*\s*0\.01\b/.test(source)) {
        stray.push(path.relative(serverSrc, file));
      }
    }
    expect(stray).toEqual([]);
  });
});

describe('the copy the web app prints', () => {
  const pricingCopy = read(path.join(clientSrc, 'lib', 'pricing.ts'));

  it('holds the same trial, refund window, fee and payout minimum as the book', () => {
    expect(exportedNumber(pricingCopy, 'TRIAL_DAYS')).toBe(TRIAL_DAYS);
    expect(exportedNumber(pricingCopy, 'REFUND_DAYS')).toBe(REFUND_DAYS);
    expect(exportedNumber(pricingCopy, 'MENTOR_PLATFORM_FEE_PERCENT')).toBe(Math.round(MENTOR_PLATFORM_FEE_RATE * 100));
    expect(exportedNumber(pricingCopy, 'GIFT_POINT_VALUE_AUD')).toBe(GIFT_POINT_VALUE_AUD);
    expect(exportedNumber(pricingCopy, 'MINIMUM_PAYOUT_AUD')).toBe(MINIMUM_PAYOUT_AUD);
  });

  it('holds the same creator share for every tier', () => {
    const block = /export const CREATOR_SHARE_PERCENT = \{([^}]*)\}/.exec(pricingCopy);
    expect(block).not.toBeNull();
    const shares: Record<string, number> = {};
    for (const [, name, value] of block![1].matchAll(/(\w+):\s*([0-9]+)/g)) shares[name] = Number(value);
    expect(shares).toEqual({ ...CREATOR_REVENUE_SHARE_PERCENT });
  });

  it('is what the Terms and the mentor agreement print: they read the copy, not a number of their own', () => {
    const agreement = read(path.join(clientSrc, 'app', 'mentor-agreement', 'page.tsx'));
    expect(agreement).toMatch(/MENTOR_PLATFORM_FEE_PERCENT/);
    // No bare "20%" left to drift from the book.
    expect(agreement).not.toMatch(/\b20%/);

    const terms = read(path.join(clientSrc, 'content', 'legal', 'terms.md'));
    expect(terms).toMatch(/\{\{\s*price\.refundDays\s*\}\}/);
    expect(terms).toMatch(/\{\{\s*price\.trialDays\s*\}\}/);
    expect(terms).toMatch(/\{\{\s*price\.creatorShareRange\s*\}\}/);
    // No hard-coded 70-80% or 20-30% left in section 5.2.
    expect(terms).not.toMatch(/70-80%/);
    expect(terms).not.toMatch(/20-30%/);
  });
});
