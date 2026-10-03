/**
 * What happens when SendGrid does not just say yes: the retry rules, the
 * deadline on each try, and the suppression list.
 *
 * Until these existed one try was made, with no deadline, and every failure
 * (a 429 or a 5xx that a second try would have got through, a 400 for an
 * address that never will work, a provider that had stopped answering) came back
 * as the same `false`. A member's confirmation email was lost to a blip the
 * code could have absorbed, a request waited on a hung provider for as long as
 * it cared to hang, and nobody could tell the two apart afterwards.
 *
 * The sender address and the templates are asserted in email.sender.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;
const fetchMock = jest.fn<FetchFn>();
const realFetch = global.fetch;

type LookupArgs = { where: { email: string }; select?: unknown };
const suppressionLookup = jest.fn<(args: LookupArgs) => Promise<{ id: string } | null>>();
jest.mock('../prisma', () => ({
  prisma: { emailSuppression: { findUnique: (args: LookupArgs) => suppressionLookup(args) } },
}));

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
jest.mock('../logger', () => ({ logger }));

import { classifyEmailStatus, deliverEmail, INTERACTIVE_DELIVERY, isEmailSuppressed, sendEmail } from '../email';

const original = process.env;
const message = {
  to: 'Her@Example.org',
  subject: 'Confirm your address',
  html: '<a href="https://app.example/verify?token=SECRET-TOKEN-123">Confirm</a>',
  text: 'https://app.example/verify?token=SECRET-TOKEN-123',
};

const answer = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

/** A fetch that never answers and only ends when its deadline aborts it. */
function hangUntilAborted(_url: string, init: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => {
      const aborted = new Error('The operation was aborted');
      aborted.name = 'AbortError';
      reject(aborted);
    });
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  // Jitter is a quarter either way of the pause; pin it to the middle.
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
  process.env = {
    ...original,
    NODE_ENV: 'production',
    SENDGRID_API_KEY: 'SG.not-a-real-key',
    SENDGRID_FROM_EMAIL: 'noreply@mail.ourdomain.org',
  } as NodeJS.ProcessEnv;
  fetchMock.mockReset();
  suppressionLookup.mockReset();
  suppressionLookup.mockResolvedValue(null);
  Object.values(logger).forEach((fn) => fn.mockClear());
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  process.env = original;
  global.fetch = realFetch;
});

/** Runs a delivery to the end, letting its pauses and deadlines elapse. */
async function finish<T>(delivery: Promise<T>): Promise<T> {
  await jest.advanceTimersByTimeAsync(60_000);
  return delivery;
}

describe('classifyEmailStatus', () => {
  it('repeats only what SendGrid being busy or broken could fix', () => {
    expect(classifyEmailStatus(429)).toEqual({ retryable: true, reason: 'rate_limited' });
    expect(classifyEmailStatus(500)).toEqual({ retryable: true, reason: 'provider_error' });
    expect(classifyEmailStatus(503)).toEqual({ retryable: true, reason: 'provider_error' });
    expect(classifyEmailStatus(408)).toEqual({ retryable: true, reason: 'provider_error' });
  });

  it('never repeats a refusal that will be the same next time', () => {
    // 400 an invalid address, 401 a bad key, 403 an unverified sender, 413 too large.
    for (const status of [400, 401, 403, 404, 413]) {
      expect(classifyEmailStatus(status)).toEqual({ retryable: false, reason: 'rejected' });
    }
  });
});

describe('deliverEmail retries', () => {
  it('succeeds on the second try after a 503, having waited between them', async () => {
    fetchMock.mockResolvedValueOnce(answer(503)).mockResolvedValueOnce(answer(202));

    const delivery = deliverEmail(message);
    // The first try is made at once; the second only after the pause.
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1_900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(200);

    await expect(delivery).resolves.toEqual({ ok: true, retryable: false, status: 202, reason: null, attempts: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 400: the address is the problem, and asking again only delays the answer', async () => {
    fetchMock.mockResolvedValue(answer(400, { errors: [{ message: 'The to address is invalid.' }] }));

    const delivery = await finish(deliverEmail(message));

    expect(delivery).toEqual({ ok: false, retryable: false, status: 400, reason: 'rejected', attempts: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to send email',
      expect.objectContaining({ status: 400, detail: 'The to address is invalid.', attempts: 1 })
    );
  });

  it('does not retry a 401 or a 403: a bad key or an unverified sender is the same next time', async () => {
    for (const status of [401, 403]) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(answer(status));

      const delivery = await finish(deliverEmail(message));

      expect(delivery).toMatchObject({ ok: false, retryable: false, status, attempts: 1 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it('gives up after three 503s and says it was worth trying again later', async () => {
    fetchMock.mockResolvedValue(answer(503));

    const delivery = await finish(deliverEmail(message));

    expect(delivery).toEqual({ ok: false, retryable: true, status: 503, reason: 'provider_error', attempts: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries a 429 and reports it as rate limiting when it does not clear', async () => {
    fetchMock.mockResolvedValue(answer(429));

    const delivery = await finish(deliverEmail(message));

    expect(delivery).toMatchObject({ ok: false, retryable: true, status: 429, reason: 'rate_limited', attempts: 3 });
  });

  it('retries a dropped connection', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(answer(202));

    const delivery = await finish(deliverEmail(message));

    expect(delivery).toMatchObject({ ok: true, attempts: 2 });
  });

  it('reports a connection that never comes back as a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const delivery = await finish(deliverEmail(message));

    expect(delivery).toEqual({ ok: false, retryable: true, status: null, reason: 'network', attempts: 3 });
  });

  it('follows the policy it is given: the interactive one tries twice and no more', async () => {
    fetchMock.mockResolvedValue(answer(503));

    const delivery = await finish(deliverEmail(message, INTERACTIVE_DELIVERY));

    expect(delivery).toMatchObject({ ok: false, attempts: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('always makes at least one try, whatever the policy says', async () => {
    fetchMock.mockResolvedValue(answer(202));

    const delivery = await finish(deliverEmail(message, { maxAttempts: 0 }));

    expect(delivery).toMatchObject({ ok: true, attempts: 1 });
  });
});

describe('deliverEmail deadlines', () => {
  it('abandons a provider that stops answering instead of holding the request open', async () => {
    fetchMock.mockImplementation(hangUntilAborted);

    const delivery = deliverEmail(message, { maxAttempts: 1, attemptTimeoutMs: 5_000 });
    await jest.advanceTimersByTimeAsync(4_999);
    let settled = false;
    void delivery.then(() => {
      settled = true;
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(2);

    await expect(delivery).resolves.toEqual({ ok: false, retryable: true, status: null, reason: 'timeout', attempts: 1 });
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to send email',
      expect.objectContaining({ reason: 'timeout', detail: 'no answer within 5000ms' })
    );
  });

  it('tries again after a timeout, and succeeds if the second try is answered', async () => {
    fetchMock.mockImplementationOnce(hangUntilAborted).mockResolvedValueOnce(answer(202));

    const delivery = await finish(deliverEmail(message, { attemptTimeoutMs: 1_000 }));

    expect(delivery).toMatchObject({ ok: true, attempts: 2 });
  });

  it('is bounded: three hung tries end within the default deadline and pauses', async () => {
    fetchMock.mockImplementation(hangUntilAborted);

    const started = Date.now();
    const delivery = deliverEmail(message);
    // Three 8-second tries and the 2 and 8 second pauses between them.
    await jest.advanceTimersByTimeAsync(8_000 * 3 + 2_000 + 8_000);

    await expect(delivery).resolves.toMatchObject({ ok: false, reason: 'timeout', attempts: 3 });
    expect(Date.now() - started).toBeLessThanOrEqual(8_000 * 3 + 2_000 + 8_000);
  });
});

describe('the suppression list', () => {
  it('refuses an address SendGrid reported as bounced, without asking SendGrid', async () => {
    suppressionLookup.mockResolvedValue({ id: 'sup-1' });

    const delivery = await finish(deliverEmail(message));

    expect(delivery).toEqual({ ok: false, retryable: false, status: null, reason: 'suppressed', attempts: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await sendEmail(message)).toBe(false);
  });

  it('looks the address up trimmed and in lower case, the way the webhook stores it', async () => {
    fetchMock.mockResolvedValue(answer(202));

    await finish(deliverEmail({ ...message, to: '  Her@Example.org ' }));

    expect(suppressionLookup).toHaveBeenCalledWith({ where: { email: 'her@example.org' }, select: { id: true } });
  });

  it('sends anyway when the list cannot be read: a database blip must not stop a password reset', async () => {
    suppressionLookup.mockRejectedValue(new Error('connection reset'));
    fetchMock.mockResolvedValue(answer(202));

    const delivery = await finish(deliverEmail(message));

    expect(delivery).toMatchObject({ ok: true, attempts: 1 });
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not check the email suppression list; sending anyway',
      expect.anything()
    );
  });

  it('answers whether one address is on it', async () => {
    suppressionLookup.mockResolvedValueOnce({ id: 'x' });
    await expect(isEmailSuppressed('a@example.org')).resolves.toBe(true);
    suppressionLookup.mockResolvedValueOnce(null);
    await expect(isEmailSuppressed('b@example.org')).resolves.toBe(false);
  });
});

describe('what the logs keep', () => {
  it('never carries the message, so a one-time link does not end up in a log aggregator', async () => {
    fetchMock.mockResolvedValue(answer(503));

    await finish(deliverEmail(message));

    const logged = JSON.stringify([...logger.error.mock.calls, ...logger.warn.mock.calls, ...logger.info.mock.calls]);
    expect(logged).not.toContain('SECRET-TOKEN-123');
    expect(logged).not.toContain('SG.not-a-real-key');
  });
});

describe('sendEmail', () => {
  it('is the yes-or-no form of deliverEmail', async () => {
    fetchMock.mockResolvedValueOnce(answer(202));
    await expect(finish(sendEmail(message))).resolves.toBe(true);

    fetchMock.mockResolvedValue(answer(400));
    await expect(finish(sendEmail(message))).resolves.toBe(false);
  });
});
