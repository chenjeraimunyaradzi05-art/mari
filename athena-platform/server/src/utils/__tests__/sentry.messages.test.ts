import { describe, expect, it, jest } from '@jest/globals';
import type * as Sentry from '@sentry/node';

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { scrubEvent, sentryOptions } from '../sentry';

/**
 * What an error report says in words. The request's body, query string and
 * headers are held back in sentry.test.ts; this is the text that is left: an
 * error's message, a breadcrumb, anything attached by hand. A failed database
 * call reports the call and its arguments in its message, so the member's
 * address and what she wrote reach a third party through the error itself.
 */

const ADDRESS = 'canary.member@example.org';
const BODY = 'canary-body leaving on Tuesday';

const prismaMessage = [
  '',
  'Invalid `prisma.message.create()` invocation:',
  '',
  '{',
  '  data: {',
  `    content: "${BODY}",`,
  `    email: "${ADDRESS}"`,
  '  }',
  '}',
  '',
  'Foreign key constraint failed on the field: `conversationId`',
].join('\n');

describe('scrubEvent: the words of a report', () => {
  it('keeps what a failed database call was and why, and drops the arguments it echoes', () => {
    const event = scrubEvent({
      exception: { values: [{ type: 'PrismaClientKnownRequestError', value: prismaMessage }] },
    } as Sentry.Event);

    const text = JSON.stringify(event);
    expect(text).toContain('Invalid `prisma.message.create()` invocation');
    expect(text).toContain('Foreign key constraint failed');
    expect(text).not.toContain(BODY);
    expect(text).not.toContain(ADDRESS);
  });

  it('cleans an address, a token and a phone number out of a message and out of an exception value', () => {
    const event = scrubEvent({
      message: `could not mail ${ADDRESS}`,
      exception: { values: [{ value: 'refused Bearer abcdefgh12345678 for 0412 345 678' }] },
    } as Sentry.Event);

    expect(event.message).toBe('could not mail [email]');
    expect(event.exception?.values?.[0].value).toBe('refused Bearer [redacted] for [phone]');
  });

  it('cleans breadcrumb messages and data, by value and by key', () => {
    const event = scrubEvent({
      breadcrumbs: [
        { category: 'log', message: `sent to ${ADDRESS}`, data: { userId: 'u1', email: ADDRESS, note: `to ${ADDRESS}` } },
      ],
    } as Sentry.Event);

    const crumb = event.breadcrumbs?.[0];
    expect(crumb?.message).toBe('sent to [email]');
    expect(crumb?.data).toEqual({ userId: 'u1', email: '[redacted]', note: 'to [email]' });
  });

  it('cleans what was attached by hand with captureException(error, context)', () => {
    const event = scrubEvent({
      extra: { requestId: 'r1', statusCode: 500, path: '/api/x', query: 'refuge near me', detail: `for ${ADDRESS}` },
    } as Sentry.Event);

    expect(event.extra).toEqual({
      requestId: 'r1',
      statusCode: 500,
      path: '/api/x',
      query: '[redacted]',
      detail: 'for [email]',
    });
  });

  it('drops the local variables of a stack frame, should an integration ever attach them', () => {
    const event = scrubEvent({
      exception: { values: [{ value: 'x', stacktrace: { frames: [{ function: 'f', vars: { password: 'hunter22' } }] } }] },
    } as unknown as Sentry.Event);

    expect(JSON.stringify(event)).not.toContain('hunter22');
  });

  // Some routes carry a credential in the path (a health-record share link, a
  // referee's form, an export download), and the request's address is attached
  // to every event by the SDK. Cutting the query string off is not enough.
  it('cuts a credential out of the path of the request, of the transaction and of the addresses in the trail', () => {
    const SHARE_TOKEN = 'Q2FuYXJ5U2hhcmVUb2tlbjEyMzQ1Njc4OTA';
    const EXPORT_TOKEN = '3f2b8c1e-9d4a-4e6b-8a57-0c1d2e3f4a5b';
    const event = scrubEvent({
      request: { url: `https://api.athena.test/api/wellness/share/${SHARE_TOKEN}?pin=1234` },
      transaction: `GET /api/gdpr/download/${EXPORT_TOKEN}`,
      breadcrumbs: [{ category: 'http', data: { url: `https://api.athena.test/api/reference/form/${SHARE_TOKEN}/submit` } }],
      contexts: { trace: { data: { 'http.url': `https://api.athena.test/api/gdpr/download/${EXPORT_TOKEN}?x=1` } } },
      spans: [{ data: { 'url.full': `https://api.athena.test/api/wellness/share/${SHARE_TOKEN}` } }],
    } as unknown as Sentry.Event);

    const text = JSON.stringify(event);
    expect(text).not.toContain(SHARE_TOKEN);
    expect(text).not.toContain(EXPORT_TOKEN);
    expect(text).not.toContain('pin=1234');
    expect(event.request?.url).toBe('https://api.athena.test/api/wellness/share/:token');
    expect(event.transaction).toBe('GET /api/gdpr/download/:id');
    expect(event.breadcrumbs?.[0].data?.url).toBe('https://api.athena.test/api/reference/form/:token/submit');
  });

  it('leaves the pattern of a matched route, and an ordinary path, as they are', () => {
    const event = scrubEvent({
      request: { url: 'https://api.athena.test/api/dv-safe/chats/c1/messages' },
      transaction: 'GET /api/wellness/share/:token',
    } as unknown as Sentry.Event);

    expect(event.request?.url).toBe('https://api.athena.test/api/dv-safe/chats/c1/messages');
    expect(event.transaction).toBe('GET /api/wellness/share/:token');
  });

  it('clips a long user agent header and keeps a normal one', () => {
    const long = `Mozilla/5.0 ${'x'.repeat(500)}`;
    const event = scrubEvent({
      request: { headers: { 'User-Agent': long, 'Content-Type': 'application/json' } },
    } as Sentry.Event);

    expect((event.request?.headers as Record<string, string>)['User-Agent']).toHaveLength(120);
    expect((event.request?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
});

describe('what the SDK is started with', () => {
  it('runs every error and every transaction through the scrubber, and sends nothing outside production', async () => {
    const options = sentryOptions('https://public@o0.ingest.sentry.io/0');
    const hint = {} as Sentry.EventHint;
    type ErrorReport = Parameters<NonNullable<typeof options.beforeSend>>[0];
    type TransactionReport = Parameters<NonNullable<typeof options.beforeSendTransaction>>[0];
    const withAddress = () => ({ message: `for ${ADDRESS}` }) as unknown as ErrorReport;
    const env = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      const sent = (await options.beforeSend?.(withAddress(), hint)) as Sentry.Event | null | undefined;
      expect(sent?.message).toBe('for [email]');

      process.env.NODE_ENV = 'development';
      expect(await options.beforeSend?.(withAddress(), hint)).toBeNull();

      const transaction = { type: 'transaction', message: `for ${ADDRESS}` } as unknown as TransactionReport;
      const sentTransaction = (await options.beforeSendTransaction?.(transaction, hint)) as Sentry.Event | null | undefined;
      expect(sentTransaction?.message).toBe('for [email]');
    } finally {
      process.env = env;
    }
  });
});
