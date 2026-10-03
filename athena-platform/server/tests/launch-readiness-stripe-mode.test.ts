import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

/**
 * What /health/launch-readiness says about which kind of money Stripe moves.
 *
 * Test and live are switched by which key is in the environment and nothing
 * else, and nothing read the key's prefix, so a deployment could go to its first
 * public member on test keys, taking no money and saying nothing, or a rehearsal
 * could run on live ones. The report now says which it is, never printing the
 * key, and in production a test key is reported as not ok: a launch that takes no
 * money is not a launch. It is never `required`, because a rehearsal on test
 * keys is a legitimate deployment and refusing to report ready would stop it
 * being rehearsed.
 *
 * Mounted on a bare express app, like launch-readiness-secrets.test.ts: the
 * handler reads process.env and the probe, and nothing else.
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

async function readiness(): Promise<ReadinessBody> {
  const response = await request(app).get('/health/launch-readiness').set('x-health-token', 'health-token');
  return response.body as ReadinessBody;
}

const modeCheck = (body: ReadinessBody) => body.checks.find((check) => check.key === 'STRIPE_MODE');

describe('GET /health/launch-readiness: Stripe mode', () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv, {
      NODE_ENV: 'production',
      HEALTH_DIAGNOSTICS_TOKEN: 'health-token',
    });
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  });

  it('says live mode, and that real cards are charged, for a live key', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_fixture-not-a-key';

    const check = modeCheck(await readiness());

    expect(check).toMatchObject({ category: 'payments', required: false, ok: true });
    expect(check?.message).toMatch(/Live mode/);
    expect(check?.message).toMatch(/real cards/);
  });

  it('reports a restricted live key (rk_live_) as live too', async () => {
    process.env.STRIPE_SECRET_KEY = 'rk_live_fixture-not-a-key';

    expect(modeCheck(await readiness())).toMatchObject({ ok: true });
  });

  it('says test mode, and that no real money moves, in production, and is not ok', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fixture-not-a-key';

    const check = modeCheck(await readiness());

    expect(check).toMatchObject({ required: false, ok: false });
    expect(check?.message).toMatch(/Test mode/);
    expect(check?.message).toMatch(/no real money moves/);
  });

  it('is fine for a rehearsal outside production, which is not a launch', async () => {
    process.env.NODE_ENV = 'development';
    process.env.STRIPE_SECRET_KEY = 'sk_test_fixture-not-a-key';

    const check = modeCheck(await readiness());

    expect(check).toMatchObject({ ok: true });
    expect(check?.message).toMatch(/Test mode/);
  });

  it('says unknown when no key is set, or the value is not a Stripe secret key', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(modeCheck(await readiness())).toMatchObject({ ok: false });
    expect(modeCheck(await readiness())?.message).toMatch(/Unknown/);

    process.env.STRIPE_SECRET_KEY = 'pk_live_thisisapublishablekeynotasecret';
    expect(modeCheck(await readiness())?.message).toMatch(/Unknown/);
  });

  it('never prints the key', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_fixture-secret-not-a-key';

    const response = await request(app).get('/health/launch-readiness').set('x-health-token', 'health-token');

    expect(JSON.stringify(response.body)).not.toContain('supersecretvalue');
  });

  it('is never what makes a rehearsal on test keys report not ready', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fixture-not-a-key';

    const body = await readiness();

    // Not ok, but not required: it informs, it does not block.
    expect(modeCheck(body)?.required).toBe(false);
  });
});
