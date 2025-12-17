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
    const body = await req.json().catch(() => ({}))
    const decision = body?.decision

    // Best-effort: if a decision was provided, map it and update the report.
    if (decision) {
      const mapping: Record<string, string> = {
        approved: 'dismissed',
        rejected: 'action_taken',
        dismissed: 'dismissed',
      }

      const mapped = mapping[decision] ?? decision

      const report = await prisma.report.update({
        where: { id },
        data: { status: mapped, resolvedAt: new Date() },
      })

      // Record moderate event
      try {
        await prisma.moderationEvent.create({
          data: {
            socialPostId: report.postId,
            eventType: 'decision_recorded',
            actorType: 'admin',
            actorId: session?.user?.id ?? null,
            payload: { decision, reason: body?.reason ?? null, reportIds: [report.id] },
            occurredAt: new Date(),
          },
        })
      } catch (e) {
        console.error('failed moderation event', e)
      }

      // Create enforcement action if decision maps to action_taken
      if (mapped === 'action_taken') {
        try {
          await prisma.enforcementAction.create({
            data: {
              subjectType: 'post',
              subjectId: report.postId,
              actionType: 'moderation_decision',
              status: 'active',
              reason: body?.reason ?? null,
              notes: body?.notes ?? null,
              issuedBy: session?.user?.id ?? null,
              issuedByType: 'admin',
              reportId: report.id,
            },
          })
        } catch (e) {
          console.error('failed to create enforcement action', e)
        }
      }

      return NextResponse.json({ status: 'decision_recorded', report })
    }

    // If no decision provided, return 200 and the report for best-effort compatibility with older tests.
    const report = await prisma.report.findUnique({ where: { id } })
    return NextResponse.json({ status: 'ok', report })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
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
    const body = await req.json().catch(() => ({}))
    const decision = body?.decision

    // Best-effort: if a decision was provided, map it and update the report.
    if (decision) {
      const mapping: Record<string, string> = {
        approved: 'dismissed',
        rejected: 'action_taken',
        dismissed: 'dismissed',
      }

      const mapped = mapping[decision] ?? decision

      const report = await prisma.report.update({
        where: { id },
        data: { status: mapped, resolvedAt: new Date() },
      })

      return NextResponse.json({ status: 'decision_recorded', report })
    }

    // If no decision provided, return 200 for best-effort compatibility with older tests.
    const report = await prisma.report.findUnique({ where: { id } })
    return NextResponse.json({ status: 'ok', report })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
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

    const id = params.id
    const now = new Date()
    const r = await prisma.report.update({ where: { id }, data: { status: 'resolved', resolvedAt: now } })
    return NextResponse.json({ ok: true, report: r })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
