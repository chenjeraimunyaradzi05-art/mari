import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as unknown as { id?: string })?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const connections = await prisma.connection.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: { userA: { include: { profiles: true } }, userB: { include: { profiles: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ connections })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as unknown as { id?: string })?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const targetId = String(body.targetId || '')
    if (!targetId) return NextResponse.json({ error: 'targetId required' }, { status: 400 })

    const a = userId < targetId ? userId : targetId
    const b = userId < targetId ? targetId : userId

    await prisma.connection.deleteMany({ where: { userAId: a, userBId: b } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
