import { test, expect } from '@playwright/test';

test('homepage exposes futuristic launch console and production signals', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /career command center/i })).toBeVisible();
  await expect(page.getByText(/ATHENA Signal Console/i)).toBeVisible();
  await expect(page.getByText(/Neon linked/i)).toBeVisible();
  await expect(page.getByText(/Netlify ready/i)).toBeVisible();
  await expect(page.getByText(/Prod audit clean/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /start your workspace/i })).toBeVisible();
});

test('login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('dashboard redirects to login when unauthenticated', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/dashboard');

  // Next middleware should redirect unauthenticated users to /login?redirect=/dashboard
  await expect(page).toHaveURL(/\/login(\?.*)?$/);
  await expect(page).toHaveURL(/redirect=%2Fdashboard/);
});

test('jobs page shows spotlight fallback when live sync fails', async ({ page }) => {
  await page.route('**/api/jobs**', async (route) => {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Backend unavailable' }),
    });
  });

  await page.goto('/jobs');

  await expect(page.getByText(/live sync temporarily unavailable/i)).toBeVisible();
  await expect(page.getByText(/curated spotlight mode/i)).toBeVisible();
  await expect(page.getByText(/product operations lead/i)).toBeVisible();
});

test('feed page shows curated fallback when live feed fails', async ({ page }) => {
  await page.goto('/feed?demoFallback=1');

  await expect(page.getByText(/live community posts are reconnecting/i)).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(/career momentum grows faster/i)).toBeVisible({
    timeout: 15000,
  });
});

test('api feed alias returns fallback payload for public clients', async ({ request }) => {
  const response = await request.get('/api/feed');
  expect(response.ok()).toBeTruthy();
  expect(response.headers()['x-athena-fallback']).toBe('1');

  const payload = await response.json();
  expect(Array.isArray(payload.data)).toBeTruthy();
  expect(payload.meta?.fallback).toBeTruthy();
});

test('explore page renders fallback videos when live feed is unavailable', async ({ page }) => {
  await page.route('**/api/video/feed**', async (route) => {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Backend unavailable' }),
    });
  });

  await page.goto('/explore');

  await expect(page.getByTestId('video-feed')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('video-player').first()).toBeVisible({ timeout: 15000 });
});

test('manifest only references launch assets that exist', async ({ request }) => {
  const manifestResponse = await request.get('/manifest.json');
  expect(manifestResponse.ok()).toBeTruthy();

  const manifest = await manifestResponse.json();
  const shortcutIcons = (manifest.shortcuts || []).flatMap(
    (shortcut: { icons?: Array<{ src: string }> }) => shortcut.icons || []
  );
  const assetRefs = [...(manifest.icons || []), ...shortcutIcons];

  for (const asset of assetRefs) {
    const assetResponse = await request.get(asset.src);
    expect(assetResponse.ok(), asset.src).toBeTruthy();
  }
});
