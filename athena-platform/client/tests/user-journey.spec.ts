import { test, expect } from '@playwright/test';

async function dismissCookieBanner(page: import('@playwright/test').Page) {
  const rejectOptional = page.getByRole('button', { name: /reject optional/i });
  const acceptAll = page.getByRole('button', { name: /accept all/i });
  const closeButton = page.getByRole('button', { name: /close/i });
  const banner = page.locator('[data-testid="cookie-banner"], [aria-label*="cookie" i]');
  const backdrop = page.locator('.fixed.inset-x-0.bottom-0');

  if (await rejectOptional.count()) {
    await rejectOptional.click();
  } else if (await acceptAll.count()) {
    await acceptAll.click();
  } else if (await closeButton.count()) {
    await closeButton.click();
  }

  if (await banner.count()) {
    await expect(banner.first()).not.toBeVisible({ timeout: 5000 });
  }

  if (await backdrop.count()) {
    await backdrop.first().evaluate((el) => {
      (el as HTMLElement).style.display = 'none';
      (el as HTMLElement).style.pointerEvents = 'none';
    });
  }

  await page.evaluate(() => {
    const cookieDialogs = document.querySelectorAll('[data-testid="cookie-banner"], [aria-label*="cookie" i]');
    cookieDialogs.forEach((node) => {
      const el = node as HTMLElement;
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
    });
  });
}

test.describe('User Journey: Registration to Persona Dashboard', () => {
  
  test('Complete registration flow', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
    await dismissCookieBanner(page);

    // Fill personal details
    await page.getByPlaceholder('Jane').fill('Test');
    await page.getByPlaceholder('Doe').fill('User');
    
    // Generate unique email per run
    const randomEmail = `test.user.${Date.now()}@example.com`;
    await page.getByPlaceholder('you@example.com').fill(randomEmail);

    // Ensure client-side handlers are hydrated before submit.
    const passwordInput = page.locator('#password');
    const passwordToggle = page.locator('#password + button');
    await passwordToggle.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await passwordToggle.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    await page.getByLabel('Password', { exact: true }).fill('Password123!'); // Meets requirements
    await page.getByLabel('Confirm Password').fill('Password123!');
    await dismissCookieBanner(page);
    await page.getByLabel(/i confirm that i am a woman/i).check({ force: true });
    
    // Submit registration
    await dismissCookieBanner(page);
    await page.getByRole('button', { name: /create account/i }).click({ force: true });
    
    // Expect redirect into first-run onboarding after auth bootstrap
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20000 });

    // Verify the new-member welcome state loaded
    await expect(page.getByRole('heading', { name: /welcome to athena/i })).toBeVisible();
  });

});
