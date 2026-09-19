jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  // The transports are stubbed out but the redaction is the real function, on
  // purpose: the thing under test below is that a thrown secret goes through
  // the logger's own key matching, and a stubbed redactSensitive would prove
  // only that the helper calls something named redactSensitive.
  redactSensitive: jest.requireActual<typeof import('../logger')>('../logger').redactSensitive,
}));

import { logger } from '../logger';
import { bestEffort } from '../best-effort';

const warnMock = logger.warn as jest.Mock;
const errorOf = (call: unknown[]) => (call[1] as Record<string, unknown>).error;

describe('Work that is allowed to fail, but not to fail quietly', () => {
  it('returns what the work resolved to and says nothing about it', async () => {
    await expect(bestEffort('audit row', Promise.resolve(41))).resolves.toBe(41);
    await expect(bestEffort('audit row', () => 'written')).resolves.toBe('written');
    await expect(bestEffort('audit row', async () => ({ id: 'a1' }))).resolves.toEqual({ id: 'a1' });
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('falls back when the promise rejects, and logs that failure exactly once', async () => {
    const writing = Promise.reject(new Error('audit table is read only'));
    await expect(bestEffort('stripe webhook audit row', writing, 'skipped')).resolves.toBe('skipped');

    expect(warnMock).toHaveBeenCalledTimes(1);
    const [message, meta] = warnMock.mock.calls[0];
    // The label is the only thing telling the reader which side effect this
    // was, so it has to reach both the line and the searchable field.
    expect(String(message)).toContain('stripe webhook audit row');
    expect(meta).toMatchObject({
      label: 'stripe webhook audit row',
      error: 'audit table is read only',
    });
    expect(typeof meta.stack).toBe('string');
  });

  it('catches a thunk that throws before it ever returns a promise', async () => {
    const send = () => {
      throw new Error('recipient has no email address');
    };
    await expect(bestEffort('welcome email', send, null)).resolves.toBeNull();
    expect(warnMock).toHaveBeenCalledTimes(1);
    expect(errorOf(warnMock.mock.calls[0])).toBe('recipient has no email address');
  });

  it('still logs something readable when what was thrown is not an Error', async () => {
    await bestEffort('cache write', Promise.reject('redis went away'));
    await bestEffort('cache write', () => {
      throw undefined;
    });
    await bestEffort('cache write', Promise.reject({ code: 'EAI_AGAIN' }));
    await bestEffort('cache write', Promise.reject(new Error()));
    // Nothing enumerable to print, and String() on this one throws outright.
    await bestEffort('cache write', Promise.reject(Object.create(null)));

    const errors = warnMock.mock.calls.map(errorOf);
    expect(errors).toEqual([
      'redis went away',
      'threw undefined',
      '{"code":"EAI_AGAIN"}',
      'Error',
      'threw an object with no readable fields',
    ]);
    // The two log lines that used to be worthless: a bare "undefined" from a
    // thrown non-Error, and "[object Object]" from a rejected plain object.
    expect(errors).not.toContain('undefined');
    expect(errors).not.toContain('[object Object]');
  });

  it('resolves to undefined when no fallback was given', async () => {
    const failed = bestEffort('follower notification', Promise.reject(new Error('queue is down')));
    await expect(failed).resolves.toBeUndefined();
    expect(warnMock).toHaveBeenCalledTimes(1);
  });

  it('redacts a secret the rejection was carrying instead of logging it whole', async () => {
    // The hole this closes: the thrown value used to be flattened to a JSON
    // string before the logger ever saw it, and utils/logger.ts redacts by key
    // name as it walks the meta object. A Stripe rejection carrying a live key
    // arrived as an opaque `error` string with no key left to match, and went
    // into the log verbatim — logs being copied, shipped and searched by far
    // more people than the database is.
    await bestEffort(
      'stripe payment intent',
      Promise.reject({
        code: 'card_declined',
        clientSecret: 'sk_live_51NOTAREALKEYatall',
        request: { headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.fake' } },
      })
    );

    const logged = String(errorOf(warnMock.mock.calls[0]));
    expect(logged).not.toContain('sk_live_51NOTAREALKEYatall');
    expect(logged).not.toContain('eyJhbGciOiJIUzI1NiJ9.fake');
    expect(logged).toContain('[redacted]');
    // Redacted, not gutted: a line nobody can diagnose from is just a quieter
    // version of the silence this helper was written to end.
    expect(logged).toContain('card_declined');
  });

  it('opens up an Error carried inside the rejection instead of logging it whole', async () => {
    // Redacting before flattening closed only the plain-object case. Errors
    // walked straight back out of it: utils/logger.ts returns any Error node
    // untouched — walking its keys would empty it, since message and stack are
    // own non-enumerable properties — and JSON.stringify then wrote that
    // Error's enumerable own properties out in full. A real StripeCardError
    // carries headers, payment_intent and a raw copy of the response as exactly
    // such properties, and wrapping a caught error in a little context before
    // rejecting is an everyday shape, so both secrets below went into the log
    // in the clear while the message — the one part worth reading — did not.
    await bestEffort(
      'stripe payment intent',
      Promise.reject({
        stage: 'charge',
        cause: Object.assign(new Error('Your card was declined.'), {
          code: 'card_declined',
          headers: { authorization: 'Bearer sk_live_REALKEY' },
          payment_intent: { id: 'pi_1', client_secret: 'pi_1_secret_REALSECRET' },
        }),
      })
    );

    const logged = String(errorOf(warnMock.mock.calls[0]));
    expect(logged).not.toContain('sk_live_REALKEY');
    expect(logged).not.toContain('pi_1_secret_REALSECRET');
    expect(logged).toContain('[redacted]');
    // And still worth reading afterwards: which step, what the gateway said,
    // the code to search on, and the intent to look up.
    expect(logged).toContain('charge');
    expect(logged).toContain('Your card was declined.');
    expect(logged).toContain('card_declined');
    expect(logged).toContain('pi_1');
  });

  it('lets a value that defines toJSON go on serialising itself', async () => {
    // redactSensitive rebuilds every object from Object.entries, which drops
    // the prototype and the toJSON with it, so a class that had said how it
    // wants to be written down was overruled and its internals printed instead
    // — output the plain JSON.stringify this replaced would never have
    // produced. A Prisma Decimal is the live case: "12.34" became
    // {"s":1,"e":1,"d":[12,3400000]}, and money, tax and accounting all pass
    // Decimals around.
    class Money {
      constructor(
        private readonly cents: number,
        private readonly ledgerRef: string
      ) {}
      toJSON() {
        return `${(this.cents / 100).toFixed(2)} AUD`;
      }
    }
    await bestEffort(
      'invoice total',
      Promise.reject({ step: 'total', amount: new Money(1234, 'internal-ledger-ref') })
    );

    expect(errorOf(warnMock.mock.calls[0])).toBe('{"step":"total","amount":"12.34 AUD"}');
  });

  it('does not spin forever on a rejection that points back at itself through an Error', async () => {
    // A cycle that runs through an Error used to cost the whole line, not just
    // the secret: redactSensitive handed the Error back whole, so its WeakSet
    // never saw the reference that closes the loop, JSON.stringify threw
    // "Converting circular structure to JSON", and the rejection logged as
    // "threw an object with no readable fields". Flattening the Error first
    // puts that reference back on the path the WeakSet walks.
    const failure: Record<string, unknown> = { stage: 'refund' };
    const cause = Object.assign(new Error('gateway timed out'), {
      apiKey: 'sk_live_REALKEY',
      context: failure,
    });
    failure.cause = cause;

    await bestEffort('refund', Promise.reject(failure));

    const logged = String(errorOf(warnMock.mock.calls[0]));
    expect(logged).not.toContain('sk_live_REALKEY');
    expect(logged).toContain('[redacted]');
    expect(logged).toContain('[circular]');
    expect(logged).toContain('gateway timed out');
  });

  it('still says something when the rejection cannot be turned into JSON', async () => {
    const circular: Record<string, unknown> = { host: 'redis-primary' };
    circular.self = circular;
    await bestEffort('cache write', Promise.reject(circular));
    // JSON.stringify throws on a BigInt, and no walk can fix that, so the
    // helper has to fall back rather than throw out of the logging path.
    await bestEffort('ledger row', Promise.reject({ amount: 10n }));

    const [circularError, bigintError] = warnMock.mock.calls.map(errorOf);
    expect(circularError).toBe('{"host":"redis-primary","self":"[circular]"}');
    expect(String(bigintError)).toContain('no readable fields');
  });

  it('will not let a caller type the missing fallback away', async () => {
    // A compile-time test, and the reason bestEffort is declared as overloads.
    // The single `<T, F = undefined>` signature it had gave F no inference site
    // among the arguments while still using it in the return type, so
    // TypeScript took F from the call site's contextual type instead of
    // defaulting it: this line type-checked, and the value was undefined the
    // moment the work failed.
    // @ts-expect-error no fallback was passed, so the result may be undefined
    const noFallback: string = await bestEffort('welcome email', Promise.resolve('sent'));
    expect(noFallback).toBe('sent');

    // The other call shape still types as the fallback's type, with no cast.
    const withFallback: string = await bestEffort(
      'welcome email',
      Promise.reject(new Error('queue is down')),
      'not sent'
    );
    expect(withFallback).toBe('not sent');
  });
});
