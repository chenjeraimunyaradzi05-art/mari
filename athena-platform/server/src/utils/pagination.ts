/**
 * Pagination utilities with security limits
 */

// Default limits
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE = 1;

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
  const page = Math.max(1, parseInt(query.page as string, 10) || DEFAULT_PAGE);
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
