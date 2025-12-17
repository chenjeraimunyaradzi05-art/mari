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

    const terms = await prisma.sensitiveTerm.findMany({ orderBy: { term: 'asc' } })
    return NextResponse.json({ terms })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    if (!body?.term || !body?.severity) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 422 })
    }

    const term = await prisma.sensitiveTerm.create({
      data: {
        term: body.term,
        severity: body.severity,
        replacement: body.replacement ?? null,
        tags: body.tags ?? null,
        contexts: body.contexts ?? null,
        isActive: body.is_active ?? true,
        createdBy: session?.user?.id ?? null,
      },
    })

    return NextResponse.json({ term })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
