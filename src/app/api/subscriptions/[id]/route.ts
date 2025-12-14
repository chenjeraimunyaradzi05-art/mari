import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Stripe from 'stripe';
import { UpdateSubscriptionSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getStripe, subscriptionToPrisma } from '@/lib/billing/stripe';
import { resolvePriceId } from '@/lib/membership';

// PATCH /api/subscriptions/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = UpdateSubscriptionSchema.parse(body);

    const local = await prisma.subscription.findUnique({ where: { id } });
    if (!local) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    if (!local.stripeSubscriptionId) {
      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          tier: validated.tier ?? local.tier,
          status: validated.status ?? local.status,
          cancelAtPeriodEnd: validated.cancelAtPeriodEnd ?? local.cancelAtPeriodEnd,
        },
      });
      return NextResponse.json(updated);
    }

    const stripe = getStripe();
    const upstream = await stripe.subscriptions.retrieve(local.stripeSubscriptionId, {
      expand: ['items.data.price', 'latest_invoice'],
    });

    if (validated.status === 'canceled') {
      const canceled = await stripe.subscriptions.cancel(local.stripeSubscriptionId, { prorate: true });
      const { userId: _ignored, ...data } = subscriptionToPrisma(canceled);
      const saved = await prisma.subscription.update({ where: { id }, data });
      return NextResponse.json(saved);
    }

    const updateParams: Stripe.SubscriptionUpdateParams = {};

    if (validated.tier && validated.tier !== upstream.metadata?.tier) {
      const priceId = resolvePriceId(validated.tier);
      if (priceId) {
        const itemId = upstream.items.data[0]?.id;
        updateParams.items = itemId ? [{ id: itemId, price: priceId }] : [{ price: priceId }];
      }
      updateParams.proration_behavior = 'create_prorations';
      updateParams.metadata = { ...(upstream.metadata ?? {}), tier: validated.tier };
    }

    if (validated.cancelAtPeriodEnd !== undefined) {
      updateParams.cancel_at_period_end = validated.cancelAtPeriodEnd;
    }

    if (validated.status === 'paused') {
      updateParams.pause_collection = { behavior: 'mark_uncollectible' };
    }

    if (validated.status === 'active' && upstream.pause_collection) {
      updateParams.pause_collection = null;
    }

    const updatedStripe = Object.keys(updateParams).length
      ? await stripe.subscriptions.update(local.stripeSubscriptionId, updateParams)
      : upstream;

    const { userId: _ignored, ...data } = subscriptionToPrisma(updatedStripe);
    const saved = await prisma.subscription.update({ where: { id }, data });

    logger.info('Subscription updated', { subscriptionId: id, tier: data.tier, status: data.status });
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    logger.error('Error updating subscription', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
