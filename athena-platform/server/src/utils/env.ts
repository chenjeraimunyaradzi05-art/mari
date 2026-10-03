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
import { mayUseDevelopmentJwtSecret } from './jwt';
import { isStrongSecret } from './secret-strength';
import { ENCRYPTION_KEY_VARIABLES, previousKeyVariable } from './encryption-key';
import { senderAddressProblem } from './sender-address';

interface EnvValidation {
  name: string;
  required: boolean;
  productionOnly?: boolean;
  validator?: (value: string) => boolean;
  errorMessage?: string;
  /** What to say when a required variable is missing, where "Missing required environment variable" is not enough. */
  missingMessage?: string;
  /**
   * What to say, in production, when a variable that is recommended and not required is unset, where "Recommended
   * for production" does not say what stops working. Should begin with the variable's name and "is not set".
   */
  absentWarning?: string;
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
  // Every member's session is signed with this. Length alone was the whole
  // check, and the example env file's value is 47 characters, so a deployment
  // that copied the example booted and signed tokens with a string printed in
  // the repository. See utils/secret-strength.ts for what else is refused.
  {
    name: 'JWT_SECRET',
    required: true,
    productionOnly: true,
    validator: (v) => isStrongSecret(v),
    errorMessage:
      'JWT_SECRET must be a random value of at least 32 characters, not a placeholder or a repeating pattern ' +
      '(generate one with `openssl rand -hex 32`)',
  },
  {
    name: 'DV_ENCRYPTION_KEY',
    required: true,
    productionOnly: true,
    // The all-zero key in the example env file is valid hex, so the shape check
    // alone passed it.
    validator: (v) => /^[0-9a-fA-F]{64}$/.test(v) && isStrongSecret(v, 64),
    errorMessage:
      'DV_ENCRYPTION_KEY must be a random 64-character hex key, not a placeholder such as all zeros ' +
      '(generate one with `openssl rand -hex 32`)',
  },
  // Which hash the ban list is keyed with. Without it the key is derived from
  // JWT_SECRET, and rotating JWT_SECRET then quietly unbans everyone; the
  // service logs that at first use, and this puts it in the boot warnings
  // where an operator reads them. Not required, because setting it after bans
  // exist would orphan the hashes already written, and that is a decision for
  // the operator (docs/runbooks/ONCALL.md says how).
  {
    name: 'BANNED_IDENTITY_HASH_KEY',
    required: false,
    productionOnly: true,
    validator: (v) => isStrongSecret(v),
    errorMessage:
      'BANNED_IDENTITY_HASH_KEY must be a random value of at least 32 characters (generate one with `openssl rand -hex 32`)',
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
  //
  // Neither is required to boot: a deployment that has not set Stripe up yet
  // should answer /livez and be looked at, and refusing to start would turn
  // "payments are not set up" into "the site is down", safety features included
  // (utils/launch-readiness.ts keeps the choice and removes the silence, with an
  // error and a Sentry message at every boot). What makes that safe is that
  // nothing pretends. Without the key, utils/stripe hands production a client that
  // answers every use with a 503, every service that has a development mock
  // refuses it there (canUseMockStripe), and ALLOW_STRIPE_SIMULATION, the one
  // switch that lets a payment succeed without a processor, stops the boot below.
  {
    name: 'STRIPE_SECRET_KEY',
    required: false,
    productionOnly: true,
    validator: (v) => v.startsWith('sk_'),
    errorMessage: 'STRIPE_SECRET_KEY must start with sk_',
    absentWarning:
      'STRIPE_SECRET_KEY is not set: every payment, payout and Connect action answers 503 until it is, and nothing is simulated in its place',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    productionOnly: true,
    validator: (v) => v.startsWith('whsec_'),
    errorMessage: 'STRIPE_WEBHOOK_SECRET must start with whsec_',
    absentWarning:
      'STRIPE_WEBHOOK_SECRET is not set: every Stripe event is refused, so a payment that completes is never recorded and a hold that authorises is never seen',
  },
  // The Connect endpoint has a secret of its own (webhook.routes.ts verifies an
  // event against whichever of the two signed it). Left unset, payout.failed
  // and account.updated are refused and nobody is told. Recommended and not
  // required, like the two above: the API boots and says so, and
  // /health/launch-readiness fails in production until it is set.
  {
    name: 'STRIPE_CONNECT_WEBHOOK_SECRET',
    required: false,
    productionOnly: true,
    validator: (v) => v.startsWith('whsec_'),
    errorMessage: 'STRIPE_CONNECT_WEBHOOK_SECRET must start with whsec_',
  },
  // Whether a new Express account is created on a manual payout schedule, so the
  // Withdraw button and Stripe's automatic payouts do not compete for one balance.
  // Only 'manual' changes anything (services/stripe-connect.service); the choice is
  // made in test mode (docs/runbooks/STRIPE-CONNECT.md). Unset is Stripe's default.
  {
    name: 'STRIPE_CONNECT_PAYOUT_SCHEDULE',
    required: false,
    validator: (v) => ['manual', 'automatic'].includes(v.trim().toLowerCase()),
    errorMessage:
      "STRIPE_CONNECT_PAYOUT_SCHEDULE must be 'manual' or 'automatic'. Only 'manual' changes anything; anything else leaves " +
      "Stripe's own schedule in place.",
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
    validator: (v) => isStrongSecret(v),
    errorMessage:
      'PROXY_SHARED_SECRET must be a random value of at least 32 characters, and must match the value the web host sends. ' +
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
  //
  // The check is also that the value is an address. It used to be only that
  // something was set, so a value of spaces, or a pasted variable name, passed
  // here and then failed at the first connection, which is no longer a boot.
  {
    name: 'REDIS_URL',
    required: true,
    productionOnly: true,
    validator: (value) => /^rediss?:\/\/\S+$/.test(value.trim()),
    errorMessage: 'REDIS_URL must be a redis:// or rediss:// address',
    missingMessage:
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
  // Media storage.
  //
  // The Dockerfile, fly.toml and the launch-readiness check all say S3 is
  // required in production, and until now the boot sequence did not: without
  // the credentials every avatar, post image, résumé and reel was written to
  // the container's own disk, which the next deploy wipes and which a second
  // instance cannot read. Presence alone is not enough either — the env
  // template ships AWS_ACCESS_KEY_ID="your_aws_access_key", which is
  // non-empty — so the values are held to the shape AWS actually issues, and
  // the bucket is named rather than left to the default, which is a name this
  // platform does not own. Whether the bucket answers is asked at startup by
  // probeMediaStorage (utils/media-storage.ts), since a variable cannot say.
  {
    name: 'AWS_ACCESS_KEY_ID',
    required: true,
    productionOnly: true,
    validator: (v) => /^[A-Z0-9]{16,128}$/.test(v.trim()),
    errorMessage:
      'AWS_ACCESS_KEY_ID must be a real access key id (upper-case letters and digits, as AWS issues them). Without S3, ' +
      'uploaded media is written to the container disk and lost at the next deploy.',
  },
  {
    name: 'AWS_SECRET_ACCESS_KEY',
    required: true,
    productionOnly: true,
    validator: (v) => /^[A-Za-z0-9/+=]{30,}$/.test(v.trim()),
    errorMessage: 'AWS_SECRET_ACCESS_KEY must be a real secret access key, not a placeholder.',
  },
  {
    name: 'S3_BUCKET',
    required: true,
    productionOnly: true,
    validator: (v) => /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(v.trim()),
    errorMessage: 'S3_BUCKET must name the bucket media is stored in (a valid S3 bucket name).',
  },
  // Where a public file is served from: the CDN in front of the bucket's public
  // folders (infrastructure/README.md, "Media bucket").
  //
  // Like API_URL, it is written into the row with every upload: an avatar or a
  // post picture is stored as `${CDN_URL}/key`, so a wrong value is permanent for
  // that file. Left unset, the address falls back to the bucket's own, which
  // Block Public Access (on, by the runbook) answers with 403, and the bucket
  // would then have to be opened to the internet to make avatars load, which
  // opens every résumé and every chat file with them. So production does not
  // start without it, and refuses the bucket's own address, since that is the
  // fallback written out by hand.
  {
    name: 'CDN_URL',
    required: true,
    productionOnly: true,
    validator: (v) => {
      try {
        const url = new URL(v.trim());
        return url.protocol === 'https:' && !/(^|\.)amazonaws\.com$/i.test(url.hostname);
      } catch {
        return false;
      }
    },
    errorMessage:
      'CDN_URL must be the https address of the CDN in front of the media bucket, not the bucket’s own amazonaws.com ' +
      'address: it is written into every upload’s stored URL, and the bucket keeps Block Public Access on.',
    missingMessage:
      'CDN_URL is required in production: public files (avatars, covers, post pictures, reels) are stored as ' +
      '`${CDN_URL}/key`, and without a CDN the only alternative is a publicly readable bucket, which would expose ' +
      'résumés and chat files too. Put CloudFront in front of the public folders (infrastructure/README.md, "Media bucket").',
  },
  // Malware scanning (services/malware-scan.service.ts). None is required to
  // boot, for the reason Stripe and the AI key are not: a deployment without a
  // scanner should answer /livez and be looked at, not exit. What the missing
  // scanner costs is spelled out at boot and in /health/launch-readiness: in
  // production a résumé or a document is refused until it answers.
  {
    name: 'CLAMAV_HOST',
    required: false,
    productionOnly: true,
    validator: (v) => /^[A-Za-z0-9]([A-Za-z0-9._-]{0,251}[A-Za-z0-9])?$/.test(v.trim()),
    errorMessage:
      'CLAMAV_HOST must be a host name or address on its own, with no scheme or port (the port is CLAMAV_PORT), ' +
      'for example athena-clamav.internal.',
  },
  {
    name: 'CLAMAV_PORT',
    required: false,
    validator: (v) => /^\d{1,5}$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 65535,
    errorMessage: 'CLAMAV_PORT must be a port number between 1 and 65535 (clamd listens on 3310).',
  },
  {
    name: 'MALWARE_SCAN_REQUIRED',
    required: false,
    validator: (v) => ['off', 'false', 'documents', 'true', 'all'].includes(v.trim().toLowerCase()),
    errorMessage:
      "MALWARE_SCAN_REQUIRED must be 'documents', 'all' or 'off'. Anything else is ignored and the environment's default applies " +
      '(documents in production), so a typo cannot switch the check off.',
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
  // Email.
  //
  // Both used to be "recommended": the API booted without them, registration
  // then created the account and the verification token and only afterwards
  // found it could not send, so every sign-up answered 503 and left an
  // account nobody could verify. Nothing in this product works for a new
  // member until a verification email can leave, so the process does not start
  // without the means to send one.
  //
  // The sender is named rather than defaulted. It used to fall back to
  // noreply@athena.com, a domain the venture does not own; SendGrid refuses a
  // sender it has not authenticated, so that default only ever looked
  // configured. Whether the domain is authenticated cannot be read off a
  // variable; the first send says, so the runbook's post-deploy check is to
  // register a throwaway address and watch for the verification email
  // (docs/runbooks/ONCALL.md, "Sign-up answers 503").
  {
    name: 'SENDGRID_API_KEY',
    required: true,
    productionOnly: true,
    validator: (v) => v.startsWith('SG.'),
    errorMessage: 'SENDGRID_API_KEY must start with SG.',
  },
  {
    name: 'SENDGRID_FROM_EMAIL',
    required: true,
    productionOnly: true,
    validator: (v) => senderAddressProblem(v) === null,
    errorMessage:
      'SENDGRID_FROM_EMAIL must be one plain address on a domain ATHENA owns and has authenticated with SendGrid ' +
      '(not athena.com, example.com or another placeholder). Verification and password-reset emails are sent from it.',
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

/**
 * Said when nothing can sign a session: no JWT_SECRET, outside the two
 * environments that may use the built-in key. Unlike the rest of the
 * non-production errors it stops the process (see validateEnvironmentOrExit),
 * because a staging deployment that started anyway answered every sign-in with
 * a 500 and looked healthy to everything but a member.
 */
const NO_SIGNING_KEY_ERROR =
  'JWT_SECRET is not set, and NODE_ENV is not "development" or "test", so there is no key to sign sessions with. ' +
  'Set JWT_SECRET (`openssl rand -hex 32`).';

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
        errors.push(validation.missingMessage ?? `Missing required environment variable: ${validation.name}`);
      } else if (isProd && validation.productionOnly) {
        warnings.push(validation.absentWarning ?? `Recommended for production: ${validation.name} is not set`);
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

  // A payment must never succeed without a processor in production. The formation
  // service has a simulation mode for development, switched on by this flag, in
  // which a mock intent is issued and the registration is marked paid with no
  // charge; it is off in every deploy file and every example. In production it is
  // ignored by the service (see formation.service), and it is refused here as
  // well, because a deployment that has it on has been configured by somebody who
  // believes it does something, and the honest answer is to say it does not.
  if (isProd && (process.env.ALLOW_STRIPE_SIMULATION ?? '').trim().toLowerCase() === 'true') {
    errors.push(
      'ALLOW_STRIPE_SIMULATION must not be "true" in production. It lets a business registration be marked paid with no ' +
        'charge, which no production deployment may do. Set it to false or remove it.'
    );
  }

  // Only "development" and "test" may sign with the built-in key (utils/jwt.ts).
  // The loop above only asks for JWT_SECRET when NODE_ENV is exactly
  // "production", so a staging deployment with no secret used to boot and then
  // sign with a public string. It now says so at boot, as an error, because
  // signing a session is where the process would otherwise fail.
  if (!isProd && !process.env.JWT_SECRET && !mayUseDevelopmentJwtSecret()) {
    errors.push(NO_SIGNING_KEY_ERROR);
  }

  // The two optional encryption keys, and the retired keys a rotation leaves
  // behind (utils/encryption-key.ts). None of them is required: health records
  // and authenticator seeds fall back to DV_ENCRYPTION_KEY. But one that is set
  // is the key those values are sealed with, and a malformed one is not a
  // fallback, it is every health write throwing in production. A retired key
  // that is malformed is skipped when opening, which makes whatever it sealed
  // unreadable without a word, so both stop the boot rather than waiting for a
  // member to find out. The messages never print a value.
  if (isProd) {
    const hexKey = /^[0-9a-fA-F]{64}$/;
    for (const name of ENCRYPTION_KEY_VARIABLES) {
      const value = process.env[name];
      // DV_ENCRYPTION_KEY has its own, stricter entry above.
      if (name !== 'DV_ENCRYPTION_KEY' && value && !(hexKey.test(value) && isStrongSecret(value, 64))) {
        errors.push(
          `${name} must be a random 64-character hex key, not a placeholder such as all zeros, or left unset to use DV_ENCRYPTION_KEY ` +
            '(generate one with `openssl rand -hex 32`)'
        );
      }

      const previous = previousKeyVariable(name);
      const retired = (process.env[previous] ?? '').split(/[\s,]+/).filter(Boolean);
      if (retired.some((key) => !hexKey.test(key))) {
        errors.push(
          `${previous} must hold 64-character hex keys separated by commas. A key it cannot read is skipped, and ` +
            'whatever it sealed stays unreadable (docs/runbooks/ENCRYPTION.md)'
        );
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

    // The one non-production error that is not survivable: a process that
    // cannot sign a session cannot sign anyone in.
    if (result.errors.includes(NO_SIGNING_KEY_ERROR)) {
      throw new Error('Invalid environment configuration: JWT_SECRET is not set');
    }

    logger.warn('Server starting with invalid non-production configuration');
  } else {
    logger.info('Environment validation passed');
  }
}
