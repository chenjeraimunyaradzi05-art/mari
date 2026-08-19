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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const logger_1 = require("../utils/logger");
const prisma_1 = require("../utils/prisma");
const worker_config_1 = require("../utils/worker-config");
const ioredis_1 = __importDefault(require("ioredis"));
// Track shutdown state
let isShuttingDown = false;
let redis = null;
let stopWorkers = null;
async function main() {
    logger_1.logger.info('🔧 Starting Athena Background Workers...');
    logger_1.logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    try {
        const workerConfig = (0, worker_config_1.validateWorkerStartupConfiguration)({
            forceEnabled: true,
            requireEnableFlag: true,
        });
        if (!workerConfig.ok) {
            throw new Error(workerConfig.errors.join('; '));
        }
        // Create Redis client for worker process after validating production config.
        redis = new ioredis_1.default((0, worker_config_1.resolveWorkerRedisUrl)(), {
            lazyConnect: true,
        });
        // Verify database connection
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        logger_1.logger.info('✅ Database connection verified');
        // Verify Redis connection
        await redis.ping();
        logger_1.logger.info('✅ Redis connection verified');
        // Start all workers
        const workerService = await Promise.resolve().then(() => __importStar(require('../services/workers.service')));
        stopWorkers = workerService.stopAllWorkers;
        await workerService.startAllWorkers();
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
                if (stopWorkers) {
                    await stopWorkers();
                    logger_1.logger.info('Workers stopped');
                }
                // Disconnect from services
                await prisma_1.prisma.$disconnect();
                logger_1.logger.info('Prisma disconnected');
                if (redis) {
                    await redis.quit();
                    logger_1.logger.info('Redis disconnected');
                }
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