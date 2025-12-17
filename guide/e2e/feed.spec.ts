import { test, expect } from '@playwright/test'
import { prisma } from '../lib-prisma'

test('creates a post and sees it in the feed', async ({ page, request, baseURL }) => {
  // Use seeded user
  const email = 'test@example.com'

  // go to sign-in and sign in
  await page.goto('/auth/signin')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')

  // navigate to feed
  await page.goto('/social/feed')
  const content = `E2E post ${Date.now()}`
  await page.fill('textarea', content)
  await page.click('button[type="submit"]')

  // verify new post appears
  await expect(page.locator('text=' + content)).toBeVisible({ timeout: 5000 })
})
