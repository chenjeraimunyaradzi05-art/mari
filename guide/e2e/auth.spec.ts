import { test, expect } from '@playwright/test'

test('signs in and accesses dashboard', async ({ page }) => {


  // Go to sign-in page
  await page.goto('/auth/signin')

  // Fill form and submit
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'password123')
  await page.click('button[type="submit"]')

  // After sign-in we expect to be redirected back to home
  await page.waitForURL('/')

  // Confirm user is shown as logged in on the home page
  await expect(page.locator('text=Logged in as')).toBeVisible()
  await expect(page.locator('text=test@example.com')).toBeVisible()

  // Navigate to protected dashboard page
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: '✅ Protected Page' })).toBeVisible()
  await expect(page.locator('p', { hasText: 'Email:' }).locator('code')).toContainText('test@example.com')
})

// Register + verify flow
import { prisma } from '../lib-prisma'

test('register then verify', async ({ page, request, baseURL }) => {
  const email = `e2e+${Date.now()}@example.com`
  const res = await request.post(`${baseURL}/api/auth/register`, {
    data: { email, password: 'Password123!', name: 'E2E User' },
  })
  expect(res.ok()).toBeTruthy()

  // fetch token from DB
  const tokenRecord = await prisma.verificationToken.findFirst({ where: { identifier: email } })
  expect(tokenRecord).toBeTruthy()
  const token = tokenRecord?.token
  expect(token).toBeTruthy()

  // open verification page
  await page.goto(`/auth/verify?token=${token}`)
  await expect(page.locator('text=Email verified')).toBeVisible()

  // try signing in with credentials
  await page.goto('/auth/signin')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', 'Password123!')
  await page.click('button[type="submit"]')

  // after sign in we should be redirected to home
  await expect(page).toHaveURL(/\//)
})
