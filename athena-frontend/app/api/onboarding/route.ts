import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()
  const backend = process.env.MOCK_API_URL || process.env.NEXT_PUBLIC_MOCK_API_URL || 'http://localhost:4001'
  const url = `${backend}/api/onboarding`
  // Forward Authorization header if present
  const auth = request.headers.get('authorization')
  const headers: any = { 'Content-Type': 'application/json' }
  if (auth) headers['Authorization'] = auth

  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const json = await res.json()
    return NextResponse.json(json, { status: res.status })
  } catch (e) {
    console.error('Onboarding forward failed', e)
    return NextResponse.json({ ok: false, error: 'forward failed' }, { status: 502 })
  }
}
