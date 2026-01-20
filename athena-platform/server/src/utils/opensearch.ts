import { Client } from '@opensearch-project/opensearch';
import { logger } from './logger';

const node = process.env.OPENSEARCH_NODE || 'http://localhost:9200';
const username = process.env.OPENSEARCH_USERNAME || 'admin';
const password = process.env.OPENSEARCH_PASSWORD || 'admin';

let client: Client | null = null;
let isConnected = false;

export const initializeOpenSearch = async () => {
  try {
    if (!process.env.OPENSEARCH_NODE) {
      logger.warn('OPENSEARCH_NODE not set, skipping OpenSearch initialization');
      return;
    }

    client = new Client({
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
    logger.info('OpenSearch connected', { status: health.body.status });
  } catch (error) {
    logger.error('OpenSearch connection failed', { error });
    client = null;
    isConnected = false;
  }
};

export const getOpenSearchClient = () => {
  if (!isConnected || !client) {
    return null;
  }
  return client;
};

export const IndexNames = {
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

export const indexDocument = async (index: string, id: string, document: any) => {
  if (!isConnected || !client) return;

  try {
    await client.index({
      index,
      id,
      body: document,
      refresh: true, // Make searchable immediately
    });
    logger.debug(`Indexed document ${id} in ${index}`);
  } catch (error) {
    logger.error(`Failed to index document ${id} in ${index}`, { error });
  }
};

export const deleteDocument = async (index: string, id: string) => {
  if (!isConnected || !client) return;

  try {
    await client.delete({
      index,
      id,
    });
    logger.debug(`Deleted document ${id} from ${index}`);
  } catch (error) {
    logger.error(`Failed to delete document ${id} from ${index}`, { error });
  }
};
