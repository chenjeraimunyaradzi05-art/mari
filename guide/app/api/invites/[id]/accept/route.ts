import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as unknown as { id?: string; email?: string })?.id
    const userEmail = (session?.user as unknown as { id?: string; email?: string })?.email
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = params.id
    const invite = await prisma.invite.findUnique({ where: { id } })
    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    if (invite.status !== 'pending') return NextResponse.json({ error: 'Invite not pending' }, { status: 400 })

    if (invite.targetEmail !== userEmail) {
      return NextResponse.json({ error: 'Invite email does not match your account' }, { status: 403 })
    }

    const now = new Date()
    await prisma.invite.update({ where: { id }, data: { status: 'accepted', acceptedAt: now } })

    // create connection between sender and current user (avoid duplicates)
    const senderId = invite.senderId
    const userAId = senderId < userId ? senderId : userId
    const userBId = senderId < userId ? userId : senderId

    const conn = await prisma.connection.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      update: {},
      create: { userAId, userBId },
    })

    return NextResponse.json({ ok: true, connection: conn })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
