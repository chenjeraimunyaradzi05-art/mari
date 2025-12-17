import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as unknown as { id?: string })?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { subjectId, category, severity, description, metadata, actions, evidence } = body

    if (!category || !description) return NextResponse.json({ error: 'category and description required' }, { status: 400 })

    // create incident
    const incident = await prisma.incidentReport.create({
      data: {
        reporterId: userId,
        subjectId: subjectId ?? null,
        category,
        severity: severity ?? 'medium',
        description: description ?? null,
        status: 'open',
        metadata: metadata ?? {},
        occurredAt: metadata?.occurred_at ? new Date(metadata.occurred_at) : null,
      },
    })

    const results: Record<string, unknown> = {}

    // quick action: block subject (best-effort)
    if (actions?.block && subjectId) {
      // create or update a block (user->user) record (best-effort without unique composite)
      const existing = await prisma.block.findFirst({ where: { blockerId: userId, blockedId: String(subjectId) } })
      if (existing) {
        await prisma.block.update({ where: { id: existing.id }, data: { status: 'active' } })
      } else {
        await prisma.block.create({ data: { blockerId: userId, blockedId: String(subjectId), status: 'active' } })
      }

      await prisma.incidentEvent.create({ data: { incidentId: incident.id, action: 'quick_action.blocked', notes: `Blocked user ${subjectId}` } })
      results.block = { applied: true }
    }

    // collect evidence
    if (actions?.collect_evidence && Array.isArray(evidence) && evidence.length > 0) {
      const metadataNow: any = incident.metadata ?? {}
      metadataNow.evidence = Array.isArray(metadataNow.evidence) ? [...metadataNow.evidence, ...evidence] : [...evidence]
      await prisma.incidentReport.update({ where: { id: incident.id }, data: { metadata: metadataNow } })
      await prisma.incidentEvent.create({ data: { incidentId: incident.id, action: 'quick_action.evidence', notes: `Collected ${evidence.length} evidence` } })
      results.collect_evidence = { applied: true, count: evidence.length }
    }

    return NextResponse.json({ incident, actions: results }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
