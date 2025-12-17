import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { token, password } = await req.json()
  if (!token || !password) return NextResponse.json({ error: 'Token and new password required' }, { status: 400 })

  const record = await prisma.verificationToken.findUnique({ where: { token } })
  if (!record || record.expires < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
  }

  const email = record.identifier
  const hashed = await bcrypt.hash(password, 10)

  await prisma.user.update({ where: { email }, data: { password: hashed } })

  // cleanup tokens for this identifier
  await prisma.verificationToken.deleteMany({ where: { identifier: email } })

  return NextResponse.json({ ok: true })
}
