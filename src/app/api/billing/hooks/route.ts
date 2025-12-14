import Stripe from 'stripe';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getStripe, logStripeEvent, subscriptionToPrisma } from '@/lib/billing/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function upsertSubscriptionFromStripe(sub: Stripe.Subscription) {
  const mapped = subscriptionToPrisma(sub);
  const { userId, ...data } = mapped;

  const ors: Prisma.SubscriptionWhereInput[] = [{ stripeSubscriptionId: sub.id }];
  if (data.stripeCustomerId) ors.push({ stripeCustomerId: data.stripeCustomerId });
  if (userId) ors.push({ userId });

  const existing = await prisma.subscription.findFirst({ where: { OR: ors } });

  if (existing) {
    return prisma.subscription.update({ where: { id: existing.id }, data });
  }

  if (!userId) throw new Error('Subscription is missing userId metadata');

  return prisma.subscription.create({
    data: {
      ...data,
      userId,
    },
  });
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook signature missing' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Invalid Stripe webhook signature', { message });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  logStripeEvent(event);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (typeof session.subscription === 'string') {
          const sub = await stripe.subscriptions.retrieve(session.subscription, {
            expand: ['items.data.price', 'latest_invoice'],
          });
          await upsertSubscriptionFromStripe(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscriptionFromStripe(sub);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string, {
            expand: ['items.data.price', 'latest_invoice'],
          });
          await upsertSubscriptionFromStripe(sub);
        }
        break;
      }
      default: {
        break;
      }
    }
  } catch (err) {
    logger.error('Failed to process Stripe webhook', { error: err instanceof Error ? err.message : String(err), eventType: event.type });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
