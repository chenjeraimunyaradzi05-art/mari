import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { authOptions } from '@/lib/auth';

const DEFAULT_TAKE = 6;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const fallbackUserId = request.nextUrl.searchParams.get('userId') || request.headers.get('x-user-id');
  const userId = session?.user?.id || fallbackUserId;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!session && fallbackUserId) {
    logger.warn('Candidate dashboard using fallback userId without session');
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        member: {
          select: {
            pathwayProgress: true,
            currentPathway: true,
            // status: true, // Not in schema
            // location: true, // Not in schema
            // desiredRole: true, // Not in schema
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const completion = user.member?.pathwayProgress ?? 0;
    const progress = {
      completion,
      stepsCompleted: Math.round((completion / 100) * 10),
      pathway: user.member?.currentPathway ?? 'General',
      status: user.status ?? 'UNKNOWN',
    };

    const badges = [
      completion >= 70 && { id: 'momentum', label: 'Momentum Maker', color: 'pink' },
      completion >= 40 && { id: 'trail', label: 'Trail Starter', color: 'indigo' },
      { id: 'ally', label: 'Community Ally', color: 'emerald' },
    ].filter((badge): badge is { id: string; label: string; color: string } => Boolean(badge));

    const bookmarks = await prisma.orgPost.findMany({
      where: { visibility: 'public' },
      take: DEFAULT_TAKE,
      orderBy: { createdAt: 'desc' },
      include: { organization: { select: { name: true } } },
    });

    const signals = await prisma.userInteraction.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: DEFAULT_TAKE,
    });

    return NextResponse.json({
      profile: {
        id: user.id,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Member',
        email: user.email,
        role: user.role,
        location: null, // user.member?.location,
        desiredRole: null, // user.member?.desiredRole,
      },
      progress,
      badges,
      bookmarks,
      signals,
    });
  } catch (error) {
    logger.error('Candidate dashboard API error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
