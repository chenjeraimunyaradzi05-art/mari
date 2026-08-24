import { test, expect } from '@playwright/test';

test('homepage is the feed, in an Instagram-style three-column shell', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  // Stories sit above the feed, and the feed column is Instagram's 470px.
  await expect(page.getByRole('heading', { name: 'Stories' }).first()).toBeVisible();
  // Feed column is half Instagram's width so the middle column gets the space.
  await expect(page.locator('main')).toHaveCSS('max-width', '235px');

  // Left rail navigation.
  for (const label of ['Home', 'Reels', 'Jobs', 'Mentors']) {
    await expect(page.getByRole('link', { name: label, exact: true }).first()).toBeVisible();
  }

  // Signed out, the join actions live in the left rail as buttons.
  await expect(page.getByRole('link', { name: /^sign up$/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /^log in$/i }).first()).toBeVisible();

  // Middle column opens by talking to the reader, not announcing a product.
  await expect(
    page.getByRole('heading', { name: /have to do it alone/i }).first()
  ).toBeVisible();

  // No campaign to serve means no ad slot at all — an empty placement must not
  // hold space with a house promo.
  await expect(page.locator('[data-ad-placement]')).toHaveCount(0);

  // The advertiser ask belongs in the footer, not between the member's results.
  await expect(page.getByRole('link', { name: /^advertise$/i }).first()).toBeVisible();

  // Five topic circles open themed slices of the reel feed.
  const topics = page.locator('nav[aria-label="Reel topics"] a');
  await expect(topics).toHaveCount(5);
  await expect(topics.first()).toHaveAttribute('href', /\/explore\?topic=/);

  // The feed loads client-side, so wait for a post before asserting on the
  // affordances that live inside one.
  await expect(page.locator('article').first()).toBeVisible({ timeout: 15000 });

  // Signed out, save and comment are sign-in prompts rather than doomed API
  // calls — a 401 would trip the axios interceptor and yank the page to /login.
  await expect(page.locator('a[aria-label="Sign in to save"]').first()).toBeVisible();
  await expect(page.getByText(/sign in to join the conversation/i).first()).toBeVisible();
  await expect(page.locator('button[aria-label="Save"]')).toHaveCount(0);

  // The middle column carries real records, not marketing tiles.
  await expect(page.getByText(/jobs worth a look/i).first()).toBeVisible();
  await expect(page.locator('a[href^="/jobs/"]').first()).toBeVisible();
  await expect(page.getByText(/learn something new/i).first()).toBeVisible();
  await expect(page.locator('a[href^="/courses/"]').first()).toBeVisible();
  await expect(page.getByText(/find your people/i).first()).toBeVisible();
  await expect(page.locator('a[href^="/groups/"]').first()).toBeVisible();

  // The generic ability grid it replaced must not come back.
  await expect(page.getByText('Everything in one account')).toHaveCount(0);

  // Warm copy has to actually read as warm. These headings used .kicker — 12px
  // uppercase, letterspaced — so "Find your people" rendered as FIND YOUR PEOPLE
  // and the whole column read like a B2B dashboard regardless of the wording.
  const shouted = await page
    .locator('section[aria-label="Discover"] h2')
    .evaluateAll((els) => els.filter((e) => getComputedStyle(e).textTransform === 'uppercase').length);
  expect(shouted).toBe(0);

  // Partner cards must stay labelled as samples, never as real partnerships.
  await expect(page.getByText('Sample', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /tell us about them/i }).first()).toBeVisible();

  // Three columns, tight gutters: the nav must start near the viewport edge.
  const navLeft = await page.locator('aside').first().evaluate(
    (el) => el.getBoundingClientRect().left
  );
  expect(navLeft).toBeLessThan(48);

  // Infrastructure status has no place on a consumer homepage. These came from
  // the old SignalPanel/LiveOpsRail and must not come back.
  for (const noise of ['ATHENA Signal Console', 'Neon linked', 'Netlify ready', 'Prod audit clean']) {
    await expect(page.getByText(noise, { exact: false })).toHaveCount(0);
  }
});

test('homepage is navigable by heading and landmark', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  // Deliberately does not wait on feed data: the page structure must be sound
  // whether or not posts load, and coupling it to the API made this test fail
  // purely because the rate limiter had tripped.
  await expect(page.getByRole('heading', { name: 'Jobs worth a look', exact: true })).toBeVisible({
    timeout: 15000,
  });

  // Exactly one h1, and every section reachable by heading. These were styled
  // spans, which left screen-reader users only four headings on the page.
  await expect(page.locator('h1')).toHaveCount(1);
  for (const section of ['Jobs worth a look', 'Learn something new', 'Find your people']) {
    await expect(page.getByRole('heading', { name: section, exact: true })).toHaveCount(1);
  }
  // Matched loosely: this heading contains a typographic apostrophe.
  await expect(page.getByRole('heading', { name: /actually showing up/i })).toHaveCount(1);

  // Heading levels must not skip.
  const levels = await page
    .locator('h1,h2,h3')
    .evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetHeight > 0).map((e) => Number(e.tagName[1]))
    );
  levels.reduce((prev, lvl) => {
    expect(lvl).toBeLessThanOrEqual(prev + 1);
    return lvl;
  }, 0);

  // Every landmark is named, so they can be told apart when jumping between them.
  const unnamed = await page
    .locator('nav, aside, main')
    .evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetHeight > 0 && !e.getAttribute('aria-label')).length
    );
  expect(unnamed).toBe(0);

  // Loading more posts is announced rather than happening silently. Counted
  // loosely: React's streaming buffer keeps a hidden second copy of the shell.
  await expect(page.locator('[aria-live="polite"]').first()).toBeAttached();
});

test('homepage collapses to a single column with a bottom bar on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  await expect(page.locator('nav.sticky.bottom-0')).toBeVisible();
  await expect(page.locator('aside').first()).toBeHidden();

  // Nothing may push the page sideways on a phone.
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(overflows).toBe(false);
});

test('the product tour still lives at /about', async ({ page }) => {
  await page.goto('/about');

  await expect(page.getByRole('heading', { name: /career command center/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /start your workspace/i }).first()).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /short video from women building in public/i }).first()
  ).toBeVisible();
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
