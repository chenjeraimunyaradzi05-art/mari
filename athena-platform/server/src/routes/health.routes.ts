/**
 * Health Check Routes
 * ===================
 * Comprehensive health endpoints for container orchestration and monitoring.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { pingRedis, redisReadyForTraffic } from '../utils/redis';
import { getOpenSearchClient } from '../utils/opensearch';
import { mlService } from '../services/ml.service';
import { mlRankingStats } from '../services/feed-ml.service';
// Queue utils are dynamically imported to avoid Redis connection when workers disabled
// import { getAllQueueStats } from '../utils/queue';
import { isTextModerationConfigured } from '../services/moderation.service';
import { checkMediaExposure, probeMediaStorage } from '../utils/media-storage';
import { malwareScanRequirement, probeMalwareScanner } from '../services/malware-scan.service';
import { logger } from '../utils/logger';
import { secretMatchesAny } from '../utils/secret-compare';
import { secretWeakness } from '../utils/secret-strength';
import { senderAddressProblem } from '../utils/sender-address';
import { supplierReadiness } from '../services/invoice.service';
import { stripeModeOf } from '../utils/stripe-mode';
import {
  OpsSnapshot,
  RECENT_FAILURE_WINDOW_MS,
  opsSnapshot,
  recentFailureCount,
} from '../utils/ops-metrics';
import fs from 'fs';
import os from 'os';
import path from 'path';
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

export interface LaunchReadinessCheck {
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

/**
 * A secret is not "Configured" because it is non-empty. The example env file's
 * JWT_SECRET is 47 characters and its DV_ENCRYPTION_KEY is a valid run of
 * zeros, so presence alone reported ready for a deployment signing sessions
 * with a value printed in the repository. This asks the same question the boot
 * check asks (utils/secret-strength.ts), and says what is wrong without ever
 * printing the value.
 */
function secretCheck(
  key: string,
  category: LaunchReadinessCheck['category'],
  required: boolean,
  message: string,
  minLength?: number,
  hexOnly = false
): LaunchReadinessCheck {
  let weakness = isConfiguredEnv(key) ? secretWeakness(process.env[key], minLength) : 'not set';
  // An encryption key is read as hex. 64 characters of anything else pass the
  // strength test and then make the service refuse to seal a single record.
  if (weakness === null && hexOnly && !/^[0-9a-fA-F]{64}$/.test(process.env[key] ?? '')) {
    weakness = 'not 64 hexadecimal characters';
  }
  return {
    key,
    category,
    required,
    ok: weakness === null,
    message:
      weakness === null
        ? 'Configured'
        : weakness === 'not set'
          ? message
          : `${key} is ${weakness}. Generate a real one with \`openssl rand -hex 32\`.`,
  };
}

/**
 * An encryption key that is optional because it falls back to DV_ENCRYPTION_KEY
 * (health records, authenticator seeds). Unset is fine. Set, it is the key those
 * values are sealed with, so it is held to the same standard and a malformed one
 * holds the launch back: it would stop every write of them.
 */
function optionalKeyCheck(key: string): LaunchReadinessCheck {
  if (!isConfiguredEnv(key)) {
    return { key, category: 'security', required: false, ok: true, message: 'Not set: DV_ENCRYPTION_KEY is used' };
  }
  return secretCheck(key, 'security', true, `${key} is not configured`, 64, true);
}

/**
 * Which kind of money the Stripe key moves, read from its prefix and never
 * printed. Never required: a rehearsal on test keys is a legitimate deployment,
 * and refusing to report ready would stop it being rehearsed. But in production
 * a test key means a launch that takes no money and says nothing, so it is
 * reported as not ok, and the message says which mode it is in.
 */
function stripeModeCheck(production: boolean): LaunchReadinessCheck {
  const mode = isConfiguredEnv('STRIPE_SECRET_KEY') ? stripeModeOf(process.env.STRIPE_SECRET_KEY) : 'unknown';

  if (mode === 'live') {
    return { key: 'STRIPE_MODE', category: 'payments', required: false, ok: true, message: 'Live mode: real cards are charged' };
  }
  if (mode === 'test') {
    return {
      key: 'STRIPE_MODE',
      category: 'payments',
      required: false,
      ok: !production,
      message: production
        ? 'Test mode: no real money moves. Fine for a rehearsal; put the live Stripe keys on the host before launch'
        : 'Test mode: no real money moves',
    };
  }
  return {
    key: 'STRIPE_MODE',
    category: 'payments',
    required: false,
    ok: false,
    message: 'Unknown: STRIPE_SECRET_KEY is not set, or is not a Stripe secret key',
  };
}

/**
 * Whether payments may be simulated here, which in production they never may.
 *
 * ALLOW_STRIPE_SIMULATION lets the formation service mark a business registration
 * paid against a mock intent, with nothing charged. It is off in every deploy file
 * and example, and a production process with it on does not start (utils/env.ts)
 * and the service ignores it there, so this should never report a problem; it is
 * here so that the one report an operator reads says so, rather than the answer
 * living only in a refused boot. Required in production, reported elsewhere.
 */
function stripeSimulationCheck(required: boolean): LaunchReadinessCheck {
  const on = (process.env.ALLOW_STRIPE_SIMULATION ?? '').trim().toLowerCase() === 'true';
  return {
    key: 'ALLOW_STRIPE_SIMULATION',
    category: 'payments',
    required,
    ok: !on,
    message: on
      ? 'ALLOW_STRIPE_SIMULATION is on: a business registration could be marked paid with no charge. Set it to false.'
      : 'Off: no payment is simulated',
  };
}

/**
 * Whether ATHENA can put its name to an invoice, from the five ATHENA_* values the
 * invoice service reads (services/invoice.service.ts). Nothing told an operator
 * to set them: they were in no env example, no deploy file and no check, so a
 * deployment went live printing a placeholder billing address and a made-up
 * sender on every member's document, and nothing here said so.
 *
 * The invoice service no longer invents any of it. With the legal name, the
 * billing address, the billing mailbox or an ABN that passes its checksum
 * missing, no document is produced and a member's download answers 503, so a
 * production deployment that has not set them is not ready: required there,
 * reported elsewhere. The invoices themselves are filed as sales happen and keep,
 * so setting the values later loses nothing. Never prints a value.
 *
 * The GST registration is not asked for. Not being registered is a legitimate
 * state (a business below the A$75,000 threshold need not be), so its absence is
 * ok and says what the invoices will therefore say.
 */
function invoicingCheck(required: boolean): LaunchReadinessCheck {
  const key = 'ATHENA_INVOICING';
  const check = (ok: boolean, message: string): LaunchReadinessCheck => ({ key, category: 'payments', required, ok, message });

  const readiness = supplierReadiness();
  if (!readiness.ready) {
    // Written out by name so scripts/check-env.js can see this check still
    // asks for each variable it requires of the blueprint.
    const describe: Record<string, string> = {
      'ATHENA_LEGAL_NAME': 'ATHENA_LEGAL_NAME is not set',
      'ATHENA_ABN': 'ATHENA_ABN is not set, or does not pass its checksum',
      'ATHENA_BILLING_ADDRESS': 'ATHENA_BILLING_ADDRESS is not set',
      'ATHENA_BILLING_EMAIL': `ATHENA_BILLING_EMAIL ${senderAddressProblem(process.env.ATHENA_BILLING_EMAIL) ?? 'is not usable'}`,
    };
    const problems = readiness.missing.map((name) => describe[name] ?? `${name} is not set`);
    return check(
      false,
      `Invoices cannot be produced because ATHENA does not say who it is: ${problems.join('; ')}. Until then a member's invoice download answers 503; the invoices themselves are kept. See DEPLOYMENT_GUIDE.md, "Invoices and GST".`
    );
  }

  const from = process.env.ATHENA_GST_REGISTERED_FROM;
  if (from && Number.isNaN(new Date(from).getTime())) {
    return check(false, 'ATHENA_GST_REGISTERED_FROM is not a date (use YYYY-MM-DD), so invoices are issued without GST.');
  }
  if (!from) {
    return check(
      true,
      'Configured, with no GST registration date: invoices show the ABN, are titled "Invoice" and say no GST is charged. Right while ATHENA is not registered for GST; set ATHENA_GST_REGISTERED_FROM (YYYY-MM-DD) once it is.'
    );
  }
  return check(
    true,
    'Configured. Invoices are tax invoices from the GST registration date. Create each Stripe Price in AUD with tax behaviour "Inclusive", and have the accountant confirm the wording.'
  );
}

/** The From address transactional email is sent as; see utils/sender-address.ts for what is refused. */
function senderCheck(required: boolean): LaunchReadinessCheck {
  const problem = senderAddressProblem(process.env.SENDGRID_FROM_EMAIL);
  return {
    key: 'SENDGRID_FROM_EMAIL',
    category: 'email',
    required,
    ok: problem === null,
    message:
      problem === null
        ? 'Configured. Confirm the domain is authenticated in SendGrid by registering a throwaway address and checking the verification email arrives.'
        : `SENDGRID_FROM_EMAIL ${problem}. Verification and password-reset emails are sent from it.`,
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

/**
 * Whether private uploads (résumés, documents) really cannot be read without
 * signing in, and public ones (avatars, reels) can, asked from the outside.
 * The code only chooses which address to hand out; the bucket policy and what
 * the CDN may fetch decide the rest, and the variables look the same whether
 * those are right or wrong. See checkMediaExposure and infrastructure/README.md
 * ("Media bucket"). Not applicable, and so not required, with no bucket.
 */
async function mediaExposureCheck(required: boolean): Promise<LaunchReadinessCheck> {
  const result = await checkMediaExposure();
  const notApplicable = result.status === 'not_applicable';
  return {
    key: 'MEDIA_EXPOSURE',
    category: 'media',
    required: required && !notApplicable,
    ok: result.status === 'ok' || notApplicable,
    message: result.detail,
  };
}

/** How long launch-readiness waits for S3 before calling the bucket unreachable. */
const MEDIA_PROBE_TIMEOUT_MS = 5_000;

/** The two variables media storage signs its requests with. */
const MEDIA_CREDENTIAL_NAMES = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] as const;

/**
 * Whether media can actually be stored, asked of S3 rather than read off the
 * variables.
 *
 * This used to be two presence checks on AWS_ACCESS_KEY_ID and
 * AWS_SECRET_ACCESS_KEY, and presence says nothing about whether the bucket
 * answers: the env template's placeholder values passed them, as did a key
 * that had been revoked or a bucket in another account. The endpoint said
 * "Configured" for a deployment where every avatar, post image and reel was
 * failing to store. So it asks the same question the startup probe asks, with
 * a HeadBucket on the configured credentials, and waits a bounded time for the
 * answer: an S3 that does not reply is reported as not reachable rather than
 * holding the operator's request open. The probe also refreshes the
 * media-storage gauge /health/detailed shows, so the two cannot disagree.
 */
async function mediaStorageCheck(required: boolean): Promise<LaunchReadinessCheck> {
  const missing = MEDIA_CREDENTIAL_NAMES.filter((name) => !isConfiguredEnv(name));
  if (missing.length > 0) {
    return {
      key: 'MEDIA_STORAGE',
      category: 'media',
      required,
      ok: false,
      message: `${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not configured, so media cannot be stored in S3`,
    };
  }

  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<{ reachable: boolean; detail: string }>((resolve) => {
    timer = setTimeout(
      () =>
        resolve({
          reachable: false,
          detail: `S3 did not answer within ${MEDIA_PROBE_TIMEOUT_MS / 1000} seconds, so the bucket cannot be confirmed reachable`,
        }),
      MEDIA_PROBE_TIMEOUT_MS
    );
  });

  try {
    const result = await Promise.race([probeMediaStorage(), timedOut]);
    return { key: 'MEDIA_STORAGE', category: 'media', required, ok: result.reachable, message: result.detail };
  } catch (error) {
    // probeMediaStorage is written not to throw. If it ever does, the answer
    // is still "not confirmed", never a silent pass.
    return {
      key: 'MEDIA_STORAGE',
      category: 'media',
      required,
      ok: false,
      message: `The S3 probe failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Whether uploaded files can be scanned for malware, asked of the scanner.
 *
 * Required in production unless the deployment has said MALWARE_SCAN_REQUIRED=off
 * on purpose: without a scanner a résumé or a document cannot be uploaded (see
 * services/malware-scan.service), so a deployment that is missing it cannot take
 * a job application, which is a launch blocker and not a missing extra. It asks
 * the scanner with a PING rather than reading CLAMAV_HOST, because a host name
 * that nothing answers on, or a scanner still downloading its signatures on
 * first start, is the same outage to a member as no host name at all. With the
 * check switched off, a scanner that is there is still reported, and one that is
 * not is reported as recommended, so "uploads are not scanned" is on the page
 * and not only in a variable.
 */
async function malwareScanCheck(production: boolean): Promise<LaunchReadinessCheck> {
  const required = production && malwareScanRequirement() !== 'off';
  const probe = await probeMalwareScanner();
  return { key: 'MALWARE_SCANNER', category: 'media', required, ok: probe.reachable, message: probe.detail };
}

/**
 * The migrations this build ships with: prisma/migrations beside dist/ in the
 * image (the Dockerfile copies prisma into the runtime stage, and start.ts runs
 * `migrate deploy` from it) and beside src/ in a checkout, which is the same
 * relative path from either.
 */
const MIGRATIONS_DIRECTORY = path.resolve(__dirname, '../../prisma/migrations');

/** How long launch-readiness waits for the migration table before calling it unreadable. */
const MIGRATIONS_QUERY_TIMEOUT_MS = 5_000;

/** The columns Prisma keeps in _prisma_migrations that say how a migration ended. */
type MigrationRow = {
  migration_name: string;
  finished_at: Date | string | null;
  rolled_back_at: Date | string | null;
};

const MIGRATIONS_HOW_TO_FIX =
  'Run `npx prisma migrate status` with DIRECT_DATABASE_URL set; the on-call runbook ("A migration failed or is pending") says how to resolve it.';

const nameList = (names: string[]) =>
  names.length > 5 ? `${names.slice(0, 5).join(', ')} and ${names.length - 5} more` : names.join(', ');

/**
 * Whether the database holds every migration this build ships with, asked of
 * the database rather than assumed from the fact that a deploy ran.
 *
 * start.ts runs `prisma migrate deploy` before it boots and then boots anyway
 * when that fails, on purpose, so /health can answer and the logs can be read.
 * The cost was that nothing downstream could tell: an API running against a
 * database missing the Session.revokedAt column answered 500 on sign-in while
 * every readiness check said Configured. Prisma records how each migration
 * ended in _prisma_migrations, so this reads it. A migration with no finish
 * time and no rollback is one that failed or stopped half way; a shipped
 * migration with no finished row is one that has not run.
 *
 * Rows for migrations this build does not ship are ignored: the production
 * database is shared with an application this repository does not model, and
 * its migrations are not ours to judge. A table that cannot be read fails the
 * check rather than passing it, and so does a query that never answers.
 */
async function migrationsCheck(required: boolean): Promise<LaunchReadinessCheck> {
  const result = (ok: boolean, message: string): LaunchReadinessCheck => ({
    key: 'MIGRATIONS',
    category: 'core',
    required,
    ok,
    message,
  });

  if (!isConfiguredEnv('DATABASE_URL')) {
    return result(false, 'DATABASE_URL is not configured, so the migrations cannot be checked');
  }

  let shipped: string[];
  try {
    shipped = fs
      .readdirSync(MIGRATIONS_DIRECTORY, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    return result(
      false,
      `The migrations this build ships with could not be listed (${error instanceof Error ? error.message : String(error)}), so they cannot be compared with the database`
    );
  }

  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), MIGRATIONS_QUERY_TIMEOUT_MS);
  });

  let rows: MigrationRow[];
  try {
    const answer = await Promise.race([
      prisma.$queryRaw<MigrationRow[]>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`,
      timedOut,
    ]);
    if (answer === 'timeout') {
      return result(false, `The migration table did not answer within ${MIGRATIONS_QUERY_TIMEOUT_MS / 1000} seconds`);
    }
    if (!Array.isArray(answer)) {
      return result(false, 'The migration table returned nothing readable, so the migrations cannot be confirmed');
    }
    rows = answer;
  } catch (error) {
    return result(
      false,
      `The migration table could not be read (${error instanceof Error ? error.message : String(error)}). ${MIGRATIONS_HOW_TO_FIX}`
    );
  } finally {
    if (timer) clearTimeout(timer);
  }

  const known = new Set(shipped);
  const applied = new Set<string>();
  const unfinished = new Set<string>();
  for (const row of rows) {
    if (!known.has(row.migration_name)) continue;
    if (row.finished_at && !row.rolled_back_at) applied.add(row.migration_name);
    else if (!row.finished_at && !row.rolled_back_at) unfinished.add(row.migration_name);
  }

  // A migration that failed and was later re-run to the end is applied.
  const failed = shipped.filter((name) => unfinished.has(name) && !applied.has(name));
  const pending = shipped.filter((name) => !applied.has(name) && !unfinished.has(name));

  if (failed.length === 0 && pending.length === 0) {
    return result(true, `All ${shipped.length} migrations this build ships with are applied`);
  }

  const problems: string[] = [];
  if (failed.length > 0) {
    problems.push(`${failed.length} failed or stopped half way: ${nameList(failed)}`);
  }
  if (pending.length > 0) {
    problems.push(`${pending.length} not applied yet: ${nameList(pending)}`);
  }
  return result(false, `${problems.join('; ')}. ${MIGRATIONS_HOW_TO_FIX}`);
}

/**
 * Whether password sign-up has its human check.
 *
 * Reported rather than required, as auth.routes.ts decides: the check is
 * enforced only when TURNSTILE_SECRET_KEY is set, so a developer machine and
 * the test suite need no Cloudflare account. But a production deployment
 * without it has nothing on its front door except per-address rate limits, and
 * the only sign of that was one warning in the log at start. When it is set,
 * the message says what this server cannot see for itself: the web host needs
 * the matching site key, or the form never sends a token and every password
 * sign-up is refused.
 */
function humanCheckReadiness(): LaunchReadinessCheck {
  const ok = isConfiguredEnv('TURNSTILE_SECRET_KEY');
  return {
    key: 'TURNSTILE_SECRET_KEY',
    category: 'security',
    required: false,
    ok,
    message: ok
      ? 'Configured. The web host must have NEXT_PUBLIC_TURNSTILE_SITE_KEY from the same Turnstile widget, or every password sign-up is refused.'
      : 'Password sign-up has no human check, only rate limits and email verification. Set TURNSTILE_SECRET_KEY here and NEXT_PUBLIC_TURNSTILE_SITE_KEY on the web host, together.',
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

    // And Redis, where the deployment cannot do without it (production):
    // see /readyz in index.ts for why this is not named in the answer.
    if (!(await redisReadyForTraffic())) {
      logger.error('Readiness check failed', { error: 'Redis does not answer' });
      return res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    // The text of a connection failure names the database host and port, and
    // this route answers anyone. The log has it; the caller is told only that
    // the answer is no, as /readyz in index.ts does.
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
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

export interface LaunchReadinessReport {
  status: 'ready' | 'not_ready';
  environment: string;
  timestamp: string;
  summary: { total: number; passed: number; requiredFailures: number; recommendedMissing: number };
  checks: LaunchReadinessCheck[];
}

/**
 * Every externally configured thing a production launch needs, asked of this
 * process's own environment and, for the database and the media bucket, of the
 * thing itself.
 *
 * A function and not the body of the route so that two callers can ask it the
 * same question: GET /health/launch-readiness, for someone holding the
 * diagnostics token, and the end of startServer in production, which has no
 * request and used to be the moment nothing said that Stripe or the Connect
 * secret was missing. See utils/launch-readiness.ts for what boot does with
 * the answer.
 *
 * `probeMedia` is the ?probe=media option: it writes and deletes two small
 * objects in the bucket, so it is asked for and never run by default.
 */
export async function buildLaunchReadiness(options: { probeMedia?: boolean } = {}): Promise<LaunchReadinessReport> {
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
    // Asked of the database: boot-time `migrate deploy` that fails does not
    // stop the API, so this is where an unmigrated database shows. See
    // migrationsCheck.
    await migrationsCheck(production),
    anyEnvCheck('PUBLIC_APP_URL', ['CLIENT_URL', 'FRONTEND_URL'], 'core', true),
    envCheck('ALLOWED_ORIGINS', 'security', production, 'Production CORS allowlist is not configured'),
    secretCheck('JWT_SECRET', 'security', true, 'JWT_SECRET is not configured'),
    secretCheck('DV_ENCRYPTION_KEY', 'security', production, 'DV safe-chat encryption key is not configured', 64, true),
    // Optional: each falls back to the key above. Set, each is what its values
    // are sealed with, so a malformed one is a failing, required check.
    optionalKeyCheck('HEALTH_ENCRYPTION_KEY'),
    optionalKeyCheck('TOTP_ENCRYPTION_KEY'),
    // Reported, never required: without it the ban list is keyed from
    // JWT_SECRET, and rotating that signs everyone out and also quietly unbans
    // everyone. Required would turn the endpoint red for a deployment whose
    // bans are working today; the warning is the nudge to set it once.
    // A key that is set but guessable is reported too: the ban list holds a
    // keyed hash of each banned address, and a short key lets anyone who reads
    // the table recover the addresses by trying them.
    secretCheck(
      'BANNED_IDENTITY_HASH_KEY',
      'security',
      false,
      'Ban list is keyed from JWT_SECRET, so rotating JWT_SECRET would unban everyone. Set BANNED_IDENTITY_HASH_KEY once (openssl rand -hex 32).'
    ),
    humanCheckReadiness(),
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
    senderCheck(production),
    // Reported, never required: mail works without it. What it buys is hearing
    // about bounces and spam reports, so an address that cannot be reached
    // stops being mailed; see routes/webhook.routes.ts (POST /sendgrid).
    envCheck(
      'SENDGRID_WEBHOOK_PUBLIC_KEY',
      'email',
      false,
      'Bounced and spam-reported addresses are not heard about, so they keep being mailed. Switch on the Signed Event Webhook in SendGrid and set this key.'
    ),
    envCheck('STRIPE_SECRET_KEY', 'payments', production, 'Stripe payments are not configured'),
    stripeModeCheck(production),
    stripeSimulationCheck(production),
    envCheck('STRIPE_WEBHOOK_SECRET', 'payments', production, 'Stripe webhook verification is not configured'),
    // A second endpoint with its own secret: Stripe sends payout and
    // connected-account events only to an endpoint set to listen on connected
    // accounts. Without it webhook.routes.ts refuses them, so a payout that
    // bounced, or a seller whose account Stripe stopped paying, is never heard
    // about and nothing fails visibly.
    envCheck(
      'STRIPE_CONNECT_WEBHOOK_SECRET',
      'payments',
      production,
      'Stripe Connect webhook secret is not configured: payout.paid, payout.failed and account.updated are refused, so a failed payout goes unnoticed'
    ),
    envCheck('STRIPE_PRICE_CAREER', 'payments', production, 'Career subscription price ID is not configured'),
    envCheck('STRIPE_PRICE_PROFESSIONAL', 'payments', production, 'Professional subscription price ID is not configured'),
    envCheck('STRIPE_PRICE_ENTREPRENEUR', 'payments', production, 'Entrepreneur subscription price ID is not configured'),
    envCheck('STRIPE_PRICE_CREATOR', 'payments', production, 'Creator subscription price ID is not configured'),
    invoicingCheck(production),
    envCheck('S3_BUCKET', 'media', production, 'Media bucket is not configured'),
    envCheck('AWS_REGION', 'media', production, 'AWS region is not configured'),
    // Replaces the presence checks on the two credential variables; see
    // mediaStorageCheck for why "set" was never the question.
    await mediaStorageCheck(production),
    // Beside it: the files that reach the bucket are looked inside before they do.
    await malwareScanCheck(production),
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

  // Only when asked for (?probe=media): this one writes and deletes two small
  // objects in the bucket and reads them back the way a stranger would, so it
  // is not run by every call to an endpoint that is otherwise read-only.
  if (options.probeMedia) {
    checks.push(await mediaExposureCheck(production));
  }

  const requiredFailures = checks.filter((check) => check.required && !check.ok);
  const recommendedMissing = checks.filter((check) => !check.required && !check.ok);
  const status = requiredFailures.length === 0 ? 'ready' : 'not_ready';

  return {
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
  };
}

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

  const report = await buildLaunchReadiness({ probeMedia: req.query.probe === 'media' });
  res.status(report.status === 'ready' ? 200 : 503).json(report);
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

  // Not configured is not the same as broken. The client falls back to
  // localhost and connects lazily, so it is a client that has never reached
  // anything; letting that reach ping() reports a deployment which
  // deliberately runs without Redis as hard down, and a load balancer reading
  // /health/detailed would take the instance out of rotation for it.
  if (!process.env.REDIS_URL) {
    return {
      status: 'degraded',
      message:
        'REDIS_URL is not set: caching, rate limits and scheduled-sweep locks are per instance',
    };
  }

  // The connection asked is the shared one in utils/redis.ts, which holds the
  // sweep locks and the rate-limit counters. The one in utils/cache.ts is a
  // different connection that retries for ever on its own, so it answered "up"
  // while the sweeps were dead, which is the one thing this check is for.
  if (!(await pingRedis())) {
    return {
      status: 'down',
      latency: Date.now() - start,
      message:
        'Redis does not answer: scheduled sweeps (reminders, expiry warnings, scheduled posts) are paused on this instance, and the ones skipped so far are listed under ops as redis.sweeps_skipped; the rate-limit counters are per process. It reconnects by itself.',
    };
  }
  return {
    status: 'up',
    latency: Date.now() - start,
  };
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
  // The public status page reads the service and the package version from this.
  // The Node version, the build time and the commit say which known flaws a
  // build has, so they go only to a caller holding the diagnostics token.
  if (!hasProtectedHealthAccess(req)) {
    return res.json({
      service: 'athena-server',
      version: process.env.npm_package_version || '1.0.0',
    });
  }
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
