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

    // Fetch distinct conversations
    // This is complex in Prisma/SQL. We want the latest message for each unique pair.
    // A simpler approach for now: Fetch all messages involving the user, sort by date, and group in JS.
    
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, profileImage: true }
        },
        receiver: {
          select: { id: true, firstName: true, lastName: true, profileImage: true }
        }
      },
      take: 100, // Limit to recent 100 messages to build the list
    });

    // Group by conversation partner
    const conversationsMap = new Map();

    for (const msg of messages) {
      const partner = msg.senderId === userId ? msg.receiver : msg.sender;
      const partnerId = partner.id;

      if (!conversationsMap.has(partnerId)) {
        conversationsMap.set(partnerId, {
          partner,
          lastMessage: msg,
          unreadCount: (msg.receiverId === userId && !msg.isRead) ? 1 : 0
        });
      } else {
        const conv = conversationsMap.get(partnerId);
        if (msg.receiverId === userId && !msg.isRead) {
          conv.unreadCount += 1;
        }
      }
    }

    const conversations = Array.from(conversationsMap.values());

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
