import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as unknown as { id?: string })?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { postId, reason } = await req.json()
    if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 })

    const report = await prisma.report.create({ data: { reporterId: userId, postId, reason } })
    return NextResponse.json({ report })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
