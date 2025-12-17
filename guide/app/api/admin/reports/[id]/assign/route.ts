import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

function isAdmin(session: any) {
  return session?.user?.role === 'admin'
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = params

    // Mark the report as under review and record a moderation event
    const report = await prisma.report.update({ where: { id }, data: { status: 'under_review' } })

    try {
      await prisma.moderationEvent.create({
        data: {
          socialPostId: report.postId,
          eventType: 'assigned',
          actorType: 'admin',
          actorId: session?.user?.id ?? null,
          payload: { reportId: report.id, assignedTo: session?.user?.id ?? null },
          occurredAt: new Date(),
        },
      })
    } catch (e) {
      // best-effort: don't fail the request if event logging fails
      console.error('failed to record moderation event', e)
    }

    return NextResponse.json({ status: 'assigned', report })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
