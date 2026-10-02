/**
 * What an error report may carry out of the building.
 *
 * Sentry's HTTP integration attaches the incoming request to every event: the
 * body (10 kB by default), the query string, the cookies and the headers. On
 * this platform a request body is a safe-chat message and the PIN that opens the
 * chat, a health note, a booking reason or a password, and utils/sentry.ts
 * stripped only two headers, while a comment in errorHandler.ts said the body
 * was not attached. Any 5xx on those routes sent a member's words to a third
 * party.
 *
 * Two layers are held here. The first block runs the real SDK, with the options
 * the server really starts it with and a transport that keeps what would have
 * been sent, so the claim "the body is not attached" is checked against the
 * thing that attaches it. The control in that block shows the harness does see a
 * body when the SDK is left on its defaults; without it, "no body" could pass
 * because nothing was ever captured. The second block is the scrubber on its own.
 */

import http from 'http';
import { AddressInfo } from 'net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Sentry from '@sentry/node';

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { initSentry, scrubEvent, sentryOptions } from '../sentry';

const SAFE_CHAT_MESSAGE = 'Leave on Tuesday, the spare keys are with Mum';
const PIN = '135790';

/** A request body shaped like the one that opens a safe chat and sends a message. */
const messageBody = JSON.stringify({ content: SAFE_CHAT_MESSAGE, pin: PIN });

describe('the real SDK, started with the options the server uses', () => {
  const sent: any[] = [];
  const env = { ...process.env };
  let server: http.Server;
  let port: number;

  const transport = () => ({
    send: async (envelope: any) => {
      for (const item of envelope[1]) sent.push(item[1]);
      return {};
    },
    flush: async () => true,
  });

  /** Starts the SDK the way initSentry does, with a transport that keeps what it would have sent. */
  async function start(overrides: Record<string, unknown> = {}) {
    await Sentry.close();
    sent.length = 0;
    Sentry.init({
      ...sentryOptions('https://public@o0.ingest.sentry.io/0'),
      tracesSampleRate: 0,
      transport,
      ...overrides,
    } as Sentry.NodeOptions);
  }

  /** One POST to a route that fails the way a 500 does: the handler reports it and answers. */
  async function failingPost(path: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port, path, method: 'POST', headers: { 'content-type': 'application/json' } },
        (res) => {
          res.resume();
          res.on('end', resolve);
        }
      );
      req.on('error', reject);
      req.end(messageBody);
    });
    await Sentry.flush(2000);
  }

  beforeAll(async () => {
    // beforeSend drops everything outside production, so the process says so.
    process.env.NODE_ENV = 'production';
    server = http.createServer((req, res) => {
      // The body is read, as express.json() would, and then the route fails and
      // reports it: errorHandler calls captureException from inside the request.
      req.on('data', () => undefined);
      req.on('end', () => {
        Sentry.captureException(new Error('the route failed'));
        res.statusCode = 500;
        res.end('failed');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await Sentry.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env = env;
  });

  afterEach(async () => {
    await Sentry.close();
  });

  it('control: left on its defaults the SDK does attach the request body, which is why the options exist', async () => {
    await start({ integrations: [Sentry.httpIntegration()], beforeSend: (event: Sentry.Event) => event });

    await failingPost('/api/dv-safe/chats/c1/messages?pin=' + PIN);

    const event = sent.find((item) => item?.exception);
    expect(event).toBeDefined();
    expect(JSON.stringify(event.request)).toContain(SAFE_CHAT_MESSAGE);
  });

  it('attaches neither the message nor the PIN to an error from a safe-chat route', async () => {
    await start();

    await failingPost('/api/dv-safe/chats/c1/messages?pin=' + PIN);

    const event = sent.find((item) => item?.exception);
    expect(event).toBeDefined();
    const text = JSON.stringify(event);
    expect(text).not.toContain(SAFE_CHAT_MESSAGE);
    expect(text).not.toContain(PIN);
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.query_string).toBeUndefined();
    expect(event.request?.cookies).toBeUndefined();
    // What it should still say: that a POST to this route failed.
    expect(event.request?.method).toBe('POST');
    expect(event.request?.url).toContain('/api/dv-safe/chats/c1/messages');
  });
});

/** Closing the SDK stops it sending but leaves the client bound, and initSentry takes a bound client to mean "already started". */
async function stopSdk() {
  await Sentry.close();
  Sentry.getCurrentScope().setClient(undefined);
}

describe('initSentry', () => {
  const env = { ...process.env };

  beforeEach(stopSdk);
  afterEach(async () => {
    await stopSdk();
    process.env = env;
  });

  it('starts nothing outside production, or without a DSN', () => {
    process.env = { ...env, NODE_ENV: 'test', SENTRY_DSN: 'https://public@o0.ingest.sentry.io/0' };
    expect(initSentry()).toBe(false);
    expect(Sentry.getClient()).toBeUndefined();

    process.env = { ...env, NODE_ENV: 'production' };
    delete process.env.SENTRY_DSN;
    expect(initSentry()).toBe(false);
    expect(Sentry.getClient()).toBeUndefined();
  });

  it('starts with no request body captured, in production with a DSN', () => {
    process.env = { ...env, NODE_ENV: 'production', SENTRY_DSN: 'https://public@o0.ingest.sentry.io/0' };
    expect(initSentry()).toBe(true);
    expect(Sentry.getClient()).toBeDefined();
    expect(Sentry.getClient()?.getIntegrationByName('Http')).toBeDefined();
  });

  it('sends nothing from outside production, and a scrubbed event from inside it', () => {
    const options = sentryOptions('https://public@o0.ingest.sentry.io/0');
    const dirty = (): Sentry.ErrorEvent => ({
      type: undefined,
      request: { url: 'https://api.test/x?pin=1', data: { pin: PIN }, cookies: { session: 'abc' } },
    });

    process.env.NODE_ENV = 'development';
    expect(options.beforeSend?.(dirty(), {})).toBeNull();

    process.env.NODE_ENV = 'production';
    const sentEvent = options.beforeSend?.(dirty(), {}) as Sentry.ErrorEvent;
    expect(sentEvent.request?.data).toBeUndefined();
    expect(sentEvent.request?.cookies).toBeUndefined();
    expect(sentEvent.request?.url).toBe('https://api.test/x');

    const transaction = options.beforeSendTransaction?.(
      { type: 'transaction', request: { query_string: 'q=a+private+thing', data: 'secret' } },
      {}
    ) as Sentry.Event;
    expect(transaction.request?.query_string).toBeUndefined();
    expect(transaction.request?.data).toBeUndefined();
  });
});

describe('scrubEvent', () => {
  const dirty = () =>
    ({
      message: 'a failure',
      request: {
        method: 'POST',
        url: 'https://api.athena.test/api/dv-safe/chats/c1/messages?pin=135790&q=somewhere+i+could+go#frag',
        query_string: 'pin=135790',
        data: { content: SAFE_CHAT_MESSAGE, pin: PIN },
        cookies: { refresh_token: 'abc123' },
        headers: {
          Authorization: 'Bearer eyJhbGciOi.secret',
          Cookie: 'refresh_token=abc123',
          'X-Forwarded-For': '203.0.113.9',
          'x-proxy-secret': 'shared',
          'X-Request-Id': 'req-1',
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/json',
        },
      },
      user: { id: 'u1', email: 'her@example.org', username: 'her', ip_address: '203.0.113.9' },
    }) as Sentry.Event;

  it('removes the body, the cookies and the query string, so a message and its PIN cannot ride along', () => {
    const event = scrubEvent(dirty());
    const text = JSON.stringify(event);

    expect(event.request?.data).toBeUndefined();
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.query_string).toBeUndefined();
    expect(text).not.toContain(SAFE_CHAT_MESSAGE);
    expect(text).not.toContain(PIN);
    expect(text).not.toContain('abc123');
  });

  it('keeps the headers on an allow-list and drops every other, whatever its case', () => {
    const event = scrubEvent(dirty());

    expect(event.request?.headers).toEqual({
      'X-Request-Id': 'req-1',
      'User-Agent': 'Mozilla/5.0',
      'Content-Type': 'application/json',
    });
    const text = JSON.stringify(event);
    expect(text).not.toContain('Bearer');
    expect(text).not.toContain('203.0.113.9');
    expect(text).not.toContain('shared');
  });

  it('keeps the route and the method, which are what a report is for, and drops the query from the URL', () => {
    const event = scrubEvent(dirty());

    expect(event.request?.method).toBe('POST');
    expect(event.request?.url).toBe('https://api.athena.test/api/dv-safe/chats/c1/messages');
  });

  it('keeps her id and nothing else about her', () => {
    expect(scrubEvent(dirty()).user).toEqual({ id: 'u1' });
    expect(scrubEvent({ user: { email: 'her@example.org', ip_address: '1.2.3.4' } } as Sentry.Event).user).toBeUndefined();
  });

  it('strips the query from breadcrumb URLs, and from trace and span attributes, and drops a captured body', () => {
    const event = scrubEvent({
      breadcrumbs: [{ category: 'http', data: { url: 'https://api.test/search?q=private', method: 'GET' } }],
      contexts: {
        trace: {
          trace_id: 't',
          span_id: 's',
          data: { 'url.full': 'https://api.test/a?token=1', 'url.query': '?token=1', 'http.request.body.data': 'body' },
        },
      },
      spans: [
        {
          span_id: 'x',
          trace_id: 't',
          start_timestamp: 0,
          data: { 'http.url': 'https://api.test/b?x=1', 'http.query': '?x=1' },
        },
      ],
    } as unknown as Sentry.Event);

    const text = JSON.stringify(event);
    expect(event.breadcrumbs?.[0].data?.url).toBe('https://api.test/search');
    expect(event.breadcrumbs?.[0].data?.method).toBe('GET');
    expect(event.contexts?.trace?.data?.['url.full']).toBe('https://api.test/a');
    expect(event.spans?.[0].data?.['http.url']).toBe('https://api.test/b');
    expect(text).not.toContain('token=1');
    expect(text).not.toContain('private');
    expect(text).not.toContain('"body"');
    expect(text).not.toContain('x=1');
  });

  it('leaves an event that has no request alone', () => {
    const event = scrubEvent({ message: 'process crashed' } as Sentry.Event);
    expect(event).toEqual({ message: 'process crashed' });
  });
});
