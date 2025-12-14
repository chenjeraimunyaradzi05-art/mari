import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Check if we are in a build environment to avoid infinite connection retries
const isBuild = process.env.npm_lifecycle_event === 'build' || process.env.NEXT_PHASE === 'phase-production-build';

export const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    // During build, fail fast if Redis is not available
    if (isBuild && times > 1) {
      return null;
    }
    // Otherwise, retry with backoff
    return Math.min(times * 50, 2000);
  },
});

// Prevent unhandled error events from crashing the process
redis.on('error', (err) => {
  // Suppress errors during build to keep output clean
  if (!isBuild) {
    console.warn('Redis connection error:', err.message);
  }
});

export const connection = redis; // BullMQ accepts an ioredis instance
