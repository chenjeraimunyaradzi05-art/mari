/**
 * The monthly creator payout sweep, which is off unless ATHENA turns it on.
 *
 * What these protect is the money moving by itself: it must not happen unless
 * the switch is on and it is the first of the month in Queensland, it must pay
 * through the same checks as a creator pressing the button (an account that is
 * closed, locked, under age, or has not accepted the Creator Terms Addendum is
 * not paid because it did not ask), and it must pay a creator once a month, no
 * matter how many instances run it or how many times the process restarts that
 * day. The claim-then-transfer safety of the payout itself is requestPayout's,
 * and is tested with it.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/redis', () => ({ runExclusively: jest.fn(async (_key: string, fn: () => Promise<unknown>) => fn()) }));

// The admin's payments pause (services/feature-flags.service), which these tests
// turn on and off. Off unless a test says otherwise.
let paymentsPaused = false;
jest.mock('../feature-flags.service', () => ({
  getPaymentsPause: jest.fn(async () => ({ paused: paymentsPaused, message: 'Payments are paused.' })),
  // The same test the real one makes: an error raised with the PAYMENTS_PAUSED code.
  isPaymentsPausedError: (error: unknown) => (error as { details?: { code?: string } } | null)?.details?.code === 'PAYMENTS_PAUSED',
}));

const requestPayout = jest.fn<(userId: string) => Promise<{ payoutId: string; amount: number }>>();
jest.mock('../creator.service', () => ({ requestPayout: (userId: string) => requestPayout(userId) }));

const creatorTermsRefusal = jest.fn<(userId: string) => Promise<unknown>>(async () => null);
jest.mock('../../middleware/account-gates', () => {
  const actual: any = jest.requireActual('../../middleware/account-gates');
  return { ...actual, creatorTermsRefusal: (userId: string) => creatorTermsRefusal(userId) };
});

const womanVerifiedRefusal = jest.fn<(userId: string, surface: string) => Promise<unknown>>(async () => null);
jest.mock('../../middleware/woman-gate-surfaces', () => ({
  womanVerifiedRefusal: (userId: string, surface: string) => womanVerifiedRefusal(userId, surface),
}));

type Profile = { id: string; userId: string; pendingPayout: number; payoutHold: boolean; user: Record<string, unknown> | null };
const profiles: Profile[] = [];
const payouts: Array<{ creatorProfileId: string; createdAt: Date; status: string }> = [];

const goodUser = (over: Record<string, unknown> = {}) => ({
  isSuspended: false,
  bannedAt: null,
  lockedAt: null,
  emailVerified: true,
  dateOfBirth: new Date('1990-05-05T00:00:00Z'),
  womanVerificationStatus: null,
  ...over,
});

const prismaMock: any = {
  creatorProfile: {
    findMany: jest.fn(async ({ where, take }: any) => {
      const after = where?.id?.gt ?? '';
      return profiles
        .filter((p) => p.pendingPayout >= where.pendingPayout.gte && p.payoutHold === where.payoutHold && p.id > after)
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .slice(0, take);
    }),
  },
  creatorPayout: {
    findFirst: jest.fn(async ({ where }: any) => {
      const found = payouts.find(
        (p) =>
          p.creatorProfileId === where.creatorProfileId &&
          p.createdAt >= where.createdAt.gte &&
          (where.status?.not ? p.status !== where.status.not : true)
      );
      return found ? { id: 'payout-found' } : null;
    }),
  },
  notification: { create: jest.fn(async () => ({})) },
};
jest.mock('../../utils/prisma', () => ({ prisma: prismaMock }));

import { ApiError } from '../../middleware/errorHandler';
import { MINIMUM_PAYOUT_AUD } from '../../config/price-book';
import { opsSnapshot, resetOpsMetrics } from '../../utils/ops-metrics';
import {
  AUTO_PAYOUTS_ENV,
  autoPayoutsEnabled,
  isAutoPayoutDay,
  runCreatorPayoutSweep,
  startOfBrisbaneMonth,
} from '../creator-payout-sweeper.service';

// 10:00 on the 1st of November in Brisbane, which is midnight UTC.
const firstOfMonth = new Date('2026-11-01T00:00:00.000Z');

function creator(n: number, over: Partial<Profile> = {}): Profile {
  const id = `profile-${String(n).padStart(4, '0')}`;
  const profile: Profile = { id, userId: `user-${n}`, pendingPayout: 6_000, payoutHold: false, user: goodUser(), ...over };
  profiles.push(profile);
  return profile;
}

/** The instant the sweep under test is running at, which is when a payout it makes is recorded. */
let now = firstOfMonth;

/** What requestPayout does to the table the sweep reads, so a second sweep sees the first. */
function payingForReal() {
  requestPayout.mockImplementation(async (userId) => {
    const profile = profiles.find((p) => p.userId === userId)!;
    payouts.push({ creatorProfileId: profile.id, createdAt: new Date(now), status: 'PENDING' });
    const amount = profile.pendingPayout / 100;
    profile.pendingPayout = 0;
    return { payoutId: `po-${userId}`, amount };
  });
}

describe('the monthly creator payout sweep', () => {
  const previous = process.env[AUTO_PAYOUTS_ENV];

  beforeEach(() => {
    jest.clearAllMocks();
    resetOpsMetrics();
    profiles.length = 0;
    payouts.length = 0;
    now = firstOfMonth;
    paymentsPaused = false;
    process.env[AUTO_PAYOUTS_ENV] = 'monthly';
    requestPayout.mockReset();
    creatorTermsRefusal.mockResolvedValue(null);
    womanVerifiedRefusal.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({});
    payingForReal();
  });

  afterEach(() => {
    if (previous === undefined) delete process.env[AUTO_PAYOUTS_ENV];
    else process.env[AUTO_PAYOUTS_ENV] = previous;
  });

  describe('whether it runs at all', () => {
    it('is off unless the switch says monthly, so no money moves by itself on a deployment that never decided', async () => {
      creator(1);
      for (const value of [undefined, '', 'off', 'true', 'weekly', 'MONTHLY ']) {
        if (value === undefined) delete process.env[AUTO_PAYOUTS_ENV];
        else process.env[AUTO_PAYOUTS_ENV] = value;
        const on = value?.trim().toLowerCase() === 'monthly';
        expect(autoPayoutsEnabled()).toBe(on);
        if (!on) expect(await runCreatorPayoutSweep(firstOfMonth)).toBeNull();
      }
      expect(requestPayout).not.toHaveBeenCalled();
    });

    it('is not a run while payments are paused: nobody is asked for, nobody is counted as a failure, and it pays once they reopen', async () => {
      creator(1);
      paymentsPaused = true;

      expect(await runCreatorPayoutSweep(firstOfMonth)).toBeNull();

      expect(requestPayout).not.toHaveBeenCalled();
      expect(prismaMock.creatorProfile.findMany).not.toHaveBeenCalled();
      expect(opsSnapshot().totals.failure).toBe(0);

      paymentsPaused = false;
      expect(await runCreatorPayoutSweep(firstOfMonth)).toEqual({ considered: 1, paid: 1, skipped: 0, failed: 0 });
    });

    it('stops, without counting a failure, when a pause begins part-way through the run', async () => {
      creator(1);
      creator(2);
      creator(3);
      requestPayout.mockReset();
      payingForReal();
      const paying = requestPayout.getMockImplementation()!;
      // The first creator is paid; the pause is switched on before the second.
      requestPayout.mockImplementation(async (userId) => {
        if (userId === 'user-2') {
          paymentsPaused = true;
          throw new ApiError(503, 'Payments are paused.', { code: 'PAYMENTS_PAUSED' });
        }
        return paying(userId);
      });

      const outcome = await runCreatorPayoutSweep(firstOfMonth);

      // The run ends there: the third is not asked for, and nobody is counted or alarmed as a failure.
      expect(outcome).toEqual({ considered: 2, paid: 1, skipped: 0, failed: 0 });
      expect(requestPayout.mock.calls.map((c) => c[0])).toEqual(['user-1', 'user-2']);
      expect(opsSnapshot().totals.failure).toBe(0);

      // Once payments reopen the next run of the day pays the two who were not paid.
      paymentsPaused = false;
      requestPayout.mockImplementation(paying);
      expect(await runCreatorPayoutSweep(firstOfMonth)).toEqual({ considered: 2, paid: 2, skipped: 0, failed: 0 });
    });

    it('does nothing on any day but the 1st, Brisbane time', async () => {
      creator(1);

      expect(await runCreatorPayoutSweep(new Date('2026-11-02T00:00:00.000Z'))).toBeNull();
      expect(await runCreatorPayoutSweep(new Date('2026-11-15T03:00:00.000Z'))).toBeNull();

      expect(requestPayout).not.toHaveBeenCalled();
      expect(prismaMock.creatorProfile.findMany).not.toHaveBeenCalled();
    });

    it('takes the 1st from Queensland, which is ten hours ahead of UTC and has no daylight saving', () => {
      // Midnight on the 1st in Brisbane is 14:00 UTC the day before.
      expect(isAutoPayoutDay(new Date('2026-10-31T13:59:59.000Z'))).toBe(false);
      expect(isAutoPayoutDay(new Date('2026-10-31T14:00:00.000Z'))).toBe(true);
      // And it is still the 1st at 23:59 there, which is 13:59 UTC the same day.
      expect(isAutoPayoutDay(new Date('2026-11-01T13:59:59.000Z'))).toBe(true);
      expect(isAutoPayoutDay(new Date('2026-11-01T14:00:00.000Z'))).toBe(false);
      // The summer months are no different.
      expect(isAutoPayoutDay(new Date('2027-01-01T05:00:00.000Z'))).toBe(true);
    });

    it('counts a month from its first instant in Brisbane', () => {
      expect(startOfBrisbaneMonth(new Date('2026-11-20T08:00:00.000Z')).toISOString()).toBe('2026-10-31T14:00:00.000Z');
      expect(startOfBrisbaneMonth(new Date('2026-10-31T14:00:00.000Z')).toISOString()).toBe('2026-10-31T14:00:00.000Z');
      expect(startOfBrisbaneMonth(new Date('2026-10-31T13:59:59.000Z')).toISOString()).toBe('2026-09-30T14:00:00.000Z');
    });
  });

  describe('who it pays', () => {
    it('pays each creator at or above the minimum once, and asks only for those whose withdrawals are not on hold', async () => {
      creator(1);
      creator(2);
      creator(3, { pendingPayout: MINIMUM_PAYOUT_AUD * 100 - 1 });
      creator(4, { payoutHold: true });

      const outcome = await runCreatorPayoutSweep(firstOfMonth);

      expect(outcome).toEqual({ considered: 2, paid: 2, skipped: 0, failed: 0 });
      expect(requestPayout.mock.calls.map((c) => c[0])).toEqual(['user-1', 'user-2']);
      // The floor is the price book's, in points at a cent each.
      expect(prismaMock.creatorProfile.findMany.mock.calls[0][0].where).toMatchObject({
        pendingPayout: { gte: MINIMUM_PAYOUT_AUD * 100 },
        payoutHold: false,
      });
    });

    it('pays a creator exactly at the minimum', async () => {
      creator(1, { pendingPayout: MINIMUM_PAYOUT_AUD * 100 });

      expect((await runCreatorPayoutSweep(firstOfMonth))?.paid).toBe(1);
    });

    it('pays nobody a second time in the same month, however many times it runs that day', async () => {
      creator(1);
      creator(2);

      await runCreatorPayoutSweep(firstOfMonth);
      // A restart, or another instance: and a gift has since taken her back over the minimum.
      profiles[0].pendingPayout = 9_000;
      now = new Date(firstOfMonth.getTime() + 6 * 60 * 60 * 1000);
      const again = await runCreatorPayoutSweep(now);

      expect(requestPayout).toHaveBeenCalledTimes(2);
      expect(again).toEqual({ considered: 1, paid: 0, skipped: 1, failed: 0 });
    });

    it('asks about this month only: a payout made last month does not stop this one', async () => {
      creator(1);
      payouts.push({ creatorProfileId: 'profile-0001', createdAt: new Date('2026-10-02T00:00:00Z'), status: 'COMPLETED' });

      expect((await runCreatorPayoutSweep(firstOfMonth))?.paid).toBe(1);

      const asked = prismaMock.creatorPayout.findFirst.mock.calls[0][0].where;
      expect(asked.createdAt.gte.toISOString()).toBe('2026-10-31T14:00:00.000Z');
    });

    it('tries again a creator whose payout was refused and put back this month, rather than missing her for a month', async () => {
      creator(1);
      payouts.push({ creatorProfileId: 'profile-0001', createdAt: new Date('2026-10-31T15:00:00Z'), status: 'FAILED' });

      expect((await runCreatorPayoutSweep(firstOfMonth))?.paid).toBe(1);
    });

    it('goes through every page of creators, not only the first', async () => {
      for (let n = 1; n <= 230; n += 1) creator(n);

      const outcome = await runCreatorPayoutSweep(firstOfMonth);

      expect(outcome).toEqual({ considered: 230, paid: 230, skipped: 0, failed: 0 });
      expect(new Set(requestPayout.mock.calls.map((c) => c[0])).size).toBe(230);
    });

    it('does not stop at creators it leaves alone, so they cannot crowd out the ones behind them', async () => {
      for (let n = 1; n <= 150; n += 1) creator(n, { user: goodUser({ lockedAt: new Date() }) });
      creator(151);

      const outcome = await runCreatorPayoutSweep(firstOfMonth);

      expect(outcome).toEqual({ considered: 151, paid: 1, skipped: 150, failed: 0 });
      expect(requestPayout).toHaveBeenCalledWith('user-151');
    });
  });

  // A payout nobody asked for is no reason to pay an account that could not have
  // asked for one.
  describe('who it leaves alone, for the reasons the creator herself would be refused', () => {
    const cases: Array<[string, () => Profile]> = [
      ['a suspended account', () => creator(1, { user: goodUser({ isSuspended: true }) })],
      ['a banned account', () => creator(1, { user: goodUser({ bannedAt: new Date() }) })],
      ['an account she has locked', () => creator(1, { user: goodUser({ lockedAt: new Date() }) })],
      ['an address that was never confirmed', () => creator(1, { user: goodUser({ emailVerified: false }) })],
      ['an account with no date of birth', () => creator(1, { user: goodUser({ dateOfBirth: null }) })],
      ['an account under the minimum age', () => creator(1, { user: goodUser({ dateOfBirth: new Date(Date.now() - 12 * 365 * 24 * 60 * 60 * 1000) }) })],
      ['an account a reviewer has refused', () => creator(1, { user: goodUser({ womanVerificationStatus: 'REJECTED' }) })],
      ['a creator with no user behind her', () => creator(1, { user: null })],
    ];

    it.each(cases)('is not paid: %s', async (_what, make) => {
      make();

      const outcome = await runCreatorPayoutSweep(firstOfMonth);

      expect(requestPayout).not.toHaveBeenCalled();
      expect(outcome).toEqual({ considered: 1, paid: 0, skipped: 1, failed: 0 });
    });

    it('is not paid when she has not accepted the current Creator Terms Addendum', async () => {
      creator(1);
      creator(2);
      creatorTermsRefusal.mockImplementation(async (userId) => (userId === 'user-1' ? { code: 'CREATOR_TERMS_REQUIRED' } : null));

      const outcome = await runCreatorPayoutSweep(firstOfMonth);

      expect(requestPayout.mock.calls.map((c) => c[0])).toEqual(['user-2']);
      expect(outcome).toEqual({ considered: 2, paid: 1, skipped: 1, failed: 0 });
    });

    it('is not paid when the women-only check is asked for on creator payouts and hers is not complete', async () => {
      creator(1);
      creator(2);
      womanVerifiedRefusal.mockImplementation(async (userId) => (userId === 'user-2' ? { code: 'WOMAN_VERIFICATION_REQUIRED' } : null));

      const outcome = await runCreatorPayoutSweep(firstOfMonth);

      expect(womanVerifiedRefusal).toHaveBeenCalledWith('user-1', 'creator_payouts');
      expect(requestPayout.mock.calls.map((c) => c[0])).toEqual(['user-1']);
      expect(outcome).toEqual({ considered: 2, paid: 1, skipped: 1, failed: 0 });
    });
  });

  describe('when a payout itself is refused or fails', () => {
    it('counts a refusal that is the creator’s own state as skipped and goes on to the next creator', async () => {
      creator(1);
      creator(2);
      requestPayout.mockRejectedValueOnce(new ApiError(409, 'Your payout account is not ready yet.'));

      const outcome = await runCreatorPayoutSweep(firstOfMonth);

      expect(outcome).toEqual({ considered: 2, paid: 1, skipped: 1, failed: 0 });
      expect(requestPayout).toHaveBeenCalledTimes(2);
    });

    it('counts a failure that is ours or Stripe’s as failed, puts it on the operations record, and goes on', async () => {
      creator(1);
      creator(2);
      requestPayout.mockRejectedValueOnce(new ApiError(502, 'The payout could not be sent. Your balance is unchanged; please try again.'));

      const outcome = await runCreatorPayoutSweep(firstOfMonth);

      expect(outcome).toEqual({ considered: 2, paid: 1, skipped: 0, failed: 1 });
      expect(opsSnapshot().operations['creator_payout.sweep.payout']?.failure).toBe(1);
    });

    it('counts an unexpected error as failed too, and does not stop the sweep', async () => {
      creator(1);
      creator(2);
      requestPayout.mockRejectedValueOnce(new Error('connection reset'));

      const outcome = await runCreatorPayoutSweep(firstOfMonth);

      expect(outcome).toEqual({ considered: 2, paid: 1, skipped: 0, failed: 1 });
    });
  });

  describe('telling the creator', () => {
    it('tells her the amount that was sent, since she did not press the button', async () => {
      creator(1, { pendingPayout: 6_050 });

      await runCreatorPayoutSweep(firstOfMonth);

      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          title: 'Your monthly payout is on its way',
          message: expect.stringContaining('A$60.50'),
          link: '/dashboard/creator',
        }),
      });
    });

    it('still counts the payout as made when the notice cannot be written', async () => {
      creator(1);
      prismaMock.notification.create.mockRejectedValueOnce(new Error('db busy'));

      const outcome = await runCreatorPayoutSweep(firstOfMonth);

      expect(outcome).toEqual({ considered: 1, paid: 1, skipped: 0, failed: 0 });
    });

    it('says nothing to a creator who was not paid', async () => {
      creator(1, { user: goodUser({ lockedAt: new Date() }) });

      await runCreatorPayoutSweep(firstOfMonth);

      expect(prismaMock.notification.create).not.toHaveBeenCalled();
    });
  });
});
