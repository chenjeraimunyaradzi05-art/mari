"use strict";
/**
 * ===========================================
 * ATHENA - BACKGROUND WORKERS ENTRY POINT
 * ===========================================
 *
 * Standalone entry point for running background workers
 * in a dedicated container. This allows scaling workers
 * independently from the main API server.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const logger_1 = require("../utils/logger");
const workers_service_1 = require("../services/workers.service");
const prisma_1 = require("../utils/prisma");
const ioredis_1 = __importDefault(require("ioredis"));
// Create Redis client for worker process
const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
// Track shutdown state
let isShuttingDown = false;
async function main() {
    logger_1.logger.info('🔧 Starting Athena Background Workers...');
    logger_1.logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    try {
        // Verify database connection
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        logger_1.logger.info('✅ Database connection verified');
        // Verify Redis connection
        await redis.ping();
        logger_1.logger.info('✅ Redis connection verified');
        // Start all workers
        await (0, workers_service_1.startAllWorkers)();
        logger_1.logger.info('🚀 All workers started successfully');
        // Log worker status periodically
        const statusInterval = setInterval(() => {
            if (!isShuttingDown) {
                logger_1.logger.debug('Workers heartbeat - all running');
            }
        }, 60000); // Every minute
        // Handle graceful shutdown
        const shutdown = async (signal) => {
            if (isShuttingDown)
                return;
            isShuttingDown = true;
            logger_1.logger.info(`Received ${signal}. Shutting down workers gracefully...`);
            clearInterval(statusInterval);
            try {
                // Stop all workers (waits for current jobs to complete)
                await (0, workers_service_1.stopAllWorkers)();
                logger_1.logger.info('Workers stopped');
                // Disconnect from services
                await prisma_1.prisma.$disconnect();
                logger_1.logger.info('Prisma disconnected');
                await redis.quit();
                logger_1.logger.info('Redis disconnected');
                logger_1.logger.info('Graceful shutdown complete');
                process.exit(0);
            }
            catch (err) {
                logger_1.logger.error('Error during shutdown', err);
                process.exit(1);
            }
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        // Keep process alive
        process.stdin.resume();
    }
    catch (err) {
        logger_1.logger.error('Failed to start workers', err);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map