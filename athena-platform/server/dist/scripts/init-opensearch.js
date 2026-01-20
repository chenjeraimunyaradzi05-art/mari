"use strict";
/**
 * OpenSearch Index Initialization Script
 * =======================================
 * Creates indexes with proper mappings for all searchable entities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeIndexes = initializeIndexes;
const opensearch_1 = require("@opensearch-project/opensearch");
const opensearch_2 = require("../utils/opensearch");
const logger_1 = require("../utils/logger");
// ===========================================
// INDEX MAPPINGS
// ===========================================
const INDEX_MAPPINGS = {
    [opensearch_2.IndexNames.USERS]: {
        settings: {
            number_of_shards: 2,
            number_of_replicas: 1,
            analysis: {
                analyzer: {
                    autocomplete: {
                        type: 'custom',
                        tokenizer: 'autocomplete_tokenizer',
                        filter: ['lowercase'],
                    },
                    autocomplete_search: {
                        type: 'custom',
                        tokenizer: 'standard',
                        filter: ['lowercase'],
                    },
                },
                tokenizer: {
                    autocomplete_tokenizer: {
                        type: 'edge_ngram',
                        min_gram: 2,
                        max_gram: 20,
                        token_chars: ['letter', 'digit'],
                    },
                },
            },
        },
        mappings: {
            properties: {
                id: { type: 'keyword' },
                firstName: {
                    type: 'text',
                    analyzer: 'autocomplete',
                    search_analyzer: 'autocomplete_search',
                    fields: { keyword: { type: 'keyword' } },
                },
                lastName: {
                    type: 'text',
                    analyzer: 'autocomplete',
                    search_analyzer: 'autocomplete_search',
                    fields: { keyword: { type: 'keyword' } },
                },
                email: { type: 'keyword' },
                headline: { type: 'text' },
                bio: { type: 'text' },
                skills: { type: 'keyword' },
                industry: { type: 'keyword' },
                location: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                persona: { type: 'keyword' },
                isVerified: { type: 'boolean' },
                createdAt: { type: 'date' },
                updatedAt: { type: 'date' },
                searchText: { type: 'text' },
            },
        },
    },
    [opensearch_2.IndexNames.JOBS]: {
        settings: {
            number_of_shards: 3,
            number_of_replicas: 1,
            analysis: {
                analyzer: {
                    job_analyzer: {
                        type: 'custom',
                        tokenizer: 'standard',
                        filter: ['lowercase', 'job_synonyms', 'english_stemmer'],
                    },
                },
                filter: {
                    job_synonyms: {
                        type: 'synonym',
                        synonyms: [
                            'developer,engineer,programmer,coder',
                            'manager,lead,supervisor,head',
                            'senior,sr,experienced',
                            'junior,jr,entry-level',
                            'remote,wfh,work from home',
                        ],
                    },
                    english_stemmer: {
                        type: 'stemmer',
                        language: 'english',
                    },
                },
            },
        },
        mappings: {
            properties: {
                id: { type: 'keyword' },
                title: {
                    type: 'text',
                    analyzer: 'job_analyzer',
                    fields: { keyword: { type: 'keyword' } },
                },
                description: { type: 'text', analyzer: 'job_analyzer' },
                company: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                location: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                city: { type: 'keyword' },
                state: { type: 'keyword' },
                country: { type: 'keyword' },
                type: { type: 'keyword' },
                salaryMin: { type: 'integer' },
                salaryMax: { type: 'integer' },
                salaryCurrency: { type: 'keyword' },
                remote: { type: 'boolean' },
                skills: { type: 'keyword' },
                requirements: { type: 'text' },
                benefits: { type: 'keyword' },
                status: { type: 'keyword' },
                organizationId: { type: 'keyword' },
                createdAt: { type: 'date' },
                expiresAt: { type: 'date' },
                searchText: { type: 'text', analyzer: 'job_analyzer' },
            },
        },
    },
    [opensearch_2.IndexNames.POSTS]: {
        settings: {
            number_of_shards: 2,
            number_of_replicas: 1,
        },
        mappings: {
            properties: {
                id: { type: 'keyword' },
                content: { type: 'text' },
                type: { type: 'keyword' },
                authorId: { type: 'keyword' },
                tags: { type: 'keyword' },
                likeCount: { type: 'integer' },
                commentCount: { type: 'integer' },
                shareCount: { type: 'integer' },
                isPublic: { type: 'boolean' },
                createdAt: { type: 'date' },
                searchText: { type: 'text' },
            },
        },
    },
    [opensearch_2.IndexNames.COURSES]: {
        settings: {
            number_of_shards: 2,
            number_of_replicas: 1,
        },
        mappings: {
            properties: {
                id: { type: 'keyword' },
                title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                description: { type: 'text' },
                shortDescription: { type: 'text' },
                level: { type: 'keyword' },
                category: { type: 'keyword' },
                price: { type: 'float' },
                currency: { type: 'keyword' },
                duration: { type: 'integer' },
                skills: { type: 'keyword' },
                providerId: { type: 'keyword' },
                rating: { type: 'float' },
                enrollmentCount: { type: 'integer' },
                isPublished: { type: 'boolean' },
                createdAt: { type: 'date' },
                searchText: { type: 'text' },
            },
        },
    },
    [opensearch_2.IndexNames.VIDEOS]: {
        settings: {
            number_of_shards: 2,
            number_of_replicas: 1,
        },
        mappings: {
            properties: {
                id: { type: 'keyword' },
                title: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                description: { type: 'text' },
                authorId: { type: 'keyword' },
                tags: { type: 'keyword' },
                duration: { type: 'integer' },
                viewCount: { type: 'integer' },
                likeCount: { type: 'integer' },
                isPublic: { type: 'boolean' },
                createdAt: { type: 'date' },
                searchText: { type: 'text' },
            },
        },
    },
    [opensearch_2.IndexNames.MENTORS]: {
        settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
        },
        mappings: {
            properties: {
                id: { type: 'keyword' },
                userId: { type: 'keyword' },
                firstName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                lastName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                headline: { type: 'text' },
                bio: { type: 'text' },
                expertise: { type: 'keyword' },
                industries: { type: 'keyword' },
                hourlyRate: { type: 'float' },
                currency: { type: 'keyword' },
                rating: { type: 'float' },
                totalSessions: { type: 'integer' },
                totalMentees: { type: 'integer' },
                isAvailable: { type: 'boolean' },
                languages: { type: 'keyword' },
                timezone: { type: 'keyword' },
                createdAt: { type: 'date' },
                searchText: { type: 'text' },
            },
        },
    },
};
// ===========================================
// INITIALIZATION
// ===========================================
async function initializeIndexes(client) {
    logger_1.logger.info('Initializing OpenSearch indexes');
    for (const [indexName, config] of Object.entries(INDEX_MAPPINGS)) {
        try {
            // Check if index exists
            const exists = await client.indices.exists({ index: indexName });
            if (!exists.body) {
                // Create index with mappings
                await client.indices.create({
                    index: indexName,
                    body: config,
                });
                logger_1.logger.info(`Created index: ${indexName}`);
            }
            else {
                // Update mappings if index exists
                try {
                    await client.indices.putMapping({
                        index: indexName,
                        body: config.mappings,
                    });
                    logger_1.logger.info(`Updated mappings for: ${indexName}`);
                }
                catch (mappingError) {
                    // Mapping conflicts are expected if fields can't be changed
                    logger_1.logger.warn(`Could not update mappings for ${indexName}: ${mappingError.message}`);
                }
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to initialize index ${indexName}`, { error: error.message });
        }
    }
    logger_1.logger.info('OpenSearch index initialization complete');
}
// ===========================================
// CLI SCRIPT RUNNER
// ===========================================
if (require.main === module) {
    const node = process.env.OPENSEARCH_NODE || 'http://localhost:9200';
    const username = process.env.OPENSEARCH_USERNAME || 'admin';
    const password = process.env.OPENSEARCH_PASSWORD || 'admin';
    const client = new opensearch_1.Client({
        node,
        auth: { username, password },
        ssl: { rejectUnauthorized: false },
    });
    initializeIndexes(client)
        .then(() => {
        console.log('✅ Index initialization complete');
        process.exit(0);
    })
        .catch((error) => {
        console.error('❌ Index initialization failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=init-opensearch.js.map