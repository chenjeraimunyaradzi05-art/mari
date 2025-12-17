import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Not implemented', message: 'Social auth handlers are application specific' }, { status: 501 })
}
