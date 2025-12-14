import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const session = await getServerSession(authOptions);
    let userId = session?.user?.id;

    // Fallback for development
    if (!userId && process.env.NODE_ENV === 'development') {
      const user = await prisma.user.findFirst();
      userId = user?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Fetch actor details manually since relation might be missing
    const actorIds = [...new Set(notifications.map(n => n.actorId).filter(Boolean) as string[])];
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImage: true,
      }
    });

    const actorMap = new Map(actors.map(a => [a.id, a]));

    const enrichedNotifications = notifications.map(n => ({
      ...n,
      actor: n.actorId ? actorMap.get(n.actorId) : null,
    }));

    return NextResponse.json(enrichedNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
