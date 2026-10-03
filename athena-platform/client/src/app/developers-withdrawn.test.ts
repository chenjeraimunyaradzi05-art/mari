/**
 * @jest-environment node
 */

/**
 * The developer section is withdrawn: its pages described an API (OAuth
 * tokens, /v1 routes, SDKs, webhooks, request limits) that the platform does
 * not have. These tests keep the pages from coming back by a side door: out of
 * the sitemap, out of every public link, and old addresses sent somewhere
 * honest rather than to a 404.
 */

import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');

function read(relative: string): string {
  return fs.readFileSync(path.join(SRC, relative), 'utf8');
}

describe('the withdrawn developer section', () => {
  it('is not offered to crawlers', async () => {
    const { default: sitemap } = await import('./sitemap');
    // The API is not reachable in a test, so only the static pages come back.
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(20);
    expect(entries.some((entry) => /\/developers/.test(entry.url))).toBe(false);
  });

  it.each([
    'components/home/HomepageLanding.tsx',
    'components/home/PlatformDirectory.tsx',
    'app/ecosystem/page.tsx',
  ])('is not linked from %s', (file) => {
    expect(read(file)).not.toMatch(/['"`]\/developers/);
  });

  it('is not promised in the partner pitch either', () => {
    const ecosystem = read('app/ecosystem/page.tsx');
    expect(ecosystem).not.toMatch(/Explore APIs|Developer Docs|through the ATHENA API|API Integration|ATS Integration/);
  });

  it('does not promise a partner money, co-branding or a cohort nobody has agreed', () => {
    // None of these exists: there is no revenue share, co-branded product,
    // referral scheme, alumni network or cohort. An empty promise to a
    // business is a worse thing to publish than a short list.
    const ecosystem = read('app/ecosystem/page.tsx');
    expect(ecosystem).not.toMatch(
      /Revenue Sharing|Co-branded|Co-marketing|Referral Programs|Alumni Network|Curriculum Insights|first cohort|exclusive job|AI Candidate Matching|reduce hiring costs/i
    );
  });

  it('sends an old address, and everything under it, to the partnership page', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- next.config.js is CommonJS
    const config = require('../../next.config.js');
    const redirects: Array<{ source: string; destination: string; permanent: boolean }> = await config.redirects();
    const rule = redirects.find((entry) => entry.source.startsWith('/developers'));

    expect(rule).toBeDefined();
    expect(rule!.destination).toBe('/contact-sales?intent=partners');
    // Temporary: the paths are free to come back with a real API, and a
    // permanent redirect would be remembered by every browser that saw it.
    expect(rule!.permanent).toBe(false);

    // Next compiles `source` with path-to-regexp; `:path*` takes none or more
    // segments, so the section's root and every page under it are caught and
    // an unrelated path that merely starts the same is not.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- the copy Next itself compiles routes with
    const { match } = require('next/dist/compiled/path-to-regexp');
    const matches = match(rule!.source);
    expect(matches('/developers')).toBeTruthy();
    expect(matches('/developers/console')).toBeTruthy();
    expect(matches('/developers/docs/api-reference')).toBeTruthy();
    expect(matches('/developers-and-friends')).toBeFalsy();
    expect(matches('/contact-sales')).toBeFalsy();
  });
});
