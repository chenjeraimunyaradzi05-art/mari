import { test, expect } from '@playwright/test';

test('homepage exposes futuristic launch console and production signals', async ({ page }) => {
  await page.goto('/');

  // React streams this page in two passes, so a text locator can briefly match
  // both the fallback and the streamed-in copy. .first() keeps these assertions
  // about the content rather than about hydration timing.

  await expect(page.getByRole('heading', { name: /career command center/i }).first()).toBeVisible();
  await expect(page.getByText(/ATHENA Signal Console/i).first()).toBeVisible();
  await expect(page.getByText(/Neon linked/i).first()).toBeVisible();
  await expect(page.getByText(/Netlify ready/i).first()).toBeVisible();
  await expect(page.getByText(/Prod audit clean/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /start your workspace/i }).first()).toBeVisible();
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
