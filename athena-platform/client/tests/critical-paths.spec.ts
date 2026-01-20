import { test, expect, Page } from '@playwright/test';

/**
 * Step 95: E2E Testing Suite - Critical User Flows
 * Covers: User → Mentor → Payment loop as specified in Phase 5
 */

test.describe('Critical Path: User to Mentor to Payment', () => {
  let userPage: Page;
  const testEmail = `e2e.user.${Date.now()}@athena-test.com`;
  const testPassword = 'TestPass123!@';

  test.beforeAll(async ({ browser }) => {
    userPage = await browser.newPage();
  });

  test.afterAll(async () => {
    await userPage.close();
  });

  test('1. User Registration', async () => {
    await userPage.goto('/register');
    
    // Fill registration form
    await userPage.getByPlaceholder('Jane').fill('E2E');
    await userPage.getByPlaceholder('Doe').fill('TestUser');
    await userPage.getByPlaceholder('you@example.com').fill(testEmail);
    await userPage.getByPlaceholder('••••••••').fill(testPassword);
    
    await userPage.getByRole('button', { name: 'Continue' }).click();
    
    // Select persona
    await expect(userPage.getByText('What brings you here?')).toBeVisible({ timeout: 10000 });
    await userPage.getByText('Early Career').click();
    await userPage.locator('#acceptTerms').check();
    await userPage.locator('button[type="submit"]').click();
    
    // Should redirect to onboarding
    await expect(userPage).toHaveURL(/\/onboarding/, { timeout: 15000 });
  });

  test('2. Complete Onboarding', async () => {
    await expect(userPage.getByRole('heading', { level: 1 })).toBeVisible();
    
    // Fill out onboarding steps (skills, interests, etc.)
    // Skip for now if possible, or complete minimal required fields
    const skipButton = userPage.getByRole('button', { name: /skip|later|continue/i });
    if (await skipButton.isVisible()) {
      await skipButton.click();
    }
    
    // Should eventually reach dashboard
    await expect(userPage).toHaveURL(/\/dashboard|\/feed/, { timeout: 20000 });
  });

  test('3. Browse Mentors', async () => {
    await userPage.goto('/mentors');
    
    // Wait for mentor list to load
    await expect(userPage.locator('[data-testid="mentor-card"]').first()).toBeVisible({ timeout: 10000 });
    
    // Verify mentor cards have required info
    const firstMentor = userPage.locator('[data-testid="mentor-card"]').first();
    await expect(firstMentor.locator('[data-testid="mentor-name"]')).toBeVisible();
    await expect(firstMentor.locator('[data-testid="mentor-rate"]')).toBeVisible();
  });

  test('4. View Mentor Profile', async () => {
    // Click on first mentor
    const firstMentor = userPage.locator('[data-testid="mentor-card"]').first();
    await firstMentor.click();
    
    // Should navigate to mentor profile
    await expect(userPage).toHaveURL(/\/mentors\/[a-z0-9-]+/);
    
    // Verify profile elements
    await expect(userPage.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(userPage.getByText(/\$\d+.*session/i)).toBeVisible(); // Rate
    await expect(userPage.getByRole('button', { name: /book|schedule/i })).toBeVisible();
  });

  test('5. Book Mentor Session', async () => {
    // Click book button
    await userPage.getByRole('button', { name: /book|schedule/i }).click();
    
    // Calendar/slot selection modal should appear
    await expect(userPage.locator('[data-testid="booking-modal"]')).toBeVisible({ timeout: 5000 });
    
    // Select first available slot
    const availableSlot = userPage.locator('[data-testid="time-slot"]:not([disabled])').first();
    await availableSlot.click();
    
    // Proceed to payment
    await userPage.getByRole('button', { name: /continue|proceed|confirm/i }).click();
    
    // Should show payment form or Stripe Elements
    await expect(userPage.locator('[data-testid="payment-form"], .StripeElement, iframe[name*="stripe"]')).toBeVisible({ timeout: 10000 });
  });

  test('6. Complete Payment (Test Mode)', async () => {
    // In test mode, use Stripe test card
    const stripeFrame = userPage.frameLocator('iframe[name*="stripe"]').first();
    
    // Fill test card details
    await stripeFrame.locator('[name="cardnumber"]').fill('4242424242424242');
    await stripeFrame.locator('[name="exp-date"]').fill('12/30');
    await stripeFrame.locator('[name="cvc"]').fill('123');
    
    // Submit payment
    await userPage.getByRole('button', { name: /pay|complete|book now/i }).click();
    
    // Wait for success
    await expect(userPage.getByText(/success|confirmed|booked/i)).toBeVisible({ timeout: 30000 });
  });

  test('7. Verify Booking Confirmation', async () => {
    // Navigate to user's bookings
    await userPage.goto('/dashboard/bookings');
    
    // Should see the booking
    await expect(userPage.locator('[data-testid="booking-item"]').first()).toBeVisible({ timeout: 10000 });
    
    // Verify booking details
    await expect(userPage.getByText(/upcoming|scheduled/i)).toBeVisible();
  });
});

test.describe('Video Feed Experience', () => {
  test('Load and interact with video feed', async ({ page }) => {
    // Login first (use API to speed up)
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('test@athena.app');
    await page.getByPlaceholder('••••••••').fill('TestPass123!');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    
    await expect(page).toHaveURL(/\/dashboard|\/feed/, { timeout: 15000 });
    
    // Navigate to video feed
    await page.goto('/feed/explore');
    
    // Wait for videos to load
    await expect(page.locator('video').first()).toBeVisible({ timeout: 10000 });
    
    // Like a video
    const likeButton = page.locator('[data-testid="like-button"]').first();
    await likeButton.click();
    await expect(likeButton).toHaveAttribute('data-liked', 'true');
    
    // Scroll to next video
    await page.keyboard.press('ArrowDown');
    
    // Verify new video loaded
    await expect(page.locator('video').nth(1)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Chat Functionality', () => {
  test('Send and receive messages', async ({ page, browser }) => {
    // Create second user context for receiving messages
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    // Login user 1
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('user1@athena.app');
    await page.getByPlaceholder('••••••••').fill('TestPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard|\/feed/, { timeout: 15000 });
    
    // Login user 2
    await page2.goto('/login');
    await page2.getByPlaceholder('you@example.com').fill('user2@athena.app');
    await page2.getByPlaceholder('••••••••').fill('TestPass123!');
    await page2.getByRole('button', { name: /sign in/i }).click();
    await expect(page2).toHaveURL(/\/dashboard|\/feed/, { timeout: 15000 });
    
    // User 1 opens chat with User 2
    await page.goto('/messages');
    await page.getByRole('button', { name: /new message|compose/i }).click();
    await page.getByPlaceholder(/search|recipient/i).fill('user2');
    await page.locator('[data-testid="user-search-result"]').first().click();
    
    // Send message
    const testMessage = `E2E test message ${Date.now()}`;
    await page.getByPlaceholder(/type a message/i).fill(testMessage);
    await page.getByRole('button', { name: /send/i }).click();
    
    // Verify message sent
    await expect(page.getByText(testMessage)).toBeVisible();
    
    // User 2 should receive the message
    await page2.goto('/messages');
    await expect(page2.getByText(testMessage)).toBeVisible({ timeout: 10000 });
    
    await context2.close();
  });
});

test.describe('Job Application Flow', () => {
  test('Search and apply for a job', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('test@athena.app');
    await page.getByPlaceholder('••••••••').fill('TestPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard|\/feed/, { timeout: 15000 });
    
    // Navigate to jobs
    await page.goto('/jobs');
    
    // Search for a job
    await page.getByPlaceholder(/search jobs/i).fill('software engineer');
    await page.keyboard.press('Enter');
    
    // Wait for results
    await expect(page.locator('[data-testid="job-card"]').first()).toBeVisible({ timeout: 10000 });
    
    // Click on first job
    await page.locator('[data-testid="job-card"]').first().click();
    
    // Should be on job detail page
    await expect(page).toHaveURL(/\/jobs\/[a-z0-9-]+/);
    
    // Click apply
    await page.getByRole('button', { name: /apply|quick apply/i }).click();
    
    // Fill application (if required)
    const coverLetterInput = page.locator('[data-testid="cover-letter"]');
    if (await coverLetterInput.isVisible()) {
      await coverLetterInput.fill('I am excited to apply for this position...');
    }
    
    // Submit application
    await page.getByRole('button', { name: /submit|send application/i }).click();
    
    // Verify success
    await expect(page.getByText(/application.*submitted|success/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('GDPR Compliance', () => {
  test('Cookie consent banner functionality', async ({ page }) => {
    // Clear cookies and visit site
    await page.context().clearCookies();
    await page.goto('/');
    
    // Cookie banner should appear
    const cookieBanner = page.locator('[data-testid="cookie-banner"], [role="dialog"][aria-label*="cookie"]');
    await expect(cookieBanner).toBeVisible({ timeout: 5000 });
    
    // Click manage preferences
    await page.getByRole('button', { name: /preferences|customize|manage/i }).click();
    
    // Should show preference options
    await expect(page.getByText(/analytics|performance/i)).toBeVisible();
    await expect(page.getByText(/marketing|advertising/i)).toBeVisible();
    
    // Accept only essential
    await page.getByRole('button', { name: /reject|essential only/i }).click();
    
    // Banner should close
    await expect(cookieBanner).not.toBeVisible();
    
    // Verify analytics cookies not set
    const cookies = await page.context().cookies();
    const analyticsCookies = cookies.filter(c => c.name.includes('_ga') || c.name.includes('analytics'));
    expect(analyticsCookies.length).toBe(0);
  });

  test('Data export request (DSAR)', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('test@athena.app');
    await page.getByPlaceholder('••••••••').fill('TestPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard|\/feed/, { timeout: 15000 });
    
    // Navigate to privacy settings
    await page.goto('/dashboard/settings/privacy');
    
    // Click export data
    await page.getByRole('button', { name: /export|download.*data/i }).click();
    
    // Confirm export
    await page.getByRole('button', { name: /confirm|yes/i }).click();
    
    // Should show success message
    await expect(page.getByText(/request.*received|processing|email/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Accessibility', () => {
  test('Keyboard navigation works', async ({ page }) => {
    await page.goto('/');
    
    // Tab through main navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should have visible focus indicator
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Enter should activate focused element
    await page.keyboard.press('Enter');
    
    // Should have navigated
    expect(page.url()).not.toBe('/');
  });

  test('Screen reader landmarks present', async ({ page }) => {
    await page.goto('/');
    
    // Check for main landmarks
    await expect(page.locator('main, [role="main"]')).toBeVisible();
    await expect(page.locator('nav, [role="navigation"]')).toBeVisible();
    await expect(page.locator('header, [role="banner"]')).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('Page load performance', async ({ page }) => {
    // Measure navigation timing
    await page.goto('/');
    
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        ttfb: nav.responseStart - nav.requestStart,
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
        load: nav.loadEventEnd - nav.startTime,
      };
    });
    
    // Assert reasonable load times
    expect(timing.ttfb).toBeLessThan(500); // TTFB < 500ms
    expect(timing.domContentLoaded).toBeLessThan(3000); // DOMContentLoaded < 3s
    expect(timing.load).toBeLessThan(5000); // Full load < 5s
  });

  test('Largest Contentful Paint', async ({ page }) => {
    await page.goto('/');
    
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        
        // Fallback timeout
        setTimeout(() => resolve(2500), 5000);
      });
    });
    
    // LCP should be under 2.5s for good user experience
    expect(lcp).toBeLessThan(2500);
  });
});
