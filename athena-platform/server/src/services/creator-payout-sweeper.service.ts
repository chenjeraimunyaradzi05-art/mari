/**
 * Automatic monthly payouts to creators, switched off unless ATHENA turns them on.
 *
 * The Terms once promised "monthly or upon reaching threshold" and the code only
 * ever paid a creator when she pressed the button, so the promise was half untrue.
 * What is true today is that a creator asks for her payout once her balance has
 * reached the minimum (see section 5.3 of the Terms). This sweeper is the other
 * half, built so that the decision to make the promise bigger is a switch and not
 * a project, and left off because it moves money a member did not ask for in that
 * moment, which is the owner's call and the Terms reviewer's to sign off before
 * it is made: set CREATOR_AUTO_PAYOUTS=monthly, and change section 5.3 in the same
 * release, or the Terms say "on request" while the money moves by itself.
 *
 * What it does when it is on. On the first of each month, Queensland time, it
 * pays every creator whose balance has reached the minimum, by calling
 * requestPayout for each, so every protection that function has applies
 * unchanged: the points are claimed before Stripe is asked, the transfer is keyed
 * on the payout row, a refusal puts the points back, and a held or unverified
 * account is not paid. The route that a creator presses a button on also asks for
 * an adult account, the current Creator Terms Addendum and, where ATHENA has
 * switched it on, a completed women-only check; none of that is skipped here,
 * because a payout that nobody asked for is no reason to pay an account that
 * could not have asked for one.
 *
 * Safe to run twice, by two instances or by a restart on the first: a creator who
 * has had a payout this month that was not refused is left alone, and a balance
 * that was claimed is no longer there to claim. A creator below the minimum keeps
 * her balance, which carries over, as it always has.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { runExclusively } from '../utils/redis';
import { recordFailure, recordSuccess } from '../utils/ops-metrics';
import { ApiError } from '../middleware/errorHandler';
import { MINIMUM_PAYOUT_AUD, giftPointsForCents } from '../config/price-book';
import { accountStandingRefusal } from '../middleware/account-standing';
import { creatorTermsRefusal } from '../middleware/account-gates';
import { womanVerifiedRefusal } from '../middleware/woman-gate-surfaces';
import { requestPayout } from './creator.service';
import { getPaymentsPause, isPaymentsPausedError } from './feature-flags.service';

/** The environment value that turns the sweep on. Anything else, or nothing, leaves it off. */
export const AUTO_PAYOUTS_ENV = 'CREATOR_AUTO_PAYOUTS';
export const AUTO_PAYOUTS_MONTHLY = 'monthly';

/** Queensland does not observe daylight saving, so its offset from UTC is a constant. */
const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;

/** A sweep stops here, so one that is somehow looking at far too many creators ends rather than runs for an hour. */
const MAX_PROFILES_PER_SWEEP = 5000;
const PAGE = 100;

/** The path the creator's own request would arrive on, which the account-standing rule is asked about. */
const PAYOUT_PATH = '/api/creator/payouts/request';

export function autoPayoutsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env[AUTO_PAYOUTS_ENV] ?? '').trim().toLowerCase() === AUTO_PAYOUTS_MONTHLY;
}

/** The calendar date it is in Brisbane at this instant. */
function brisbaneDate(now: Date): { year: number; month: number; day: number } {
  const local = new Date(now.getTime() + BRISBANE_OFFSET_MS);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate() };
}

/** Whether today, in Brisbane, is the day payouts go out. */
export function isAutoPayoutDay(now: Date = new Date()): boolean {
  return brisbaneDate(now).day === 1;
}

/** The first instant of this month in Brisbane. */
export function startOfBrisbaneMonth(now: Date = new Date()): Date {
  const { year, month } = brisbaneDate(now);
  return new Date(Date.UTC(year, month, 1) - BRISBANE_OFFSET_MS);
}

export interface CreatorPayoutSweep {
  /** Creators at or above the minimum whose withdrawals are not on hold. */
  considered: number;
  /** Payouts started. */
  paid: number;
  /** Left alone for a reason that is expected: already paid this month, or not allowed to be paid yet. */
  skipped: number;
  /** Payouts that should have gone and did not, for a reason of ours or Stripe's. */
  failed: number;
}

type CandidateUser = {
  isSuspended: boolean;
  bannedAt: Date | null;
  lockedAt: Date | null;
  emailVerified: boolean | null;
  dateOfBirth: Date | null;
  womanVerificationStatus: string | null;
};

/**
 * Why this creator is not paid by the sweep, or null when she may be. The same
 * questions the route puts to her when she asks for herself.
 */
async function reasonNotToPay(userId: string, user: CandidateUser | null): Promise<string | null> {
  if (!user) return 'no account';
  if (user.isSuspended || user.bannedAt) return 'account closed';
  if (user.lockedAt) return 'account locked';
  if (user.emailVerified === false) return 'email not confirmed';
  if (accountStandingRefusal(user, 'POST', PAYOUT_PATH)) return 'account standing';
  // The route asks for an adult account too, and a date of birth that is missing
  // is a refusal in the standing rule above, so an account that got this far has one.
  if (await creatorTermsRefusal(userId)) return 'creator terms not accepted';
  if (await womanVerifiedRefusal(userId, 'creator_payouts')) return 'women-only check not complete';
  return null;
}

/**
 * Pays this month's payouts. Returns null when the sweep is off or today is not
 * the day, which is not a run of its own and so is neither a success nor a failure.
 */
export async function runCreatorPayoutSweep(now: Date = new Date()): Promise<CreatorPayoutSweep | null> {
  if (!autoPayoutsEnabled() || !isAutoPayoutDay(now)) return null;

  // Not a run while payments are paused: every payout would be refused, and each
  // creator would be counted as a failure for a state an admin chose. The sweep
  // runs again within the day, so a pause that is lifted in time loses nothing.
  if ((await getPaymentsPause()).paused) {
    logger.warn('The monthly creator payout sweep was skipped because payments are paused');
    return null;
  }

  const result: CreatorPayoutSweep = { considered: 0, paid: 0, skipped: 0, failed: 0 };
  const monthStart = startOfBrisbaneMonth(now);
  const minimumPoints = giftPointsForCents(MINIMUM_PAYOUT_AUD * 100);

  let after = '';
  while (result.considered < MAX_PROFILES_PER_SWEEP) {
    // Keyed on the id rather than skipped by count: the creators this leaves
    // alone stay in the table, and counting past them each time would never end.
    const page = await prisma.creatorProfile.findMany({
      where: { pendingPayout: { gte: minimumPoints }, payoutHold: false, ...(after ? { id: { gt: after } } : {}) },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            isSuspended: true,
            bannedAt: true,
            lockedAt: true,
            emailVerified: true,
            dateOfBirth: true,
            womanVerificationStatus: true,
          },
        },
      },
      orderBy: { id: 'asc' },
      take: PAGE,
    });
    if (page.length === 0) break;
    after = page[page.length - 1].id;

    for (const profile of page) {
      result.considered += 1;

      // One payout a month. A refused one (status FAILED, its points put back)
      // does not count, so a creator whose transfer bounced is tried again on the
      // next run of the day rather than missed for a month.
      const alreadyPaid = await prisma.creatorPayout.findFirst({
        where: { creatorProfileId: profile.id, createdAt: { gte: monthStart }, status: { not: 'FAILED' } },
        select: { id: true },
      });
      if (alreadyPaid) {
        result.skipped += 1;
        continue;
      }

      const reason = await reasonNotToPay(profile.userId, profile.user);
      if (reason) {
        result.skipped += 1;
        logger.info('A creator was not paid by the monthly sweep', { creatorProfileId: profile.id, reason });
        continue;
      }

      try {
        const payout = await requestPayout(profile.userId);
        result.paid += 1;
        // She did not press a button, so she is told it has gone. Never fails the payout.
        await prisma.notification
          .create({
            data: {
              userId: profile.userId,
              type: 'SYSTEM',
              title: 'Your monthly payout is on its way',
              message: `A$${payout.amount.toFixed(2)} from your gifts has been sent to your Stripe account. Stripe pays it into your bank on its own schedule.`,
              link: '/dashboard/creator',
            },
          })
          .catch((error: unknown) =>
            logger.warn('Could not tell a creator her monthly payout was sent', {
              creatorProfileId: profile.id,
              error: error instanceof Error ? error.message : String(error),
            })
          );
      } catch (error) {
        // A pause switched on part-way through the run, after the check at the top.
        // It is a decision, not a payout that failed, so it is not counted or
        // alarmed on per creator, and the run stops: every payout after it would be
        // refused the same way. Nobody's balance was touched (requestPayout asks
        // before it claims the points), so the next run of the day pays them.
        if (isPaymentsPausedError(error)) {
          logger.warn('The monthly creator payout sweep stopped because payments were paused part-way through');
          return result;
        }
        // A refusal that is the member's own state (a hold that landed after the
        // read, an account Stripe has not enabled, a balance somebody else just
        // claimed) is a 4xx and is not a fault. Anything else is, and is counted.
        if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
          result.skipped += 1;
          logger.info('A creator was not paid by the monthly sweep', { creatorProfileId: profile.id, reason: error.message });
          continue;
        }
        result.failed += 1;
        recordFailure('creator_payout.sweep.payout', error);
        logger.error('A monthly creator payout failed', {
          creatorProfileId: profile.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return result;
}

let timer: NodeJS.Timeout | null = null;

/**
 * Starts the sweep if it is switched on. Checked every six hours: it acts only on
 * the first of the month, and a run that the process missed is made up by the next
 * one the same day. A deployment that has not set CREATOR_AUTO_PAYOUTS starts
 * nothing at all.
 */
export function startCreatorPayoutSweeper(intervalMs = 6 * 60 * 60 * 1000): void {
  if (timer || process.env.NODE_ENV === 'test') return;
  if (!autoPayoutsEnabled()) return;

  logger.info('Automatic monthly creator payouts are on: creators at or above the minimum are paid on the 1st, Queensland time');

  const run = () =>
    runExclusively('creator-payouts', () => runCreatorPayoutSweep())
      .then((outcome) => {
        // null is another instance holding the lock, or the wrong day.
        if (!outcome) return;
        recordSuccess('creator_payout.sweep');
        logger.info('Creator payout sweep', outcome);
      })
      .catch((error) => {
        recordFailure('creator_payout.sweep', error);
        logger.warn('Creator payout sweep failed', { error: error instanceof Error ? error.message : String(error) });
      });

  setTimeout(run, 240_000).unref();
  timer = setInterval(run, intervalMs);
  timer.unref();
}
