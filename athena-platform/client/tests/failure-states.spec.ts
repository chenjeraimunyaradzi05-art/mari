import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * A request that failed is not an empty answer.
 *
 * The audit behind this suite kept finding the same defect in different
 * clothes: a page whose request failed told the member there was nothing
 * there. "No mentors yet" when the mentor list could not be reached reads as a
 * fact about the platform, and she believes it and leaves. So every page here
 * is loaded with the API answering the way the web tier answers when the API
 * is down (app/api/[...path] replies 502 "Backend unavailable"), and each one
 * has to say that it could not load, and not say the list is empty. Where the
 * page offers a button to try again, that button has to be there too.
 *
 * It needs only the web tier. The API is replaced at the browser, so the
 * result is the same in CI's client job (no API at all) and in the full-stack
 * workflow (an API that would otherwise answer). Service workers are blocked
 * so every request the page makes is one the route below sees.
 */

test.use({ serviceWorkers: 'block' });

const BACKEND_UNAVAILABLE = { success: false, message: 'Backend unavailable' };

async function apiDown(page: Page): Promise<void> {
  await page.route('**/api/**', (route: Route) =>
    route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify(BACKEND_UNAVAILABLE) })
  );
}

interface HonestPage {
  path: string;
  /** What the page says when its list could not be loaded. */
  failure: RegExp;
  /** What it says when the list really is empty, which must not appear. */
  emptyClaims: RegExp[];
  /**
   * Whether the page has a "Try again" button. The events page has none; its
   * sentence asks her to try again in a moment, which is honest if plainer.
   */
  retryButton: boolean;
}

const HONEST_PAGES: HonestPage[] = [
  {
    path: '/jobs',
    failure: /we could not reach the job listings/i,
    emptyClaims: [/no roles have been listed yet/i, /nothing listed so far/i],
    retryButton: true,
  },
  {
    path: '/explore',
    failure: /videos could not be loaded right now/i,
    emptyClaims: [/there are no videos in this feed yet/i],
    retryButton: true,
  },
  {
    path: '/events',
    failure: /we could not load events just now/i,
    emptyClaims: [/nothing coming up just now/i],
    retryButton: false,
  },
];

/**
 * Pages that still show their empty state when the request failed. Each is a
 * defect handed to the page's owner, not an exemption: it is listed so the run
 * reports it by name as skipped, rather than leaving the page out and letting
 * it look covered. When one is fixed, move it into HONEST_PAGES with its
 * failure sentence.
 */
const KNOWN_EMPTY_ON_FAILURE: Array<{ path: string; claim: RegExp; defect: string }> = [
  {
    path: '/apprenticeships',
    claim: /no apprenticeships listed yet/i,
    defect: 'shows "0 opportunities found" and "No apprenticeships listed yet" when GET /api/apprenticeships fails',
  },
  {
    path: '/skills-marketplace',
    claim: /no services listed yet/i,
    defect: 'shows "0 services available" and "No services listed yet" when GET /api/skills-marketplace/services fails',
  },
  {
    path: '/community',
    claim: /no channels yet/i,
    defect: 'shows "No channels yet" and "You have not joined a channel yet" when GET /api/channels fails',
  },
  {
    path: '/mentors',
    claim: /nobody has listed themselves as a mentor yet/i,
    defect: 'says "Nobody has listed themselves as a mentor yet" beside "We could not load the mentor list" when GET /api/mentors fails',
  },
];

test.describe('A failed request is not an empty answer', () => {
  for (const { path, failure, emptyClaims, retryButton } of HONEST_PAGES) {
    test(`${path} says it could not load, and does not say the list is empty`, async ({ page }) => {
      await apiDown(page);
      await page.goto(path);

      await expect(page.getByText(failure).first()).toBeVisible({ timeout: 15_000 });
      if (retryButton) {
        await expect(page.getByRole('button', { name: /try again/i }).first()).toBeVisible();
      }
      for (const claim of emptyClaims) {
        await expect(page.getByText(claim)).toHaveCount(0);
      }
    });
  }

  for (const { path, claim, defect } of KNOWN_EMPTY_ON_FAILURE) {
    test(`${path} says it could not load, and does not say the list is empty`, async ({ page }) => {
      test.skip(true, `Known defect, handed to the page's owner: ${path} ${defect}.`);
      await apiDown(page);
      await page.goto(path);
      await expect(page.getByText(claim)).toHaveCount(0);
    });
  }
});

test.describe('Trying again after a failure', () => {
  test('the job board recovers when the API answers again', async ({ page }) => {
    let apiUp = false;
    await page.route('**/api/**', (route: Route) => {
      const url = new URL(route.request().url());
      if (apiUp && route.request().method() === 'GET' && url.pathname === '/api/jobs') {
        // The shape GET /api/jobs answers with (server/src/routes/job.routes.ts),
        // cut to the fields the job card reads.
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: '8d3f2c1e-5b6a-4c7d-9e8f-0a1b2c3d4e5f',
                title: 'Fixture Role For The Retry Test',
                type: 'FULL_TIME',
                city: 'Brisbane',
                state: 'QLD',
                country: 'Australia',
                isRemote: false,
                showSalary: false,
                skills: [],
                publishedAt: new Date().toISOString(),
                organization: { name: 'Fixture Employer', logo: null },
                hasApplied: false,
              },
            ],
            pagination: { page: 1, limit: 20, total: 1, pages: 1 },
          }),
        });
      }
      return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify(BACKEND_UNAVAILABLE) });
    });

    await page.goto('/jobs');
    await expect(page.getByText(/we could not reach the job listings/i).first()).toBeVisible({ timeout: 15_000 });

    apiUp = true;
    await page.getByRole('button', { name: /try again/i }).first().click();

    const card = page.getByRole('link').filter({ hasText: 'Fixture Role For The Retry Test' });
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute('href', '/jobs/8d3f2c1e-5b6a-4c7d-9e8f-0a1b2c3d4e5f');
    await expect(page.getByText(/1 role open right now/i)).toBeVisible();
    await expect(page.getByText(/we could not reach the job listings/i)).toHaveCount(0);
  });
});
