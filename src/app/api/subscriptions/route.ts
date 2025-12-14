import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CreateSubscriptionSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { createCheckoutSession } from '@/lib/billing/stripe';
import { tierConfig } from '@/lib/membership';

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

/**
 * POST /api/subscriptions
 * Starts a Stripe checkout session and seeds/updates the subscription record.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreateSubscriptionSchema.parse(body);

    const tier = validated.tier;
    const existing = await prisma.subscription.findUnique({ where: { userId: validated.userId } });

    if (existing && ACTIVE_STATUSES.includes(existing.status)) {
      return NextResponse.json({
        subscription: existing,
        checkoutUrl: null,
        message: 'User already has an active subscription',
      });
    }

    const origin = request.headers.get('origin') ?? `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const successUrl = validated.successUrl ?? `${origin}/payment?status=success&tier=${tier}`;
    const cancelUrl = validated.cancelUrl ?? `${origin}/payment?status=cancelled&tier=${tier}`;

    const monthlyPrice = validated.monthlyPrice ?? tierConfig[tier].monthlyPriceCents;
    const currency = validated.currency ?? tierConfig[tier].currency;

    const session = await createCheckoutSession({
      userId: validated.userId,
      email: validated.email,
      tier,
      successUrl,
      cancelUrl,
      customerId: validated.customerId ?? existing?.stripeCustomerId ?? null,
    });

    const subscription = await prisma.subscription.upsert({
      where: { userId: validated.userId },
      update: {
        tier,
        status: 'incomplete',
        monthlyPrice,
        currency,
        stripeCustomerId: validated.customerId ?? existing?.stripeCustomerId ?? null,
      },
      create: {
        userId: validated.userId,
        tier,
        status: 'incomplete',
        monthlyPrice,
        currency,
        stripeCustomerId: validated.customerId ?? null,
      },
    });

    logger.info('Stripe checkout session created', { userId: validated.userId, tier, sessionId: session.id });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      subscription,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    logger.error('Error creating subscription', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
