"use strict";
/**
 * Health Check Routes
 * ===================
 * Comprehensive health endpoints for container orchestration and monitoring.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../utils/prisma");
const cache_1 = require("../utils/cache");
const opensearch_1 = require("../utils/opensearch");
const ml_service_1 = require("../services/ml.service");
const queue_1 = require("../utils/queue");
const logger_1 = require("../utils/logger");
const os_1 = __importDefault(require("os"));
const router = (0, express_1.Router)();
// ===========================================
// BASIC HEALTH (for load balancers)
// ===========================================
/**
 * @route GET /health
 * @description Basic health check - returns 200 if server is running
 */
router.get('/', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
    });
});
// ===========================================
// LIVENESS PROBE (Kubernetes)
// ===========================================
/**
 * @route GET /health/live
 * @description Liveness probe - checks if the application is running
 */
router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
    });
});
// ===========================================
// READINESS PROBE (Kubernetes)
// ===========================================
/**
 * @route GET /health/ready
 * @description Readiness probe - checks if the application can accept traffic
 */
router.get('/ready', async (req, res) => {
    try {
        // Check database connection
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger_1.logger.error('Readiness check failed', { error: error.message });
        res.status(503).json({
            status: 'not_ready',
            timestamp: new Date().toISOString(),
            error: error.message,
        });
    }
});
// ===========================================
// DETAILED HEALTH (for monitoring)
// ===========================================
/**
 * @route GET /health/detailed
 * @description Comprehensive health check of all dependencies
 */
router.get('/detailed', async (req, res) => {
    const startTime = Date.now();
    const checks = {};
    // Database check
    checks.database = await checkDatabase();
    // Redis check
    checks.redis = await checkRedis();
    // OpenSearch check
    checks.opensearch = await checkOpenSearch();
    // ML Service check
    checks.ml_service = await checkMLService();
    // Queue stats
    checks.queues = await checkQueues();
    // System resources
    checks.system = checkSystemResources();
    // Determine overall status
    const allChecks = Object.values(checks);
    const hasDown = allChecks.some((c) => c.status === 'down');
    const hasDegraded = allChecks.some((c) => c.status === 'degraded');
    const overallStatus = hasDown
        ? 'unhealthy'
        : hasDegraded
            ? 'degraded'
            : 'healthy';
    const health = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        checks,
    };
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
});
// ===========================================
// COMPONENT CHECKS
// ===========================================
async function checkDatabase() {
    const start = Date.now();
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        return {
            status: 'up',
            latency: Date.now() - start,
        };
    }
    catch (error) {
        return {
            status: 'down',
            latency: Date.now() - start,
            message: error.message,
        };
    }
}
async function checkRedis() {
    const start = Date.now();
    try {
        const redis = (0, cache_1.getRedisClient)();
        if (!redis) {
            return {
                status: 'degraded',
                message: 'Redis client not initialized',
            };
        }
        await redis.ping();
        return {
            status: 'up',
            latency: Date.now() - start,
        };
    }
    catch (error) {
        return {
            status: 'down',
            latency: Date.now() - start,
            message: error.message,
        };
    }
}
async function checkOpenSearch() {
    const start = Date.now();
    try {
        const client = (0, opensearch_1.getOpenSearchClient)();
        if (!client) {
            return {
                status: 'degraded',
                message: 'OpenSearch not configured',
            };
        }
        const health = await client.cluster.health();
        return {
            status: health.body.status === 'red' ? 'degraded' : 'up',
            latency: Date.now() - start,
            details: {
                clusterStatus: health.body.status,
                numberOfNodes: health.body.number_of_nodes,
            },
        };
    }
    catch (error) {
        return {
            status: 'down',
            latency: Date.now() - start,
            message: error.message,
        };
    }
}
async function checkMLService() {
    const start = Date.now();
    try {
        const isReady = await ml_service_1.mlService.isReady();
        return {
            status: isReady ? 'up' : 'degraded',
            latency: Date.now() - start,
            message: isReady ? undefined : 'ML service not ready',
        };
    }
    catch (error) {
        return {
            status: 'down',
            latency: Date.now() - start,
            message: error.message,
        };
    }
}
async function checkQueues() {
    try {
        const stats = await (0, queue_1.getAllQueueStats)();
        // Check for any queues with high failure rates
        let totalFailed = 0;
        let totalActive = 0;
        for (const queueStats of Object.values(stats)) {
            if (queueStats) {
                totalFailed += queueStats.failed || 0;
                totalActive += queueStats.active || 0;
            }
        }
        return {
            status: totalFailed > 100 ? 'degraded' : 'up',
            details: {
                totalActive,
                totalFailed,
                queues: stats,
            },
        };
    }
    catch (error) {
        return {
            status: 'degraded',
            message: error.message,
        };
    }
}
function checkSystemResources() {
    const totalMem = os_1.default.totalmem();
    const freeMem = os_1.default.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;
    const loadAvg = os_1.default.loadavg();
    const cpuCount = os_1.default.cpus().length;
    const normalizedLoad = loadAvg[0] / cpuCount;
    // Degraded if memory > 90% or load > 80%
    const status = memUsagePercent > 90 || normalizedLoad > 0.8 ? 'degraded' : 'up';
    return {
        status,
        details: {
            memory: {
                total: Math.round(totalMem / 1024 / 1024),
                used: Math.round(usedMem / 1024 / 1024),
                free: Math.round(freeMem / 1024 / 1024),
                usagePercent: Math.round(memUsagePercent),
            },
            cpu: {
                cores: cpuCount,
                loadAverage: loadAvg.map((l) => Math.round(l * 100) / 100),
                normalizedLoad: Math.round(normalizedLoad * 100) / 100,
            },
            uptime: Math.round(os_1.default.uptime()),
        },
    };
}
// ===========================================
// DEPENDENCY VERSIONS
// ===========================================
/**
 * @route GET /health/version
 * @description Returns version information
 */
router.get('/version', (req, res) => {
    res.json({
        service: 'athena-server',
        version: process.env.npm_package_version || '1.0.0',
        node: process.version,
        environment: process.env.NODE_ENV || 'development',
        buildTime: process.env.BUILD_TIME || 'unknown',
        commitSha: process.env.COMMIT_SHA || 'unknown',
    });
});
exports.default = router;
//# sourceMappingURL=health.routes.js.map