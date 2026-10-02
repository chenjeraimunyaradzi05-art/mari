/**
 * The email that goes with locking an account: it carries the only way back,
 * so what matters is that the link is right, goes to the address on the
 * account, and is not built from anything a stranger could shape.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const fetchMock = jest.fn() as jest.Mock<(url: string, init: RequestInit) => Promise<Response>>;
const realFetch = global.fetch;

jest.mock('../prisma', () => ({ prisma: { emailSuppression: { findUnique: jest.fn(async () => null) } } }));
jest.mock('../logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { accountLockUrl, sendAccountLockedEmail } from '../email';

const original = process.env;
const TOKEN = 'a1'.repeat(32);

function sent() {
  const init = fetchMock.mock.calls[0][1];
  return JSON.parse(String(init.body)) as {
    personalizations: Array<{ to: Array<{ email: string }> }>;
    subject: string;
    content: Array<{ type: string; value: string }>;
  };
}

beforeEach(() => {
  process.env = {
    ...original,
    NODE_ENV: 'production',
    SENDGRID_API_KEY: 'SG.not-a-real-key',
    SENDGRID_FROM_EMAIL: 'noreply@mail.ourdomain.org',
    CLIENT_URL: 'https://app.ourdomain.org/',
  } as NodeJS.ProcessEnv;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(null, { status: 202 }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  process.env = original;
  global.fetch = realFetch;
});

describe('sendAccountLockedEmail', () => {
  it('goes to the address it was given, with the unlock link on the site she uses', async () => {
    await expect(sendAccountLockedEmail('her@example.org', 'Maya', TOKEN)).resolves.toBe(true);

    const message = sent();
    expect(message.personalizations).toEqual([{ to: [{ email: 'her@example.org' }] }]);
    expect(message.subject).toBe('Your ATHENA account is locked');
    const unlockUrl = `https://app.ourdomain.org/unlock-account?token=${TOKEN}`;
    for (const part of message.content) {
      expect(part.value).toContain(unlockUrl);
    }
  });

  it('says plainly what the lock does and how long the link lasts, and offers a new password', async () => {
    await sendAccountLockedEmail('her@example.org', 'Maya', TOKEN);

    const text = sent().content.find((part) => part.type === 'text/plain')!.value;
    expect(text).toMatch(/signed out/i);
    expect(text).toMatch(/24 hours/);
    expect(text).toContain('https://app.ourdomain.org/forgot-password');
  });

  it('does not let a first name write into the page', async () => {
    await sendAccountLockedEmail('her@example.org', '<script>alert(1)</script>', TOKEN);

    const html = sent().content.find((part) => part.type === 'text/html')!.value;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('accountLockUrl', () => {
  it('is the confirm page on the client, carrying the token in the query', () => {
    expect(accountLockUrl(TOKEN)).toBe(`https://app.ourdomain.org/lock-account?token=${TOKEN}`);
  });
});
