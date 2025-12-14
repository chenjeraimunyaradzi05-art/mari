import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (session.user as any).id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  // Get IDs already followed
  const following = await db.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const followingIds = following.map((f: any) => f.followingId);
  followingIds.push(userId); // Exclude self

  // Find users not in followingIds
  const recommendations = await prisma.user.findMany({
    where: {
      id: { notIn: followingIds },
      status: 'ACTIVE',
    },
    take: 5,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profileImage: true,
      role: true,
    },
  });

  return NextResponse.json({ data: recommendations });
}
