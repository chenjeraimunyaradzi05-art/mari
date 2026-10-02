/**
 * What leaves the building, and from whom.
 *
 * The sender used to fall back to noreply@athena.com, a domain the venture does
 * not own. SendGrid refuses a message from a sender it has not authenticated,
 * so a deployment that never set SENDGRID_FROM_EMAIL looked configured and
 * could not send one verification email. There is no default now: a missing
 * sender in production is a refusal, logged, never a quiet attempt from a
 * domain nobody here can put DNS records on.
 *
 * The welcome message is held to the trust register as well: it told every new
 * member "500+ expert mentors" and "50,000+ ambitious women", figures nothing
 * in the product could back.
 *
 * Retries, timeouts and the suppression list belong to the delivery rules and
 * are not asserted here; the stand-in for the database answers "not suppressed"
 * so that nothing in this file can reach a real one.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const fetchMock = jest.fn() as jest.Mock<(url: string, init: RequestInit) => Promise<Response>>;
const realFetch = global.fetch;

const suppressionLookup = jest.fn(async () => null);
jest.mock('../prisma', () => ({ prisma: { emailSuppression: { findUnique: suppressionLookup } } }));

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
jest.mock('../logger', () => ({ logger }));

import { deliverEmail, sendEmail, sendVerificationEmail, sendWelcomeEmail, sendAccountExistsEmail } from '../email';

function accepted(): Response {
  return new Response(null, { status: 202 });
}

/** The JSON SendGrid was sent for the n-th call. */
function sentMessage(call = 0) {
  const init = fetchMock.mock.calls[call][1];
  return JSON.parse(String(init.body)) as {
    personalizations: Array<{ to: Array<{ email: string }> }>;
    from: { email: string };
    subject: string;
    content: Array<{ type: string; value: string }>;
  };
}

describe('the sender address', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original, NODE_ENV: 'production', SENDGRID_API_KEY: 'SG.not-a-real-key' } as NodeJS.ProcessEnv;
    delete process.env.SENDGRID_FROM_EMAIL;
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => accepted());
    suppressionLookup.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    process.env = original;
    global.fetch = realFetch;
  });

  const message = { to: 'her@example.org', subject: 'Hello', html: '<p>Hello</p>', text: 'Hello' };

  it('is exactly the configured one, with the key as the credential', async () => {
    process.env.SENDGRID_FROM_EMAIL = 'noreply@mail.ourdomain.org';

    await expect(sendEmail(message)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer SG.not-a-real-key');
    const body = sentMessage();
    expect(body.from).toEqual({ email: 'noreply@mail.ourdomain.org' });
    expect(body.personalizations).toEqual([{ to: [{ email: 'her@example.org' }] }]);
    // SendGrid rejects a message whose HTML part comes before its text part.
    expect(body.content.map((part) => part.type)).toEqual(['text/plain', 'text/html']);
  });

  it('is trimmed, because a pasted value often carries a space or a newline', async () => {
    process.env.SENDGRID_FROM_EMAIL = '  noreply@mail.ourdomain.org\n';

    await sendEmail(message);

    expect(sentMessage().from).toEqual({ email: 'noreply@mail.ourdomain.org' });
  });

  it('is never invented: with none set, production refuses, says so, and never reaches SendGrid', async () => {
    const delivery = await deliverEmail(message);

    expect(delivery).toMatchObject({ ok: false, reason: 'not_configured', attempts: 0 });
    expect(await sendEmail(message)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    // Which kind of address it was for, and not whose: the log is kept for weeks.
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('SENDGRID_FROM_EMAIL is not set'),
      expect.objectContaining({ recipientDomain: 'example.org' })
    );
    for (const [, fields] of (logger.error as jest.Mock).mock.calls) {
      expect(JSON.stringify(fields)).not.toContain('her@example.org');
    }
  });

  it('is not satisfied by a blank value', async () => {
    process.env.SENDGRID_FROM_EMAIL = '   ';

    await expect(sendEmail(message)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never falls back to the athena.com address it used to invent', async () => {
    await sendEmail(message);
    process.env.SENDGRID_FROM_EMAIL = 'noreply@mail.ourdomain.org';
    await sendEmail(message);

    const senders = fetchMock.mock.calls.map((_call, index) => sentMessage(index).from.email);
    expect(senders).toEqual(['noreply@mail.ourdomain.org']);
  });

  it('is not enough without the key', async () => {
    process.env.SENDGRID_FROM_EMAIL = 'noreply@mail.ourdomain.org';
    delete process.env.SENDGRID_API_KEY;

    await expect(deliverEmail(message)).resolves.toMatchObject({ ok: false, reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an unauthenticated sender domain is a refusal that is logged with SendGrid’s own words, and not repeated', async () => {
    process.env.SENDGRID_FROM_EMAIL = 'noreply@mail.ourdomain.org';
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'The from address does not match a verified Sender Identity.' }] }), {
        status: 403,
      })
    );

    const delivery = await deliverEmail(message);

    expect(delivery).toMatchObject({ ok: false, status: 403, retryable: false, attempts: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to send email',
      expect.objectContaining({ status: 403, detail: expect.stringContaining('verified Sender Identity') })
    );
  });

  it('is only logged outside production, which needs no key, no sender and no provider', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SENDGRID_API_KEY;

    await expect(sendEmail(message)).resolves.toBe(true);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(suppressionLookup).not.toHaveBeenCalled();
  });
});

describe('the templates', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = {
      ...original,
      NODE_ENV: 'production',
      SENDGRID_API_KEY: 'SG.not-a-real-key',
      SENDGRID_FROM_EMAIL: 'noreply@mail.ourdomain.org',
      CLIENT_URL: 'https://app.ourdomain.org',
    } as NodeJS.ProcessEnv;
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => accepted());
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    process.env = original;
    global.fetch = realFetch;
  });

  function sent() {
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = sentMessage();
    return {
      subject: body.subject,
      text: body.content.find((part) => part.type === 'text/plain')!.value,
      html: body.content.find((part) => part.type === 'text/html')!.value,
    };
  }

  it('the welcome email states no number of mentors or members', async () => {
    await sendWelcomeEmail('her@example.org', 'Ana');

    const { html, text } = sent();
    for (const body of [html, text]) {
      expect(body).not.toMatch(/\b500\+/);
      expect(body).not.toMatch(/50,000/);
      expect(body).not.toMatch(/\d[\d,]*\+\s*(expert\s+)?(mentors|ambitious|women|members)/i);
    }
    // And it still says what she can do, in words that promise no count.
    expect(html).toMatch(/Find a mentor/);
    expect(html).toMatch(/Join the community/);
  });

  it('the verification email carries the link to the site it was sent from', async () => {
    await sendVerificationEmail('her@example.org', 'Ana', 'tok-123');

    const { html } = sent();
    expect(html).toContain('https://app.ourdomain.org/verify-email?token=tok-123');
  });

  it('the account-exists email links to sign-in and to choosing a new password', async () => {
    await sendAccountExistsEmail('her@example.org', 'Ana');

    const { html, subject } = sent();
    expect(subject).toBe('You already have an ATHENA account');
    expect(html).toContain('https://app.ourdomain.org/login');
    expect(html).toContain('https://app.ourdomain.org/forgot-password');
  });
});
