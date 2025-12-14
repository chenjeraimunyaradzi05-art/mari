import { prisma } from '@/lib/db';

export type GiftType = 'heart' | 'diamond' | 'star';

export const GIFT_PRICES: Record<GiftType, number> = {
  heart: 100,    // $1.00
  diamond: 500,  // $5.00
  star: 1000,    // $10.00
};

export async function sendGift(senderId: string, creatorId: string, giftType: GiftType) {
  const amountCents = GIFT_PRICES[giftType];
  const creatorShare = BigInt(Math.floor(amountCents * 0.5)); // 50% split

  // 1. Record Transaction
  const transaction = await prisma.giftTransaction.create({
    data: {
      senderId,
      creatorId,
      giftType,
      amount: amountCents, // Face value
      valueCents: BigInt(amountCents),
      creatorEarnings: creatorShare,
    },
  });

  // 2. Update Creator Stats (LiveStream aggregation would happen here too if linked)
  // For now, we just update the creator's total earnings if we had a user wallet model
  // or we rely on aggregating GiftTransactions for the dashboard.

  return transaction;
}

export async function getCreatorEarnings(creatorId: string) {
  const result = await prisma.giftTransaction.aggregate({
    where: { creatorId },
    _sum: {
      creatorEarnings: true,
    },
  });

  return Number(result._sum.creatorEarnings || 0);
}
