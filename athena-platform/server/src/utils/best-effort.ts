/**
 * Optional work that must not take a request down with it — and must not
 * vanish either.
 *
 * Around thirty catch blocks on this server end in `} catch {}`, or in a
 * comment and nothing else: the audit row that never got written, the
 * notification nobody was sent, the cache entry that quietly stopped being
 * refreshed. Carrying on with the request was the right call; doing it in
 * complete silence was not, because the first sign anything had failed was a
 * missing record weeks later. `bestEffort` keeps the caller's request alive
 * and still puts the failure in the log, labelled with which side effect it
 * was.
 */

import { logger, redactSensitive } from './logger';

/**
 * Work that is allowed to fail: either a promise for work already running, or
 * a thunk that starts it.
 *
 * Both are accepted because the two call shapes are not equivalent.
 * `bestEffort('audit row', writeAudit(entry))` has already started the call
 * before the helper ever sees it, so only a rejection can be caught.
 * `bestEffort('audit row', () => writeAudit(entry))` hands over the start as
 * well, so a synchronous throw — an argument the callee rejects before it
 * returns a promise at all — is caught too. Callers who want that protection
 * pass the thunk.
 */
export type BestEffortWork<T> = Promise<T> | (() => T | PromiseLike<T>);

/**
 * How deep the pre-pass below walks. It mirrors the MAX_DEPTH in
 * utils/logger.ts, which is not exported, so the two are kept equal by hand.
 * While they are equal this pass emits '[depth]' at exactly the level
 * redactSensitive would have, and the logged string is unchanged. If they ever
 * drift, the shallower of the two simply truncates first: an Error can never
 * slip past on depth, because past this limit nothing is returned but that
 * marker.
 */
const MAX_SCAN_DEPTH = 8;

/**
 * Rewrites every Error found anywhere in a rejection's object graph into a
 * plain object, so that the redactor which runs next can actually see inside
 * it.
 *
 * utils/logger.ts returns any Error node untouched — walking its keys would
 * empty it, since `message` and `stack` are own *non-enumerable* properties and
 * `name` lives on the prototype, so `JSON.stringify(new Error('boom'))` is
 * `'{}'`. Redacting the graph first therefore closed only the plain-object
 * case. A rejection that is an object *containing* an Error still went straight
 * through: redactSensitive handed the Error back whole, and JSON.stringify then
 * wrote out its enumerable own properties verbatim. A real StripeCardError from
 * the `stripe` package carries `headers`, `payment_intent` and a `raw` copy of
 * the whole response as exactly such properties, so
 * `Promise.reject({ stage: 'charge', cause: stripeError })` — wrapping a caught
 * error in a bit of context is a very ordinary shape — put
 * `headers.authorization` and `payment_intent.client_secret` in the log in the
 * clear, the two key names this file's own redaction was written to stop, while
 * dropping the message that would have made the line worth reading.
 *
 * The Error's own properties are spread into the replacement rather than
 * dropped, because dropping them would take `code`, `statusCode` and
 * `decline_code` with them and leave a line nobody can act on. Spread, every
 * one of those keys is a key again, which is the only thing SENSITIVE_KEY can
 * match on. `stack` is deliberately left out: being non-enumerable it was never
 * part of this field to begin with, so leaving it out changes nothing, and a
 * stack folded into the one-line `error` string is unreadable anyway. Where the
 * rejection is itself an Error, bestEffort already logs its stack separately.
 */
function plainForRedaction(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth > MAX_SCAN_DEPTH) return '[depth]';
  // Dates and buffers are passed through exactly as logger.ts passes them
  // through, so that this pass cannot change how either is logged. Rebuilding a
  // Date from its entries would produce {} — it has no own enumerable
  // properties at all — and a Buffer's are its byte indices. Neither can hide
  // an Error, and JSON.stringify already knows how to write both.
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (value instanceof Error) {
    // Read through the accessors, not the own-property list, because that is
    // the only place these two survive; the loop then skips them so that an
    // own enumerable `name` — assignable, since `name` comes from the prototype
    // — cannot land twice.
    const flattened: Record<string, unknown> = { name: value.name, message: value.message };
    for (const [key, item] of Object.entries(value)) {
      if (key === 'name' || key === 'message') continue;
      flattened[key] = plainForRedaction(item, depth + 1, seen);
    }
    // `cause` is an own NON-enumerable property when it was passed to the
    // constructor, so the loop above never sees it; a wrapped error's original
    // reason is usually the whole diagnosis, and it is redacted like the rest.
    // Guarded on the loop not having taken it already: `err.cause = inner`
    // assigns an own *enumerable* one, which the loop does copy — and because
    // that first pass adds the value to `seen`, calling again unguarded came
    // back '[circular]' and overwrote the reason with nothing.
    if (value.cause !== undefined && !('cause' in flattened)) {
      flattened.cause = plainForRedaction(value.cause, depth + 1, seen);
    }
    return flattened;
  }

  // A class that defines toJSON has stated how it wants to be serialised, and
  // JSON.stringify honoured that until redactSensitive was inserted in front of
  // it. redactSensitive rebuilds every object from Object.entries, which drops
  // the prototype and the toJSON with it, so that class gets overruled and its
  // internals printed instead: a Prisma Decimal serialises itself as "12.34",
  // but rebuilt from its entries it comes out as {"s":1,"e":1,"d":[12,3400000]}
  // — and money.service, tax.service and accounting.service all hand Decimals
  // around. Calling toJSON here puts the class's own answer back in front, and
  // it cannot smuggle anything past the redactor: the result is walked and its
  // keys matched like any other value, and a value under a sensitive key is
  // still replaced wholesale. Nor is it an extra call — it is the call
  // JSON.stringify makes at the end of this pipeline, made earlier.
  const toJSON = (value as { toJSON?: unknown }).toJSON;
  if (typeof toJSON === 'function') {
    return plainForRedaction((toJSON as () => unknown).call(value), depth + 1, seen);
  }

  if (Array.isArray(value)) {
    return value.map((item) => plainForRedaction(item, depth + 1, seen));
  }

  // Everything else is rebuilt as a plain object. That loses the prototype, but
  // redactSensitive is about to rebuild it from Object.entries and lose it
  // anyway, so nothing survives this pass that would not have survived the
  // next one.
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = plainForRedaction(item, depth + 1, seen);
  }
  return out;
}

/**
 * The JSON form of a rejection that carried data, or null when there is none
 * to be had. A plain object rejection (`Promise.reject({ code: 'EAI_AGAIN' })`)
 * is worth reading in full; JSON.stringify throws on a circular object or on a
 * BigInt inside one, which is why the failure is a value here and not an
 * exception thrown out of the logging path.
 *
 * The value is redacted before it is flattened, and the order matters. This
 * used to be a bare JSON.stringify, which was a hole straight through the
 * logger's redaction: utils/logger.ts matches SENSITIVE_KEY against key names
 * as it walks the meta object, so by the time a rejection carrying
 * `{ clientSecret: 'sk_live_...' }`, an `authorization` header or a `password`
 * had been flattened into the `error` string there was no key left for it to
 * match, and the secret went into the log verbatim — the one thing that logger
 * was written to prevent. Redacting first puts the value in front of that key
 * check while it is still an object graph.
 *
 * Redacting first is not enough on its own, because redactSensitive steps over
 * Errors; plainForRedaction turns those into objects it will step into. Only
 * nested Errors can reach here at all — describeFailure answers out of the
 * Error's own message or name when the rejection *is* an Error, and never calls
 * this — so what this protects is a rejection carrying an Error, not a rejected
 * one.
 */
function jsonFields(cause: unknown): string | null {
  try {
    // redactSensitive walks the graph with its own depth limit and a WeakSet
    // that turns a repeated reference into '[circular]', so a circular
    // rejection now survives stringifying instead of being lost; the pre-pass
    // carries its own WeakSet and depth limit for the same reason. The catch
    // stays regardless: a BigInt field, or a toJSON()/getter that throws, still
    // takes JSON.stringify — or one of the two walks — down, and nothing in the
    // logging path is allowed to throw at the caller.
    const json = JSON.stringify(redactSensitive(plainForRedaction(cause)));
    return json && json !== '{}' ? json : null;
  } catch {
    return null;
  }
}

/**
 * Turns whatever was thrown into a line worth reading. Anything at all can be
 * thrown in JavaScript, and a rejection carrying a string or `undefined` logs
 * as "undefined" — and a plain object as "[object Object]" — neither of which
 * tells the reader anything about what broke.
 */
function describeFailure(cause: unknown): string {
  if (cause instanceof Error) {
    // `new Error()` with no message would log as an empty string, which reads
    // as though nothing went wrong; the class name at least says what it was.
    return cause.message || cause.name || 'Error with no message';
  }
  if (typeof cause === 'string') return cause.trim() || 'threw an empty string';
  if (cause === undefined) return 'threw undefined';
  if (cause === null) return 'threw null';

  const fields = jsonFields(cause);
  if (fields) return fields;

  if (typeof cause === 'object') {
    // Nothing came out as JSON, and String() on an object is either the
    // useless "[object Object]" or, for an object made with a null prototype,
    // a TypeError thrown from inside the helper that promised never to throw.
    // The constructor name is the one thing here that is both safe and a
    // starting point for whoever reads the line.
    const name = (cause as { constructor?: { name?: string } }).constructor?.name;
    return name ? `threw a ${name} with no readable fields` : 'threw an object with no readable fields';
  }
  return String(cause);
}

/**
 * Runs work whose failure the caller has already decided it can live without:
 * on failure it logs against `label` and resolves to `fallback` rather than
 * rejecting. It never rethrows, and it never fails silently.
 *
 * The resolved type is the work's own value on success and the fallback's type
 * on failure, so what a caller gets back is:
 *
 * ```ts
 * const rows = await bestEffort('recent activity', loadRows());        // Row[] | undefined
 * const rows = await bestEffort('recent activity', loadRows(), []);    // Row[]
 * const seen = await bestEffort('last seen', () => readSeen(), null);  // Date | null
 * ```
 *
 * @param label    Names the side effect in the words whoever reads the log
 *                 will need — "stripe webhook audit row", not "step 3".
 * @param work     The optional work: a promise already in flight, or a thunk
 *                 that starts it (see {@link BestEffortWork}).
 * @param fallback What to resolve to when the work fails. Left out it is
 *                 `undefined`, which is the honest answer for a value that
 *                 could not be computed — never a stand-in number or an
 *                 invented record. Leaving it out puts that `undefined` in the
 *                 returned type too, where the caller has to deal with it.
 * @returns The work's resolved value `T`, or `fallback` if it threw or
 *          rejected.
 */
export function bestEffort<T>(label: string, work: BestEffortWork<T>): Promise<T | undefined>;
/**
 * With a fallback, the result is never undefined unless the fallback itself is.
 * See the overload above for the parameters.
 */
export function bestEffort<T, F>(
  label: string,
  work: BestEffortWork<T>,
  fallback: F
): Promise<T | F>;
// Two overloads rather than the single `<T, F = undefined>` signature this
// started with, because that signature lied. With `fallback` optional, F had no
// inference site among the arguments but still appeared in the return type, so
// TypeScript inferred it from the call site's contextual type instead of
// falling back to `undefined`: `const rows: Row[] = await bestEffort('l', work)`
// compiled cleanly and handed back undefined the moment the work failed. That
// is the exact class of bug this helper exists to make visible, so the type has
// to be the one thing that cannot hide it. Splitting the call shapes gives each
// one an honest return type, and the implementation signature below is not
// visible to callers.
export async function bestEffort<T, F>(
  label: string,
  work: BestEffortWork<T>,
  fallback?: F
): Promise<T | F | undefined> {
  try {
    // The thunk is invoked inside the try on purpose: `() => doThing()` can
    // throw before it ever returns a promise, and that synchronous throw has
    // to land here too, or the caller gets the exception this helper exists
    // to absorb.
    return await (typeof work === 'function' ? work() : work);
  } catch (error) {
    // `warn`, not `error`: the request itself succeeded and nobody needs
    // paging. It is in the log so that a missing audit row can be traced back
    // to the moment it failed, instead of being discovered months later.
    logger.warn(`Best-effort work failed: ${label}`, {
      label,
      error: describeFailure(error),
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    });
    return fallback;
  }
}
