import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createBillingPortalSession } from '@/lib/billing/stripe';
import { logger } from '@/lib/logger';

const PortalSchema = z.object({
  userId: z.string().min(1),
  returnUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = PortalSchema.parse(body);

    const subscription = await prisma.subscription.findUnique({ where: { userId: validated.userId } });
    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer for user' }, { status: 404 });
    }

    const origin = request.headers.get('origin') ?? `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const returnUrl = validated.returnUrl ?? `${origin}/payment`;

    const session = await createBillingPortalSession({ customerId: subscription.stripeCustomerId, returnUrl });
    logger.info('Billing portal session created', { userId: validated.userId });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    logger.error('Failed to create billing portal session', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
