import { test, expect } from '@playwright/test'

test('profile privacy settings saved and persisted', async ({ page, request }) => {
  const email = `ps+${Date.now()}@example.com`
  const res = await request.post('/api/auth/register', { data: { email, password: 'Password123!', name: 'PS User' } })
  const j = await res.json()

  await page.goto('/auth/signin')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', 'Password123!')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')

  await page.goto('/profile')
  // set resume privacy to private
  await page.selectOption('select', 'private')
  await page.click('button:has-text("Save profile")')
  await page.waitForTimeout(500)

  // fetch profile via API and check privacySettings
  const r = await request.get('/api/profile')
  const json = await r.json()
  expect(json.profile.privacySettings?.resume === 'private' || json.profile.privacySettings?.resume === 'private').toBeTruthy()
})
