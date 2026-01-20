"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDocument = exports.indexDocument = exports.IndexNames = exports.getOpenSearchClient = exports.initializeOpenSearch = void 0;
const opensearch_1 = require("@opensearch-project/opensearch");
const logger_1 = require("./logger");
const node = process.env.OPENSEARCH_NODE || 'http://localhost:9200';
const username = process.env.OPENSEARCH_USERNAME || 'admin';
const password = process.env.OPENSEARCH_PASSWORD || 'admin';
let client = null;
let isConnected = false;
const initializeOpenSearch = async () => {
    try {
        if (!process.env.OPENSEARCH_NODE) {
            logger_1.logger.warn('OPENSEARCH_NODE not set, skipping OpenSearch initialization');
            return;
        }
        client = new opensearch_1.Client({
            node,
            auth: {
                username,
                password,
            },
            ssl: {
                rejectUnauthorized: false, // For local dev with self-signed certs
            },
        });
        const health = await client.cluster.health();
        isConnected = true;
        logger_1.logger.info('OpenSearch connected', { status: health.body.status });
    }
    catch (error) {
        logger_1.logger.error('OpenSearch connection failed', { error });
        client = null;
        isConnected = false;
    }
};
exports.initializeOpenSearch = initializeOpenSearch;
const getOpenSearchClient = () => {
    if (!isConnected || !client) {
        return null;
    }
    return client;
};
exports.getOpenSearchClient = getOpenSearchClient;
exports.IndexNames = {
    USERS: 'athena_users',
    JOBS: 'athena_jobs',
    POSTS: 'athena_posts',
    COURSES: 'athena_courses',
    VIDEOS: 'athena_videos',
    MENTORS: 'athena_mentors',
};
// ==========================================
// INDEXING HELPERS
// ==========================================
const indexDocument = async (index, id, document) => {
    if (!isConnected || !client)
        return;
    try {
        await client.index({
            index,
            id,
            body: document,
            refresh: true, // Make searchable immediately
        });
        logger_1.logger.debug(`Indexed document ${id} in ${index}`);
    }
    catch (error) {
        logger_1.logger.error(`Failed to index document ${id} in ${index}`, { error });
    }
};
exports.indexDocument = indexDocument;
const deleteDocument = async (index, id) => {
    if (!isConnected || !client)
        return;
    try {
        await client.delete({
            index,
            id,
        });
        logger_1.logger.debug(`Deleted document ${id} from ${index}`);
    }
    catch (error) {
        logger_1.logger.error(`Failed to delete document ${id} from ${index}`, { error });
    }
};
exports.deleteDocument = deleteDocument;
//# sourceMappingURL=opensearch.js.map