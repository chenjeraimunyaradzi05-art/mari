import { test, expect, type Page, type Request } from '@playwright/test';

/**
 * The unified search page (/search), against GET /api/search answered at the
 * browser.
 *
 * This replaces "Unified search returns results from multiple modules" in the
 * old super-app-features spec. That test typed into an input the page does not
 * have (`data-testid="unified-search-input"`), looked for result sections by
 * test ids nothing renders, and asserted `count >= 0`-style truths, so it could
 * not tell a working search from a broken one. These drive the real input and
 * read what a member reads: the groups, where each result goes, and what the
 * page says when the search fails or finds nothing.
 *
 * The response bodies have the shape server/src/services/search.service.ts
 * returns (SearchResponse: results, total, page, totalPages, query), cut to
 * the fields the page reads. The full-stack workflow exercises the real API.
 */

test.use({ serviceWorkers: 'block' });

const JOB_ID = '11111111-2222-4333-8444-555555555555';
const COURSE_ID = '66666666-7777-4888-9999-000000000000';
const MENTOR_USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const RESULTS = [
  {
    type: 'job',
    id: JOB_ID,
    score: 3,
    title: 'Fixture Registered Nurse',
    metadata: { organization: { name: 'Fixture Health' }, location: 'Brisbane', type: 'FULL_TIME' },
  },
  {
    type: 'course',
    id: COURSE_ID,
    score: 2,
    title: 'Fixture Nursing Refresher',
    metadata: { provider: 'Fixture College', durationMonths: 6 },
  },
  {
    type: 'mentor',
    id: 'mentor-profile-fixture',
    score: 1,
    title: 'Fixture Mentor',
    metadata: { userId: MENTOR_USER_ID, headline: 'Twenty years on the wards' },
  },
];

type SearchAnswer = { status: number; body: unknown };

/**
 * Answers the search endpoint with `answer(request)` and every other API call
 * as the web tier does when the API is down, and records the searches made.
 */
async function answerSearch(page: Page, answer: (request: Request) => SearchAnswer): Promise<URL[]> {
  const searches: URL[] = [];
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/search') {
      searches.push(url);
      const { status, body } = answer(route.request());
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    }
    return route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'Backend unavailable' }),
    });
  });
  return searches;
}

function found(query: string) {
  return { status: 200, body: { results: RESULTS, total: RESULTS.length, page: 1, totalPages: 1, query } };
}

const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Search jobs, courses, people and posts' });

test.describe('Unified search', () => {
  test('searches everything as she types, and groups what comes back by kind', async ({ page }) => {
    const searches = await answerSearch(page, (request) => found(new URL(request.url()).searchParams.get('q') ?? ''));
    await page.goto('/search');

    await searchBox(page).fill('nurse');

    // The query lives in the URL, so the results can be shared and Back works.
    await expect(page).toHaveURL(/\/search\?q=nurse$/);
    await expect(page.getByText('3 results for “nurse”')).toBeVisible();
    expect(searches.at(-1)?.searchParams.get('q')).toBe('nurse');
    expect(searches.at(-1)?.searchParams.get('type')).toBe('all');

    // Each kind of result is its own group, and each result opens its own page.
    for (const group of ['Jobs', 'Courses', 'Mentors']) {
      await expect(page.getByRole('heading', { name: group, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('link').filter({ hasText: 'Fixture Registered Nurse' })).toHaveAttribute(
      'href',
      `/jobs/${JOB_ID}`
    );
    await expect(page.getByRole('link').filter({ hasText: 'Fixture Nursing Refresher' })).toHaveAttribute(
      'href',
      `/dashboard/learn/${COURSE_ID}`
    );
    await expect(page.getByRole('link').filter({ hasText: 'Fixture Mentor' })).toHaveAttribute(
      'href',
      `/profile/${MENTOR_USER_ID}`
    );

    // Only jobs has a listing page that reads the query, so only jobs offers
    // "All jobs", and it carries her words across.
    await expect(page.getByRole('link', { name: 'All jobs' })).toHaveAttribute('href', '/jobs?q=nurse');

    // Nothing is shown for a kind the search did not match.
    for (const group of ['People', 'Posts', 'Videos']) {
      await expect(page.getByRole('heading', { name: group, exact: true })).toHaveCount(0);
    }
  });

  test('narrowing to one kind asks the API for that kind', async ({ page }) => {
    const searches = await answerSearch(page, (request) => found(new URL(request.url()).searchParams.get('q') ?? ''));
    await page.goto('/search?q=nurse');
    await expect(page.getByText('3 results for “nurse”')).toBeVisible();

    await page.getByRole('button', { name: 'Jobs', exact: true }).click();

    await expect(page).toHaveURL(/\/search\?q=nurse&type=jobs$/);
    await expect.poll(() => searches.at(-1)?.searchParams.get('type')).toBe('jobs');
  });

  test('a search that failed says so, and keeps her words', async ({ page }) => {
    await answerSearch(page, () => ({ status: 502, body: { success: false, message: 'Backend unavailable' } }));
    await page.goto('/search?q=nurse');

    await expect(page.getByText('The search could not be reached.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(searchBox(page)).toHaveValue('nurse');
    await expect(page.getByText(/nothing matched/i)).toHaveCount(0);
  });

  test('a search that matched nothing says that, and offers no filters to clear', async ({ page }) => {
    await answerSearch(page, () => ({
      status: 200,
      body: { results: [], total: 0, page: 1, totalPages: 0, query: 'zzqx' },
    }));
    await page.goto('/search?q=zzqx');

    await expect(page.getByRole('heading', { name: 'Nothing matched “zzqx”' })).toBeVisible();
    await expect(page.getByText('The search could not be reached.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /clear/i })).toHaveCount(0);
  });
});
