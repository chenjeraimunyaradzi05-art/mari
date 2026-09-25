/**
 * Environment Variable Validation
 * Validates required environment variables at startup
 * Step: Security hardening - fail fast if critical config is missing
 */

import { logger } from './logger';
import {
  applyDatabaseUrlDefaults,
  isNeonConnectionString,
  isPostgresConnectionString,
} from './database-url';

interface EnvValidation {
  name: string;
  required: boolean;
  productionOnly?: boolean;
  validator?: (value: string) => boolean;
  errorMessage?: string;
}

const hasSearchParam = (value: string, param: string, expected?: string) => {
  try {
    const url = new URL(value);
    const actual = url.searchParams.get(param);
    return expected === undefined ? actual !== null : actual === expected;
  } catch {
    return expected === undefined ? value.includes(`${param}=`) : value.includes(`${param}=${expected}`);
  }
};

const ENV_VALIDATIONS: EnvValidation[] = [
  // Critical security
  {
    name: 'JWT_SECRET',
    required: true,
    productionOnly: true,
    validator: (v) => v.length >= 32,
    errorMessage: 'JWT_SECRET must be at least 32 characters for security',
  },
  {
    name: 'DV_ENCRYPTION_KEY',
    required: true,
    productionOnly: true,
    validator: (v) => /^[0-9a-fA-F]{64}$/.test(v),
    errorMessage: 'DV_ENCRYPTION_KEY must be a 64-character hex key',
  },
  {
    name: 'DATABASE_URL',
    required: true,
    validator: isPostgresConnectionString,
    errorMessage: 'DATABASE_URL must be a valid PostgreSQL connection string',
  },
  {
    name: 'DIRECT_DATABASE_URL',
    required: true,
    productionOnly: true,
    validator: isPostgresConnectionString,
    errorMessage: 'DIRECT_DATABASE_URL must be a valid PostgreSQL connection string',
  },
  // Stripe (required for payments)
  {
    name: 'STRIPE_SECRET_KEY',
    required: false,
    productionOnly: true,
    validator: (v) => v.startsWith('sk_'),
    errorMessage: 'STRIPE_SECRET_KEY must start with sk_',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    productionOnly: true,
    validator: (v) => v.startsWith('whsec_'),
    errorMessage: 'STRIPE_WEBHOOK_SECRET must start with whsec_',
  },
  // The web proxy proves who it is with this.
  //
  // It used to be optional, and being optional is the whole defect. In
  // production no browser talks to this API directly: every call goes through
  // the Next.js route handlers, which fetch us from the web host's own egress
  // addresses. Without the secret those forwarded addresses are not believed,
  // so the API sees one address for the entire site — the login limiter's
  // budget of ten attempts per fifteen minutes is then shared by every member
  // at once, the login lockout locks out the proxy rather than the attacker,
  // and the new-device alert compares the web host's address to itself and
  // therefore never fires. That last one is a woman not being told that
  // somebody else has signed into her account, which is not something to
  // start a production process without.
  //
  // The value has to be the same string the web host sends in
  // X-Athena-Proxy-Secret (client/src/app/api/proxy-identity.ts reads it from
  // its own PROXY_SHARED_SECRET); `openssl rand -hex 32` generates one.
  {
    name: 'PROXY_SHARED_SECRET',
    required: true,
    productionOnly: true,
    validator: (v) => v.trim().length >= 32,
    errorMessage:
      'PROXY_SHARED_SECRET must be at least 32 characters, and must match the value the web host sends. ' +
      'Without it the whole site shares one login budget and new-device alerts never fire.',
  },
  // Redis.
  //
  // The launch-readiness endpoint and scripts/check-env.js have both called
  // this required in production for a long time; the boot sequence did not,
  // so a deployment missing it started anyway and only said so in a log line.
  // What is actually per-instance without it: the rate-limit counters, the
  // caches, and the locks that stop the nine scheduled sweepers running on
  // every instance at once — which is duplicate escrow-expiry warnings,
  // duplicate wellness reminders and scheduled posts published N times.
  {
    name: 'REDIS_URL',
    required: true,
    productionOnly: true,
    errorMessage:
      'REDIS_URL is required in production: without it rate limits and caches are per instance and the ' +
      'scheduled sweeps run unlocked on every instance, sending duplicate reminders and publishing posts more than once.',
  },
  // Where this API answers from, as the outside world reaches it.
  //
  // It was read in two places and validated in none. When S3 is not
  // configured an upload is stored on this host and its public URL is built
  // as `${API_URL}/uploads/...` — and the fallback when API_URL is unset is
  // http://localhost:5000. That URL is then written into the database row for
  // the avatar, the post image, the résumé or the reel, so the media is
  // broken for everyone and stays broken after the variable is fixed, because
  // the wrong URL was persisted rather than derived.
  {
    name: 'API_URL',
    required: true,
    productionOnly: true,
    validator: (v) => {
      try {
        const url = new URL(v);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
        return !/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(url.hostname);
      } catch {
        return false;
      }
    },
    errorMessage:
      'API_URL must be the absolute address this API answers on from the outside (not localhost): locally stored ' +
      'uploads bake it into the URL saved on the row, so a wrong value is permanent for that file.',
  },
  // Operator tokens: a short one is guessable, so a short one is reported.
  {
    name: 'METRICS_TOKEN',
    required: false,
    validator: (v) => v.length >= 16,
    errorMessage: 'METRICS_TOKEN must be at least 16 characters',
  },
  {
    name: 'DEBUG_SECRET',
    required: false,
    validator: (v) => v.length >= 16,
    errorMessage: 'DEBUG_SECRET must be at least 16 characters',
  },
  {
    name: 'HEALTH_DIAGNOSTICS_TOKEN',
    required: false,
    validator: (v) => v.length >= 16,
    errorMessage: 'HEALTH_DIAGNOSTICS_TOKEN must be at least 16 characters',
  },
  // Australian integrations (optional; the features say so when unset)
  { name: 'ABR_GUID', required: false },
  { name: 'BASIQ_API_KEY', required: false },
  { name: 'LEAD_ALERT_EMAIL', required: false },
  // Email
  {
    name: 'SENDGRID_API_KEY',
    required: false,
    productionOnly: true,
    validator: (v) => v.startsWith('SG.'),
    errorMessage: 'SENDGRID_API_KEY must start with SG.',
  },
  // Sentry
  {
    name: 'SENTRY_DSN',
    required: false,
    productionOnly: true,
    validator: (v) => v.startsWith('https://') && v.includes('@'),
    errorMessage: 'SENTRY_DSN must be a valid Sentry DSN URL',
  },
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): ValidationResult {
  const databaseUrls = applyDatabaseUrlDefaults();
  const isProd = process.env.NODE_ENV === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  const directDatabaseUrlWasDerived =
    databaseUrls.directDatabaseUrlWasDerived || process.env.ATHENA_DIRECT_DATABASE_URL_DERIVED === 'true';

  if (directDatabaseUrlWasDerived && databaseUrls.databaseUrl && isNeonConnectionString(databaseUrls.databaseUrl)) {
    warnings.push(
      'DIRECT_DATABASE_URL was derived from DATABASE_URL. Set an explicit unpooled Neon DIRECT_DATABASE_URL in production.'
    );
  }

  for (const validation of ENV_VALIDATIONS) {
    const value = process.env[validation.name];
    const isRequired = validation.required && (!validation.productionOnly || isProd);

    // Check if required variable is missing
    if (!value) {
      if (isRequired) {
        errors.push(`Missing required environment variable: ${validation.name}`);
      } else if (isProd && validation.productionOnly) {
        warnings.push(`Recommended for production: ${validation.name} is not set`);
      }
      continue;
    }

    // Validate the value format if validator is provided
    if (validation.validator && !validation.validator(value)) {
      const message = validation.errorMessage || `Invalid format for ${validation.name}`;
      if (isRequired) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && isNeonConnectionString(databaseUrl)) {
    if (!hasSearchParam(databaseUrl, 'sslmode', 'require')) {
      const message = 'Neon DATABASE_URL should include sslmode=require';
      if (isProd) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }

    if (!hasSearchParam(databaseUrl, 'channel_binding', 'require')) {
      warnings.push('Neon DATABASE_URL should include channel_binding=require when available');
    }

    const host = (() => {
      try {
        return new URL(databaseUrl).hostname;
      } catch {
        return databaseUrl;
      }
    })();

    const directUrl = process.env.DIRECT_DATABASE_URL;
    if (host.includes('-pooler.') && !directUrl) {
      const message = 'Set DIRECT_DATABASE_URL to the unpooled Neon connection string for Prisma migrations';
      if (isProd) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }

    if (directUrl && isNeonConnectionString(directUrl)) {
      if (!hasSearchParam(directUrl, 'sslmode', 'require')) {
        const message = 'Neon DIRECT_DATABASE_URL should include sslmode=require';
        if (isProd) {
          errors.push(message);
        } else {
          warnings.push(message);
        }
      }

      try {
        const directHost = new URL(directUrl).hostname;
        if (directHost.includes('-pooler.')) {
          warnings.push('DIRECT_DATABASE_URL should use the unpooled Neon hostname, not the pooled hostname');
        }
      } catch {
        // The format validator reports malformed URLs separately.
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateEnvironmentOrExit(): void {
  const result = validateEnvironment();
  const isProd = process.env.NODE_ENV === 'production';

  // Log warnings
  for (const warning of result.warnings) {
    logger.warn('Environment warning', { warning });
  }

  if (!result.valid) {
    for (const error of result.errors) {
      logger.error('Environment validation failed', { error });
    }

    if (isProd) {
      throw new Error('Invalid environment configuration');
    }

    logger.warn('Server starting with invalid non-production configuration');
  } else {
    logger.info('Environment validation passed');
  }
}
