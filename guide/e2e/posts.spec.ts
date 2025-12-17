import { test, expect } from '@playwright/test'

// Skip if seed/DB is intentionally disabled
test.skip(process.env.PLAYWRIGHT_SKIP_SEED === '1', 'DB not available for e2e')

test('creates a post with image (optimistic UI)', async ({ page }) => {
  // Sign in first
  await page.goto('/auth/signin')
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')

  // Go to feed
  await page.goto('/social/feed')
  await expect(page.getByRole('heading', { name: 'Social feed' })).toBeVisible()

  const unique = `E2E post ${Date.now()}`

  // Fill create form
  await page.fill('textarea[placeholder="Share something..."]', unique)
  const filePath = 'e2e/fixtures/test-image.png'
  await page.setInputFiles('input[type="file"]', filePath)

  // Click Post and expect optimistic post to show immediately
  await page.click('button:has-text("Post")')

  // Temp post should show Posting… badge
  const postLocator = page.locator(`text=${unique}`).first()
  await expect(postLocator).toBeVisible()
  await expect(postLocator.locator('text=Posting…')).toBeVisible()

  // Wait for server to confirm and replace the temp post (Posting… should disappear)
  await expect(postLocator.locator('text=Posting…')).toBeHidden({ timeout: 5000 })

  // Check that image is visible and is not a blob URL (server URL)
  const img = postLocator.locator('img[alt="post media"]')
  await expect(img).toBeVisible()
  const src = await img.getAttribute('src')
  expect(src && !src.startsWith('blob:')).toBeTruthy()

  // Fetch the post via the API and verify it exists
  const postId = await postLocator.getAttribute('data-post-id')
  const postJson = await page.evaluate(async (id) => {
    const r = await fetch(`/api/posts/${id}`)
    return r.json()
  }, postId)
  expect(postJson.post).toBeDefined()
  expect(postJson.post.content).toContain('E2E post')

  // Delete the post via the API (owner) and confirm it is removed
  const delRes = await page.evaluate(async (id) => {
    const r = await fetch(`/api/posts/${id}`, { method: 'DELETE' })
    return r.json()
  }, postId)
  expect(delRes.ok).toBeTruthy()

  // Confirm the post is no longer present in the feed
  await expect(page.locator(`text=${unique}`)).toBeHidden({ timeout: 5000 })

  // Add a comment via the comments UI
  const commentText = `Nice post ${Date.now()}`
  await postLocator.locator('textarea').fill(commentText)
  await postLocator.locator('button:has-text("Comment")').click()

  // New comment should appear
  await expect(postLocator.locator(`text=${commentText}`)).toBeVisible({ timeout: 5000 })

  // Toggle like and verify it updates
  const likeBtn = postLocator.locator('button:has-text("Like")').first()
  await likeBtn.click()
  await expect(postLocator.locator('text=Liked')).toBeVisible({ timeout: 3000 })

  // Unlike
  await likeBtn.click()
  await expect(postLocator.locator('text=Liked')).toBeHidden({ timeout: 3000 })
})