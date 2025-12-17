import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as unknown as { id?: string })?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const targetEmail = String(body.targetEmail || '').trim()
    const message = body.message || null
    if (!targetEmail) return NextResponse.json({ error: 'targetEmail required' }, { status: 400 })

    const token = randomBytes(24).toString('hex')
    const invite = await prisma.invite.create({ data: { senderId: userId, targetEmail, token, message } })

    // TODO: enqueue email send via mailer/queue
    return NextResponse.json({ invite })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
