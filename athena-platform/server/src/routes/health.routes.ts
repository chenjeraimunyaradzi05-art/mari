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
// Queue utils are dynamically imported to avoid Redis connection when workers disabled
// import { getAllQueueStats } from '../utils/queue';
import { logger } from '../utils/logger';
import os from 'os';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

function hasProtectedHealthAccess(req: Request): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  const configuredTokens = [
    process.env.HEALTH_DIAGNOSTICS_TOKEN,
    process.env.DEBUG_SECRET,
    process.env.METRICS_TOKEN,
  ].filter((token): token is string => !!token);

  if (configuredTokens.length === 0) {
    return false;
  }

  const auth = req.headers.authorization;
  const bearer =
    typeof auth === 'string' && auth.startsWith('Bearer ')
      ? auth.slice('Bearer '.length)
      : null;
  const headerToken =
    typeof req.headers['x-health-token'] === 'string'
      ? req.headers['x-health-token']
      : null;
  const debugHeader =
    typeof req.headers['x-debug-auth'] === 'string'
      ? req.headers['x-debug-auth']
      : null;

  return [bearer, headerToken, debugHeader].some(
    (token) => !!token && configuredTokens.includes(token)
  );
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
  // Only check queues if workers are enabled
  if (process.env.ENABLE_WORKERS !== 'true') {
    return {
      status: 'up',
      message: 'Queue workers disabled',
    };
  }
  
  try {
    const { getAllQueueStats } = await import('../utils/queue');
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

// ===========================================
// AUTH DIAGNOSTICS (temporary — remove after debugging)
// ===========================================

/**
 * @route GET /health/auth-diag
 * @description Tests every DB operation used in the auth registration flow
 */
router.get('/auth-diag', async (req: Request, res: Response) => {
  if (!hasProtectedHealthAccess(req)) {
    return res.status(404).json({
      success: false,
      message: 'Not found',
    });
  }

  const results: Record<string, { ok: boolean; ms: number; error?: string }> = {};

  // 1. User table query
  let t = Date.now();
  try {
    await prisma.user.findUnique({ where: { email: '__diag_test__' } });
    results['1_user_query'] = { ok: true, ms: Date.now() - t };
  } catch (e: any) {
    results['1_user_query'] = { ok: false, ms: Date.now() - t, error: e.message };
  }

  // 2. Bcrypt hash
  t = Date.now();
  try {
    await bcrypt.hash('testpassword', 4);
    results['2_bcrypt'] = { ok: true, ms: Date.now() - t };
  } catch (e: any) {
    results['2_bcrypt'] = { ok: false, ms: Date.now() - t, error: e.message };
  }

  // 3. JWT sign
  t = Date.now();
  try {
    const secret = process.env.JWT_SECRET || 'diag-fallback';
    jwt.sign({ test: true }, secret, { expiresIn: '1m' });
    results['3_jwt_sign'] = { ok: true, ms: Date.now() - t };
  } catch (e: any) {
    results['3_jwt_sign'] = { ok: false, ms: Date.now() - t, error: e.message };
  }

  // 4. InviteCode table
  t = Date.now();
  try {
    await prisma.inviteCode.findFirst({ where: { code: '__diag__' } });
    results['4_invitecode_table'] = { ok: true, ms: Date.now() - t };
  } catch (e: any) {
    results['4_invitecode_table'] = { ok: false, ms: Date.now() - t, error: e.message };
  }

  // 5. Session table
  t = Date.now();
  try {
    await prisma.session.findFirst({ where: { token: '__diag__' } });
    results['5_session_table'] = { ok: true, ms: Date.now() - t };
  } catch (e: any) {
    results['5_session_table'] = { ok: false, ms: Date.now() - t, error: e.message };
  }

  // 6. VerificationToken table
  t = Date.now();
  try {
    await prisma.verificationToken.findFirst({ where: { token: '__diag__' } });
    results['6_verification_token'] = { ok: true, ms: Date.now() - t };
  } catch (e: any) {
    results['6_verification_token'] = { ok: false, ms: Date.now() - t, error: e.message };
  }

  // 7. Profile table (used in nested create)
  t = Date.now();
  try {
    await prisma.profile.findFirst({ where: { userId: '__diag__' } });
    results['7_profile_table'] = { ok: true, ms: Date.now() - t };
  } catch (e: any) {
    results['7_profile_table'] = { ok: false, ms: Date.now() - t, error: e.message };
  }

  // 8. Subscription table (used in nested create)
  t = Date.now();
  try {
    await prisma.subscription.findFirst({ where: { userId: '__diag__' } });
    results['8_subscription_table'] = { ok: true, ms: Date.now() - t };
  } catch (e: any) {
    results['8_subscription_table'] = { ok: false, ms: Date.now() - t, error: e.message };
  }

  // 9. Referral table
  t = Date.now();
  try {
    await prisma.referral.findFirst({ where: { referrerId: '__diag__' } });
    results['9_referral_table'] = { ok: true, ms: Date.now() - t };
  } catch (e: any) {
    results['9_referral_table'] = { ok: false, ms: Date.now() - t, error: e.message };
  }

  // 10. Notification table
  t = Date.now();
  try {
    await prisma.notification.findFirst({ where: { userId: '__diag__' } });
    results['10_notification_table'] = { ok: true, ms: Date.now() - t };
  } catch (e: any) {
    results['10_notification_table'] = { ok: false, ms: Date.now() - t, error: e.message };
  }

  // 11. Check env vars
  results['11_env_jwt_secret'] = {
    ok: !!process.env.JWT_SECRET,
    ms: 0,
    error: process.env.JWT_SECRET ? undefined : 'JWT_SECRET not set',
  };
  results['12_env_database_url'] = {
    ok: !!process.env.DATABASE_URL,
    ms: 0,
    error: process.env.DATABASE_URL ? undefined : 'DATABASE_URL not set',
  };

  const allOk = Object.values(results).every((r) => r.ok);
  res.status(allOk ? 200 : 500).json({
    status: allOk ? 'all_pass' : 'has_failures',
    results,
  });
});

export default router;
