/**
 * Pagination utilities with security limits
 */

// Default limits
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE = 1;
// Deep enough that nobody scrolling gets there, shallow enough that `skip`
// stays a number Postgres will take as an OFFSET: ?page=99999999999 used to
// reach the database as a 500.
const MAX_PAGE = 10_000;

/**
 * Parse pagination parameters with safety limits
 * @param query - The request query object
 * @param maxLimit - Optional custom max limit (defaults to 100)
 * @returns Validated pagination parameters
 */
export function parsePagination(
  query: { page?: string; limit?: string },
  maxLimit: number = MAX_PAGE_SIZE
): { page: number; limit: number; skip: number } {
  const page = Math.min(Math.max(1, parseInt(query.page as string, 10) || DEFAULT_PAGE), MAX_PAGE);
  const rawLimit = parseInt(query.limit as string, 10) || DEFAULT_PAGE_SIZE;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Build pagination response metadata
 */
export function buildPaginationMeta(total: number, page: number, limit: number) {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    hasMore: page * limit < total,
  };
}

/**
 * A page size from a query string, kept between 1 and `max`.
 *
 * `parseInt(req.query.limit) || 20` was written at about a dozen list routes,
 * and what it does not do is stop `?limit=1000000` (a million rows asked of
 * Prisma or OpenSearch by whoever types it), or `?limit=-5` (Prisma reads a
 * negative `take` as "from the end"). Anything that is not a whole number,
 * including an array (`?limit=1&limit=2`), is the fallback rather than an
 * error: a list that answers with its usual page is kinder to a stale client
 * than a 400, and it is what `parsePagination` above has always done.
 */
export function clampLimit(value: unknown, fallback: number = DEFAULT_PAGE_SIZE, max: number = MAX_PAGE_SIZE): number {
  const parsed = typeof value === 'number' ? Math.trunc(value) : typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed === 0) return Math.min(Math.max(1, fallback), max);
  return Math.min(Math.max(1, parsed), max);
}

/** A page number from a query string: a whole number of at least 1, and no more than `max` so `skip` stays sane. */
export function clampPage(value: unknown, max: number = MAX_PAGE): number {
  const parsed = typeof value === 'number' ? Math.trunc(value) : typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE;
  return Math.min(Math.max(DEFAULT_PAGE, parsed), max);
}
