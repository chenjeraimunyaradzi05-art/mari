import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

async function isParticipant(conversationId: string, userId: string) {
  const p = await prisma.conversationParticipant.findFirst({ where: { conversationId, userId } })
  return !!p
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id
    const conversationId = params.id

    if (!(await isParticipant(conversationId, userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const messages = await prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true } } } })

    return NextResponse.json({ messages })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id
    const conversationId = params.id

    if (!(await isParticipant(conversationId, userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const content = body?.content
    const attachments = body?.attachments ?? null

    if (!content && !attachments) return NextResponse.json({ error: 'Validation' }, { status: 422 })

    const msg = await prisma.message.create({ data: { conversationId, authorId: userId, content: content ?? '', attachments } })
    await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: msg.createdAt } })

    // detect mentions (e.g., @handle) and create notifications for mentioned users
    try {
      const text = content ?? ''
      const re = /@([a-zA-Z0-9_\-]+)/g
      const handles = new Set<string>()
      let m
      while ((m = re.exec(text)) !== null) {
        handles.add(m[1])
      }

      for (const handle of handles) {
        const profile = await prisma.profile.findUnique({ where: { handle } })
        if (profile && profile.userId !== userId) {
          await prisma.notification.create({ data: { userId: profile.userId, actorId: userId, actorType: 'user', type: 'mention', data: { conversationId, messageId: msg.id, excerpt: text.slice(0, 200) } } })
        }
      }
    } catch (e) {
      console.error('failed to create mention notifications', e)
    }

    return NextResponse.json({ message: msg })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
