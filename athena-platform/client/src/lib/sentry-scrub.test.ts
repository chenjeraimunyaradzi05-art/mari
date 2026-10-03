import { scrubReport, scrubReportText, withoutCredentials, withoutQuery } from './sentry-scrub';

/**
 * Next.js gives the server's error hook the request it was handling, and
 * Sentry attaches its headers. The session cookie and the bearer token must be
 * gone before the report leaves.
 */
describe('withoutCredentials', () => {
  it('drops the cookie and the bearer token, whatever the capitalisation, and keeps the rest', () => {
    const event = {
      message: 'boom',
      request: {
        url: 'https://athena.example/dashboard',
        headers: {
          Cookie: 'refreshToken=secret',
          authorization: 'Bearer secret',
          'Proxy-Authorization': 'Basic secret',
          'user-agent': 'Mozilla',
          accept: 'text/html',
        },
        cookies: { refreshToken: 'secret' },
      },
    };

    const scrubbed = withoutCredentials(event);

    expect(scrubbed.request.headers).toEqual({ 'user-agent': 'Mozilla', accept: 'text/html' });
    expect(scrubbed.request).not.toHaveProperty('cookies');
    expect(JSON.stringify(scrubbed)).not.toContain('secret');
    expect(scrubbed.request.url).toBe('https://athena.example/dashboard');
    expect(scrubbed.message).toBe('boom');
  });

  it('passes an event with no request, or no headers, through untouched', () => {
    expect(withoutCredentials({ message: 'x' })).toEqual({ message: 'x' });
    expect(withoutCredentials({ request: { url: '/' } })).toEqual({ request: { url: '/' } });
  });
});

/**
 * What a report says, as distinct from what is attached to it: the address of
 * the page (which carries an emailed link's one-time token), an error's message,
 * a breadcrumb.
 */
describe('scrubReport', () => {
  it('cuts the one-time token off the address of the page the error happened on', () => {
    const event = scrubReport({
      request: {
        url: 'https://athena.example/reset-password?token=abc123def456&utm=x#top',
        query_string: 'token=abc123def456',
        data: { password: 'hunter22' },
        headers: { cookie: 'refreshToken=secret', accept: 'text/html' },
      },
      transaction: '/verify-email?token=abc123def456',
    });

    const text = JSON.stringify(event);
    expect(event.request.url).toBe('https://athena.example/reset-password');
    expect(event.request).not.toHaveProperty('query_string');
    expect(event.request).not.toHaveProperty('data');
    expect(event.transaction).toBe('/verify-email');
    expect(text).not.toContain('abc123def456');
    expect(text).not.toContain('hunter22');
    expect(text).not.toContain('secret');
  });

  it('cleans an address, a bearer credential and a phone number out of the words of the report', () => {
    const event = scrubReport({
      message: 'could not send to her@example.org',
      exception: { values: [{ type: 'Error', value: 'rejected Bearer abcdefgh12345678 for 0412 345 678' }] },
    });

    expect(event.message).toBe('could not send to [email]');
    expect(event.exception.values[0].value).toBe('rejected Bearer [redacted] for [phone]');
  });

  it('cuts the query off the addresses in breadcrumbs, trace data and spans, and drops a captured body', () => {
    const event = scrubReport({
      breadcrumbs: [
        { category: 'navigation', message: 'to her@example.org', data: { from: '/search?q=refuge', to: '/jobs?page=2' } },
        {
          category: 'fetch',
          data: { url: 'https://api.athena.example/api/x?token=abc123def456', body: 'secret words', method: 'GET' },
        },
      ],
      contexts: { trace: { data: { 'http.url': 'https://a.test/p?q=private' } } },
      spans: [{ data: { 'url.full': 'https://a.test/s?q=private', 'http.request.body.data': 'private' } }],
    });

    const text = JSON.stringify(event);
    expect(event.breadcrumbs[0].message).toBe('to [email]');
    expect(event.breadcrumbs[0].data).toEqual({ from: '/search', to: '/jobs' });
    expect(event.breadcrumbs[1].data).toEqual({ url: 'https://api.athena.example/api/x', method: 'GET' });
    expect(text).not.toContain('refuge');
    expect(text).not.toContain('private');
    expect(text).not.toContain('abc123def456');
    expect(text).not.toContain('secret words');
  });

  it('still removes the credentials withoutCredentials removes', () => {
    const event = scrubReport({
      request: { headers: { Authorization: 'Bearer abcdefgh12345678', accept: '*/*' }, cookies: { a: 'b' } },
    });

    expect(event.request.headers).toEqual({ accept: '*/*' });
    expect(event.request).not.toHaveProperty('cookies');
  });

  // Next.js's error hook (onRequestError) gives Sentry the whole request: every
  // header, and its path with the query string, on a route such as
  // /api/wellness/share/<token> that carries a credential in the path.
  it('keeps only the request headers that help find a bug, so no visitor address and no referring page leaves', () => {
    const event = scrubReport({
      request: {
        headers: {
          'X-Forwarded-For': '203.0.113.7',
          'x-nf-client-connection-ip': '203.0.113.7',
          Referer: 'https://athena.example/reset-password?token=abc123def456',
          'User-Agent': `Mozilla/5.0 ${'x'.repeat(500)}`,
          Accept: 'text/html',
          host: 'athena.example',
        },
      },
    });

    const headers = event.request.headers as Record<string, string>;
    expect(Object.keys(headers).sort()).toEqual(['Accept', 'User-Agent', 'host']);
    expect(headers['User-Agent']).toHaveLength(120);
    expect(JSON.stringify(event)).not.toContain('203.0.113.7');
    expect(JSON.stringify(event)).not.toContain('abc123def456');
  });

  it('cuts the query string and the credential out of the path Next.js records for a request that failed', () => {
    const SHARE_TOKEN = 'Q2FuYXJ5U2hhcmVUb2tlbjEyMzQ1Njc4OTA';
    const event = scrubReport({
      request: { url: `https://athena.example/api/wellness/share/${SHARE_TOKEN}` },
      transaction: `GET /api/gdpr/download/3f2b8c1e-9d4a-4e6b-8a57-0c1d2e3f4a5b`,
      contexts: {
        nextjs: {
          request_path: `/api/wellness/share/${SHARE_TOKEN}?pin=1234`,
          router_path: '/api/[...path]',
          router_kind: 'App Router',
        },
      },
    });

    const text = JSON.stringify(event);
    expect(event.contexts.nextjs).toEqual({
      request_path: '/api/wellness/share/:token',
      router_path: '/api/[...path]',
      router_kind: 'App Router',
    });
    expect(event.request.url).toBe('https://athena.example/api/wellness/share/:token');
    expect(event.transaction).toBe('GET /api/gdpr/download/:id');
    expect(text).not.toContain(SHARE_TOKEN);
    expect(text).not.toContain('pin=1234');
  });

  it('leaves an ordinary sentence, and an event with nothing to clean, alone', () => {
    expect(scrubReportText('request 8b1c2d3e took 12ms')).toBe('request 8b1c2d3e took 12ms');
    expect(withoutQuery('/plain/path')).toBe('/plain/path');
    expect(scrubReport({ level: 'error' })).toEqual({ level: 'error' });
  });
});
