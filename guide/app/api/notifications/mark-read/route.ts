import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const ids: string[] = body?.ids || []
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'Validation' }, { status: 422 })

    const updated = await prisma.notification.updateMany({ where: { id: { in: ids }, userId }, data: { isRead: true } })
    return NextResponse.json({ count: updated.count })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
