import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const record = await prisma.verificationToken.findUnique({ where: { token } })
  if (!record || record.expires < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
  }

  const email = record.identifier
  await prisma.user.update({ where: { email }, data: { emailVerified: new Date() } })
  await prisma.verificationToken.deleteMany({ where: { identifier: email } })

  return NextResponse.json({ ok: true })
}
