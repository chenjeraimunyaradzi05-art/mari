/**
 * What the platform is actually running with, for the admin console.
 *
 * The admin "Platform Settings" page used to print a table of constants
 * ('Session Timeout: 7 days', 'CDN: CloudFront', 'Maintenance Mode: Disabled')
 * that were read from nowhere and mostly wrong. These two routes answer the
 * same questions from the process itself:
 *
 *   GET /api/admin/ops/config    non-secret runtime facts: build, maintenance
 *                                state, rate limit, token lifetimes, the staff
 *                                two-factor policy, storage backend, and which
 *                                integrations are configured (true/false only,
 *                                never a value).
 *   GET /api/admin/ops/revenue   monthly recurring revenue summed from the
 *                                amounts Stripe recorded on each subscription,
 *                                normalised to a month. A subscription without
 *                                a recorded amount is counted and reported,
 *                                never priced from a guess.
 *
 * Nothing here returns a secret: keys, URLs with credentials and tokens are
 * reduced to "configured or not". Mounted at /api/admin ahead of the general
 * admin router, guarding each route itself like admin-operations.routes.ts so
 * unmatched paths fall through.
 */

import { Router, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { staffTwoFactorRequired } from '../middleware/roles';
import { getMaintenanceState } from '../services/feature-flags.service';
import { ingestConfig } from '../services/livestream.service';
import { authorityReferralMailbox, trustAndSafetyMailbox } from '../services/content-report.service';
import { decodeToken, generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { bestEffort } from '../utils/best-effort';

const router = Router();
const adminOnly: RequestHandler[] = [authenticate, requireRole('ADMIN')];

// ---------------------------------------------------------------- helpers

/**
 * Set, and not one of the placeholders .env.example ships with. The same list
 * lives in health.routes.ts (module-private there); keep the two in step.
 */
const PLACEHOLDER_VALUES = new Set([
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
]);

export function isConfiguredEnv(name: string): boolean {
  const value = process.env[name];
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return !PLACEHOLDER_VALUES.has(normalized);
}

/**
 * The API rate limit as index.ts applies it. index.ts parses the same three
 * variables with the same defaults and cannot export the result without a
 * circular import, so the expressions are repeated here. Change both together.
 */
export function describeRateLimit(): { enabled: boolean; windowMs: number; max: number } {
  const enabled = process.env.NODE_ENV === 'production' || process.env.RATE_LIMIT_ENABLED !== 'false';
  const windowRaw = parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10);
  const maxRaw = parseInt(
    process.env.RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? '100' : '2000'),
    10
  );
  return {
    enabled,
    windowMs: Number.isFinite(windowRaw) ? windowRaw : 15 * 60 * 1000,
    max: Number.isFinite(maxRaw) ? maxRaw : 100,
  };
}

/**
 * The lifetime a token really gets, measured by signing a throwaway one and
 * reading its claims back, so the answer cannot drift from utils/jwt.ts. The
 * token is discarded; nothing stores or returns it.
 *
 * Null when the probe fails, because a guessed lifetime on a page whose whole
 * point is to stop printing constants nobody checked would be the old bug
 * again. What the catch used to carry was a comment saying the failure is
 * "only possible when JWT_SECRET is missing in production" — and that is not
 * the only way in. generateAccessToken passes JWT_EXPIRES_IN (and the refresh
 * one JWT_REFRESH_EXPIRES_IN) straight to jwt.sign, which throws on a timespan
 * it cannot parse, in every environment, whatever the secret is. So a typo in
 * one environment variable turned both lifetimes on the admin console into a
 * silent blank that the comment explained away as a missing secret. The null
 * is kept; bestEffort logs which of the two it actually was. The work is a
 * thunk rather than a promise because sign() throws synchronously — there is
 * no promise to reject.
 */
async function measureTokenSeconds(
  label: string,
  sign: (payload: { userId: string; email: string; role: string; persona: string }) => string
): Promise<number | null> {
  return bestEffort(
    label,
    () => {
      const decoded = decodeToken(sign({ userId: 'config-probe', email: 'probe@invalid', role: 'USER', persona: 'NONE' }));
      if (!decoded?.exp || !decoded?.iat) return null;
      return decoded.exp - decoded.iat;
    },
    null
  );
}

const env = (name: string): string | null => process.env[name]?.trim() || null;

// ---------------------------------------------------------------- config

/**
 * GET /admin/ops/config
 * Non-secret runtime facts. Every boolean is "configured or not"; every
 * number is the value the process is using; unknowns are null.
 */
router.get('/ops/config', ...adminOnly, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const maintenance = await getMaintenanceState({ fresh: true });
    const s3 = !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY; // media-storage.ts hasS3Credentials()
    const { ingestUrl, playbackTemplate } = ingestConfig();

    res.json({
      build: {
        service: 'athena-server',
        version: env('npm_package_version'),
        node: process.version,
        environment: process.env.NODE_ENV || 'development',
        buildTime: env('BUILD_TIME'),
        commitSha: env('COMMIT_SHA'),
      },
      maintenance,
      rateLimit: describeRateLimit(),
      tokens: {
        accessSeconds: await measureTokenSeconds('admin-config.access-token-lifetime-probe', generateAccessToken),
        refreshSeconds: await measureTokenSeconds('admin-config.refresh-token-lifetime-probe', generateRefreshToken),
      },
      security: {
        // Production always insists on a second factor for staff; elsewhere
        // STAFF_TWO_FACTOR_REQUIRED=false switches it off.
        staffTwoFactor: staffTwoFactorRequired() ? 'required' : 'optional',
      },
      storage: {
        backend: s3 ? 's3' : 'local',
        region: s3 ? process.env.AWS_REGION?.trim() || 'ap-southeast-2' : null,
        bucketConfigured: isConfiguredEnv('S3_BUCKET'),
        cdnConfigured: isConfiguredEnv('CDN_URL'),
      },
      integrations: {
        email: isConfiguredEnv('SENDGRID_API_KEY'),
        stripe: isConfiguredEnv('STRIPE_SECRET_KEY'),
        ai: isConfiguredEnv('AI_OPENAI_API_KEY') || isConfiguredEnv('OPENAI_API_KEY'),
        aiSimulationAllowed: process.env.AI_ALLOW_SIMULATION === 'true',
        redis: isConfiguredEnv('REDIS_URL'),
        openSearch: process.env.OPENSEARCH_ENABLED === 'true' || isConfiguredEnv('OPENSEARCH_NODE'),
        livestreamIngest: Boolean(ingestUrl),
        livestreamPlayback: Boolean(playbackTemplate),
        sentry: isConfiguredEnv('SENTRY_DSN'),
        // Where a content report's contents are sent when it is high priority,
        // and where a CSAM or terrorism referral is queued for a human to file.
        // Both used to fall back to a literal address at a domain the venture
        // does not own, and nothing anywhere told an operator the variable was
        // missing, so the audit that exists to catch exactly this now covers
        // them. False means the alert is not sent at all: the queue still holds
        // the report, but nobody is told it is there.
        trustSafetyAlerts: Boolean(trustAndSafetyMailbox()),
        authorityReferralAlerts: Boolean(authorityReferralMailbox()),
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- revenue

const PAYING_STATUSES = ['ACTIVE', 'TRIALING'] as const;

/** How many months one billing interval covers; null for an interval we do not know. */
function monthsPerInterval(interval: string | null | undefined): number | null {
  switch ((interval || '').trim().toLowerCase()) {
    case 'month':
    case 'monthly':
      return 1;
    case 'year':
    case 'yearly':
    case 'annual':
    case 'annually':
      return 12;
    case 'week':
    case 'weekly':
      return 12 / 52;
    case 'day':
    case 'daily':
      return 12 / 365;
    default:
      return null;
  }
}

/** The amount per month, or null when the amount or the interval was not recorded. */
export function monthlyAmount(amount: unknown, interval: string | null | undefined): number | null {
  if (amount === null || amount === undefined) return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  const months = monthsPerInterval(interval);
  if (months === null) return null;
  return value / months;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

type Bucket = { count: number; recorded: number; notRecorded: number; total: number; currencies: Set<string> };
const newBucket = (): Bucket => ({ count: 0, recorded: 0, notRecorded: 0, total: 0, currencies: new Set() });

/** A sum is only a figure when every recorded row shares one currency. */
function settle(bucket: Bucket): { mrr: number | null; currency: string | null; mixedCurrencies: boolean } {
  const mixedCurrencies = bucket.currencies.size > 1;
  if (bucket.recorded === 0 || mixedCurrencies) return { mrr: null, currency: null, mixedCurrencies };
  return { mrr: round2(bucket.total), currency: bucket.currencies.values().next().value ?? null, mixedCurrencies: false };
}

/**
 * GET /admin/ops/revenue
 * MRR from what Stripe recorded on each active or trialing paid subscription,
 * a yearly amount divided by twelve. Rows without a recorded amount are
 * counted as `notRecorded` and never priced.
 */
router.get('/ops/revenue', ...adminOnly, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.subscription.findMany({
      where: { status: { in: [...PAYING_STATUSES] }, tier: { not: 'FREE' } },
      select: { tier: true, status: true, amount: true, interval: true, currency: true },
    });

    const all = newBucket();
    const byTier = new Map<string, Bucket>();

    for (const row of rows) {
      const tier = byTier.get(row.tier) ?? newBucket();
      byTier.set(row.tier, tier);
      const monthly = monthlyAmount(row.amount, row.interval);
      for (const bucket of [all, tier]) {
        bucket.count += 1;
        if (monthly === null) {
          bucket.notRecorded += 1;
        } else {
          bucket.recorded += 1;
          bucket.total += monthly;
          bucket.currencies.add((row.currency || 'unknown').toUpperCase());
        }
      }
    }

    const total = settle(all);

    res.json({
      mrr: total.mrr,
      arr: total.mrr === null ? null : round2(total.mrr * 12),
      currency: total.currency,
      mixedCurrencies: total.mixedCurrencies,
      subscriptions: { paying: all.count, recorded: all.recorded, notRecorded: all.notRecorded },
      byTier: [...byTier.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([tier, bucket]) => ({ tier, count: bucket.count, recorded: bucket.recorded, notRecorded: bucket.notRecorded, ...settle(bucket) })),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
