/**
 * Health Check Routes
 * ===================
 * Comprehensive health endpoints for container orchestration and monitoring.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { getRedisClient } from '../utils/cache';
import { getOpenSearchClient } from '../utils/opensearch';
import { mlService } from '../services/ml.service';
import { getAllQueueStats } from '../utils/queue';
import { logger } from '../utils/logger';
import os from 'os';

const router = Router();

// ===========================================
// TYPES
// ===========================================

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: Record<string, ComponentHealth>;
}

interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
  details?: Record<string, any>;
}

// ===========================================
// BASIC HEALTH (for load balancers)
// ===========================================

/**
 * @route GET /health
 * @description Basic health check - returns 200 if server is running
 */
router.get('/', (req: Request, res: Response) => {
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
router.get('/live', (req: Request, res: Response) => {
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
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Readiness check failed', { error: error.message });
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
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const checks: Record<string, ComponentHealth> = {};

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

  const overallStatus: 'healthy' | 'degraded' | 'unhealthy' = hasDown
    ? 'unhealthy'
    : hasDegraded
    ? 'degraded'
    : 'healthy';

  const health: HealthStatus = {
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

async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'up',
      latency: Date.now() - start,
    };
  } catch (error: any) {
    return {
      status: 'down',
      latency: Date.now() - start,
      message: error.message,
    };
  }
}

async function checkRedis(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const redis = getRedisClient();
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
  } catch (error: any) {
    return {
      status: 'down',
      latency: Date.now() - start,
      message: error.message,
    };
  }
}

async function checkOpenSearch(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const client = getOpenSearchClient();
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
  } catch (error: any) {
    return {
      status: 'down',
      latency: Date.now() - start,
      message: error.message,
    };
  }
}

async function checkMLService(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const isReady = await mlService.isReady();
    return {
      status: isReady ? 'up' : 'degraded',
      latency: Date.now() - start,
      message: isReady ? undefined : 'ML service not ready',
    };
  } catch (error: any) {
    return {
      status: 'down',
      latency: Date.now() - start,
      message: error.message,
    };
  }
}

async function checkQueues(): Promise<ComponentHealth> {
  try {
    const stats = await getAllQueueStats();
    
    // Check for any queues with high failure rates
    let totalFailed = 0;
    let totalActive = 0;
    
    for (const queueStats of Object.values(stats)) {
      if (queueStats) {
        totalFailed += (queueStats as any).failed || 0;
        totalActive += (queueStats as any).active || 0;
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
  } catch (error: any) {
    return {
      status: 'degraded',
      message: error.message,
    };
  }
}

function checkSystemResources(): ComponentHealth {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = (usedMem / totalMem) * 100;

  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  const normalizedLoad = loadAvg[0] / cpuCount;

  // Degraded if memory > 90% or load > 80%
  const status: 'up' | 'degraded' =
    memUsagePercent > 90 || normalizedLoad > 0.8 ? 'degraded' : 'up';

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
      uptime: Math.round(os.uptime()),
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
router.get('/version', (req: Request, res: Response) => {
  res.json({
    service: 'athena-server',
    version: process.env.npm_package_version || '1.0.0',
    node: process.version,
    environment: process.env.NODE_ENV || 'development',
    buildTime: process.env.BUILD_TIME || 'unknown',
    commitSha: process.env.COMMIT_SHA || 'unknown',
  });
});

export default router;
