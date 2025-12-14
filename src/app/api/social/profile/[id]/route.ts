import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: profileId } = await params;
    const session = await getServerSession(authOptions);
    const viewerId = session?.user?.id;

    // Get User Details
    const user = await prisma.user.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        // bio: true, // Commented out as it might not exist in schema yet
        _count: {
          select: {
            posts: true,
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get Follow Stats
    const followersCount = await prisma.follow.count({
      where: { followingId: profileId }
    });

    const followingCount = await prisma.follow.count({
      where: { followerId: profileId }
    });

    // Check if viewer is following
    let isFollowing = false;
    if (viewerId) {
      const followRecord = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: profileId,
          }
        }
      });
      isFollowing = !!followRecord;
    }

    // Get Posts
    const posts = await prisma.post.findMany({
      where: { authorId: profileId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        thumbnailUrl: true,
        videoUrl: true,
        likesCount: true,
      }
    });

    return NextResponse.json({ 
      user: {
        ...user,
        followersCount,
        followingCount,
        isFollowing
      }, 
      posts 
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
