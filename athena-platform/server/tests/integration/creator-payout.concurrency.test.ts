/**
 * Two payout requests arriving at the same moment for the same balance.
 *
 * `requestPayout` claims the points with a conditional `updateMany` before it
 * calls Stripe, and the comment above it says plainly that this is the
 * concurrency guard — "the loser of the race matches no row, decrements
 * nothing". That claim is about what Postgres does with two transactions
 * updating one row under READ COMMITTED. The mocked suite beside it
 * (`src/services/__tests__/creator.payout.test.ts`) hand-writes an `updateMany`
 * that re-checks the balance in JavaScript, so it tests the test's own idea of
 * the database, and it would go on passing if the `where` clause lost its
 * `pendingPayout: { gte: points }` entirely.
 *
 * The money at stake is real. Gift points are bought with real money and leave
 * as a real Stripe transfer, so a guard that does not hold pays a creator
 * twice out of one balance.
 *
 * Stripe is the one thing mocked here, because it is the one thing that is not
 * the platform's own state.
 */

import { describeIntegration, createMember, race, fulfilled, rejections, resetDatabase } from './setup/harness';
import { prisma } from '../../src/utils/prisma';

const mockTransfersCreate = jest.fn();

jest.mock('../../src/utils/stripe', () => ({
  STRIPE_API_VERSION: '2023-10-16',
  isStripeConfigured: () => true,
  getStripe: () => ({ transfers: { create: mockTransfersCreate } }),
}));

import { requestPayout, reverseCreatorPayout } from '../../src/services/creator.service';

/** $50 at a cent a point: the minimum payout, so one balance funds exactly one. */
const ONE_PAYOUT_IN_POINTS = 5_000;

async function seedCreatorWithBalance(points: number) {
  const member = await createMember({ stripeConnectAccountId: 'acct_integration_test' });
  const profile = await prisma.creatorProfile.create({
    data: { userId: member.id, pendingPayout: points, totalEarnings: points, isMonetized: true },
  });
  return { member, profile };
}

describeIntegration('two creator payouts racing for one balance', () => {
  beforeEach(async () => {
    await resetDatabase();
    mockTransfersCreate.mockReset();
    mockTransfersCreate.mockImplementation(async (_params: unknown, options: { idempotencyKey: string }) => ({
      id: `tr_${options.idempotencyKey}`,
    }));
  });

  it('sends exactly one transfer and decrements the balance exactly once', async () => {
    const { member } = await seedCreatorWithBalance(ONE_PAYOUT_IN_POINTS);

    const results = await race(
      () => requestPayout(member.id),
      () => requestPayout(member.id)
    );

    const succeeded = fulfilled(results);
    const refused = rejections(results);

    expect(succeeded).toHaveLength(1);
    expect(refused).toHaveLength(1);

    // The refusal a member sees. 409 rather than 400 because her balance was
    // above the minimum when she pressed the button; it is the other request
    // that took it.
    expect(refused[0]).toMatchObject({
      statusCode: 409,
      message: 'This balance is already being paid out. Check your payout history in a moment.',
    });

    // One transfer. This is the assertion the whole suite exists for: if the
    // conditional claim did not hold, both calls would reach Stripe and $50 of
    // gift points would pay out $100.
    expect(mockTransfersCreate).toHaveBeenCalledTimes(1);

    const profile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: member.id } });
    expect(profile.pendingPayout).toBe(0);

    const payouts = await prisma.creatorPayout.findMany({ where: { creatorProfileId: profile.id } });
    expect(payouts).toHaveLength(1);
    expect(payouts[0].amount).toBeCloseTo(50, 2);
    expect(payouts[0].status).toBe('PENDING');
    expect(payouts[0].stripeTransferId).toBe(`tr_creator-payout-${payouts[0].id}`);
  });

  it('never lets a balance go negative, however many requests arrive together', async () => {
    const { member } = await seedCreatorWithBalance(ONE_PAYOUT_IN_POINTS);

    const results = await Promise.allSettled([
      requestPayout(member.id),
      requestPayout(member.id),
      requestPayout(member.id),
      requestPayout(member.id),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const profile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: member.id } });
    expect(profile.pendingPayout).toBe(0);
    expect(profile.pendingPayout).toBeGreaterThanOrEqual(0);
    expect(mockTransfersCreate).toHaveBeenCalledTimes(1);
    expect(await prisma.creatorPayout.count()).toBe(1);
  });

  it('takes only what this payout sends, so a gift credited mid-flight survives', async () => {
    // The balance is above the minimum by a gift's worth. The claim decrements
    // the amount it read rather than setting the column to zero, which is what
    // stops a gift that landed a moment ago from being destroyed by the payout
    // — silently, since a payout row records only what was paid.
    const { member } = await seedCreatorWithBalance(ONE_PAYOUT_IN_POINTS + 250);

    await requestPayout(member.id);

    const profile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: member.id } });
    expect(profile.pendingPayout).toBe(250);
  });

  it('puts the points back when Stripe refuses the transfer', async () => {
    const { member } = await seedCreatorWithBalance(ONE_PAYOUT_IN_POINTS);
    mockTransfersCreate.mockRejectedValueOnce(new Error('No such destination: acct_integration_test'));

    await expect(requestPayout(member.id)).rejects.toMatchObject({ statusCode: 502 });

    // A refused transfer must not eat her balance: the platform would have no
    // record of owing it and she would have no way to ask for it again.
    const profile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: member.id } });
    expect(profile.pendingPayout).toBe(ONE_PAYOUT_IN_POINTS);

    const payouts = await prisma.creatorPayout.findMany({ where: { creatorProfileId: profile.id } });
    expect(payouts).toHaveLength(1);
    expect(payouts[0].status).toBe('FAILED');
  });

  it('credits a refused payout back once, not once per attempt to report it', async () => {
    const { member } = await seedCreatorWithBalance(ONE_PAYOUT_IN_POINTS);
    mockTransfersCreate.mockRejectedValueOnce(new Error('No such destination: acct_integration_test'));

    await expect(requestPayout(member.id)).rejects.toMatchObject({ statusCode: 502 });

    const profile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: member.id } });
    const payout = await prisma.creatorPayout.findFirstOrThrow({ where: { creatorProfileId: profile.id } });
    expect(payout.status).toBe('FAILED');

    // The webhook arriving after the synchronous failure has already credited
    // her. `creditBackFailedPayout` is guarded on the row still being open, and
    // that guard is a conditional `updateMany` — the same kind of claim, and
    // the same kind of thing a mock cannot check.
    await prisma.creatorPayout.update({
      where: { id: payout.id },
      data: { stripeTransferId: 'tr_reported_late' },
    });

    await expect(reverseCreatorPayout('tr_reported_late')).resolves.toBe(false);

    const after = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: member.id } });
    expect(after.pendingPayout).toBe(ONE_PAYOUT_IN_POINTS);
  });
});
