import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * What the health endpoints tell a stranger, what they tell the operator, and
 * what the launch-readiness list says about the second Stripe endpoint.
 *
 * Three things were wrong at once. GET /health/ready answers anyone and put
 * `error.message` in its 503, and a Prisma connection failure's message names
 * the database host and port, so a down database told every anonymous caller
 * where it lives. GET /health/version printed the Node version and the commit
 * to anyone. And STRIPE_CONNECT_WEBHOOK_SECRET, which webhook.routes.ts reads
 * to accept payout and connected-account events, was in nobody's checklist:
 * launch-readiness reported ready for a deployment that refused every
 * payout.failed.
 *
 * Mounted on a bare express app, as tests/launch-readiness-media.test.ts does:
 * the routes read process.env, the database, and nothing else.
 */

const mockQueryRaw = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockLoggerError = jest.fn();

jest.mock('../utils/prisma', () => ({ prisma: { $queryRaw: (...args: unknown[]) => mockQueryRaw(...args) } }));
jest.mock('../utils/logger', () => ({
  logger: { error: (...args: unknown[]) => mockLoggerError(...args), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
// Redis is the shared client in utils/redis.ts: whether it answers, and whether a
// deployment that must have it is ready without it, are what the tests decide.
const mockPingRedis = jest.fn<() => Promise<boolean>>();
const mockRedisReady = jest.fn<() => Promise<boolean>>();
jest.mock('../utils/redis', () => ({
  pingRedis: () => mockPingRedis(),
  redisReadyForTraffic: () => mockRedisReady(),
}));
jest.mock('../utils/opensearch', () => ({ getOpenSearchClient: () => null }));
jest.mock('../services/ml.service', () => ({ mlService: { describeHealth: jest.fn(async () => ({ configured: false })) } }));
jest.mock('../services/feed-ml.service', () => ({ mlRankingStats: () => ({}) }));
jest.mock('../services/moderation.service', () => ({ isTextModerationConfigured: () => true }));
jest.mock('../utils/media-storage', () => ({
  probeMediaStorage: async () => ({ reachable: true, detail: 'S3 bucket athena-uploads is reachable' }),
}));

import healthRoutes, { buildLaunchReadiness } from '../routes/health.routes';
import { resetOpsMetrics } from '../utils/ops-metrics';
import { appliedMigrationRows } from './applied-migrations';

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
const TOKEN = 'health-token-for-this-test';

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
    HEALTH_DIAGNOSTICS_TOKEN: TOKEN,
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
  delete process.env.DEBUG_SECRET;
}

const readiness = (token: string = TOKEN) =>
  request(app).get('/health/launch-readiness').set('x-health-token', token);

const checkNamed = (body: ReadinessBody, key: string) => body.checks.find((check) => check.key === key);

beforeEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  configuredProduction();
  mockQueryRaw.mockReset();
  mockLoggerError.mockReset();
  mockPingRedis.mockReset();
  mockPingRedis.mockResolvedValue(true);
  mockRedisReady.mockReset();
  mockRedisReady.mockResolvedValue(true);
  resetOpsMetrics();
  // The migrations check reads _prisma_migrations; every probe that asks
  // "is the database there" gets the same answer unless a test says otherwise.
  mockQueryRaw.mockImplementation(async () => appliedMigrationRows());
});

afterAll(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

describe('GET /health/ready', () => {
  const HOST_ERROR = "Can't reach database server at `ep-secret-123.neon.tech`:`5432`";

  it('answers 503 not_ready with no error text when the database cannot be reached', async () => {
    mockQueryRaw.mockRejectedValue(new Error(HOST_ERROR));

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
    const text = JSON.stringify(response.body);
    expect(text).not.toContain('ep-secret-123');
    expect(text).not.toContain('5432');
    expect(Object.keys(response.body).sort()).toEqual(['status', 'timestamp']);
  });

  it('keeps the reason for whoever reads the log', async () => {
    mockQueryRaw.mockRejectedValue(new Error(HOST_ERROR));

    await request(app).get('/health/ready');

    expect(mockLoggerError).toHaveBeenCalledWith('Readiness check failed', expect.objectContaining({ error: HOST_ERROR }));
  });

  it('answers 200 ready when the database answers', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
  });
});

describe('GET /health/ready and Redis', () => {
  beforeEach(() => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
  });

  it('answers 503 not_ready when the database is fine and Redis, which this deployment cannot do without, does not answer', async () => {
    mockRedisReady.mockResolvedValue(false);

    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
    // Like the database failure above: the caller is told only that the answer is no.
    expect(Object.keys(response.body).sort()).toEqual(['status', 'timestamp']);
    expect(JSON.stringify(response.body)).not.toMatch(/redis/i);
    expect(mockLoggerError).toHaveBeenCalledWith('Readiness check failed', expect.objectContaining({ error: 'Redis does not answer' }));
  });

  it('answers 200 ready when both answer', async () => {
    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(mockRedisReady).toHaveBeenCalledTimes(1);
  });
});

describe('GET /health/detailed: Redis', () => {
  const detailed = () => request(app).get('/health/detailed').set('Authorization', `Bearer ${TOKEN}`);

  it('is up when the connection the sweeps use answers', async () => {
    const response = await detailed();

    expect(response.body.checks.redis).toMatchObject({ status: 'up' });
    expect(mockPingRedis).toHaveBeenCalled();
  });

  it('is down, and says what has stopped, when that connection does not answer, however well another one is doing', async () => {
    mockPingRedis.mockResolvedValue(false);

    const response = await detailed();

    expect(response.status).toBe(503);
    expect(response.body.checks.redis.status).toBe('down');
    expect(response.body.checks.redis.message).toMatch(/scheduled sweeps/);
    expect(response.body.checks.redis.message).toMatch(/reconnects by itself/);
  });

  it('is degraded, and says why, when no REDIS_URL is set', async () => {
    delete process.env.REDIS_URL;

    const response = await detailed();

    expect(response.body.checks.redis.status).toBe('degraded');
    expect(response.body.checks.redis.message).toMatch(/REDIS_URL is not set/);
    expect(mockPingRedis).not.toHaveBeenCalled();
  });
});

describe('GET /health/version', () => {
  it('tells a stranger the service and the package version, and nothing about the build', async () => {
    const response = await request(app).get('/health/version');

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(['service', 'version']);
    expect(JSON.stringify(response.body)).not.toContain(process.version);
  });

  it('adds the Node version and the build for a caller holding the diagnostics token', async () => {
    process.env.COMMIT_SHA = 'abc1234';

    const response = await request(app).get('/health/version').set('x-health-token', TOKEN);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ node: process.version, commitSha: 'abc1234' });
  });
});

describe('the diagnostics endpoints in production', () => {
  it.each(['/health/detailed', '/health/launch-readiness', '/health/auth-diag'])(
    '%s is not found without the token, and says nothing about itself',
    async (path) => {
      const response = await request(app).get(path);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ success: false, message: 'Not found' });
    }
  );

  it.each(['/health/detailed', '/health/launch-readiness'])('%s is not found with the wrong token', async (path) => {
    const response = await request(app).get(path).set('x-health-token', 'not-the-token');

    expect(response.status).toBe(404);
  });

  it('answers the holder of the token', async () => {
    const detailed = await request(app).get('/health/detailed').set('Authorization', `Bearer ${TOKEN}`);

    expect(detailed.status).not.toBe(404);
    expect(detailed.body.checks).toBeDefined();
  });
});

describe('GET /health/launch-readiness: the Stripe Connect webhook secret', () => {
  it('is ready when everything, including the Connect secret, is set', async () => {
    const response = await readiness();

    expect(response.status).toBe(200);
    expect(checkNamed(response.body, 'STRIPE_CONNECT_WEBHOOK_SECRET')).toMatchObject({
      category: 'payments',
      required: true,
      ok: true,
    });
  });

  it('is not ready in production without it, and says what goes unnoticed', async () => {
    delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

    const response = await readiness();

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
    const check = checkNamed(response.body, 'STRIPE_CONNECT_WEBHOOK_SECRET');
    expect(check).toMatchObject({ required: true, ok: false });
    expect(check?.message).toMatch(/payout/i);
  });

  it('is only recommended outside production, so a developer machine still reports ready', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

    const response = await request(app).get('/health/launch-readiness');

    expect(checkNamed(response.body, 'STRIPE_CONNECT_WEBHOOK_SECRET')).toMatchObject({ required: false, ok: false });
  });

  it('is answered by the same function the boot report uses', async () => {
    delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

    const report = await buildLaunchReadiness();

    expect(report.status).toBe('not_ready');
    expect(report.summary.requiredFailures).toBeGreaterThanOrEqual(1);
    expect(report.checks.find((check) => check.key === 'STRIPE_CONNECT_WEBHOOK_SECRET')?.ok).toBe(false);
  });
});
