/**
 * The one rule for whether a membership buys paid features today.
 *
 * Three gates used to admit only ACTIVE and TRIALING each for themselves, so a
 * card that was declined on the renewal date took the paid tools away that
 * minute while the email said Stripe would try again for days. These are the
 * cases that decide it: a paid-up membership and a trial are in, a failed
 * renewal is in for a grace and then out, and nothing else is.
 */

import { describe, it, expect } from '@jest/globals';
import { PAST_DUE_GRACE_DAYS } from '../../config/price-book';
import {
  BILLING_STATUSES,
  hasLiveEntitlement,
  isSubscriptionLive,
  pastDueGraceEndsAt,
} from '../subscription-entitlement';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-10T00:00:00.000Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);

describe('hasLiveEntitlement', () => {
  it('admits a paid tier that is paid up or in its trial', () => {
    expect(hasLiveEntitlement({ tier: 'PREMIUM_CAREER', status: 'ACTIVE' }, now)).toBe(true);
    expect(hasLiveEntitlement({ tier: 'PREMIUM_CAREER', status: 'TRIALING' }, now)).toBe(true);
  });

  it('is never true for the free tier, whatever the status says', () => {
    expect(hasLiveEntitlement({ tier: 'FREE', status: 'ACTIVE' }, now)).toBe(false);
    expect(hasLiveEntitlement(null, now)).toBe(false);
    expect(hasLiveEntitlement(undefined, now)).toBe(false);
  });

  it('refuses a cancelled membership, even one that still names a paid tier', () => {
    expect(hasLiveEntitlement({ tier: 'PREMIUM_CAREER', status: 'CANCELED', currentPeriodStart: daysAgo(1) }, now)).toBe(false);
  });

  describe('a renewal whose payment failed', () => {
    it('keeps the paid tools inside the grace, counted from the day the failed period began', () => {
      const subscription = { tier: 'PREMIUM_CAREER', status: 'PAST_DUE', currentPeriodStart: daysAgo(PAST_DUE_GRACE_DAYS - 1) };
      expect(hasLiveEntitlement(subscription, now)).toBe(true);
    });

    it('pauses them once the grace is over', () => {
      const subscription = { tier: 'PREMIUM_CAREER', status: 'PAST_DUE', currentPeriodStart: daysAgo(PAST_DUE_GRACE_DAYS + 1) };
      expect(hasLiveEntitlement(subscription, now)).toBe(false);
    });

    it('ends the grace at the instant, not a day later', () => {
      const exactly = { tier: 'PREMIUM_CAREER', status: 'PAST_DUE', currentPeriodStart: daysAgo(PAST_DUE_GRACE_DAYS) };
      expect(hasLiveEntitlement(exactly, now)).toBe(false);
      expect(hasLiveEntitlement(exactly, new Date(now.getTime() - 1))).toBe(true);
    });

    it('gives no grace to a row that has no period to count from, rather than inventing one', () => {
      expect(hasLiveEntitlement({ tier: 'PREMIUM_CAREER', status: 'PAST_DUE', currentPeriodStart: null }, now)).toBe(false);
      expect(hasLiveEntitlement({ tier: 'PREMIUM_CAREER', status: 'PAST_DUE' }, now)).toBe(false);
      expect(hasLiveEntitlement({ tier: 'PREMIUM_CAREER', status: 'PAST_DUE', currentPeriodStart: 'not a date' }, now)).toBe(false);
    });

    it('reads a period start that came over the wire as text', () => {
      const subscription = { tier: 'PREMIUM_CAREER', status: 'PAST_DUE', currentPeriodStart: daysAgo(2).toISOString() };
      expect(hasLiveEntitlement(subscription, now)).toBe(true);
    });
  });
});

describe('isSubscriptionLive', () => {
  it('says nothing about the tier, so a gate that asks only about the status can use it', () => {
    expect(isSubscriptionLive({ status: 'ACTIVE' }, now)).toBe(true);
    expect(isSubscriptionLive({ status: 'CANCELED' }, now)).toBe(false);
  });
});

describe('pastDueGraceEndsAt', () => {
  it('is the day the failed period began plus the grace', () => {
    const began = daysAgo(3);
    const ends = pastDueGraceEndsAt({ status: 'PAST_DUE', currentPeriodStart: began });
    expect(ends?.getTime()).toBe(began.getTime() + PAST_DUE_GRACE_DAYS * DAY);
  });

  it('is null for a membership that is not past due', () => {
    expect(pastDueGraceEndsAt({ status: 'ACTIVE', currentPeriodStart: daysAgo(3) })).toBeNull();
    expect(pastDueGraceEndsAt(null)).toBeNull();
  });
});

describe('BILLING_STATUSES', () => {
  it('names the statuses Stripe is still billing, past due included, and no ended one', () => {
    expect([...BILLING_STATUSES]).toEqual(['ACTIVE', 'TRIALING', 'PAST_DUE']);
  });
});
