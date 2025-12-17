import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id

    const parts = await prisma.conversationParticipant.findMany({
      where: { userId },
      include: { conversation: { include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
      orderBy: { joinedAt: 'desc' },
    })

    const conversations = parts.map((p) => ({
      ...p.conversation,
      lastMessage: p.conversation.messages?.[0] ?? null,
    }))

    return NextResponse.json({ conversations })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { participantIds = [], title, initialMessage } = body

    // ensure current user is included
    const userId = session.user.id
    const uniqueParticipantIds = Array.from(new Set([userId, ...(participantIds || [])]))

    const conv = await prisma.conversation.create({ data: { title } })

    const participantCreates = uniqueParticipantIds.map((pid: string) =>
      prisma.conversationParticipant.create({ data: { conversationId: conv.id, userId: pid } }),
    )

    await Promise.all(participantCreates)

    let message = null
    if (initialMessage) {
      message = await prisma.message.create({ data: { conversationId: conv.id, authorId: userId, content: initialMessage } })
      await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: message.createdAt } })
    }

    return NextResponse.json({ conversation: conv, message })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
