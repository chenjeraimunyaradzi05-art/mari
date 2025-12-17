import { test, expect } from '@playwright/test'

test('mention creates notification and can be read', async ({ page, request }) => {
  const a = `not-a+${Date.now()}@example.com`
  const b = `not-b+${Date.now()}@example.com`

  // create users with handles
  await request.post('/api/auth/register', { data: { email: a, password: 'Password123!', name: 'A', handle: 'usera' } })
  await request.post('/api/auth/register', { data: { email: b, password: 'Password123!', name: 'B', handle: 'userb' } })

  // sign in as A and create a post mentioning @userb
  await page.goto('/auth/signin')
  await page.fill('input[type="email"]', a)
  await page.fill('input[type="password"]', 'Password123!')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')

  // create post via API with mention
  await page.evaluate(async () => {
    await fetch('/api/posts', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'Hello @userb this mentions you' }) })
  })

  // sign in as B to see notifications
  await page.goto('/auth/signin')
  await page.fill('input[type="email"]', b)
  await page.fill('input[type="password"]', 'Password123!')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')

  // navigate to notifications page
  await page.goto('/notifications')
  await expect(page.locator('text=mention')).toBeVisible()
})
