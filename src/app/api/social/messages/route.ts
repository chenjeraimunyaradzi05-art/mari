import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const partnerId = request.nextUrl.searchParams.get('userId');

  if (!partnerId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

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

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, profileImage: true }
        }
      }
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { receiverId, content } = await request.json();

    if (!receiverId || !content) {
      return NextResponse.json({ error: 'Receiver ID and content required' }, { status: 400 });
    }

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

    const message = await prisma.message.create({
      data: {
        senderId: userId,
        receiverId,
        content,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, profileImage: true }
        }
      }
    });

    // Create Notification for receiver
    try {
      await prisma.notification.create({
        data: {
          userId: receiverId,
          type: 'MESSAGE',
          actorId: userId,
          message: 'sent you a message',
          isRead: false,
        },
      });
    } catch (e) {
      // Ignore
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
