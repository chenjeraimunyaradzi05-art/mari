import { NextResponse } from 'next/server'

export async function GET() {
  // currently not implemented; return disabled state
  return NextResponse.json({ enabled: false })
}
