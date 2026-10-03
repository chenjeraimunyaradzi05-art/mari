import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

/**
 * What /health/launch-readiness says about simulated payments.
 *
 * ALLOW_STRIPE_SIMULATION lets a business registration be marked paid with no
 * charge. It is off in every deploy file, a production process with it on does not
 * start (utils/env.ts) and the formation service ignores it there, so this should
 * never find it on; it is here so that the one report an operator reads says so
 * too. Required in production, reported elsewhere.
 *
 * Mounted on a bare express app, like launch-readiness-stripe-mode.test.ts: the
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

const simulationCheck = (body: ReadinessBody) => body.checks.find((check) => check.key === 'ALLOW_STRIPE_SIMULATION');

describe('GET /health/launch-readiness: simulated payments', () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv, {
      NODE_ENV: 'production',
      HEALTH_DIAGNOSTICS_TOKEN: 'health-token',
    });
    delete process.env.ALLOW_STRIPE_SIMULATION;
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  });

  it('says nothing is simulated when the flag is off, empty or absent', async () => {
    for (const value of ['false', '', undefined]) {
      if (value === undefined) delete process.env.ALLOW_STRIPE_SIMULATION;
      else process.env.ALLOW_STRIPE_SIMULATION = value;

      expect(simulationCheck(await readiness())).toMatchObject({ category: 'payments', required: true, ok: true });
    }
  });

  it('fails in production when the flag is on, and says what it would do', async () => {
    process.env.ALLOW_STRIPE_SIMULATION = 'true';

    const body = await readiness();
    const check = simulationCheck(body);

    expect(check).toMatchObject({ category: 'payments', required: true, ok: false });
    expect(check?.message).toMatch(/marked paid with no charge/);
    // A required check that fails is what makes the launch not ready.
    expect(body.status).toBe('not_ready');
  });

  it('reads the flag however it is typed, since missing it is a registration paid for nothing', async () => {
    process.env.ALLOW_STRIPE_SIMULATION = ' TRUE ';

    expect(simulationCheck(await readiness())).toMatchObject({ ok: false });
  });

  it('is only reported, not required, outside production, where simulation is what the flag is for', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_STRIPE_SIMULATION = 'true';

    expect(simulationCheck(await readiness())).toMatchObject({ required: false, ok: false });
  });
});
