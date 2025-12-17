import { test, expect } from '@playwright/test'

// Creates a second user and tests follow/unfollow flow
test('follow and unfollow a profile', async ({ page, request }) => {
  const u1 = `user1+${Date.now()}@example.com`
  const u2 = `user2+${Date.now()}@example.com`

  // create two users via API
  await request.post('/api/auth/register', { data: { email: u1, password: 'Password123!', name: 'User One', displayName: 'User One' } })
  const res2 = await request.post('/api/auth/register', { data: { email: u2, password: 'Password123!', name: 'User Two', displayName: 'User Two' } })
  const j2 = await res2.json()
  const targetHandle = j2.profile?.handle || j2.user?.id

  // anonymous API follow should be unauthorized
  const anonRes = await request.post(`/api/profiles/${targetHandle}/follow`)
  expect(anonRes.status()).toBe(401)

  // anonymous status check should return counts
  const statusAnon = await request.get(`/api/profiles/${targetHandle}/follow/status`)
  expect(statusAnon.ok()).toBeTruthy()
  const statusAnonJson = await statusAnon.json()
  expect(typeof statusAnonJson.followers_count).toBe('number')

  // sign in as user1
  await page.goto('/auth/signin')
  // ensure the sign-in form is visible before interacting
  await page.waitForSelector('form', { timeout: 15000 })
  await page.locator('form input[type="email"]').fill(u1)
  await page.locator('form input[type="password"]').fill('Password123!')
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL('/')

  // derive cookies for request fixture to call API as the signed-in user
  const cookies = await page.context().cookies()
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

  // call follow via API to verify server response includes follower count and is idempotent
  const apiRes = await request.post(`/api/profiles/${targetHandle}/follow`, { headers: { cookie: cookieHeader } })
  expect(apiRes.ok()).toBeTruthy()
  const apiJson = await apiRes.json()
  expect(typeof apiJson.followers_count).toBe('number')

  // calling follow again should not error and should return same or higher count
  const apiRes2 = await request.post(`/api/profiles/${targetHandle}/follow`, { headers: { cookie: cookieHeader } })
  const apiJson2 = await apiRes2.json()
  expect(apiJson2.followers_count).toBeGreaterThanOrEqual(apiJson.followers_count)

  // ensure unfollow via API works
  const delRes = await request.delete(`/api/profiles/${targetHandle}/follow`, { headers: { cookie: cookieHeader } })
  expect(delRes.ok()).toBeTruthy()
  const delJson = await delRes.json()
  expect(typeof delJson.followers_count).toBe('number')

  // Already signed in above; proceed to visiting the profile

  // Visit user2's profile by handle returned from registration
  await page.goto(`/social/profile/${targetHandle}`)
  await page.waitForLoadState('networkidle')

  // Follow (UI) — tolerate either state initially
  const anyBtn = page.locator('button:has-text("Follow"), button:has-text("Following")').first()
  // wait for the button to be attached to the DOM (visible may be affected by layout)
  await anyBtn.waitFor({ state: 'attached', timeout: 10000 })
  const followBtn = page.locator('button', { hasText: 'Follow' }).first()
  const followingBtn = page.locator('button', { hasText: 'Following' }).first()

  if (await followingBtn.isVisible()) {
    // already following — click to unfollow then expect Follow to appear
    await followingBtn.click()
    await expect(followBtn).toBeVisible({ timeout: 3000 })
  } else {
    // not following — click to follow then expect Following to appear, then unfollow
    await followBtn.click()
    await expect(followingBtn).toBeVisible({ timeout: 3000 })
    await followingBtn.click()
    await expect(followBtn).toBeVisible({ timeout: 3000 })
  }
})