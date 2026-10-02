import { execFileSync } from 'child_process';
import { randomBytes } from 'crypto';
import path from 'path';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * The critical member journey, end to end: registration, the mentor
 * directory, a requested session, and the job board.
 *
 * What this file used to be, because it explains every choice below. It was
 * titled "User to Mentor to Payment" and made no payment. Twenty of its steps
 * ended in a bare `return;` whenever the page they were looking for was not
 * there — no mentors, a redirect to sign-in, a registration that never left
 * the form — so on an empty database, or with no API at all, it went green
 * having checked nothing. Its selectors had also drifted from the UI it
 * described ("Book 60 min", "Session booked!"), and registration never filled
 * in the date of birth the form requires, so the one step that ran for real
 * could only ever stay on /register — which the test accepted as a pass.
 *
 * Now:
 *
 *   - The journey needs a running API and the rows server/scripts/seed-e2e.js
 *     writes (a mentor who mentors for free, a published job). Where those are
 *     absent the tests are skipped with the reason, visibly, rather than passed.
 *     E2E_FULL_STACK=true says they are present; the "E2E (full stack)" job in
 *     .github/workflows/e2e.yml sets it after starting both.
 *   - Every step asserts its outcome. A booking passes only when the member
 *     lands on her sessions page with the request listed as Requested, and the
 *     time she took is no longer offered to anyone else.
 *   - "Payment" is gone from the title. A free session needs no card, which
 *     is why the fixture mentor charges nothing. The money path (authorising a
 *     held payment, capture on completion, refunds) is covered on the server
 *     against a mocked Stripe in server/tests/payments-money-surfaces.test.ts
 *     and server/tests/escrow-authorisation.test.ts. A browser step through Stripe's test
 *     mode would need a Stripe test account's keys in CI, which the repository
 *     does not have.
 *
 * The signed-out checks at the bottom need only the web tier and always run.
 */

const FULL_STACK = process.env.E2E_FULL_STACK === 'true';
const FULL_STACK_REASON =
  'Needs the API at NEXT_PUBLIC_API_URL with the fixtures from server/scripts/seed-e2e.js; ' +
  'set E2E_FULL_STACK=true once both are up (the "E2E (full stack)" workflow does).';

// Must match server/scripts/seed-e2e.js.
const MENTOR_NAME = 'E2E Mentor';
const JOB_TITLE = 'E2E Fixture Software Engineer';

// Both the member and the fixture mentor keep Brisbane time, which has no
// daylight saving, so a weekday two or more days out always has the mentor's
// nine-to-five in it and none of it is in the past.
const TIMEZONE = 'Australia/Brisbane';

/** A calendar date in Brisbane, as the date input wants it (YYYY-MM-DD). */
function brisbaneDate(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** The first Monday-to-Friday at least two days from now, in Brisbane. */
function nextWorkingDay(): string {
  const weekday = new Intl.DateTimeFormat('en-AU', { timeZone: TIMEZONE, weekday: 'short' });
  for (let days = 2; days < 10; days += 1) {
    const candidate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    if (!['Sat', 'Sun'].includes(weekday.format(candidate))) return brisbaneDate(candidate);
  }
  throw new Error('No working day in the next ten days, which cannot happen');
}

/**
 * The cookie banner opens for every fresh browser, and it sits over the bottom
 * of the page where it can take a click meant for the form beneath. Choosing
 * "Reject optional" is also an assertion: the choice has to take.
 *
 * The button reads "Reject optional" from the locale file and "Essential
 * Only" if the messages have not loaded, so either name is accepted.
 */
const REJECT_OPTIONAL = /reject optional|essential only/i;

async function rejectOptionalCookies(page: Page) {
  const reject = page.getByRole('button', { name: REJECT_OPTIONAL });
  await reject.click({ timeout: 10_000 });
  await expect(reject).toBeHidden();
}

test.describe('Critical path: registration to a requested mentor session', () => {
  test.skip(!FULL_STACK, FULL_STACK_REASON);
  test.describe.configure({ mode: 'serial' });

  const runId = randomBytes(4).toString('hex');
  const email = `e2e.member.${runId}.${Date.now()}@athena-e2e.test`;
  // A password the server accepts: 12 or more characters, with upper and
  // lower case, a number and a symbol. Generated per run for a throwaway
  // account on a disposable database.
  const password = `Athena-E2E-${randomBytes(6).toString('hex')}-9a!`;
  const sessionNote = `E2E session request ${runId}`;

  let context: BrowserContext;
  let page: Page;
  let mentorProfilePath = '';
  let bookedDate = '';
  let bookedTime = '';

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext({ timezoneId: TIMEZONE, locale: 'en-AU' });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('a new member registers, is asked to check her email, and signs in once it is confirmed', async () => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
    await rejectOptionalCookies(page);

    await page.getByLabel('First Name', { exact: true }).fill('E2E');
    await page.getByLabel('Last Name', { exact: true }).fill('Member');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Date of birth', { exact: true }).fill('1990-05-20');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    await page.getByLabel(/i confirm that i am a woman/i).check();
    await page.getByRole('button', { name: /create account/i }).click();

    // Registration opens no session: the server answers every address the same
    // way and the link that finishes it is in an email. A refusal, from the
    // form's own checks or from the server, is shown in the form. Waiting on
    // the panel alone would time out without saying why, so the poll reports
    // the refusal's text if one appears first.
    const checkEmail = page.getByRole('heading', { name: 'Check your email' });
    const refusal = page.locator('form p.text-red-600, form p.text-red-700');
    await expect
      .poll(
        async () => {
          if (await checkEmail.count()) return 'asked to check her email';
          if (await refusal.count()) return `refused: ${(await refusal.first().textContent())?.trim()}`;
          return 'waiting';
        },
        { timeout: 20_000 }
      )
      .toBe('asked to check her email');
    await expect(page.getByText(email)).toBeVisible();

    // Before she confirms, she is not signed in, whatever the page said.
    await page.goto('/dashboard/mentors');
    await expect(page).toHaveURL(/\/login(\?|$)/);

    // The mailed link cannot be followed from here: in development the API
    // only logs that a mail would be sent, and the tokens are stored hashed.
    // This marks the address confirmed on the disposable database, the one
    // change the link makes. That the link itself works is covered by
    // server/tests/integration/auth-recovery.test.ts.
    execFileSync('node', ['scripts/verify-e2e-member.js', email], {
      cwd: path.resolve(process.cwd(), '..', 'server'),
      env: process.env,
      stdio: 'inherit',
    });

    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/dashboard(\/|\?|$)/, { timeout: 20_000 });
  });

  test('she finds the fixture mentor in the directory', async () => {
    await page.goto('/dashboard/mentors');
    await expect(page).toHaveURL(/\/dashboard\/mentors$/);
    await expect(page.getByRole('heading', { name: 'Find Your Mentor' })).toBeVisible();

    await page.getByPlaceholder('Search mentors by name or expertise...').fill(MENTOR_NAME);

    const card = page.locator('div.card').filter({
      has: page.getByRole('heading', { level: 3, name: MENTOR_NAME }),
    });
    await expect(card).toHaveCount(1, { timeout: 15_000 });
    await expect(card.getByText('Free', { exact: true })).toBeVisible();

    await card.getByRole('link', { name: 'View Profile' }).click();
    await expect(page).toHaveURL(/\/dashboard\/mentors\/[0-9a-f-]{36}$/);
    mentorProfilePath = new URL(page.url()).pathname;
  });

  test('her profile offers the standard hours on a working day', async () => {
    await expect(page.getByRole('heading', { level: 1, name: MENTOR_NAME })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Book a session' })).toBeVisible();

    bookedDate = nextWorkingDay();
    await page.getByLabel('Date', { exact: true }).fill(bookedDate);

    const hours = page.getByRole('group', { name: /when suits you/i }).getByRole('button');
    await expect(hours.first()).toBeVisible({ timeout: 15_000 });
    // ATHENA's standard day, nine to five on the hour in her time zone, and
    // nobody has booked any of it yet.
    await expect(hours).toHaveCount(8);

    const submit = page.getByRole('button', { name: /pick a time|request session/i });
    await expect(submit).toBeDisabled();
  });

  test('she requests a session, and it is recorded as requested', async () => {
    const firstHour = page.getByRole('group', { name: /when suits you/i }).getByRole('button').first();
    bookedTime = ((await firstHour.textContent()) ?? '').trim();
    expect(bookedTime).not.toBe('');
    await firstHour.click();
    await expect(firstHour).toHaveAttribute('aria-pressed', 'true');

    await page.getByLabel('What would you like to cover?').fill(sessionNote);

    const submit = page.getByRole('button', { name: 'Request session' });
    await expect(submit).toBeEnabled();
    await submit.click();

    // Success is leaving the form for the sessions page. A refused request
    // leaves the button where it was, and this fails rather than accepting it.
    await expect(page).toHaveURL(/\/dashboard\/mentors\/sessions(\?|$)/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Mentoring sessions' })).toBeVisible();

    const request = page.getByRole('listitem').filter({ hasText: sessionNote });
    await expect(request).toHaveCount(1);
    await expect(request.getByText('Requested', { exact: true })).toBeVisible();
    await expect(request.getByRole('link', { name: MENTOR_NAME })).toBeVisible();
  });

  test('the hour she took is no longer offered', async () => {
    await page.goto(mentorProfilePath);
    await page.getByLabel('Date', { exact: true }).fill(bookedDate);

    const hours = page.getByRole('group', { name: /when suits you/i }).getByRole('button');
    await expect(hours.first()).toBeVisible({ timeout: 15_000 });
    await expect(hours).toHaveCount(7);
    await expect(hours.filter({ hasText: bookedTime })).toHaveCount(0);
  });

  test('her inbox and her privacy page open for her', async () => {
    await page.goto('/dashboard/messages');
    await expect(page).toHaveURL(/\/dashboard\/messages$/);
    await expect(page.getByRole('heading', { name: 'Select a conversation' })).toBeVisible();

    await page.goto('/dashboard/settings/privacy');
    await expect(page).toHaveURL(/\/dashboard\/settings\/privacy$/);
    await expect(page.getByRole('heading', { name: 'Privacy & Data' })).toBeVisible();
    // Not clicked: the export writes a file, and the point here is that the
    // control is present for her, not the download itself.
    await expect(page.getByRole('button', { name: /^download$/i })).toBeVisible();
  });
});

test.describe('Job board search', () => {
  test.skip(!FULL_STACK, FULL_STACK_REASON);

  test('finds a published job by its title and opens it', async ({ page }) => {
    await page.goto('/jobs');
    await rejectOptionalCookies(page);

    await page.getByLabel('Search job titles and descriptions').fill('software engineer');
    await page.getByRole('button', { name: 'Search', exact: true }).click();

    const result = page.getByRole('link').filter({ hasText: JOB_TITLE });
    await expect(result).toHaveCount(1, { timeout: 15_000 });
    await result.click();

    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: JOB_TITLE })).toBeVisible();
  });
});

test.describe('Signed-out visitors', () => {
  for (const path of ['/dashboard/mentors', '/dashboard/messages', '/dashboard/settings/privacy']) {
    test(`are sent to sign in from ${path}, with the way back kept`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?redirect=${encodeURIComponent(path)}$`));
    });
  }

  test('can open the reels feed', async ({ page }) => {
    await page.goto('/explore');
    await expect(page).toHaveURL(/\/explore$/);

    for (const tab of ['For You', 'Following', 'Trending']) {
      await expect(page.getByRole('button', { name: tab, exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole('list', { name: 'Video feed' })).toBeVisible();
  });
});

test.describe('Cookie consent', () => {
  test('a fresh visitor is asked, and her refusal is remembered', async ({ page }) => {
    await page.goto('/');
    await rejectOptionalCookies(page);

    await page.reload();
    // The banner opens half a second after the page decides to show it, so
    // wait past that before concluding it stayed shut.
    await page.waitForTimeout(1_500);
    await expect(page.getByRole('button', { name: REJECT_OPTIONAL })).toHaveCount(0);
  });
});

test.describe('Accessibility', () => {
  test('keyboard navigation reaches a link and Enter follows it', async ({ page }) => {
    await page.goto('/');
    await rejectOptionalCookies(page);

    // Tab until focus lands on an in-app link. Asserted to happen within a
    // reasonable number of presses, rather than assuming what comes first.
    let href: string | null = null;
    for (let presses = 0; presses < 20 && !href; presses += 1) {
      await page.keyboard.press('Tab');
      href = await page.evaluate(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLAnchorElement)) return null;
        const value = active.getAttribute('href');
        return value && value.startsWith('/') && value !== '/' ? value : null;
      });
    }
    expect(href, 'no in-app link took keyboard focus within 20 presses of Tab').not.toBeNull();
    await expect(page.locator(':focus')).toBeVisible();

    await page.keyboard.press('Enter');
    const target = new URL(href as string, page.url()).pathname;
    await expect.poll(() => new URL(page.url()).pathname).toBe(target);
  });

  test('Screen reader landmarks present', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('Page load performance', async ({ page }) => {
    await page.goto('/');

    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        ttfb: nav.responseStart - nav.requestStart,
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
        load: nav.loadEventEnd - nav.startTime,
      };
    });

    expect(timing.ttfb).toBeLessThan(500);
    expect(timing.domContentLoaded).toBeLessThan(3000);
    expect(timing.load).toBeLessThan(5000);
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

        // No LCP entry within five seconds is itself a slow page, so the
        // fallback is a value that fails the assertion rather than one that
        // sits exactly on its edge.
        setTimeout(() => resolve(Number.POSITIVE_INFINITY), 5000);
      });
    });

    expect(lcp).toBeLessThan(2500);
  });
});
