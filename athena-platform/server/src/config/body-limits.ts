/**
 * How large a JSON request body this API reads, per route.
 *
 * There was one limit for everything: `express.json({ limit: '10mb' })`,
 * mounted for every route including the ones that run before anyone is signed
 * in. A sign-in is a few dozen bytes. At ten megabytes the parser buffers and
 * parses a body two hundred thousand times that for a caller who has proved
 * nothing, on a process that is held to one instance, so a handful of
 * concurrent requests is memory the API does not have for the members.
 *
 * The default is now 256kb, which is more than any form on the web app sends
 * (the longest member text is 20,000 characters, an application's cover
 * letter or a business plan). The few routes that really take a bigger body
 * are named below with the reason, and only they get one. A body over its
 * limit is answered 413 by the error handler (`entity.too.large`).
 *
 * The larger parsers are mounted ahead of the default one. body-parser skips a
 * request whose body an earlier parser has read, so a route in this list is
 * read once, at its own limit, and never meets the default.
 *
 * A larger limit is only for a caller who has signed in. The parsers run before
 * any route's `authenticate`, so without this a stranger could post five
 * megabytes at /api/admin/breaches and have the API buffer and parse all of it
 * before being told to sign in. The check here is the signature on the bearer
 * token, which costs one HMAC and no database read. A request that carries no
 * token, a forged one, an expired one or a refresh token gets no larger limit:
 * within the default it is read by the default parser below and the route's
 * `authenticate` answers as it always did; past the default it is answered 401
 * here, with the sentence `authenticate` would use, and not a byte of the body
 * is read. Not 413, deliberately. An access token lasts fifteen minutes and
 * neither client refreshes it ahead of time: both refresh on the first 401 and
 * send the request again. A member who spent twenty minutes on a breach notice
 * or pasting a spreadsheet would otherwise be told her file was too large when
 * it was her token that had lapsed, and nothing would retry. The route's own
 * `authenticate` still decides whether the session behind a good token is live.
 *
 * Not listed, because they never meet this parser: the Stripe and SendGrid
 * webhooks, which take the raw body (mounted before this in index.ts), and file
 * uploads, which are multipart and read by multer against their own per-kind
 * size limits.
 */

import express, { Application, Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../utils/jwt';
import { UnauthorizedError } from '../middleware/errorHandler';

/** The default limit in bytes: body-parser reads `256kb` as 256 × 1024. */
export const DEFAULT_JSON_LIMIT_BYTES = 256 * 1024;
export const DEFAULT_JSON_LIMIT = `${DEFAULT_JSON_LIMIT_BYTES / 1024}kb`;

export interface LargerJsonBody {
  /** The path prefix the larger limit applies to. */
  path: string;
  limit: string;
  /** Why this route cannot live within the default. */
  why: string;
}

export const LARGER_JSON_BODIES: readonly LargerJsonBody[] = [
  {
    path: '/api/banking/import',
    limit: '2mb',
    why: 'A bank statement export: up to 5,000 rows (open-banking.service MAX_IMPORT_ROWS), each with a description of up to 500 characters.',
  },
  {
    path: '/api/housing/admin/listings/import',
    limit: '2mb',
    why: "A partner's housing spreadsheet pasted as CSV, accepted up to a million characters (housing.routes.ts).",
  },
  {
    path: '/api/automotive/admin/catalogue/import',
    limit: '2mb',
    why: 'A car catalogue CSV, accepted up to a million characters (automotive.routes.ts).',
  },
  {
    path: '/api/wellness/entries/import',
    limit: '1mb',
    why: 'An Apple Health or Google Fit export: up to 500 entries, each with its own payload.',
  },
  {
    path: '/api/admin/marketing/leads/import',
    limit: '1mb',
    why: 'Rows pasted from a spreadsheet: up to 1,000 leads.',
  },
  {
    path: '/api/admin/breaches',
    limit: '5mb',
    why: 'Telling the members a breach affected: the request carries the id of every one of them (about forty bytes each), so a breach of a hundred thousand members is about four megabytes. This is the one request that must never fail for size in an incident.',
  },
  {
    path: '/api/admin/legal-holds',
    limit: '2mb',
    why: 'A hold names the members it covers by id.',
  },
  {
    path: '/api/admin/blog',
    limit: '1mb',
    why: 'An article body of up to 200,000 characters (admin-blog.routes.ts), which is up to four times that in bytes.',
  },
];

/**
 * Why the request's bearer token does not stand as a signed, unexpired access
 * token, in the words `authenticate` (middleware/auth.ts) uses for the same
 * refusal, or null when it does. Says nothing about the session behind a good
 * token, which is for `authenticate` to check once the body is read.
 */
export function accessTokenRefusal(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return 'No token provided';
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return 'No token provided';
  }
  try {
    verifyToken(token, 'access');
    return null;
  } catch (error) {
    return error instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token';
  }
}

/** Whether the request carries an access token this server signed and that has not expired. */
export function carriesSignedAccessToken(req: Request): boolean {
  return accessTokenRefusal(req) === null;
}

/**
 * Whether the request says, in its Content-Length, that its body is past the
 * default limit. A body sent chunked declares nothing and answers false; the
 * default parser below then stops it at the limit as it does any other.
 */
export function declaresBodyPastDefault(req: Request): boolean {
  const declared = Number(req.headers['content-length']);
  return Number.isFinite(declared) && declared > DEFAULT_JSON_LIMIT_BYTES;
}

/**
 * Mounts the JSON and form body parsers: each larger route at its own limit
 * for a caller with a signed access token, then everything else at the default.
 * On a larger route, a caller without one is answered 401 before the body is
 * read when the body is past the default, and otherwise handed on unchanged.
 */
export function mountJsonBodyParsers(app: Application): void {
  for (const { path, limit } of LARGER_JSON_BODIES) {
    const parser = express.json({ limit });
    const forSignedInCallers: RequestHandler = (req, res, next) => {
      const refusal = accessTokenRefusal(req);
      if (refusal === null) {
        return parser(req, res, next);
      }
      if (declaresBodyPastDefault(req)) {
        return next(UnauthorizedError(refusal));
      }
      return next();
    };
    app.use(path, forSignedInCallers);
  }
  app.use(express.json({ limit: DEFAULT_JSON_LIMIT }));
  app.use(express.urlencoded({ extended: true }));
}
