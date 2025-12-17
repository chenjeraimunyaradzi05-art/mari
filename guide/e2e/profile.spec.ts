import { test, expect } from '@playwright/test'
import path from 'path'

const EMAIL = 'test@example.com'
const PASSWORD = 'password123'

test('sign in, update profile, upload avatar, save and verify', async ({ page }) => {
  // Sign in
  await page.goto('/auth/signin')
  await expect(page.locator('form')).toBeVisible()
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  // Wait for home contents to appear (may take a moment while server responds)
  await page.waitForSelector('text=PoC Active', { timeout: 60000 })

  // Go to profile page
  await page.goto('/profile')
  await expect(page.locator('h1')).toHaveText('Profile')

  // Set a unique handle to avoid collisions
  const handle = `e2e-${Date.now()}`
  await page.fill('input[placeholder] ~ input, input[type="text"]', '')
  // Fill the handle field specifically by label
  await page.fill('label:has-text("Handle") + input', handle)

  // Upload avatar via file input (first file input is avatar)
  const avatarPath = path.join(__dirname, 'assets', 'avatar.png')
  const fileInputs = page.locator('input[type="file"]')
  await fileInputs.first().setInputFiles(avatarPath)

  // Wait for uploaded result marker (Saved occurs later) and preview to update
  await page.waitForSelector('img[alt="avatar"]', { timeout: 60000 })

  // Save
  await page.click('button:has-text("Save profile")')
  await expect(page.locator('text=Saved')).toBeVisible()

  // Reload and verify persisted values
  await page.reload()
  // The avatar preview or saved profile should contain uploads path
  const avatar = page.locator('img[alt="avatar"]')
  await expect(avatar).toBeVisible()
  const src = await avatar.getAttribute('src')
  expect(src).toContain('/uploads/profiles/')

  // Ensure the handle field persists
  const handleVal = await page.locator('label:has-text("Handle") + input').inputValue()
  expect(handleVal).toBe(handle)
})
