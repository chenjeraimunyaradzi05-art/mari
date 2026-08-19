"use strict";
/**
 * OpenSearch Sync Middleware
 * ==========================
 * Prisma middleware to automatically sync data to OpenSearch on create/update/delete.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.openSearchSyncMiddleware = void 0;
exports.createOpenSearchMiddleware = createOpenSearchMiddleware;
exports.syncAllToOpenSearch = syncAllToOpenSearch;
exports.syncModelToOpenSearch = syncModelToOpenSearch;
const queue_1 = require("../utils/queue");
const opensearch_1 = require("../utils/opensearch");
const logger_1 = require("../utils/logger");
// ===========================================
// MODELS TO SYNC
// ===========================================
const SYNC_CONFIG = {
    User: {
        indexName: opensearch_1.IndexNames.USERS,
        transform: (user) => ({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            headline: user.headline,
            bio: user.bio,
            skills: user.skills || [],
            industry: user.industry,
            location: user.location,
            persona: user.persona,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            // Searchable text
            searchText: [user.firstName, user.lastName, user.headline, user.bio].filter(Boolean).join(' '),
        }),
    },
    Job: {
        indexName: opensearch_1.IndexNames.JOBS,
        transform: (job) => ({
            id: job.id,
            title: job.title,
            description: job.description,
            company: job.company,
            location: job.location,
            city: job.city,
            state: job.state,
            country: job.country,
            type: job.type,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            salaryCurrency: job.salaryCurrency,
            remote: job.remote,
            skills: job.skills || [],
            requirements: job.requirements || [],
            benefits: job.benefits || [],
            status: job.status,
            organizationId: job.organizationId,
            createdAt: job.createdAt,
            expiresAt: job.expiresAt,
            // Searchable text
            searchText: [job.title, job.description, job.company, job.location].filter(Boolean).join(' '),
        }),
    },
    Post: {
        indexName: opensearch_1.IndexNames.POSTS,
        transform: (post) => ({
            id: post.id,
            content: post.content,
            type: post.type,
            authorId: post.authorId,
            tags: post.tags || [],
            likeCount: post.likeCount || 0,
            commentCount: post.commentCount || 0,
            shareCount: post.shareCount || 0,
            isPublic: post.isPublic,
            createdAt: post.createdAt,
            // Searchable text
            searchText: post.content,
        }),
    },
    Course: {
        indexName: opensearch_1.IndexNames.COURSES,
        transform: (course) => ({
            id: course.id,
            title: course.title,
            description: course.description,
            shortDescription: course.shortDescription,
            level: course.level,
            category: course.category,
            price: course.price,
            currency: course.currency,
            duration: course.duration,
            skills: course.skills || [],
            providerId: course.providerId,
            rating: course.rating,
            enrollmentCount: course.enrollmentCount,
            isPublished: course.isPublished,
            createdAt: course.createdAt,
            // Searchable text
            searchText: [course.title, course.description, course.shortDescription].filter(Boolean).join(' '),
        }),
    },
    Video: {
        indexName: opensearch_1.IndexNames.VIDEOS,
        transform: (video) => ({
            id: video.id,
            title: video.title,
            description: video.description,
            authorId: video.authorId,
            tags: video.tags || [],
            duration: video.duration,
            viewCount: video.viewCount || 0,
            likeCount: video.likeCount || 0,
            isPublic: video.isPublic,
            createdAt: video.createdAt,
            // Searchable text
            searchText: [video.title, video.description].filter(Boolean).join(' '),
        }),
    },
};
// ===========================================
// MIDDLEWARE
// ===========================================
function createOpenSearchMiddleware() {
    return async (params, next) => {
        // Execute the actual database operation first
        const result = await next(params);
        // Check if this model should be synced
        const config = params.model ? SYNC_CONFIG[params.model] : null;
        if (!config) {
            return result;
        }
        try {
            // Handle different operations
            switch (params.action) {
                case 'create':
                case 'update':
                    if (result && result.id) {
                        await (0, queue_1.queueSearchIndexing)({
                            operation: 'index',
                            indexName: config.indexName,
                            documentId: result.id,
                            document: config.transform(result),
                        });
                        logger_1.logger.debug('Queued search index update', {
                            model: params.model,
                            action: params.action,
                            id: result.id,
                        });
                    }
                    break;
                case 'delete':
                    if (result && result.id) {
                        await (0, queue_1.queueSearchIndexing)({
                            operation: 'delete',
                            indexName: config.indexName,
                            documentId: result.id,
                        });
                        logger_1.logger.debug('Queued search index delete', {
                            model: params.model,
                            id: result.id,
                        });
                    }
                    break;
                case 'createMany':
                    // For batch creates, queue each document
                    if (Array.isArray(result)) {
                        for (const item of result) {
                            if (item.id) {
                                await (0, queue_1.queueSearchIndexing)({
                                    operation: 'index',
                                    indexName: config.indexName,
                                    documentId: item.id,
                                    document: config.transform(item),
                                });
                            }
                        }
                    }
                    break;
                case 'updateMany':
                case 'deleteMany':
                    // For bulk operations, we can't easily get IDs
                    // In production, you might want to re-index the affected records
                    logger_1.logger.debug('Bulk operation - manual re-index may be needed', {
                        model: params.model,
                        action: params.action,
                    });
                    break;
            }
        }
        catch (error) {
            // Don't fail the main operation if search sync fails
            logger_1.logger.error('Search sync failed', {
                model: params.model,
                action: params.action,
                error: error.message,
            });
        }
        return result;
    };
}
// ===========================================
// BULK SYNC FUNCTIONS
// ===========================================
async function syncAllToOpenSearch(prisma) {
    logger_1.logger.info('Starting full OpenSearch sync');
    for (const [modelName, config] of Object.entries(SYNC_CONFIG)) {
        try {
            const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
            const records = await prisma[modelKey].findMany({
                take: 10000, // Limit for safety
            });
            logger_1.logger.info(`Syncing ${records.length} ${modelName} records to OpenSearch`);
            for (const record of records) {
                await (0, queue_1.queueSearchIndexing)({
                    operation: 'index',
                    indexName: config.indexName,
                    documentId: record.id,
                    document: config.transform(record),
                });
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to sync ${modelName}`, { error: error.message });
        }
    }
    logger_1.logger.info('Full OpenSearch sync queued');
}
async function syncModelToOpenSearch(prisma, modelName) {
    const config = SYNC_CONFIG[modelName];
    if (!config) {
        throw new Error(`No sync config for model: ${modelName}`);
    }
    const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const records = await prisma[modelKey].findMany({
        take: 10000,
    });
    logger_1.logger.info(`Syncing ${records.length} ${modelName} records`);
    for (const record of records) {
        await (0, queue_1.queueSearchIndexing)({
            operation: 'index',
            indexName: config.indexName,
            documentId: record.id,
            document: config.transform(record),
        });
    }
    return records.length;
}
// Export alias for convenience
exports.openSearchSyncMiddleware = createOpenSearchMiddleware();
//# sourceMappingURL=opensearch-sync.js.map