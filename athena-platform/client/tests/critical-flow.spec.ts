import { test, expect } from '@playwright/test';

test('critical user flow: login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /welcome|sign in|login/i })).toBeVisible();
});
