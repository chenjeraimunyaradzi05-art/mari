/**
 * ===========================================
 * ATHENA - BACKGROUND WORKERS ENTRY POINT
 * ===========================================
 * 
 * Standalone entry point for running background workers
 * in a dedicated container. This allows scaling workers
 * independently from the main API server.
 */

import dotenv from 'dotenv';
dotenv.config();

import { logger } from '../utils/logger';
import { startAllWorkers, stopAllWorkers } from '../services/workers.service';
import { prisma } from '../utils/prisma';
import Redis from 'ioredis';

// Create Redis client for worker process
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Track shutdown state
let isShuttingDown = false;

async function main() {
  logger.info('🔧 Starting Athena Background Workers...');
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);

  try {
    // Verify database connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database connection verified');

    // Verify Redis connection
    await redis.ping();
    logger.info('✅ Redis connection verified');

    // Start all workers
    await startAllWorkers();
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
        await stopAllWorkers();
        logger.info('Workers stopped');

        // Disconnect from services
        await prisma.$disconnect();
        logger.info('Prisma disconnected');

        await redis.quit();
        logger.info('Redis disconnected');

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
