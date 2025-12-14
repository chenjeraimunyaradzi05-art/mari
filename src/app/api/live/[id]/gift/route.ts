import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SendGiftSchema } from '@/lib/validations';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/live/[id]/gift
 * Send a gift to creator during live stream
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = SendGiftSchema.parse(body);

    // Calculate gift value in cents (1 gift = 100 cents)
    const valueCents = BigInt(validated.amount * 100);
    const creatorEarnings = (valueCents * BigInt(50)) / BigInt(100); // 50% cut

    // Create gift transaction
    const gift = await prisma.giftTransaction.create({
      data: {
        creatorId: validated.creatorId,
        senderId: validated.senderId,
        giftType: validated.giftType,
        amount: validated.amount,
        valueCents,
        creatorEarnings,
      },
    });

    // Update live stream metrics
    await prisma.liveStream.update({
      where: { id },
      data: {
        totalGifts: {
          increment: BigInt(validated.amount),
        },
      },
    });

    logger.info('Gift sent', {
      streamId: id,
      giftId: gift.id,
      creatorId: validated.creatorId,
    });

    return NextResponse.json(gift, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    logger.error('Error sending gift', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
