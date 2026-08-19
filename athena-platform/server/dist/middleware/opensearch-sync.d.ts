/**
 * OpenSearch Sync Middleware
 * ==========================
 * Prisma middleware to automatically sync data to OpenSearch on create/update/delete.
 */
import { Prisma } from '@prisma/client';
export declare function createOpenSearchMiddleware(): Prisma.Middleware;
export declare function syncAllToOpenSearch(prisma: any): Promise<void>;
export declare function syncModelToOpenSearch(prisma: any, modelName: string): Promise<any>;
export declare const openSearchSyncMiddleware: Prisma.Middleware;
//# sourceMappingURL=opensearch-sync.d.ts.map