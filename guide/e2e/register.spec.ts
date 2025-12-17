import { test, expect } from '@playwright/test'

test('registers a user and rejects duplicate email', async ({ request }) => {
  const unique = `user+${Date.now()}@example.com`
  const res = await request.post('/api/auth/register', {
    data: { email: unique, password: 'Password123!', name: 'Tester', displayName: 'Tester' },
  })
  expect(res.ok()).toBeTruthy()
  const res2 = await request.post('/api/auth/register', {
    data: { email: unique, password: 'Password123!', name: 'Tester2' },
  })
  expect(res2.ok()).toBeFalsy()
  const json = await res2.json()
  expect(json.error).toBeDefined()
})