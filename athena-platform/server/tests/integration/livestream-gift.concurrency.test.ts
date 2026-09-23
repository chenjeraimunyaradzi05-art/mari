/**
 * Two gifts sent at the same moment from a balance that covers one.
 *
 * `sendStreamGift` reads the sender's balance for an early exit, then does a
 * whole follower count — a database round trip — before it debits. The comment
 * on that early check says so outright: it is "a cheap early exit, and nothing
 * more than that", and the real guard is the conditional `updateMany` inside
 * the transaction. Gift points are bought with real money and the creator's
 * share of every gift lands in `pendingPayout`, which leaves as a real Stripe
 * transfer, so two gifts paid for once is money the platform hands out and
 * cannot get back.
 *
 * The mocked sibling (`src/services/__tests__/livestream.safety.test.ts`) says
 * in a comment that "the conditional updateMany IS the balance check" — and
 * then checks it against a `jest.fn()` that applies the condition itself. This
 * is the same claim put to Postgres.
 */

import { describeIntegration, createMember, race, fulfilled, rejections, resetDatabase } from './setup/harness';
import { prisma } from '../../src/utils/prisma';
import { sendStreamGift } from '../../src/services/livestream.service';

/** The Star gift: 5 points, and at the Emerging tier's 70% share, 3 to the creator. */
const STAR_POINTS = 5;
const STAR_CREATOR_SHARE = 3;

async function seedLiveStream() {
  const host = await createMember({ firstName: 'Host' });
  await prisma.creatorProfile.create({ data: { userId: host.id } });

  const stream = await prisma.liveStream.create({
    data: {
      hostId: host.id,
      title: 'Building a business from the kitchen table',
      status: 'LIVE',
      streamKey: `key-${host.id}`,
      startedAt: new Date(),
    },
  });

  return { host, stream };
}

describeIntegration('two gifts racing for one balance', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('records one gift and leaves a balance of zero, not of minus five', async () => {
    const { host, stream } = await seedLiveStream();
    const sender = await createMember({ firstName: 'Supporter', giftBalance: STAR_POINTS });

    const results = await race(
      () => sendStreamGift(stream.id, sender.id, 'STAR'),
      () => sendStreamGift(stream.id, sender.id, 'STAR')
    );

    expect(fulfilled(results)).toHaveLength(1);
    expect(rejections(results)).toHaveLength(1);
    expect(rejections(results)[0]).toMatchObject({
      statusCode: 402,
      message: 'Not enough gift points. Top up to send this gift.',
    });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: sender.id } });
    expect(after.giftBalance).toBe(0);
    expect(after.giftBalance).toBeGreaterThanOrEqual(0);

    expect(await prisma.giftTransaction.count()).toBe(1);

    // The refused half must not have left anything behind either. The debit is
    // inside the interactive transaction with these two writes, so a gift
    // nobody paid for would show up here as a stream credited twice.
    const credited = await prisma.liveStream.findUniqueOrThrow({ where: { id: stream.id } });
    expect(credited.totalGiftPoints).toBe(STAR_POINTS);

    const hostProfile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: host.id } });
    expect(hostProfile.pendingPayout).toBe(STAR_CREATOR_SHARE);
    expect(hostProfile.totalEarnings).toBe(STAR_CREATOR_SHARE);
  });

  it('holds when five requests arrive together for a balance covering two', async () => {
    const { host, stream } = await seedLiveStream();
    const sender = await createMember({ firstName: 'Supporter', giftBalance: STAR_POINTS * 2 });

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => sendStreamGift(stream.id, sender.id, 'STAR'))
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: sender.id } });
    expect(after.giftBalance).toBe(0);

    expect(await prisma.giftTransaction.count()).toBe(2);
    const credited = await prisma.liveStream.findUniqueOrThrow({ where: { id: stream.id } });
    expect(credited.totalGiftPoints).toBe(STAR_POINTS * 2);

    const hostProfile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: host.id } });
    expect(hostProfile.pendingPayout).toBe(STAR_CREATOR_SHARE * 2);
  });

  it('rolls the gift row back when the debit is refused, rather than recording a gift nobody paid for', async () => {
    const { host, stream } = await seedLiveStream();
    const sender = await createMember({ firstName: 'Supporter', giftBalance: 0 });

    await expect(sendStreamGift(stream.id, sender.id, 'STAR')).rejects.toMatchObject({ statusCode: 402 });

    expect(await prisma.giftTransaction.count()).toBe(0);
    const credited = await prisma.liveStream.findUniqueOrThrow({ where: { id: stream.id } });
    expect(credited.totalGiftPoints).toBe(0);
    const hostProfile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: host.id } });
    expect(hostProfile.pendingPayout).toBe(0);
  });

  it('reports the balance the database holds, not the one it read before the debit', async () => {
    const { stream } = await seedLiveStream();
    const sender = await createMember({ firstName: 'Supporter', giftBalance: 20 });

    const [first, second] = await Promise.all([
      sendStreamGift(stream.id, sender.id, 'STAR'),
      sendStreamGift(stream.id, sender.id, 'STAR'),
    ]);

    // Both succeed here — 20 points covers two Stars — so the interesting
    // question is what each one told the sender her balance was. Subtracting
    // from the figure read at the top of the call would have both reporting
    // 15; reading it back inside the transaction gives 15 and 10 in some order.
    expect([first.balance, second.balance].sort((a, b) => a - b)).toEqual([10, 15]);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: sender.id } });
    expect(after.giftBalance).toBe(10);
  });
});
