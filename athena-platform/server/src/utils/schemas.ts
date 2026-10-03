/**
 * The building blocks route schemas are made from.
 *
 * Twenty-one route and service files each defined their own `uuid`, `money`
 * and state list, with ceilings from $1,000,000 to $1,000,000,000 and no two
 * of them agreeing on whether `true` is a number. Use these in new schemas, and
 * move an old route onto them when it is next touched; `scripts/check-route-
 * validation.js` is what keeps a route from having no schema at all.
 *
 * Two rules the pieces share:
 *
 *  - A number arrives as a number or as a numeric string, and nothing else.
 *    `z.coerce.number()` is the obvious tool and the wrong one for input: it
 *    runs `Number(value)`, so `true` is 1, `null` and `''` are 0 and `[]` is 0.
 *    A money field that "validates" a boolean as a dollar is not validating.
 *  - Text is trimmed and has a ceiling. A string with no `.max()` is an
 *    invitation to store whatever is sent, up to the body limit.
 */

import { z } from 'zod';
import { httpUrl } from './http-url';
import { clampLimit, clampPage } from './pagination';
import { AU_STATES } from '../services/strategy/au-rates';

export { httpUrl };

/** A row id: every model in the schema is keyed by a UUID. */
export const uuid = z.string().uuid('must be an id');

/** `{ id }` in the path, for `zodParams(idParams)`. */
export const idParams = z.object({ id: uuid });

/**
 * A finite number, from a number or a string that is only a number. `''`,
 * `'  '`, `true`, `null` and arrays are refused instead of becoming 0 or 1.
 */
export const numeric = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
  z.number({ invalid_type_error: 'must be a number', required_error: 'is required' }).finite('must be a number')
);

/** A whole number of at least 1 and at most `max`. */
export const positiveInt = (max = 1_000_000) => numeric.pipe(z.number().int('must be a whole number').min(1).max(max));

/** Whole cents: 12.34 is fine, 12.345 is not. Compared in cents so 0.1 + 0.2 style float dust does not fail. */
const isWholeCents = (value: number) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

/**
 * A positive amount of Australian dollars, to the cent, at most `max`
 * (a million by default; a route that takes more says so). It is a number of
 * dollars, as the prices and balances in this API are, not cents.
 */
export const audMoney = (max = 1_000_000) =>
  numeric.pipe(
    z
      .number()
      .positive('must be more than $0')
      .max(max, `must be at most $${max.toLocaleString('en-AU')}`)
      .refine(isWholeCents, 'must be a whole number of cents')
  );

/** Like `audMoney`, but zero is allowed: a price that can be free, a balance. */
export const audMoneyOrZero = (max = 1_000_000) =>
  numeric.pipe(
    z
      .number()
      .min(0, 'cannot be negative')
      .max(max, `must be at most $${max.toLocaleString('en-AU')}`)
      .refine(isWholeCents, 'must be a whole number of cents')
  );

/** An Australian state or territory code: QLD, NSW, VIC, WA, SA, TAS, ACT or NT. */
export const auState = z.enum(AU_STATES as [(typeof AU_STATES)[number], ...(typeof AU_STATES)[number][]], {
  errorMap: () => ({ message: `must be one of ${AU_STATES.join(', ')}` }),
});

/** An email address, trimmed and lower-cased, within the 254 characters the standard allows. */
export const email = z.string().trim().toLowerCase().email('must be an email address').max(254);

/** Text that must have something in it, trimmed, at most `max` characters. */
export const text = (max: number) => z.string().trim().min(1, 'is required').max(max, `must be at most ${max} characters`);

/** Text that may be empty, trimmed, at most `max` characters. */
export const optionalText = (max: number) => z.string().trim().max(max, `must be at most ${max} characters`);

/** A calendar day as a form sends it: YYYY-MM-DD, and a day that exists. */
export const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a day such as 2026-09-30')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, 'must be a real day');

/** `?flag=true` or `?flag=false`, as the boolean. Anything else is refused rather than read as false. */
export const queryFlag = z.enum(['true', 'false']).transform((value) => value === 'true');

/**
 * A page size from the query string. Never fails: a missing, non-numeric or
 * absurd value becomes the fallback or the ceiling, which is what
 * `parsePagination` has always done and what a stale client expects.
 */
export const limitQuery = (fallback = 20, max = 100) => z.unknown().transform((value) => clampLimit(value, fallback, max));

/** A page number from the query string, clamped the same way. */
export const pageQuery = () => z.unknown().transform((value) => clampPage(value));

/** `?page=&limit=`, for `zodQuery(paginationQuery())` or `.extend({...})`. */
export const paginationQuery = (fallback = 20, max = 100) =>
  z.object({ page: pageQuery(), limit: limitQuery(fallback, max) });
