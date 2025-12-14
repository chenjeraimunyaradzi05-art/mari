import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SubscriptionTier } from '@prisma/client';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { tier } = body;

  if (!tier || !Object.values(SubscriptionTier).includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const userId = (session.user as any).id;

  // In a real app, we would:
  // 1. Create/Get Stripe Customer
  // 2. Create Stripe Checkout Session
  // 3. Return session URL

  // For MVP Simulation:
  // We'll just update the user's subscription directly to simulate a successful payment
  
  // Check if subscription exists
  const existingSub = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (existingSub) {
    await prisma.subscription.update({
      where: { userId },
      data: {
        tier,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        userId,
        tier,
        status: 'active',
        monthlyPrice: 0, // Should fetch from plan details
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  return NextResponse.json({ url: '/dashboard/settings/billing?success=true' });
}
