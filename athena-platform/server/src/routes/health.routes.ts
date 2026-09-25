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
import { mlRankingStats } from '../services/feed-ml.service';
// Queue utils are dynamically imported to avoid Redis connection when workers disabled
// import { getAllQueueStats } from '../utils/queue';
import { isTextModerationConfigured } from '../services/moderation.service';
import { logger } from '../utils/logger';
import { secretMatchesAny } from '../utils/secret-compare';
import {
  OpsSnapshot,
  RECENT_FAILURE_WINDOW_MS,
  opsSnapshot,
  recentFailureCount,
} from '../utils/ops-metrics';
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
  /**
   * What the money paths have actually been doing: per-operation counts and the
   * last failure messages. Added alongside the existing fields rather than
   * folded into checks, because a reader needs the messages, and ComponentHealth
   * only has room for one.
   */
  ops: OpsSnapshot;
}

interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
  details?: Record<string, any>;
}

interface LaunchReadinessCheck {
  key: string;
  category: 'core' | 'security' | 'payments' | 'media' | 'ai' | 'observability' | 'workers' | 'email' | 'search';
  required: boolean;
  ok: boolean;
  message: string;
}

function isConfiguredEnv(name: string): boolean {
  const value = process.env[name];
  if (!value) return false;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  return ![
    'changeme',
    'change_me',
    'secret',
    'your-secret',
    'your_secret',
    'not_configured',
    'sk_test_not_configured',
    'price_career',
    'price_professional',
    'price_entrepreneur',
    'price_creator',
  ].includes(normalized);
}

function envCheck(
  key: string,
  category: LaunchReadinessCheck['category'],
  required: boolean,
  message?: string
): LaunchReadinessCheck {
  const ok = isConfiguredEnv(key);
  return {
    key,
    category,
    required,
    ok,
    message: ok ? 'Configured' : message || `${key} is not configured`,
  };
}

function anyEnvCheck(
  key: string,
  keys: string[],
  category: LaunchReadinessCheck['category'],
  required: boolean,
  message?: string
): LaunchReadinessCheck {
  const ok = keys.some(isConfiguredEnv);
  return {
    key,
    category,
    required,
    ok,
    message: ok ? `Configured via ${keys.find(isConfiguredEnv)}` : message || `${keys.join(' or ')} is not configured`,
  };
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

  // Compared in constant time: a wrong guess takes as long as a near miss.
  return [bearer, headerToken, debugHeader].some((token) => secretMatchesAny(token, configuredTokens));
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
  // Memory, load, queue depths and which dependency is down describe the
  // deployment; in production that is for operators, not the internet. The
  // balancer and the status page use /health and /readyz, which stay open.
  if (process.env.NODE_ENV === 'production' && !hasProtectedHealthAccess(req)) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

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

  // Stripe webhooks and the escrow sweep. Everything above asks a dependency
  // whether it is up; this one is the only check that knows whether the work
  // those dependencies exist for has been succeeding.
  const ops = opsSnapshot();
  checks.money_paths = checkMoneyPaths(ops);

  // Whether member text is being screened at all. This is reported rather than
  // enforced on purpose: refusing every post because a key lapsed would take
  // the platform down to protect it. But a deployment publishing unscreened
  // text on a women's safety platform should not look identical to a healthy
  // one, which is exactly what it did — the only signal was a single log line
  // per process.
  checks.content_moderation = isTextModerationConfigured()
    ? { status: 'up', message: 'Member text is screened before it publishes' }
    : {
        status: 'degraded',
        message: 'No text moderation provider is configured: member text publishes unscreened. Set AI_OPENAI_API_KEY.',
      };

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
    ops,
  };

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
});

// ===========================================
// LAUNCH READINESS
// ===========================================

/**
 * @route GET /health/launch-readiness
 * @description Production launch readiness checklist for externally configured services
 */
router.get('/launch-readiness', async (req: Request, res: Response) => {
  if (!hasProtectedHealthAccess(req)) {
    return res.status(404).json({
      success: false,
      message: 'Not found',
    });
  }

  const production =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.RENDER_ENV === 'production';

  const workersEnabled = process.env.ENABLE_WORKERS === 'true';
  // The two names that actually decide whether the video worker hands a reel to
  // an external transcoder or runs the ffmpeg pipeline in this process:
  // `canSimulateWorker('VIDEO_PROCESSING')` in services/workers.service.ts reads
  // WORKER_ALLOW_SIMULATION and VIDEO_PROCESSING_ALLOW_SIMULATION, and nothing
  // else.
  //
  // This endpoint used to gate the media requirement on VIDEO_ALLOW_SIMULATION,
  // a third name that no worker, service or util reads — it appears only here,
  // in scripts/check-env.js, and as a literal "false" in render.yaml and
  // fly.toml. So the gate and the behaviour it was guarding keyed on different
  // variables: setting VIDEO_ALLOW_SIMULATION=true made readiness stop asking
  // for a processor while the worker went on demanding one and throwing, and
  // setting the real flag left readiness failing for a deployment that was
  // transcoding perfectly well. Both directions were wrong, and both looked
  // like a configuration mistake rather than a bug in the check.
  const workerSimulationAllowed =
    process.env.WORKER_ALLOW_SIMULATION === 'true' ||
    process.env.VIDEO_PROCESSING_ALLOW_SIMULATION === 'true';
  const openSearchEnabled = process.env.OPENSEARCH_ENABLED === 'true' || isConfiguredEnv('OPENSEARCH_NODE');

  const checks: LaunchReadinessCheck[] = [
    envCheck('DATABASE_URL', 'core', true),
    anyEnvCheck('PUBLIC_APP_URL', ['CLIENT_URL', 'FRONTEND_URL'], 'core', true),
    envCheck('ALLOWED_ORIGINS', 'security', production, 'Production CORS allowlist is not configured'),
    envCheck('JWT_SECRET', 'security', true),
    envCheck('DV_ENCRYPTION_KEY', 'security', production, 'DV safe-chat encryption key is not configured'),
    envCheck('METRICS_TOKEN', 'observability', production, 'Metrics endpoint token is required in production'),
    anyEnvCheck(
      'HEALTH_DIAGNOSTICS_ACCESS',
      ['HEALTH_DIAGNOSTICS_TOKEN', 'DEBUG_SECRET'],
      'observability',
      production,
      'Protected health diagnostics need HEALTH_DIAGNOSTICS_TOKEN or DEBUG_SECRET in production'
    ),
    envCheck('SENTRY_DSN', 'observability', false),
    envCheck('SENDGRID_API_KEY', 'email', production, 'Transactional email is not configured'),
    envCheck('STRIPE_SECRET_KEY', 'payments', production, 'Stripe payments are not configured'),
    envCheck('STRIPE_WEBHOOK_SECRET', 'payments', production, 'Stripe webhook verification is not configured'),
    envCheck('STRIPE_PRICE_CAREER', 'payments', production, 'Career subscription price ID is not configured'),
    envCheck('STRIPE_PRICE_PROFESSIONAL', 'payments', production, 'Professional subscription price ID is not configured'),
    envCheck('STRIPE_PRICE_ENTREPRENEUR', 'payments', production, 'Entrepreneur subscription price ID is not configured'),
    envCheck('STRIPE_PRICE_CREATOR', 'payments', production, 'Creator subscription price ID is not configured'),
    envCheck('S3_BUCKET', 'media', production, 'Media bucket is not configured'),
    envCheck('AWS_REGION', 'media', production, 'AWS region is not configured'),
    envCheck('AWS_ACCESS_KEY_ID', 'media', production, 'AWS access key is not configured'),
    envCheck('AWS_SECRET_ACCESS_KEY', 'media', production, 'AWS secret key is not configured'),
    // There is no VIDEO_PROCESSOR_URL check in the media category any more.
    // It required a transcoder URL of every production deployment whether the
    // BullMQ workers were running or not, which is a requirement the platform
    // does not have: with ENABLE_WORKERS unset, a reel is processed by
    // services/video-pipeline.service.ts in this process, using the ffmpeg
    // binary from the ffmpeg-static package, and no external service is
    // involved at any point. The one place the URL matters is the video worker,
    // and the check for that is in the workers category below, where it can see
    // whether the workers are enabled.
    anyEnvCheck('AI_PROVIDER_KEY', ['AI_OPENAI_API_KEY', 'OPENAI_API_KEY'], 'ai', production, 'AI provider key is not configured'),
    // Reported, never required — and it used to be the reason this endpoint
    // could not return "ready" at all. The Python ML service has no trained
    // model artefact anywhere in this repository, three of its six algorithm
    // directories are empty, and its loader refused to start without artefacts
    // it could never find. So production readiness demanded the URL of a
    // service that could not boot, and /health/launch-readiness answered 503
    // for a reason nobody could fix by configuring anything.
    //
    // The one real consumer is the feed re-ranker, which keeps the engagement
    // order when the service is absent, so nothing a member sees depends on it.
    // Demoting the check is not making the failure quieter: the answer is still
    // published on every call, /health/detailed reports whether the service is
    // reachable and which models it has loaded, and docs/runbooks/ML-SERVICE.md
    // records what turning it on would require.
    envCheck(
      'ML_SERVICE_URL',
      'ai',
      false,
      'ML service is not configured: the feed ranks by engagement only. Optional — see docs/runbooks/ML-SERVICE.md'
    ),
    envCheck('OPENSEARCH_NODE', 'search', openSearchEnabled, 'OpenSearch is enabled but OPENSEARCH_NODE is not configured'),
    envCheck('REDIS_URL', 'workers', production || workersEnabled, 'Redis is required for production queues/workers'),
    // Required, and worth being blunt about why: with the workers enabled in
    // production and neither simulation flag set, the video worker calls
    // callVideoProcessor() unconditionally, and postJson() throws
    // "Video processor URL is required for production worker processing" when
    // the URL is absent. It does not fall back to the in-process pipeline it
    // shares every other step with. So this exact combination means every reel
    // a member uploads fails its job and never leaves PROCESSING — which is a
    // launch blocker, not a missing integration.
    envCheck(
      'VIDEO_PROCESSOR_URL',
      'workers',
      workersEnabled && production && !workerSimulationAllowed,
      'Reels will not publish: the video worker is enabled and has no transcoder to call. ' +
        'Set VIDEO_PROCESSOR_URL, or set VIDEO_PROCESSING_ALLOW_SIMULATION=true to transcode in this process with ffmpeg.'
    ),
    // Push runs in process through Expo's API; the token only matters when the
    // Expo project has enhanced push security turned on.
    envCheck('EXPO_ACCESS_TOKEN', 'workers', false, 'Expo push access token is not set (only needed with enhanced push security)'),
  ];

  const requiredFailures = checks.filter((check) => check.required && !check.ok);
  const recommendedMissing = checks.filter((check) => !check.required && !check.ok);
  const status = requiredFailures.length === 0 ? 'ready' : 'not_ready';

  res.status(status === 'ready' ? 200 : 503).json({
    status,
    environment: production ? 'production' : process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    summary: {
      total: checks.length,
      passed: checks.filter((check) => check.ok).length,
      requiredFailures: requiredFailures.length,
      recommendedMissing: recommendedMissing.length,
    },
    checks,
  });
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

  // Not configured is not the same as broken. getRedisClient falls back to
  // localhost and connects lazily, so it hands back a client that has never
  // reached anything; letting that reach ping() reports a deployment which
  // deliberately runs without Redis as hard down, and a load balancer reading
  // /health/detailed would take the instance out of rotation for it.
  if (!process.env.REDIS_URL) {
    return {
      status: 'degraded',
      message:
        'REDIS_URL is not set: caching, rate limits and scheduled-sweep locks are per instance',
    };
  }

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

/**
 * The Python ML service, which is optional everywhere.
 *
 * Two things were wrong here. The client defaults to http://localhost:8000 when
 * ML_SERVICE_URL is unset, so a deployment that had deliberately not deployed
 * an ML service was reported as one whose ML service was broken — the same
 * mistake checkRedis above already had to fix. And "ML service not ready" was
 * the entire message, which covers a host that does not resolve, a timeout, and
 * a service that is running perfectly but has no trained model artefact. Those
 * need three different actions from whoever is reading.
 *
 * Never 'down', for the same reason checkMoneyPaths never is: this report is
 * read by monitoring that can take an instance out of rotation, and no member
 * request fails because the ranker is absent.
 */
async function checkMLService(): Promise<ComponentHealth> {
  const start = Date.now();
  const ranking = mlRankingStats();

  try {
    const health = await mlService.describeHealth();

    if (!health.configured) {
      return {
        status: 'degraded',
        message:
          'ML_SERVICE_URL is not set: the feed ranks by engagement only. Optional — see docs/runbooks/ML-SERVICE.md',
        details: { feedRanking: ranking },
      };
    }

    const message = health.ready
      ? undefined
      : health.reachable
      ? 'ML service is reachable but reports itself degraded: it is missing a trained model artefact some endpoint needs. Its /health says which.'
      : `ML service did not answer: ${health.error || 'no response'}`;

    return {
      status: health.ready ? 'up' : 'degraded',
      latency: Date.now() - start,
      message,
      details: {
        url: health.url,
        reachable: health.reachable,
        models: health.models,
        checkedAt: health.checkedAt,
        // How often the one real consumer has actually been able to use it.
        // A ranker that is configured and has applied zero times out of
        // thousands of feeds is the failure this check exists to surface.
        feedRanking: ranking,
      },
    };
  } catch (error: any) {
    return {
      status: 'degraded',
      latency: Date.now() - start,
      message: `ML service health probe failed: ${error.message}`,
      details: { feedRanking: ranking },
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

/**
 * Stripe webhooks and the escrow expiry sweep, as recorded by utils/ops-metrics.
 *
 * Until this existed the endpoint reported "healthy" while every payment event
 * was being rejected, because Postgres and Redis were both perfectly fine; the
 * only thing that was broken was the work. A failure recorded inside the recent
 * window now drags the whole report down to degraded.
 *
 * Never 'down', however bad the numbers look. /health/detailed is read by
 * monitoring that can take an instance out of rotation, and pulling a server
 * because one webhook handler threw would turn a single failed payment into an
 * outage. Degraded (still HTTP 200) is the loudest this check is allowed to be.
 */
function checkMoneyPaths(ops: OpsSnapshot): ComponentHealth {
  const recent = recentFailureCount();
  const windowMinutes = Math.round(RECENT_FAILURE_WINDOW_MS / 60000);

  // A standing condition is not a failure event and never enters the ring, so
  // reading only recentFailureCount() missed the loudest thing there is: every
  // escrow hold lapsed is recorded once as a condition and then never again,
  // which left this check saying "up" through exactly the outage it exists to
  // catch. A condition is clear when its count is zero, so a non-zero one is
  // the current state of something, not a historical count.
  const standing = Object.entries(ops.conditions).filter(([, condition]) => condition.count > 0);

  const reasons: string[] = [];
  if (recent > 0) {
    reasons.push(`${recent} failure(s) in the last ${windowMinutes} minutes; ops.recentFailures says which`);
  }
  for (const [name, condition] of standing) {
    reasons.push(condition.detail ? `${name}: ${condition.count} (${condition.detail})` : `${name}: ${condition.count}`);
  }

  let message: string;
  if (reasons.length > 0) {
    message = reasons.join('; ');
  } else if (ops.totals.failure > 0) {
    message = `Nothing has failed in the last ${windowMinutes} minutes (${ops.totals.failure} earlier, since this process started)`;
  } else {
    message = 'Nothing has failed since this process started';
  }

  return {
    status: reasons.length > 0 ? 'degraded' : 'up',
    message,
    details: {
      since: ops.since,
      recentFailureWindowMinutes: windowMinutes,
      recentFailures: recent,
      totals: ops.totals,
      operations: ops.operations,
      // Carried whether or not anything is standing, so a reader can see the
      // zero and know the question was asked rather than guess it was.
      conditions: ops.conditions,
      // The same honesty note the snapshot carries: these are one process's
      // numbers, not the platform's.
      note: ops.note,
    },
  };
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
