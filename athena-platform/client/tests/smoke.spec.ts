import { test, expect } from '@playwright/test';

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
