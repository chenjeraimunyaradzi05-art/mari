import { test, expect, type Page } from '@playwright/test';

/**
 * Does the site render, and does it keep the promises every page has to keep.
 * This runs on every pull request, in CI's client job, where there is no API.
 *
 * The first two tests used to describe the homepage as it was on 24 August
 * (f5e7a9607) — an Instagram-style three-column feed with a 235px middle
 * column, an
 * "Advertise" link and a "Jobs worth a look" rail — and the homepage has been
 * redesigned since. Both failed on every run, which nobody saw only because
 * GitHub Actions could not start jobs for this repository. They now check the
 * structure and the safety line rather than the wording of a page that is
 * still being worked on, and they replace the API at the browser, so the
 * answer is the same with or without an API behind the site.
 */

// The web tier answers this when the API is down (app/api/[...path]).
async function apiDown(page: Page): Promise<void> {
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Backend unavailable' }),
    })
  );
}

test.describe('the homepage', () => {
  test.use({ serviceWorkers: 'block' });

  test('renders its shell, the way in, and the safety line, without the API', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await apiDown(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

    const primary = page.getByRole('navigation', { name: 'Primary' });
    for (const [label, href] of [
      ['Home', '/'],
      ['Reels', '/explore'],
      ['Jobs', '/jobs'],
      ['Mentors', '/mentors'],
    ]) {
      await expect(primary.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
    }

    // Signed out, the way in is offered, not a dashboard.
    await expect(page.getByRole('link', { name: /^sign up$/i }).first()).toHaveAttribute('href', '/register');
    await expect(page.getByRole('link', { name: /^log in$/i }).first()).toHaveAttribute('href', '/login');

    // Five topic circles open themed slices of the reel feed.
    const topics = page.getByRole('navigation', { name: 'Reel topics' }).getByRole('link');
    await expect(topics).toHaveCount(5);
    for (const href of await topics.evaluateAll((links) => links.map((a) => a.getAttribute('href')))) {
      expect(href).toMatch(/^\/explore\?topic=[a-z-]+$/);
    }

    // The feed is the main landmark, and with the API down it says so rather
    // than showing an empty feed.
    const feed = page.getByRole('main', { name: 'Feed' });
    await expect(feed).toBeVisible();
    await expect(feed.getByText(/can.t reach the feed/i)).toBeVisible({ timeout: 15_000 });

    // Every page ends with the emergency numbers, whatever else failed to load.
    // A member who came here in trouble must find them without the API.
    const footer = page.getByRole('contentinfo', { name: 'Site links' });
    await expect(footer.getByText('000', { exact: true })).toBeVisible();
    await expect(footer.getByText('1800 737 732', { exact: true })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Safety centre' }).first()).toBeVisible();

    // No campaign to serve means no ad slot at all — an empty placement must
    // not hold space with a house promo.
    await expect(page.locator('[data-ad-placement]')).toHaveCount(0);

    // Infrastructure status has no place on a consumer homepage. These came
    // from the old SignalPanel/LiveOpsRail and must not come back.
    for (const noise of ['ATHENA Signal Console', 'Neon linked', 'Netlify ready', 'Prod audit clean']) {
      await expect(page.getByText(noise, { exact: false })).toHaveCount(0);
    }
  });

  test('is navigable by heading and landmark', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await apiDown(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

    // Exactly one h1, and heading levels that never skip one.
    await expect(page.locator('h1')).toHaveCount(1);
    const levels = await page
      .locator('h1,h2,h3,h4')
      .evaluateAll((els) =>
        els.filter((e) => (e as HTMLElement).offsetHeight > 0).map((e) => Number(e.tagName[1]))
      );
    expect(levels[0]).toBe(1);
    levels.reduce((prev, lvl) => {
      expect(lvl).toBeLessThanOrEqual(prev + 1);
      return lvl;
    }, 0);

    // Every visible landmark is named, so they can be told apart when jumping
    // between them. An element hidden from assistive technology is not a
    // landmark to anyone using one (the homepage's empty spacer column is an
    // aria-hidden <aside>), so it is not counted.
    const unnamed = await page
      .locator('nav, aside, main, section[aria-label], footer')
      .evaluateAll((els) =>
        els
          .filter((e) => (e as HTMLElement).offsetHeight > 0)
          .filter((e) => !e.closest('[aria-hidden="true"]'))
          .filter((e) => !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby'))
          .map((e) => e.tagName.toLowerCase())
      );
    expect(unnamed).toEqual([]);

    // The skip links go somewhere.
    for (const target of ['#main-content', '#main-nav']) {
      await expect(page.locator(`a[href="${target}"]`).first()).toBeAttached();
      await expect(page.locator(target)).toHaveCount(1);
    }
  });
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
