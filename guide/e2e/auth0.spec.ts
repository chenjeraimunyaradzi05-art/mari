import { test, expect } from '@playwright/test'

test('auth0 and social endpoints return 501', async ({ request }) => {
  const a = await request.get('/api/auth/auth0/login')
  expect(a.status()).toBe(501)

  const s = await request.post('/api/auth/social', { data: {} })
  expect(s.status()).toBe(501)
})