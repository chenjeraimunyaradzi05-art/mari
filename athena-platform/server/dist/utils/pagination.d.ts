/**
 * Pagination utilities with security limits
 */
/**
 * Parse pagination parameters with safety limits
 * @param query - The request query object
 * @param maxLimit - Optional custom max limit (defaults to 100)
 * @returns Validated pagination parameters
 */
export declare function parsePagination(query: {
    page?: string;
    limit?: string;
}, maxLimit?: number): {
    page: number;
    limit: number;
    skip: number;
};
/**
 * Build pagination response metadata
 */
export declare function buildPaginationMeta(total: number, page: number, limit: number): {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
};
//# sourceMappingURL=pagination.d.ts.map