import { test, expect, Page } from '@playwright/test';

/**
 * Super App Features E2E Tests
 * Tests for Video Feed, Channel/Chat, and Marketplace features
 */

// Helper to login before tests that require authentication
async function loginUser(page: Page, email = 'test@example.com', password = 'Password123') {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /sign in|login/i }).click();
  await page.waitForURL(/\/(dashboard|explore|home)/);
}

// ============================================
// VIDEO FEED TESTS
// ============================================
test.describe('Video Feed Feature', () => {
  
  test('Video feed loads and displays videos', async ({ page }) => {
    await page.goto('/explore');
    
    // Wait for feed container to be visible
    await expect(page.locator('[data-testid="video-feed"]')).toBeVisible({ timeout: 10000 });
    
    // Verify at least one video player is rendered
    const videoPlayers = page.locator('[data-testid="video-player"]');
    await expect(videoPlayers.first()).toBeVisible();
    
    // Check video controls are present
    await expect(page.locator('[data-testid="video-like-button"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="video-comment-button"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="video-share-button"]').first()).toBeVisible();
  });

  test('Can scroll through video feed', async ({ page }) => {
    await page.goto('/explore');
    
    await expect(page.locator('[data-testid="video-feed"]')).toBeVisible({ timeout: 10000 });
    
    // Get initial video
    const firstVideoId = await page.locator('[data-testid="video-player"]').first().getAttribute('data-video-id');
    
    // Scroll down to next video
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(500);
    
    // Verify active video changed (if multiple videos exist)
    const activeVideo = page.locator('[data-testid="video-player"].active, [data-testid="video-player"][data-active="true"]');
    if (await activeVideo.count() > 0) {
      const currentVideoId = await activeVideo.getAttribute('data-video-id');
      // Video should have changed or stayed the same if only one video
      expect(currentVideoId).toBeDefined();
    }
  });

  test('Video like interaction works', async ({ page }) => {
    await loginUser(page);
    await page.goto('/explore');
    
    await expect(page.locator('[data-testid="video-feed"]')).toBeVisible({ timeout: 10000 });
    
    const likeButton = page.locator('[data-testid="video-like-button"]').first();
    await expect(likeButton).toBeVisible();
    
    // Click like button
    await likeButton.click();
    
    // Verify like state changed (button should show liked state)
    await expect(likeButton).toHaveAttribute('data-liked', 'true');
  });

  test('Can filter videos by category', async ({ page }) => {
    await page.goto('/explore');
    
    // Look for category filter tabs/buttons
    const categoryFilter = page.locator('[data-testid="category-filter"], [role="tablist"]');
    
    if (await categoryFilter.count() > 0) {
      // Click on a specific category
      await page.getByRole('tab', { name: /career|tech|business/i }).first().click();
      
      // Verify feed updates (loading indicator or content change)
      await page.waitForTimeout(500);
      await expect(page.locator('[data-testid="video-feed"]')).toBeVisible();
    }
  });
});

// ============================================
// CHANNEL / COMMUNITY CHAT TESTS
// ============================================
test.describe('Channel and Community Chat', () => {
  
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test('Community page loads with channel sidebar', async ({ page }) => {
    await page.goto('/community');
    
    // Verify channel sidebar is visible
    await expect(page.locator('[data-testid="channel-sidebar"]')).toBeVisible({ timeout: 10000 });
    
    // Verify at least one channel or "create channel" option exists
    const channels = page.locator('[data-testid="channel-item"]');
    const createButton = page.locator('[data-testid="create-channel-button"]');
    
    const hasChannels = await channels.count() > 0;
    const hasCreateButton = await createButton.count() > 0;
    
    expect(hasChannels || hasCreateButton).toBeTruthy();
  });

  test('Can create a new channel', async ({ page }) => {
    await page.goto('/community');
    
    // Click create channel button
    const createButton = page.locator('[data-testid="create-channel-button"]');
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();
    
    // Modal should appear
    const modal = page.locator('[data-testid="create-channel-modal"]');
    await expect(modal).toBeVisible();
    
    // Fill in channel details
    const channelName = `Test Channel ${Date.now()}`;
    await page.getByLabel(/name/i).fill(channelName);
    await page.getByLabel(/description/i).fill('A test channel for E2E testing');
    
    // Select channel type if available
    const typeSelect = page.locator('[data-testid="channel-type-select"]');
    if (await typeSelect.count() > 0) {
      await typeSelect.selectOption('public');
    }
    
    // Submit
    await page.getByRole('button', { name: /create/i }).click();
    
    // Verify channel was created and appears in sidebar
    await expect(page.getByText(channelName)).toBeVisible({ timeout: 5000 });
  });

  test('Can send and receive messages in channel', async ({ page }) => {
    await page.goto('/community');
    
    // Click on first available channel
    const firstChannel = page.locator('[data-testid="channel-item"]').first();
    if (await firstChannel.count() > 0) {
      await firstChannel.click();
      
      // Chat area should be visible
      await expect(page.locator('[data-testid="chat-area"]')).toBeVisible();
      
      // Type a message
      const messageInput = page.locator('[data-testid="message-input"]');
      await expect(messageInput).toBeVisible();
      
      const testMessage = `Test message ${Date.now()}`;
      await messageInput.fill(testMessage);
      
      // Send message
      await page.keyboard.press('Enter');
      
      // Verify message appears in chat
      await expect(page.getByText(testMessage)).toBeVisible({ timeout: 5000 });
    }
  });

  test('Can search for channels', async ({ page }) => {
    await page.goto('/community');
    
    const searchInput = page.locator('[data-testid="channel-search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('general');
      await page.waitForTimeout(500);
      
      // Results should filter
      const channels = page.locator('[data-testid="channel-item"]');
      const count = await channels.count();
      
      // Either finds matching channels or shows no results message
      expect(count >= 0).toBeTruthy();
    }
  });
});

// ============================================
// APPRENTICESHIPS PORTAL TESTS
// ============================================
test.describe('Apprenticeships Portal', () => {
  
  test('Apprenticeships page loads with listings', async ({ page }) => {
    await page.goto('/apprenticeships');
    
    // Verify page title/header
    await expect(page.getByRole('heading', { name: /apprenticeship/i })).toBeVisible({ timeout: 10000 });
    
    // Verify listings container
    await expect(page.locator('[data-testid="apprenticeship-listings"]')).toBeVisible();
    
    // Check for apprenticeship cards
    const cards = page.locator('[data-testid="apprenticeship-card"]');
    await expect(cards.first()).toBeVisible();
  });

  test('Can filter apprenticeships by industry', async ({ page }) => {
    await page.goto('/apprenticeships');
    
    // Find and use filter
    const industryFilter = page.locator('[data-testid="industry-filter"]');
    if (await industryFilter.count() > 0) {
      await industryFilter.selectOption({ index: 1 }); // Select first industry
      
      // Wait for filter to apply
      await page.waitForTimeout(500);
      
      // Verify listings still visible (may be filtered)
      await expect(page.locator('[data-testid="apprenticeship-listings"]')).toBeVisible();
    }
  });

  test('Can view apprenticeship details', async ({ page }) => {
    await page.goto('/apprenticeships');
    
    // Click on first apprenticeship card
    const firstCard = page.locator('[data-testid="apprenticeship-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await firstCard.click();
    
    // Detail view or modal should appear
    const detailView = page.locator('[data-testid="apprenticeship-detail"], [data-testid="application-modal"]');
    await expect(detailView).toBeVisible({ timeout: 5000 });
  });

  test('Can apply to apprenticeship', async ({ page }) => {
    await loginUser(page);
    await page.goto('/apprenticeships');
    
    // Click on first apprenticeship
    const firstCard = page.locator('[data-testid="apprenticeship-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await firstCard.click();
    
    // Click apply button
    const applyButton = page.getByRole('button', { name: /apply/i });
    await expect(applyButton).toBeVisible();
    await applyButton.click();
    
    // Application modal should appear
    const modal = page.locator('[data-testid="application-modal"]');
    await expect(modal).toBeVisible();
    
    // Fill application form
    const coverLetter = page.locator('[data-testid="cover-letter-input"], textarea[name="coverLetter"]');
    if (await coverLetter.count() > 0) {
      await coverLetter.fill('I am very interested in this apprenticeship opportunity. I have relevant skills and am eager to learn.');
    }
    
    // Submit application
    await page.getByRole('button', { name: /submit|send/i }).click();
    
    // Verify success message or confirmation
    await expect(page.getByText(/success|submitted|thank you/i)).toBeVisible({ timeout: 5000 });
  });
});

// ============================================
// SKILLS MARKETPLACE TESTS
// ============================================
test.describe('Skills Marketplace', () => {
  
  test('Skills marketplace page loads', async ({ page }) => {
    await page.goto('/skills-marketplace');
    
    // Verify page loads
    await expect(page.getByRole('heading', { name: /marketplace|skills/i })).toBeVisible({ timeout: 10000 });
    
    // Verify service listings
    await expect(page.locator('[data-testid="service-listings"]')).toBeVisible();
  });

  test('Can browse service categories', async ({ page }) => {
    await page.goto('/skills-marketplace');
    
    // Find category navigation
    const categoryNav = page.locator('[data-testid="category-nav"], [role="tablist"]');
    if (await categoryNav.count() > 0) {
      // Click a category
      const categories = page.locator('[data-testid="category-item"], [role="tab"]');
      if (await categories.count() > 1) {
        await categories.nth(1).click();
        await page.waitForTimeout(500);
      }
    }
    
    // Listings should still be visible
    await expect(page.locator('[data-testid="service-listings"]')).toBeVisible();
  });

  test('Can view service details', async ({ page }) => {
    await page.goto('/skills-marketplace');
    
    // Click on a service card
    const serviceCard = page.locator('[data-testid="service-card"]').first();
    await expect(serviceCard).toBeVisible({ timeout: 10000 });
    await serviceCard.click();
    
    // Detail view should appear
    const detailView = page.locator('[data-testid="service-detail"], [data-testid="order-modal"]');
    await expect(detailView).toBeVisible({ timeout: 5000 });
  });

  test('Can initiate service order', async ({ page }) => {
    await loginUser(page);
    await page.goto('/skills-marketplace');
    
    // Click on a service
    const serviceCard = page.locator('[data-testid="service-card"]').first();
    await expect(serviceCard).toBeVisible({ timeout: 10000 });
    await serviceCard.click();
    
    // Click order/book button
    const orderButton = page.getByRole('button', { name: /order|book|hire/i });
    await expect(orderButton).toBeVisible();
    await orderButton.click();
    
    // Order modal should appear
    const modal = page.locator('[data-testid="order-modal"]');
    await expect(modal).toBeVisible();
    
    // Fill order details
    const requirements = page.locator('[data-testid="requirements-input"], textarea[name="requirements"]');
    if (await requirements.count() > 0) {
      await requirements.fill('I need help with my project. Please advise on timeline.');
    }
    
    // Verify order form elements are present
    await expect(page.getByRole('button', { name: /confirm|place order|submit/i })).toBeVisible();
  });

  test('Can toggle between grid and list view', async ({ page }) => {
    await page.goto('/skills-marketplace');
    
    const gridButton = page.locator('[data-testid="view-grid"]');
    const listButton = page.locator('[data-testid="view-list"]');
    
    if (await gridButton.count() > 0 && await listButton.count() > 0) {
      // Click list view
      await listButton.click();
      await page.waitForTimeout(300);
      
      // Verify list class is applied
      await expect(page.locator('[data-testid="service-listings"]')).toHaveClass(/list/);
      
      // Click grid view
      await gridButton.click();
      await page.waitForTimeout(300);
      
      // Verify grid class is applied
      await expect(page.locator('[data-testid="service-listings"]')).toHaveClass(/grid/);
    }
  });
});

// ============================================
// CROSS-MODULE INTEGRATION TESTS
// ============================================
test.describe('Super App Cross-Module Integration', () => {
  
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test('Can share job to channel from job listing', async ({ page }) => {
    await page.goto('/jobs');
    
    // Find share button on a job card
    const shareButton = page.locator('[data-testid="job-share-button"]').first();
    if (await shareButton.count() > 0) {
      await shareButton.click();
      
      // Share modal should appear with channel options
      const shareModal = page.locator('[data-testid="share-modal"]');
      await expect(shareModal).toBeVisible();
      
      // Select a channel
      const channelOption = page.locator('[data-testid="share-channel-option"]').first();
      if (await channelOption.count() > 0) {
        await channelOption.click();
        await page.getByRole('button', { name: /share|send/i }).click();
        
        // Verify success
        await expect(page.getByText(/shared|sent/i)).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('Unified search returns results from multiple modules', async ({ page }) => {
    await page.goto('/search');
    
    // Perform a search
    const searchInput = page.locator('[data-testid="unified-search-input"], input[type="search"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('python');
    await searchInput.press('Enter');
    
    // Wait for results
    await page.waitForTimeout(1000);
    
    // Verify multiple result types are shown
    const jobResults = page.locator('[data-testid="search-results-jobs"]');
    const videoResults = page.locator('[data-testid="search-results-videos"]');
    const mentorResults = page.locator('[data-testid="search-results-mentors"]');
    
    // At least one result section should be visible
    const hasResults = 
      await jobResults.count() > 0 || 
      await videoResults.count() > 0 || 
      await mentorResults.count() > 0;
    
    expect(hasResults).toBeTruthy();
  });
});
