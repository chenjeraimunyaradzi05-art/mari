import { describe, expect, it } from '@jest/globals';

import { USER_AGENT_MAX_LENGTH, clipUserAgent, redactSensitive, scrubText } from '../logger';
import { scrubAddress } from '../log-scrub';

describe('What a log line may carry', () => {
  it('masks secrets by key at any depth, and leaves the rest', () => {
    const out = redactSensitive({
      requestId: 'r1',
      body: { email: 'her@athena.com', password: 'hunter22', nested: { refreshToken: 'abc', twoFactorCode: '123456' } },
      headers: { authorization: 'Bearer x', cookie: 'refreshToken=y', 'x-request-id': 'r1' },
      list: [{ apiKey: 'k' }, 'plain'],
    }) as any;

    expect(out.requestId).toBe('r1');
    // `body` is a key that carries what she sent, so the whole of it goes.
    expect(out.body).toBe('[redacted]');
    expect(out.headers.authorization).toBe('[redacted]');
    expect(out.headers.cookie).toBe('[redacted]');
    expect(out.headers['x-request-id']).toBe('r1');
    expect(out.list[0].apiKey).toBe('[redacted]');
    expect(out.list[1]).toBe('plain');
  });

  it('masks who she is and what she wrote, by key, and keeps the ids that find the row', () => {
    const out = redactSensitive({
      userId: 'u1',
      groupId: 'g1',
      email: 'her@athena.com',
      phone: '0412 345 678',
      ipAddress: '203.0.113.9',
      firstName: 'Ada',
      content: 'Leave on Tuesday, the spare keys are with Mum',
      query: 'domestic violence housing near me',
      coverLetter: 'Dear hiring team',
      nested: { refereeEmail: 'ref@example.org', conversationId: 'c1' },
    }) as any;

    expect(out.userId).toBe('u1');
    expect(out.groupId).toBe('g1');
    expect(out.nested.conversationId).toBe('c1');
    for (const key of ['email', 'phone', 'ipAddress', 'firstName', 'content', 'query', 'coverLetter']) {
      expect(out[key]).toBe('[redacted]');
    }
    expect(out.nested.refereeEmail).toBe('[redacted]');
    expect(JSON.stringify(out)).not.toMatch(/her@athena|0412|203\.0\.113|spare keys|domestic violence/);
  });

  it('keeps dates and buffers whole and survives a cycle', () => {
    const date = new Date('2026-09-15T00:00:00Z');
    const cyclic: any = { name: 'loop' };
    cyclic.self = cyclic;

    const out = redactSensitive({ date, buffer: Buffer.from('x'), cyclic }) as any;
    expect(out.date).toBe(date);
    expect(Buffer.isBuffer(out.buffer)).toBe(true);
    expect(out.cyclic.self).toBe('[circular]');
    expect(redactSensitive('a string')).toBe('a string');
    expect(redactSensitive(null)).toBeNull();
  });
});

describe('Text that has a shape is cleaned wherever it sits', () => {
  it('replaces an email address, a bearer credential and a web token in a sentence', () => {
    const out = scrubText(
      'Sent to her@example.org with Bearer abcdefgh12345678 and eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJl'
    );

    expect(out).toBe('Sent to [email] with Bearer [redacted] and [token]');
  });

  it('replaces the secret in a link but not an ordinary number', () => {
    expect(scrubText('GET /reset?token=abc123XYZ&next=/home')).toBe('GET /reset?token=[redacted]&next=/home');
    expect(scrubText('failed with status code=500 after 3 tries')).toBe('failed with status code=500 after 3 tries');
    expect(scrubText('https://x.test/cb?code=4%2F0AX&state=1')).toBe('https://x.test/cb?code=[redacted]&state=1');
  });

  it('replaces a one-time token and its hash (64 hex characters), and provider keys', () => {
    const hex = 'a'.repeat(32) + 'b1'.repeat(16);
    expect(scrubText(`token ${hex} was used`)).toBe('token [token] was used');
    expect(scrubText('key sk_live_abcdefghij1234567890 and whsec_abcdefghij1234567890')).toBe('key [secret] and [secret]');
  });

  it('replaces a phone’s push token, as Expo repeats it in an error reply', () => {
    expect(scrubText('{"errors":[{"message":"\\"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]\\" is not a registered push notification recipient"}]}')).toBe(
      '{"errors":[{"message":"\\"[push-token]\\" is not a registered push notification recipient"}]}'
    );
  });

  it('leaves a request id, a commit hash and an ordinary sentence alone', () => {
    const sentence = 'request 8b1c2d3e-aaaa-bbbb-cccc-1234567890ab built from 0123456789abcdef0123456789abcdef01234567 took 12ms';
    expect(scrubText(sentence)).toBe(sentence);
  });

  it('replaces a phone number, Australian or written with a country code', () => {
    expect(scrubText('call 0412 345 678 or +61 412 345 678 or +44 7700 900123')).toBe('call [phone] or [phone] or [phone]');
    expect(scrubText('order 20261001 shipped')).toBe('order 20261001 shipped');
  });

  // The request log scrubs the path of every request no route answered, and the
  // path is whatever a stranger typed (up to the 16 kB a header may hold).
  it('does not stall on a very long run of address-like characters with an @ after it', () => {
    const adversarial = [
      `${'a'.repeat(19_990)}@ x`,
      `${'x.'.repeat(9_000)}@y`,
      `/${'a'.repeat(15_000)}@`,
    ];

    const started = Date.now();
    for (const text of adversarial) scrubText(text);

    // Quadratic, these took about 1.4 s together; linear, a few milliseconds.
    expect(Date.now() - started).toBeLessThan(300);
  });

  it('still finds an address with a long but real local part, and one at the end of a line', () => {
    expect(scrubText(`${'a'.repeat(40)}@example.org`)).toBe('[email]');
    expect(scrubText('write to first.last+tag@mail.example.co.uk')).toBe('write to [email]');
  });

  it('cleans a string at any depth, not only under a key', () => {
    const out = redactSensitive({ context: { reason: 'could not reach her@example.org', ids: ['u1'] } }) as any;
    expect(out.context.reason).toBe('could not reach [email]');
    expect(out.context.ids).toEqual(['u1']);
  });
});

describe('An address is logged without what it carries', () => {
  it('cuts the query string and fragment, and replaces ids and credentials in the path', () => {
    expect(scrubAddress('/api/wellness/share/Q2FuYXJ5U2hhcmVUb2tlbjEyMzQ1Njc4OTA?pin=1234')).toBe('/api/wellness/share/:token');
    expect(scrubAddress('/api/gdpr/download/3f2b8c1e-9d4a-4e6b-8a57-0c1d2e3f4a5b')).toBe('/api/gdpr/download/:id');
    expect(scrubAddress('https://api.athena.test/api/reference/form/' + 'ab'.repeat(32) + '/submit#top')).toBe(
      // A 64-character hex token is the shape scrubText already names.
      'https://api.athena.test/api/reference/form/[token]/submit'
    );
  });

  it('leaves a route pattern and an ordinary path as they are', () => {
    expect(scrubAddress('/api/wellness/share/:token')).toBe('/api/wellness/share/:token');
    expect(scrubAddress('/api/dv-safe/chats/c1/messages')).toBe('/api/dv-safe/chats/c1/messages');
    expect(scrubAddress('GET /api/users/:id/posts')).toBe('GET /api/users/:id/posts');
  });

  it('removes an address that somebody put in the path', () => {
    expect(scrubAddress('/api/users/her@example.org/posts')).toBe('/api/users/[email]/posts');
  });
});

describe('An error is logged for what broke, not for what it was carrying', () => {
  it('turns an Error into a plain object with its message and stack, so that it is not written as {}', () => {
    const error = new Error('boom');
    const out = redactSensitive({ error }) as any;

    expect(out.error).not.toBe(error);
    expect(out.error.name).toBe('Error');
    expect(out.error.message).toBe('boom');
    expect(out.error.stack).toContain('boom');
    expect(JSON.stringify(out)).toContain('boom');
  });

  it('scrubs the message and the stack of an error, and the cause behind it', () => {
    const inner = new Error('smtp refused her@example.org');
    const error = new Error('send failed for 0412 345 678', { cause: inner });

    const out = JSON.stringify(redactSensitive({ error }));

    expect(out).not.toContain('her@example.org');
    expect(out).not.toContain('0412 345 678');
    expect(out).toContain('smtp refused [email]');
    expect(out).toContain('send failed for [phone]');
  });

  it('redacts a sensitive property carried by the error, as a Stripe or axios error carries headers', () => {
    const error: any = new Error('card declined');
    error.code = 'card_declined';
    error.headers = { authorization: 'Bearer sk_live_abcdefghij1234567890', 'request-id': 'req_1' };
    error.email = 'her@example.org';

    const out = redactSensitive({ error }) as any;

    expect(out.error.code).toBe('card_declined');
    expect(out.error.headers.authorization).toBe('[redacted]');
    expect(out.error.headers['request-id']).toBe('req_1');
    expect(out.error.email).toBe('[redacted]');
  });

  it('keeps a Prisma error’s invocation line and its reason, and drops the arguments it echoes', () => {
    const message = [
      '',
      'Invalid `prisma.user.create()` invocation:',
      '',
      '{',
      '  data: {',
      '    email: "her@example.org",',
      '    passwordHash: "$2b$12$abcdefghijklmnopqrstuv",',
      '    bio: "I am leaving on Tuesday"',
      '  }',
      '}',
      '',
      'Unique constraint failed on the fields: (`email`)',
    ].join('\n');
    const error = new Error(message);
    error.name = 'PrismaClientKnownRequestError';

    const out = JSON.stringify(redactSensitive({ error }));

    expect(out).toContain('Invalid `prisma.user.create()` invocation');
    expect(out).toContain('Unique constraint failed on the fields');
    expect(out).not.toContain('passwordHash');
    expect(out).not.toContain('abcdefghijklmnopqrstuv');
    expect(out).not.toContain('leaving on Tuesday');
    expect(out).not.toContain('her@example.org');
  });

  it('survives an error whose property points back at itself', () => {
    const error: any = new Error('loop');
    error.self = error;

    expect(() => JSON.stringify(redactSensitive({ error }))).not.toThrow();
  });
});

describe('A user agent is kept, but short', () => {
  it('clips one that is longer than the limit and leaves a normal one alone', () => {
    const normal = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
    const long = `Mozilla/5.0 ${'x'.repeat(500)}`;

    expect(clipUserAgent(normal)).toBe(normal);
    expect(clipUserAgent(long)?.length).toBe(USER_AGENT_MAX_LENGTH);
    expect(clipUserAgent(long)?.endsWith('…')).toBe(true);
    expect(clipUserAgent(undefined)).toBeUndefined();
  });

  it('is applied to a userAgent key wherever it turns up in a log record', () => {
    const out = redactSensitive({ session: { userAgent: `Mozilla/5.0 ${'x'.repeat(500)}`, 'user-agent': 'curl/8' } }) as any;

    expect(out.session.userAgent.length).toBe(USER_AGENT_MAX_LENGTH);
    expect(out.session['user-agent']).toBe('curl/8');
  });
});
