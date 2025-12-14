import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CreateSubscriptionSchema, UpdateSubscriptionSchema } from '@/lib/validations';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/subscriptions
 * Create a subscription
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreateSubscriptionSchema.parse(body);

    // Check if user already has active subscription
    const existing = await prisma.subscription.findUnique({
      where: { userId: validated.userId },
    });

    if (existing && existing.status === 'active') {
      return NextResponse.json(
        { error: 'User already has an active subscription' },
        { status: 409 }
      );
    }

    const subscription = await prisma.subscription.create({
      data: validated,
    });

    logger.info('Subscription created', { userId: validated.userId, tier: validated.tier });

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    logger.error('Error creating subscription', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/subscriptions/[userId]
 * Get user subscription
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: params.userId },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    logger.info('Subscription retrieved', { userId: params.userId });

    return NextResponse.json(subscription);
  } catch (error) {
    logger.error('Error getting subscription', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
