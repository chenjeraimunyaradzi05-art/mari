/**
 * One way to check a request: a zod schema, run before the handler, answering
 * 400 with the field and what is wrong with it.
 *
 *   router.post('/gifts', authenticate, zodBody(giftSchema), handler);
 *   router.get('/gifts/received', authenticate, zodQuery(paginationQuery()), handler);
 *   router.get('/:id', authenticate, zodParams(idParams), handler);
 *
 * The handler then reads `req.body`, `req.query` and `req.params` as before,
 * and what it reads is what the schema produced: unknown keys of a body are
 * gone (or refused, if the schema is `.strict()`), numbers are numbers, text is
 * trimmed. A schema is the only place a route says what it accepts.
 *
 * Where the request is a body that goes near the database, make the schema
 * `.strict()`. zod drops a key it does not know and carries on, which is safe
 * only while the handler builds its write from the parsed result; a strict
 * schema turns an overposted key (`{ role: 'ADMIN' }` to a profile route) into
 * a 400 that names it, so the mistake cannot be silent.
 *
 * The same checking is available inline as `parseWith(schema, value)`, for a
 * handler that has to decide which schema to use after it has read something.
 *
 * Why not express-validator: its chains check nothing by themselves.
 * `body('x').isInt()` in a route's argument list only records a result, and
 * the request goes on to the handler unless the handler also calls
 * `validationResult(req)`. Several routes here declared chains and never read
 * them (creator gifts, the mentor session list, the profile route that handed
 * its raw body to Prisma). A zod middleware cannot be declared and forgotten:
 * the request does not reach the handler unless it passed.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { ApiError } from './errorHandler';

/**
 * What a member or a developer is told: `Unknown field: userId` for a key the
 * schema does not take, otherwise `<field>: <what is wrong>`, naming the first
 * problem only so the answer is one sentence.
 */
export function describeZodError(error: z.ZodError): string {
  const unknownKeys = error.issues.find((issue) => issue.code === 'unrecognized_keys');
  if (unknownKeys && unknownKeys.code === 'unrecognized_keys') {
    const names = unknownKeys.keys.map((key) => [...unknownKeys.path, key].join('.')).join(', ');
    return `Unknown ${unknownKeys.keys.length === 1 ? 'field' : 'fields'}: ${names}`;
  }
  const issue = error.issues[0];
  if (!issue) return 'That request could not be read';
  const where = issue.path.join('.');
  return where ? `${where}: ${issue.message}` : issue.message;
}

/** Parses `value` or throws the 400 the middleware below would have answered. */
export function parseWith<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new ApiError(400, describeZodError(parsed.error));
}

/**
 * Checks `req.body`. A missing body is read as `{}` so a schema of optional
 * fields accepts an empty request and one with required fields names the first.
 */
export function zodBody(schema: z.ZodTypeAny): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = parseWith(schema, req.body ?? {});
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Checks `req.query`. The parsed fields replace the raw ones under the same
 * names and keys the schema does not mention are left as they arrived, because
 * a query string legitimately carries things a schema has no reason to know
 * (a cache-buster, a tracking tag) and a handler migrating to this may still
 * read a key it has not declared yet.
 */
export function zodQuery(schema: z.ZodTypeAny): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = parseWith(schema, req.query);
      req.query = { ...req.query, ...(parsed as Record<string, unknown>) } as Request['query'];
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Checks `req.params`, so a path segment that should be an id is one before a query is built from it. */
export function zodParams(schema: z.ZodTypeAny): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.params = { ...req.params, ...(parseWith(schema, req.params) as Record<string, string>) };
      next();
    } catch (error) {
      next(error);
    }
  };
}
