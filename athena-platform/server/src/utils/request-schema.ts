/**
 * Reading a request body the way a member's own settings need it read: only
 * the fields the schema names, and a refusal that says so when anything else
 * arrives.
 *
 * Why not the default. zod's `z.object` drops keys it does not know and
 * carries on, so a body `{ userId: 'someone-else' }` is "accepted" and the
 * extra key simply vanishes. That is safe only while every handler remembers
 * to build its write from the parsed result. The handlers this replaced
 * handed `req.body` itself to Prisma, and Prisma reads more into an object
 * than a column list: `{ user: { update: { role: 'SUPER_ADMIN' } } }` is a
 * nested write to the member's own account row. Refusing the unknown key
 * keeps a mistake like that from being silent, and tells the one honest
 * client we have (our own pages) exactly what it sent wrongly.
 *
 * Use it for bodies that go to the database. A schema passed here must end in
 * `.strict()`; an object schema that does not would strip the key and never
 * reach the refusal, so this fails loudly when handed one.
 */

import { z } from 'zod';
import { ApiError } from '../middleware/errorHandler';

/** `YYYY-MM-DD` or a full ISO 8601 timestamp: what an HTML date input or `toISOString()` sends. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * An ISO 8601 date string, handed on as a Date. `z.coerce.date()` is not used
 * because it runs `new Date(value)` on anything, so a number, `true` or the
 * word "tomorrow" would pass; this takes the two shapes a form actually sends.
 */
export const isoDate = () =>
  z
    .string()
    .trim()
    .regex(ISO_DATE, 'must be a date such as 2026-09-30')
    .transform((value, ctx) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a real date' });
        return z.NEVER;
      }
      return date;
    });

function isStrictObject(schema: z.ZodTypeAny): boolean {
  let current: z.ZodTypeAny = schema;
  // `.refine()` and `.transform()` wrap the object in an effects node.
  while (current instanceof z.ZodEffects) current = current.innerType();
  return current instanceof z.ZodObject && current._def.unknownKeys === 'strict';
}

/**
 * Parses `body` with a strict schema, or throws a 400 that names the first
 * problem: `Unknown field: userId` for an overposted key, otherwise
 * `<field>: <what is wrong>`.
 */
export function parseStrict<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  if (!isStrictObject(schema)) {
    throw new Error('parseStrict needs an object schema that ends in .strict()');
  }
  const parsed = schema.safeParse(body ?? {});
  if (parsed.success) return parsed.data;

  const unknownKeys = parsed.error.issues.find((issue) => issue.code === 'unrecognized_keys');
  if (unknownKeys && unknownKeys.code === 'unrecognized_keys') {
    const names = unknownKeys.keys.map((key) => [...unknownKeys.path, key].join('.')).join(', ');
    throw new ApiError(400, `Unknown ${unknownKeys.keys.length === 1 ? 'field' : 'fields'}: ${names}`);
  }

  const issue = parsed.error.issues[0];
  throw new ApiError(
    400,
    issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'That request could not be read'
  );
}
