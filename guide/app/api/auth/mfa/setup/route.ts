import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Not implemented', message: 'MFA setup requires Prisma model additions and TOTP support' }, { status: 501 })
}

export async function POST() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
}
