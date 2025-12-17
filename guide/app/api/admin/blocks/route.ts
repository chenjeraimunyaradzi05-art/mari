import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

function isAdmin(session: any) {
  return session?.user?.role === 'admin'
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const blocks = await prisma.block.findMany({
      orderBy: { createdAt: 'desc' },
      include: { blocker: { select: { id: true, name: true } }, blocked: { select: { id: true, name: true } } },
      take: 200,
    })

    return NextResponse.json({ blocks })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
