"use strict";
/**
 * Pagination utilities with security limits
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePagination = parsePagination;
exports.buildPaginationMeta = buildPaginationMeta;
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
function parsePagination(query, maxLimit = MAX_PAGE_SIZE) {
    const page = Math.max(1, parseInt(query.page, 10) || DEFAULT_PAGE);
    const rawLimit = parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE;
    const limit = Math.min(Math.max(1, rawLimit), maxLimit);
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}
/**
 * Build pagination response metadata
 */
function buildPaginationMeta(total, page, limit) {
    return {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total,
    };
}
//# sourceMappingURL=pagination.js.map