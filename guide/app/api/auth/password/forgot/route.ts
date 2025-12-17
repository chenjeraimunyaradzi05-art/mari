import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return NextResponse.json({ ok: true }) // do not reveal existence

  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  })

  // send reset email (best-effort)
  try {
    const { sendResetPasswordEmail } = await import('@/lib/mailer')
    await sendResetPasswordEmail(email, token)
  } catch (err) {
    console.error('Failed sending reset email', err)
  }

  return NextResponse.json({ ok: true })
}
