import { test, expect } from '@playwright/test'

test('comments and likes flow', async ({ page }) => {
  const email = 'test@example.com'
  await page.goto('/auth/signin')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')

  await page.goto('/social/feed')
  const content = `E2E comment ${Date.now()}`
  // create a post
  await page.fill('textarea', content)
  await page.click('button[type="submit"]')
  await expect(page.locator('text=' + content)).toBeVisible({ timeout: 5000 })

  const post = page.locator(`text=${content}`).first()
  // comment
  await post.locator('textarea').fill('Nice post')
  await post.locator('button', { hasText: 'Comment' }).click()
  await expect(post.locator('text=Nice post')).toBeVisible({ timeout: 5000 })

  // like
  const likeBtn = post.locator('button', { hasText: 'Like' })
  await likeBtn.click()
  await expect(post.locator('text=Liked')).toBeVisible({ timeout: 5000 })
})