import { test, expect } from '@playwright/test'

test('create conversation and send messages', async ({ page, request }) => {
  const ua = `mess-a+${Date.now()}@example.com`
  const ub = `mess-b+${Date.now()}@example.com`

  const resA = await request.post('/api/auth/register', { data: { email: ua, password: 'Password123!', name: 'Mess A' } })
  const jA = await resA.json()
  const resB = await request.post('/api/auth/register', { data: { email: ub, password: 'Password123!', name: 'Mess B' } })
  const jB = await resB.json()

  // sign in as A
  await page.goto('/auth/signin')
  await page.fill('input[type="email"]', ua)
  await page.fill('input[type="password"]', 'Password123!')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')

  // create conversation with B using page context so cookies are present
  const conv = await page.evaluate(async (pid) => {
    const r = await fetch('/api/conversations', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantIds: [pid], initialMessage: 'Hi there' }) })
    return r.json()
  }, jB.user.id)

  expect(conv.conversation).toBeDefined()
  const convId = conv.conversation.id

  // Visit conversation page and ensure initial message is visible
  await page.goto(`/conversations/${convId}`)
  await expect(page.locator('text=Hi there')).toBeVisible()

  // Send a reply via compose form
  await page.fill('textarea', 'Reply from A')
  await page.click('button:has-text("Send")')

  // After reload, reply should be visible
  await expect(page.locator('text=Reply from A')).toBeVisible()
})
