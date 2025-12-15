import { POST } from '../../src/app/api/onboarding/route'

describe('POST /api/onboarding', () => {
  test('returns 201 and stores onboarding for valid payload', async () => {
    const payload = { name: 'Alice Example', role: 'member', email: 'alice@example.com' }
    const req = new Request('http://localhost/api/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.onboarding).toBeDefined()
    expect(json.onboarding.payload.name).toBe(payload.name)
  })

  test('returns 422 for invalid payload', async () => {
    const payload = { name: 'A', role: 'unknown', email: 'not-an-email' }
    const req = new Request('http://localhost/api/onboarding', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const res = await POST(req as any)
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.errors).toBeDefined()
    expect(json.errors.name).toBeDefined()
    expect(json.errors.role).toBeDefined()
    expect(json.errors.email).toBeDefined()
  })
})
