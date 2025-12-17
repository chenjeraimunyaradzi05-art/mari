import { test, expect } from '@playwright/test'

test('create incident report and quick-action block', async ({ page, request }) => {
  const ua = `inc-a+${Date.now()}@example.com`
  const ub = `inc-b+${Date.now()}@example.com`

  await request.post('/api/auth/register', { data: { email: ua, password: 'Password123!', name: 'Inc A' } })
  const resB = await request.post('/api/auth/register', { data: { email: ub, password: 'Password123!', name: 'Inc B' } })
  const jB = await resB.json()

  // sign in as reporter
  await page.goto('/auth/signin')
  await page.fill('input[type="email"]', ua)
  await page.fill('input[type="password"]', 'Password123!')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')

  // Call the incidents API from the browser context so the session cookie is included
  const incJson = await page.evaluate(async (body) => {
    const res = await fetch('/api/incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { status: res.status, json: await res.json() }
  }, { subjectId: jB.user?.id, category: 'abuse', description: 'E2E incident', actions: { block: true } })

  expect([200,201,202].includes(incJson.status)).toBeTruthy()
  expect(incJson.json.incident).toBeDefined()
})
