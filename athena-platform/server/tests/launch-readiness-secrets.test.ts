import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

/**
 * What /health/launch-readiness says about the secrets and the mail sender.
 *
 * It used to call a secret "Configured" because it was not empty. The example
 * env file's JWT_SECRET is 47 characters and its DV_ENCRYPTION_KEY is a valid
 * run of zeros, so a deployment that copied the example reported ready while
 * signing every session with a value printed in the repository. It now asks the
 * same question the boot check asks (utils/secret-strength.ts) and says what is
 * wrong without printing the value.
 *
 * The mail sender is the other half. SENDGRID_FROM_EMAIL had no check at all,
 * and the address it fell back to (noreply@athena.com) belongs to someone else,
 * so readiness could be green on a deployment that could not send a single
 * verification email. A variable cannot prove the domain is authenticated with
 * SendGrid, and the message says so rather than claiming it: the first real
 * send is the proof.
 *
 * Mounted on a bare express app for the same reason as
 * launch-readiness-media.test.ts: the handler reads process.env and the probe,
 * and nothing else.
 */

// Readiness also asks the database whether every migration ran; this one has them all.
jest.mock('../src/utils/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(async () =>
      (jest.requireActual('./support/applied-migrations') as typeof import('./support/applied-migrations')).appliedMigrationRows()
    ),
  },
}));
jest.mock('../src/utils/cache', () => ({ getRedisClient: () => null }));
jest.mock('../src/utils/opensearch', () => ({ getOpenSearchClient: () => null }));
jest.mock('../src/services/ml.service', () => ({ mlService: { healthCheck: jest.fn() } }));
jest.mock('../src/services/feed-ml.service', () => ({ mlRankingStats: () => ({}) }));
jest.mock('../src/services/moderation.service', () => ({ isTextModerationConfigured: () => true }));
jest.mock('../src/utils/media-storage', () => ({
  probeMediaStorage: async () => ({ reachable: true, detail: 'S3 bucket athena-uploads is reachable' }),
}));

import healthRoutes from '../src/routes/health.routes';

const app = express();
app.use('/health', healthRoutes);

interface ReadinessCheck {
  key: string;
  category: string;
  required: boolean;
  ok: boolean;
  message: string;
}

interface ReadinessBody {
  status: 'ready' | 'not_ready';
  checks: ReadinessCheck[];
}

const originalEnv = { ...process.env };

const RANDOM_HEX = '21c983cb1baec38efae62af1e84dc644fdc9306f8b190a8e76dd98eed44be44b';
const OTHER_RANDOM_HEX = '1e7668712a2dfacf98da6906a9b348287f7013dbba1cd6f6421e36f7273132e1';

/** Every variable the production list requires, so each test fails only on what it is about. */
function configuredProduction(): void {
  Object.assign(process.env, {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    CLIENT_URL: 'https://example.test',
    ALLOWED_ORIGINS: 'https://example.test',
    JWT_SECRET: RANDOM_HEX,
    DV_ENCRYPTION_KEY: OTHER_RANDOM_HEX,
    METRICS_TOKEN: 'metrics-token',
    HEALTH_DIAGNOSTICS_TOKEN: 'health-token',
    SENDGRID_API_KEY: 'SG.test',
    SENDGRID_FROM_EMAIL: 'noreply@mail.ourdomain.org',
    STRIPE_SECRET_KEY: 'sk_live_test',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_connect_test',
    STRIPE_PRICE_CAREER: 'price_1',
    STRIPE_PRICE_PROFESSIONAL: 'price_2',
    STRIPE_PRICE_ENTREPRENEUR: 'price_3',
    STRIPE_PRICE_CREATOR: 'price_4',
    // Who ATHENA is on an invoice: required in production, because no invoice
    // document is produced without them (services/invoice.service supplierReadiness).
    ATHENA_LEGAL_NAME: 'Example Trading Pty Ltd',
    ATHENA_ABN: '51824753556',
    ATHENA_BILLING_ADDRESS: '1 Example St|Brisbane QLD 4000',
    ATHENA_BILLING_EMAIL: 'billing@mail.ourdomain.org',
    S3_BUCKET: 'athena-uploads',
    AWS_REGION: 'ap-southeast-2',
    AWS_ACCESS_KEY_ID: 'AKIATEST',
    AWS_SECRET_ACCESS_KEY: 'aws-secret-access-key-value',
    AI_OPENAI_API_KEY: 'sk-test',
    REDIS_URL: 'redis://localhost:6379',
  });
  delete process.env.ENABLE_WORKERS;
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.BANNED_IDENTITY_HASH_KEY;
}

async function readiness(): Promise<ReadinessBody> {
  const response = await request(app).get('/health/launch-readiness').set('x-health-token', 'health-token');
  return response.body as ReadinessBody;
}

const checkNamed = (body: ReadinessBody, key: string) => body.checks.find((check) => check.key === key);

describe('GET /health/launch-readiness: secrets and the mail sender', () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    configuredProduction();
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  });

  describe('JWT_SECRET', () => {
    it('passes for a generated value', async () => {
      const body = await readiness();
      expect(checkNamed(body, 'JWT_SECRET')).toMatchObject({ category: 'security', required: true, ok: true, message: 'Configured' });
      expect(body.status).toBe('ready');
    });

    it('fails for the placeholder the example env file used to ship, though it is 47 characters', async () => {
      process.env.JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';

      const body = await readiness();
      const check = checkNamed(body, 'JWT_SECRET');

      expect(check).toMatchObject({ required: true, ok: false });
      expect(check?.message).toMatch(/placeholder/);
      expect(check?.message).not.toContain('your-super-secret-jwt-key');
      expect(body.status).toBe('not_ready');
    });

    it('fails for a value that is too short, and for one that is a single repeated character', async () => {
      process.env.JWT_SECRET = RANDOM_HEX.slice(0, 20);
      expect(checkNamed(await readiness(), 'JWT_SECRET')).toMatchObject({ ok: false });

      process.env.JWT_SECRET = 'a'.repeat(64);
      const repeated = checkNamed(await readiness(), 'JWT_SECRET');
      expect(repeated).toMatchObject({ ok: false });
      expect(repeated?.message).toMatch(/repeating pattern/);
    });

    it('fails when it is not set at all', async () => {
      delete process.env.JWT_SECRET;
      expect(checkNamed(await readiness(), 'JWT_SECRET')).toMatchObject({ ok: false, required: true });
    });
  });

  describe('DV_ENCRYPTION_KEY', () => {
    it('fails for the all-zero key, which is valid hex', async () => {
      process.env.DV_ENCRYPTION_KEY = '0'.repeat(64);

      const body = await readiness();
      expect(checkNamed(body, 'DV_ENCRYPTION_KEY')).toMatchObject({ category: 'security', required: true, ok: false });
      expect(body.status).toBe('not_ready');
    });

    it('fails for a key that is not 64 characters', async () => {
      process.env.DV_ENCRYPTION_KEY = RANDOM_HEX.slice(0, 40);
      const check = checkNamed(await readiness(), 'DV_ENCRYPTION_KEY');
      expect(check).toMatchObject({ ok: false });
      expect(check?.message).toMatch(/shorter than 64/);
    });

    it('fails for 64 characters that are not hex, which the strength test alone would pass and the service would then refuse', async () => {
      process.env.DV_ENCRYPTION_KEY = 'g' + OTHER_RANDOM_HEX.slice(1);
      const check = checkNamed(await readiness(), 'DV_ENCRYPTION_KEY');
      expect(check).toMatchObject({ ok: false });
      expect(check?.message).toMatch(/not 64 hexadecimal characters/);
      expect(check?.message).not.toContain(OTHER_RANDOM_HEX.slice(1, 20));
    });
  });

  describe('HEALTH_ENCRYPTION_KEY and TOTP_ENCRYPTION_KEY', () => {
    it.each(['HEALTH_ENCRYPTION_KEY', 'TOTP_ENCRYPTION_KEY'])('passes when %s is unset, because it falls back to the safe-chat key', async (name) => {
      delete process.env[name];
      const body = await readiness();
      expect(checkNamed(body, name)).toMatchObject({ category: 'security', ok: true });
      expect(body.status).toBe('ready');
    });

    it.each(['HEALTH_ENCRYPTION_KEY', 'TOTP_ENCRYPTION_KEY'])('passes when %s is a random key', async (name) => {
      process.env[name] = RANDOM_HEX;
      expect(checkNamed(await readiness(), name)).toMatchObject({ ok: true, message: 'Configured' });
    });

    it.each(['HEALTH_ENCRYPTION_KEY', 'TOTP_ENCRYPTION_KEY'])('fails, and holds the launch back, when %s is set and is not a real key', async (name) => {
      for (const value of ['0'.repeat(64), RANDOM_HEX.slice(0, 40), 'g' + OTHER_RANDOM_HEX.slice(1)]) {
        process.env[name] = value;
        const body = await readiness();
        expect(checkNamed(body, name)).toMatchObject({ required: true, ok: false });
        expect(body.status).toBe('not_ready');
      }
    });
  });

  describe('BANNED_IDENTITY_HASH_KEY', () => {
    it('is reported when missing but never holds the launch back', async () => {
      const body = await readiness();
      const check = checkNamed(body, 'BANNED_IDENTITY_HASH_KEY');

      expect(check).toMatchObject({ required: false, ok: false });
      expect(check?.message).toMatch(/rotating JWT_SECRET would unban everyone/);
      expect(body.status).toBe('ready');
    });

    it('passes once it is set', async () => {
      process.env.BANNED_IDENTITY_HASH_KEY = OTHER_RANDOM_HEX;
      expect(checkNamed(await readiness(), 'BANNED_IDENTITY_HASH_KEY')).toMatchObject({ ok: true });
    });

    it('is reported when it is set but guessable, still without holding the launch back, and never printed', async () => {
      process.env.BANNED_IDENTITY_HASH_KEY = 'ban-list-key';

      const body = await readiness();
      const check = checkNamed(body, 'BANNED_IDENTITY_HASH_KEY');

      expect(check).toMatchObject({ required: false, ok: false });
      expect(check?.message).toMatch(/shorter than 32 characters/);
      expect(check?.message).not.toContain('ban-list-key');
      expect(body.status).toBe('ready');
    });
  });

  describe('SENDGRID_FROM_EMAIL', () => {
    it('passes for an address on a domain that is not on the denylist, and does not claim the domain is proven', async () => {
      const body = await readiness();
      const check = checkNamed(body, 'SENDGRID_FROM_EMAIL');

      expect(check).toMatchObject({ category: 'email', required: true, ok: true });
      expect(check?.message).toMatch(/throwaway address/);
      expect(body.status).toBe('ready');
    });

    it('fails when it is missing, and holds the launch back', async () => {
      delete process.env.SENDGRID_FROM_EMAIL;

      const body = await readiness();
      expect(checkNamed(body, 'SENDGRID_FROM_EMAIL')).toMatchObject({ required: true, ok: false });
      expect(body.status).toBe('not_ready');
    });

    it.each(['noreply@athena.com', 'noreply@example.com', 'noreply@your-domain.com', 'ATHENA <noreply@mail.ourdomain.org>'])(
      'fails for %s',
      async (address) => {
        process.env.SENDGRID_FROM_EMAIL = address;

        const body = await readiness();
        const check = checkNamed(body, 'SENDGRID_FROM_EMAIL');

        expect(check).toMatchObject({ required: true, ok: false });
        expect(check?.message).toMatch(/Verification and password-reset emails are sent from it/);
        expect(body.status).toBe('not_ready');
      }
    );

    it('is not required outside production', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.SENDGRID_FROM_EMAIL;

      expect(checkNamed(await readiness(), 'SENDGRID_FROM_EMAIL')).toMatchObject({ required: false, ok: false });
    });
  });
});
