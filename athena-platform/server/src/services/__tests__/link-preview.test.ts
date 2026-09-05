import { afterEach, describe, it, expect, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({ prisma: { post: { update: jest.fn() } } }));
// Hostnames in these tests are made up, so name resolution is answered here
// with a public address; the private-range checks are on literal IPs.
jest.mock('dns/promises', () => {
  const api = { lookup: jest.fn(async () => [{ address: '93.184.216.34', family: 4 }]) };
  return { __esModule: true, default: api, ...api };
});
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { fetchLinkPreview, firstLinkIn, parseOpenGraph } from '../link-preview.service';

describe('firstLinkIn', () => {
  it('finds the first bare link and strips trailing punctuation', () => {
    expect(firstLinkIn('Read this: https://example.com/article, then tell me.')).toBe('https://example.com/article');
    expect(firstLinkIn('two links http://a.example and https://b.example')).toBe('http://a.example');
  });

  it('ignores mentions, hashtags and text without a link', () => {
    expect(firstLinkIn('Thanks @[Mei Chen](11111111-1111-4111-8111-111111111111) #salary')).toBeNull();
    expect(firstLinkIn('')).toBeNull();
    expect(firstLinkIn(null)).toBeNull();
  });
});

describe('parseOpenGraph', () => {
  const html = `
    <html><head>
      <title>Fallback title</title>
      <meta property="og:title" content="Negotiating your first offer &amp; keeping it" />
      <meta content="A short guide." property="og:description">
      <meta property="og:image" content="/images/cover.jpg">
      <meta property="og:site_name" content="ATHENA Guides">
    </head><body>...</body></html>`;

  it('reads the card and resolves a relative image against the page', () => {
    expect(parseOpenGraph(html, 'https://guides.example.com/offers/1')).toEqual({
      url: 'https://guides.example.com/offers/1',
      title: 'Negotiating your first offer & keeping it',
      description: 'A short guide.',
      image: 'https://guides.example.com/images/cover.jpg',
      siteName: 'ATHENA Guides',
    });
  });

  it('falls back to the <title> and gives nothing for a page with no card', () => {
    expect(parseOpenGraph('<html><head><title>Only a title</title></head></html>', 'https://x.example')?.title).toBe('Only a title');
    expect(parseOpenGraph('<html><body>nothing</body></html>', 'https://x.example')).toBeNull();
  });
});

describe('fetchLinkPreview', () => {
  const PAGE = '<html><head><meta property="og:title" content="Public page"></head></html>';

  // A stand-in for fetch: each call answers from the queue in order.
  function mockFetch(responses: Array<{ status: number; headers?: Record<string, string>; body?: string; url?: string }>) {
    const calls: string[] = [];
    const impl = jest.fn(async (input: string | URL) => {
      calls.push(String(input));
      const next = responses.shift();
      if (!next) throw new Error('no more responses');
      return new Response(next.body ?? '', {
        status: next.status,
        headers: { 'content-type': 'text/html; charset=utf-8', ...(next.headers ?? {}) },
      });
    });
    (globalThis as any).fetch = impl;
    return { calls };
  }

  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('follows a redirect to another public host and reads the card there', async () => {
    const { calls } = mockFetch([
      { status: 301, headers: { location: 'https://cdn.example.org/article' } },
      { status: 200, body: PAGE },
    ]);
    const preview = await fetchLinkPreview('https://example.com/short');
    expect(preview?.title).toBe('Public page');
    expect(calls).toEqual(['https://example.com/short', 'https://cdn.example.org/article']);
  });

  it('refuses a redirect that lands on a private address', async () => {
    const { calls } = mockFetch([
      { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } },
      { status: 200, body: PAGE },
    ]);
    await expect(fetchLinkPreview('https://example.com/evil')).resolves.toBeNull();
    // The private hop was never requested.
    expect(calls).toEqual(['https://example.com/evil']);
  });

  it('gives up after too many redirects', async () => {
    mockFetch([
      { status: 302, headers: { location: 'https://a.example/1' } },
      { status: 302, headers: { location: 'https://a.example/2' } },
      { status: 302, headers: { location: 'https://a.example/3' } },
      { status: 302, headers: { location: 'https://a.example/4' } },
      { status: 200, body: PAGE },
    ]);
    await expect(fetchLinkPreview('https://example.com/loop')).resolves.toBeNull();
  });

  it('refuses private and local hosts without fetching', async () => {
    await expect(fetchLinkPreview('http://localhost:5000/admin')).resolves.toBeNull();
    await expect(fetchLinkPreview('http://127.0.0.1/')).resolves.toBeNull();
    await expect(fetchLinkPreview('http://10.0.0.5/secrets')).resolves.toBeNull();
    await expect(fetchLinkPreview('http://169.254.169.254/latest/meta-data')).resolves.toBeNull();
    await expect(fetchLinkPreview('ftp://example.com/file')).resolves.toBeNull();
  });
});
