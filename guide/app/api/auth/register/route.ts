import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password, name } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
      },
      select: { id: true, email: true, name: true },
    })

    // create a basic primary profile for the user (if provided)
    const { displayName, pronouns, handle } = body as { displayName?: string; pronouns?: string; handle?: string }
    let profile
    try {
      // ensure handle uniqueness by appending a short suffix if needed
      let safeHandle = handle ? String(handle).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() : undefined
      if (safeHandle) {
        const existing = await prisma.profile.findUnique({ where: { handle: safeHandle } })
        if (existing) safeHandle = `${safeHandle}-${Math.random().toString(36).slice(2, 6)}`
      }

      profile = await prisma.profile.create({
        data: {
          userId: user.id,
          displayName: displayName || name || '',
          handle: safeHandle || `${user.id.slice(0, 8)}`,
          pronouns: pronouns || null,
          isPrimary: true,
        },
      })
    } catch (err) {
      console.error('Failed to create profile', err)
    }

    // create verification token (used for email verification or password reset flows)
    const token = randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24) // 24 hours

    await prisma.verificationToken.create({
      data: {
        identifier: user.email ?? '',
        token,
        expires,
      },
    })

    // send verification email (best-effort)
    try {
      const { sendVerificationEmail } = await import('@/lib/mailer')
      if (user.email) await sendVerificationEmail(user.email, token)
    } catch (err) {
      console.error('Failed sending verification email', err)
    }

    return NextResponse.json({ ok: true, user, profile })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
