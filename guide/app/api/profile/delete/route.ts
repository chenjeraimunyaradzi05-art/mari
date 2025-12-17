import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let userId: string | undefined = (session.user as { id?: string; email?: string })?.id
  if (!userId && session.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } })
    userId = u?.id
  }
  if (!userId) return NextResponse.json({ error: 'no_user' }, { status: 400 })

  try {
    await prisma.user.delete({ where: { id: userId } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('delete user failed', err)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
}