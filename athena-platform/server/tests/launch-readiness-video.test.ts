import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

/**
 * What /health/launch-readiness says about video, and why it is worth a suite
 * of its own.
 *
 * The endpoint gated its video requirement on VIDEO_ALLOW_SIMULATION — a name
 * that no worker, service or util under src/ reads. The flag the video worker
 * actually consults is WORKER_ALLOW_SIMULATION or
 * VIDEO_PROCESSING_ALLOW_SIMULATION, through canSimulateWorker() in
 * services/workers.service.ts. Both deployment blueprints set the dead name to
 * "false" and looked correct while doing nothing.
 *
 * That produced two wrong answers in opposite directions, and neither looked
 * like a bug in the check:
 *
 *   - Set VIDEO_ALLOW_SIMULATION=true and readiness stopped asking for a
 *     transcoder, while the worker went on calling one and throwing
 *     "Video processor URL is required for production worker processing" on
 *     every reel. The platform reported ready and published nothing.
 *   - Set the real flag and readiness still failed, for a deployment that was
 *     transcoding correctly in-process with ffmpeg.
 *
 * These tests pin the answer to the flags the worker reads, so a future edit
 * that reintroduces a third name fails here rather than on the host.
 *
 * The router is mounted on a bare express app rather than importing src/index:
 * the launch-readiness handler reads nothing but process.env, and standing up
 * the whole server to ask it a question about environment variables would drag
 * in sockets, workers and schedulers for no coverage.
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
// The media check asks S3 whether the bucket answers. That question has its
// own suite (launch-readiness-media.test.ts); here the bucket is reachable, so
// a test about video fails on video and never on a HeadBucket to AWS.
jest.mock('../src/utils/media-storage', () => ({
  probeMediaStorage: jest.fn(async () => ({ reachable: true, detail: 'S3 bucket athena-uploads is reachable' })),
}));

// Imported after the jest.mock calls above on purpose: the router's module body
// resolves prisma, Redis, OpenSearch and the ML client at import time, and the
// real ones open connections a unit test has no business opening.
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

/**
 * Every variable the production readiness list requires, so that a test about
 * video fails on video and not on a missing Stripe key. Values are arbitrary;
 * the endpoint only asks whether each name is set to something that is not one
 * of its known placeholders.
 */
function configuredProduction(): void {
  Object.assign(process.env, {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    CLIENT_URL: 'https://example.test',
    ALLOWED_ORIGINS: 'https://example.test',
    // Random-looking, because readiness now refuses a repeated character as a
    // placeholder (utils/secret-strength.ts).
    JWT_SECRET: '21c983cb1baec38efae62af1e84dc644fdc9306f8b190a8e76dd98eed44be44b',
    DV_ENCRYPTION_KEY: '1e7668712a2dfacf98da6906a9b348287f7013dbba1cd6f6421e36f7273132e1',
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
    // Not the string "secret": isConfiguredEnv() treats that as an unfilled
    // placeholder, and the whole suite then fails on media rather than video.
    AWS_SECRET_ACCESS_KEY: 'aws-secret-access-key-value',
    AI_OPENAI_API_KEY: 'sk-test',
    REDIS_URL: 'redis://localhost:6379',
  });

  delete process.env.VIDEO_PROCESSOR_URL;
  delete process.env.VIDEO_ALLOW_SIMULATION;
  delete process.env.VIDEO_PROCESSING_ALLOW_SIMULATION;
  delete process.env.WORKER_ALLOW_SIMULATION;
  delete process.env.ENABLE_WORKERS;
}

async function readiness(): Promise<ReadinessBody> {
  const response = await request(app)
    .get('/health/launch-readiness')
    .set('x-health-token', 'health-token');

  return response.body as ReadinessBody;
}

const videoChecks = (body: ReadinessBody) => body.checks.filter((check) => check.key === 'VIDEO_PROCESSOR_URL');

describe('GET /health/launch-readiness — the video transcoder gate', () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    configuredProduction();
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  });

  it('does not ask for a transcoder when the workers are switched off', async () => {
    // With ENABLE_WORKERS unset a reel is processed in this process by
    // video-pipeline.service.ts and no external service is involved, so
    // demanding a URL would fail a deployment that publishes video correctly.
    // There used to be a second VIDEO_PROCESSOR_URL check in the media category
    // that did exactly that, regardless of the workers.
    const body = await readiness();

    expect(videoChecks(body).filter((check) => check.required)).toHaveLength(0);
    expect(body.status).toBe('ready');
  });

  it('refuses to report ready when the video worker has nothing to call', async () => {
    // The combination that loses every upload: workers on, both simulation
    // flags off, no transcoder. callVideoProcessor() throws and the reel never
    // leaves PROCESSING.
    process.env.ENABLE_WORKERS = 'true';

    const body = await readiness();
    const required = videoChecks(body).filter((check) => check.required);

    expect(required).toHaveLength(1);
    expect(required[0].ok).toBe(false);
    expect(required[0].message).toMatch(/Reels will not publish/i);
    expect(body.status).toBe('not_ready');
  });

  it('is satisfied by VIDEO_PROCESSING_ALLOW_SIMULATION, the flag the worker reads', async () => {
    process.env.ENABLE_WORKERS = 'true';
    process.env.VIDEO_PROCESSING_ALLOW_SIMULATION = 'true';

    const body = await readiness();

    expect(videoChecks(body).filter((check) => check.required)).toHaveLength(0);
    expect(body.status).toBe('ready');
  });

  it('is satisfied by WORKER_ALLOW_SIMULATION, the other flag the worker reads', async () => {
    process.env.ENABLE_WORKERS = 'true';
    process.env.WORKER_ALLOW_SIMULATION = 'true';

    const body = await readiness();

    expect(videoChecks(body).filter((check) => check.required)).toHaveLength(0);
    expect(body.status).toBe('ready');
  });

  it('is satisfied by a configured transcoder', async () => {
    process.env.ENABLE_WORKERS = 'true';
    process.env.VIDEO_PROCESSOR_URL = 'https://transcode.example.test';

    const body = await readiness();
    const required = videoChecks(body).filter((check) => check.required);

    expect(required).toHaveLength(1);
    expect(required[0].ok).toBe(true);
    expect(body.status).toBe('ready');
  });

  it('is not satisfied by VIDEO_ALLOW_SIMULATION, which no worker reads', async () => {
    // The regression this file exists for. Setting the dead name used to make
    // the endpoint answer "ready" for a deployment whose every reel would fail.
    process.env.ENABLE_WORKERS = 'true';
    process.env.VIDEO_ALLOW_SIMULATION = 'true';

    const body = await readiness();

    expect(body.status).toBe('not_ready');
  });
});
