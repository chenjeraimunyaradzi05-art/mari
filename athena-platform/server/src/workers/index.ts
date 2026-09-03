/**
 * ===========================================
 * ATHENA - BACKGROUND WORKERS ENTRY POINT
 * ===========================================
 * 
 * Standalone entry point for running background workers
 * in a dedicated container. This allows scaling workers
 * independently from the main API server.
 *
 * This process also owns the recurring schedule: startAllWorkers() upserts the
 * BullMQ job schedulers (see registerRecurringJobs in utils/queue), so the
 * nightly data-retention purge runs wherever this container runs. The upsert is
 * keyed, so scaling this container to N replicas still yields one schedule.
 */

import dotenv from 'dotenv';
dotenv.config();

import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';
import { resolveWorkerRedisUrl, validateWorkerStartupConfiguration } from '../utils/worker-config';
import Redis from 'ioredis';

// Track shutdown state
let isShuttingDown = false;
let redis: Redis | null = null;
let stopWorkers: (() => Promise<void>) | null = null;

async function main() {
  logger.info('🔧 Starting Athena Background Workers...');
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);

  try {
    const workerConfig = validateWorkerStartupConfiguration({
      forceEnabled: true,
      requireEnableFlag: true,
    });
    if (!workerConfig.ok) {
      throw new Error(workerConfig.errors.join('; '));
    }

    // Create Redis client for worker process after validating production config.
    redis = new Redis(resolveWorkerRedisUrl(), {
      lazyConnect: true,
    });

    // Verify database connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database connection verified');

    // Verify Redis connection
    await redis.ping();
    logger.info('✅ Redis connection verified');

    // Start all workers
    const workerService = await import('../services/workers.service');
    stopWorkers = workerService.stopAllWorkers;
    await workerService.startAllWorkers();
    logger.info('🚀 All workers started successfully');

    // Log worker status periodically
    const statusInterval = setInterval(() => {
      if (!isShuttingDown) {
        logger.debug('Workers heartbeat - all running');
      }
    }, 60000); // Every minute

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger.info(`Received ${signal}. Shutting down workers gracefully...`);
      clearInterval(statusInterval);

      try {
        // Stop all workers (waits for current jobs to complete)
        if (stopWorkers) {
          await stopWorkers();
          logger.info('Workers stopped');
        }

        // Disconnect from services
        await prisma.$disconnect();
        logger.info('Prisma disconnected');

        if (redis) {
          await redis.quit();
          logger.info('Redis disconnected');
        }

        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', err);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Keep process alive
    process.stdin.resume();

  } catch (err) {
    logger.error('Failed to start workers', err);
    process.exit(1);
  }
}

main();
