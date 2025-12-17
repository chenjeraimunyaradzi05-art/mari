import { test, expect } from '@playwright/test'

test('signs out successfully', async ({ page }) => {
  // Sign in first
  await page.goto('/auth/signin')
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')

  // Confirm logged in
  await expect(page.locator('text=Logged in as')).toBeVisible()
  await expect(page.locator('text=test@example.com')).toBeVisible()

  // Click Sign Out and complete the confirmation form
  await page.click('text=Sign Out')
  // Wait for the signout confirmation form and submit it
  await page.waitForSelector('form[action*="/api/auth/signout"] button#submitButton')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load' }),
    page.click('button#submitButton'),
  ])

  // Visiting /dashboard should redirect to sign-in (confirms sign-out)
  await page.goto('/dashboard')
  await page.waitForURL('/auth/signin')
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()

  // The home page should show 'Not authenticated' after sign out (may take a moment)
  await page.goto('/')
  await expect(page.locator('text=Not authenticated')).toBeVisible({ timeout: 5000 })
})


test('shows error on invalid credentials', async ({ page }) => {
  await page.goto('/auth/signin')

  // Submit wrong password
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'wrongpassword')
  await page.click('button[type="submit"]')

  // Expect an error message to appear on the sign-in page
  await expect(page.locator('text=Invalid credentials')).toBeVisible()
})