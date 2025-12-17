import { test, expect } from '@playwright/test'

test('mfa endpoints return not implemented or disabled', async ({ request }) => {
  const setup = await request.get('/api/auth/mfa/setup')
  expect(setup.status()).toBe(501)

  const post = await request.post('/api/auth/mfa/setup', { data: {} })
  expect(post.status()).toBe(501)

  const verify = await request.post('/api/auth/mfa/verify', { data: { code: '000000' } })
  expect(verify.status()).toBe(501)

  const status = await request.get('/api/auth/mfa/status')
  expect(status.ok()).toBeTruthy()
  const json = await status.json()
  expect(json.enabled).toBe(false)
})