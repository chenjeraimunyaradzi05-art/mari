import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Not implemented', message: 'Auth0 SSO requires configuration and Auth0 SDK integration' }, { status: 501 })
}
