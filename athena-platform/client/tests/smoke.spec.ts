import { test, expect } from '@playwright/test';

test('homepage exposes theme toggle, launch matrix, and AI launcher', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /career superapp/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dark' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Light' })).toBeVisible();
  await expect(page.getByRole('link', { name: /open athena ai assistant/i })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
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
  await expect(page.getByText(/curated fallback mode/i)).toBeVisible();
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
