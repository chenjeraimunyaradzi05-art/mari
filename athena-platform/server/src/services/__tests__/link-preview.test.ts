import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({ prisma: { post: { update: jest.fn() } } }));
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
  it('refuses private and local hosts without fetching', async () => {
    await expect(fetchLinkPreview('http://localhost:5000/admin')).resolves.toBeNull();
    await expect(fetchLinkPreview('http://127.0.0.1/')).resolves.toBeNull();
    await expect(fetchLinkPreview('http://10.0.0.5/secrets')).resolves.toBeNull();
    await expect(fetchLinkPreview('http://169.254.169.254/latest/meta-data')).resolves.toBeNull();
    await expect(fetchLinkPreview('ftp://example.com/file')).resolves.toBeNull();
  });
});
