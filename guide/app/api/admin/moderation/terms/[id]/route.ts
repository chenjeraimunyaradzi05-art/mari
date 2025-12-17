import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

function isAdmin(session: any) {
  return session?.user?.role === 'admin'
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = params
    const body = await req.json()

    const updateData: any = {}
    if (body.term !== undefined) updateData.term = body.term
    if (body.severity !== undefined) updateData.severity = body.severity
    if (body.replacement !== undefined) updateData.replacement = body.replacement
    if (body.tags !== undefined) updateData.tags = body.tags
    if (body.contexts !== undefined) updateData.contexts = body.contexts
    if (body.is_active !== undefined) updateData.isActive = !!body.is_active

    const term = await prisma.sensitiveTerm.update({ where: { id }, data: updateData })
    return NextResponse.json({ term })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = params
    await prisma.sensitiveTerm.delete({ where: { id } })
    return NextResponse.json({ status: 'deleted' })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
