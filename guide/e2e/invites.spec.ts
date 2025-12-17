import { test, expect } from '@playwright/test'

// Invite flow: user A sends invite to user B email, user B accepts via API
test('invite and accept flow', async ({ page, request }) => {
  const uA = `ia+${Date.now()}@example.com`
  const uB = `ib+${Date.now()}@example.com`

  // Register both accounts
  await request.post('/api/auth/register', { data: { email: uA, password: 'Password123!', name: 'A', displayName: 'A' } })
  const resB = await request.post('/api/auth/register', { data: { email: uB, password: 'Password123!', name: 'B', displayName: 'B' } })
  const jB = await resB.json()

  // Sign in as A and create an invite to B
  await page.goto('/auth/signin')
  await page.fill('input[type="email"]', uA)
  await page.fill('input[type="password"]', 'Password123!')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')

  const inviteRes = await request.post('/api/invites', { data: { targetEmail: uB, message: 'Join me' } })
  expect(inviteRes.ok()).toBeTruthy()
  const inviteJson = await inviteRes.json()
  const inviteId = inviteJson.invite?.id
  expect(inviteId).toBeDefined()

  // Sign out A, sign in B
  await page.click('text=Sign Out')
  await page.fill('input[type="email"]', uB)
  await page.fill('input[type="password"]', 'Password123!')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')

  // Accept invite via API (B)
  const acceptRes = await request.post(`/api/invites/${inviteId}/accept`)
  expect(acceptRes.ok()).toBeTruthy()
  const acceptJson = await acceptRes.json()
  expect(acceptJson.ok).toBeTruthy()
  expect(acceptJson.connection).toBeDefined()
})