import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let userId: string | undefined = (session.user as { id?: string; email?: string })?.id
  if (!userId && session.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email } })
    userId = u?.id
  }
  if (!userId) return NextResponse.json({ error: 'no_user' }, { status: 400 })

  const { currentPassword, newPassword } = await req.json().catch(() => ({} as Record<string, string>))
  if (!currentPassword || !newPassword) return NextResponse.json({ error: 'current and new password required' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !user.password) return NextResponse.json({ error: 'no_local_password' }, { status: 400 })

  const ok = await bcrypt.compare(currentPassword, user.password)
  if (!ok) return NextResponse.json({ error: 'invalid_current_password' }, { status: 403 })

  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } })

  // optional: invalidate sessions? For now, let NextAuth continue (user must re-login manually)
  return NextResponse.json({ ok: true })
}