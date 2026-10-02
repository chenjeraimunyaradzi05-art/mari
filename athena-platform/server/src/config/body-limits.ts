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
 * Not listed, because they never meet this parser: the Stripe and SendGrid
 * webhooks, which take the raw body (mounted before this in index.ts), and file
 * uploads, which are multipart and read by multer against their own per-kind
 * size limits.
 */

import express, { Application } from 'express';

export const DEFAULT_JSON_LIMIT = '256kb';

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

/** Mounts the JSON and form body parsers: each larger route at its own limit, then everything else at the default. */
export function mountJsonBodyParsers(app: Application): void {
  for (const { path, limit } of LARGER_JSON_BODIES) {
    app.use(path, express.json({ limit }));
  }
  app.use(express.json({ limit: DEFAULT_JSON_LIMIT }));
  app.use(express.urlencoded({ extended: true }));
}
