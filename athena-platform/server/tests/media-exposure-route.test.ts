import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

/**
 * GET /health/launch-readiness?probe=media: whether private uploads can be read
 * without signing in, and public ones can, asked from the outside.
 *
 * What these pin is how the readiness endpoint carries the answer (the probe
 * itself is covered by src/utils/__tests__/media-storage.exposure.test.ts): it
 * is run only when asked for, because it writes to the bucket; in production a
 * failing answer makes the endpoint "not ready" and says why; and a deployment
 * with no bucket is not failed for it.
 */

type Exposure = { status: string; detail: string; problems: string[] };
const mockCheckMediaExposure = jest.fn<() => Promise<Exposure>>();

jest.mock('../src/utils/prisma', () => ({ prisma: { $queryRaw: jest.fn() } }));
jest.mock('../src/utils/cache', () => ({ getRedisClient: () => null }));
jest.mock('../src/utils/opensearch', () => ({ getOpenSearchClient: () => null }));
jest.mock('../src/services/ml.service', () => ({ mlService: { healthCheck: jest.fn() } }));
jest.mock('../src/services/feed-ml.service', () => ({ mlRankingStats: () => ({}) }));
jest.mock('../src/services/moderation.service', () => ({ isTextModerationConfigured: () => true }));
jest.mock('../src/utils/media-storage', () => ({
  probeMediaStorage: async () => ({ reachable: true, detail: 'S3 bucket athena-uploads is reachable' }),
  checkMediaExposure: () => mockCheckMediaExposure(),
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

const originalEnv = { ...process.env };

function configuredProduction(): void {
  Object.assign(process.env, {
    NODE_ENV: 'production',
    HEALTH_DIAGNOSTICS_TOKEN: 'health-token',
    S3_BUCKET: 'athena-uploads',
    AWS_REGION: 'ap-southeast-2',
    AWS_ACCESS_KEY_ID: 'AKIATEST',
    AWS_SECRET_ACCESS_KEY: 'aws-secret-access-key-value',
  });
}

const exposureCheck = (checks: ReadinessCheck[]) => checks.find((check) => check.key === 'MEDIA_EXPOSURE');

describe('GET /health/launch-readiness?probe=media', () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    configuredProduction();
    mockCheckMediaExposure.mockReset();
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  });

  const ask = (path = '/health/launch-readiness?probe=media') => request(app).get(path).set('x-health-token', 'health-token');

  it('does not touch the bucket unless it is asked to', async () => {
    const res = await ask('/health/launch-readiness');

    expect(mockCheckMediaExposure).not.toHaveBeenCalled();
    expect(exposureCheck(res.body.checks)).toBeUndefined();
  });

  it('does not answer a caller without the token, and does not touch the bucket', async () => {
    await request(app).get('/health/launch-readiness?probe=media').expect(404);
    expect(mockCheckMediaExposure).not.toHaveBeenCalled();
  });

  it('reports fine when the bucket and the CDN agree with the code', async () => {
    mockCheckMediaExposure.mockResolvedValue({ status: 'ok', detail: 'Public folders are readable; private ones are not.', problems: [] });

    const res = await ask();

    expect(exposureCheck(res.body.checks)).toMatchObject({ category: 'media', required: true, ok: true });
    expect(mockCheckMediaExposure).toHaveBeenCalledTimes(1);
  });

  it.each(['exposed', 'public_unreadable', 'unverified'])('is a required failure in production for %s, with the reason', async (status) => {
    mockCheckMediaExposure.mockResolvedValue({ status, detail: 'Fix the bucket policy.', problems: ['Fix the bucket policy.'] });

    const res = await ask();

    expect(exposureCheck(res.body.checks)).toMatchObject({ required: true, ok: false, message: 'Fix the bucket policy.' });
    expect(res.body.status).toBe('not_ready');
    expect(res.status).toBe(503);
  });

  it('does not fail a deployment that has no bucket to check', async () => {
    mockCheckMediaExposure.mockResolvedValue({ status: 'not_applicable', detail: 'No S3 credentials are configured.', problems: [] });

    const res = await ask();

    expect(exposureCheck(res.body.checks)).toMatchObject({ required: false, ok: true });
  });

  it('is only recommended outside production', async () => {
    process.env.NODE_ENV = 'development';
    mockCheckMediaExposure.mockResolvedValue({ status: 'exposed', detail: 'Private files are readable.', problems: ['x'] });

    const res = await ask();

    expect(exposureCheck(res.body.checks)).toMatchObject({ required: false, ok: false });
  });
});
