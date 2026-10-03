import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterEach, afterAll } from '@jest/globals';

/**
 * What /health/launch-readiness says about media storage and the sign-up
 * human check.
 *
 * Media used to be judged by whether AWS_ACCESS_KEY_ID and
 * AWS_SECRET_ACCESS_KEY were non-empty. The env template's placeholder values
 * are non-empty, as are a revoked key and a key for a bucket in another
 * account, so the endpoint reported "Configured" for deployments where every
 * avatar, post image and reel failed to store. It now asks S3, through the
 * same probe the API runs at start, and these tests pin that the answer comes
 * from the probe: a reachable bucket passes, an unreachable one fails with the
 * probe's reason, and an S3 that never replies fails on a timeout instead of
 * holding the request open.
 *
 * The human check (Cloudflare Turnstile) is reported, not required, because
 * auth.routes.ts deliberately runs without it where no key is set. What these
 * tests pin is that its absence is visible here at all; before, the only trace
 * was one warning in the log at start.
 *
 * Mounted on a bare express app for the same reason as
 * launch-readiness-video.test.ts: the handler reads process.env and the probe,
 * and nothing else.
 */

type ProbeResult = { reachable: boolean; detail: string };

const mockProbeMediaStorage = jest.fn<() => Promise<ProbeResult>>();

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
  probeMediaStorage: () => mockProbeMediaStorage(),
}));

// After the mocks, so the router resolves the doubles rather than real clients.
import healthRoutes from '../src/routes/health.routes';
import { closedPort, startClamd, type Stub } from '../src/services/__tests__/clamd-stub';

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

/** Every variable the production list requires, so each test fails only on what it is about. */
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
    AWS_SECRET_ACCESS_KEY: 'aws-secret-access-key-value',
    AI_OPENAI_API_KEY: 'sk-test',
    REDIS_URL: 'redis://localhost:6379',
  });
  delete process.env.ENABLE_WORKERS;
  delete process.env.TURNSTILE_SECRET_KEY;
}

function sendReadiness() {
  return request(app).get('/health/launch-readiness').set('x-health-token', 'health-token');
}

async function readiness(): Promise<ReadinessBody> {
  return (await sendReadiness()).body as ReadinessBody;
}

const checkNamed = (body: ReadinessBody, key: string) => body.checks.find((check) => check.key === key);

describe('GET /health/launch-readiness — media storage', () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    configuredProduction();
    mockProbeMediaStorage.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  });

  it('passes when S3 answers for the configured bucket', async () => {
    mockProbeMediaStorage.mockResolvedValue({ reachable: true, detail: 'S3 bucket athena-uploads is reachable' });

    const body = await readiness();
    const media = checkNamed(body, 'MEDIA_STORAGE');

    expect(media).toMatchObject({ category: 'media', required: true, ok: true });
    expect(media?.message).toMatch(/reachable/);
    expect(body.status).toBe('ready');
  });

  it('fails with the probe’s reason when the credentials are set but the bucket does not answer', async () => {
    // The case the old presence checks passed: both variables hold something,
    // and S3 refuses it.
    mockProbeMediaStorage.mockResolvedValue({
      reachable: false,
      detail: 'S3 bucket athena-uploads could not be reached with the configured credentials (InvalidAccessKeyId)',
    });

    const body = await readiness();
    const media = checkNamed(body, 'MEDIA_STORAGE');

    expect(media).toMatchObject({ required: true, ok: false });
    expect(media?.message).toMatch(/InvalidAccessKeyId/);
    expect(body.status).toBe('not_ready');
  });

  it('no longer reports the credentials as configured merely because they are set', async () => {
    mockProbeMediaStorage.mockResolvedValue({ reachable: false, detail: 'S3 bucket athena-uploads could not be reached' });

    const body = await readiness();
    const presenceOnly = body.checks.filter(
      (check) => check.key === 'AWS_ACCESS_KEY_ID' || check.key === 'AWS_SECRET_ACCESS_KEY'
    );

    expect(presenceOnly).toHaveLength(0);
  });

  it('names the missing credential without asking S3 when one is not set', async () => {
    delete process.env.AWS_SECRET_ACCESS_KEY;

    const body = await readiness();
    const media = checkNamed(body, 'MEDIA_STORAGE');

    expect(media).toMatchObject({ required: true, ok: false });
    expect(media?.message).toMatch(/AWS_SECRET_ACCESS_KEY/);
    expect(mockProbeMediaStorage).not.toHaveBeenCalled();
    expect(body.status).toBe('not_ready');
  });

  it('reports a bucket that never answers as unreachable instead of holding the request open', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    mockProbeMediaStorage.mockImplementation(() => new Promise<ProbeResult>(() => undefined));

    const pending = sendReadiness().then((response) => response.body as ReadinessBody);

    // The request travels over a real socket, so wait on the event loop until
    // the handler has actually asked S3 before moving the clock.
    for (let turn = 0; turn < 500 && mockProbeMediaStorage.mock.calls.length === 0; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(mockProbeMediaStorage).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(5_000);
    const body = await pending;
    const media = checkNamed(body, 'MEDIA_STORAGE');

    expect(media).toMatchObject({ required: true, ok: false });
    expect(media?.message).toMatch(/did not answer within 5 seconds/);
    expect(body.status).toBe('not_ready');
  });

  it('does not require media storage outside production, but still says what it found', async () => {
    process.env.NODE_ENV = 'development';
    mockProbeMediaStorage.mockResolvedValue({ reachable: false, detail: 'S3 bucket athena-uploads could not be reached' });

    const body = await readiness();
    const media = checkNamed(body, 'MEDIA_STORAGE');

    expect(media).toMatchObject({ required: false, ok: false });
    expect(media?.message).toMatch(/could not be reached/);
  });
});

describe('GET /health/launch-readiness — the sign-up human check', () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    configuredProduction();
    mockProbeMediaStorage.mockReset();
    mockProbeMediaStorage.mockResolvedValue({ reachable: true, detail: 'S3 bucket athena-uploads is reachable' });
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  });

  it('says plainly when password sign-up has no human check, without blocking readiness', async () => {
    const body = await readiness();
    const humanCheck = checkNamed(body, 'TURNSTILE_SECRET_KEY');

    expect(humanCheck).toMatchObject({ category: 'security', required: false, ok: false });
    expect(humanCheck?.message).toMatch(/no human check/i);
    expect(humanCheck?.message).toMatch(/NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
    expect(body.status).toBe('ready');
  });

  it('reports the key when it is set, and reminds the operator the web host needs its pair', async () => {
    process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAAtest-secret-key';

    const body = await readiness();
    const humanCheck = checkNamed(body, 'TURNSTILE_SECRET_KEY');

    expect(humanCheck).toMatchObject({ ok: true });
    expect(humanCheck?.message).toMatch(/NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  });
});

/**
 * The malware scanner, beside media storage. Résumés and documents are refused
 * in production when they cannot be scanned (services/malware-scan.service), so
 * a deployment without a scanner cannot take a job application, and the report
 * has to say so as a failed required check, not as a note. The scanner is a real
 * stand-in clamd on a socket: the check asks it with a PING, as it would ask
 * the real one.
 */
describe('GET /health/launch-readiness — the malware scanner', () => {
  let clamd: Stub | null = null;

  beforeEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    configuredProduction();
    mockProbeMediaStorage.mockReset();
    mockProbeMediaStorage.mockResolvedValue({ reachable: true, detail: 'S3 bucket athena-uploads is reachable' });
    // The unit project says "never required" for everyone else; this block is about the default.
    delete process.env.MALWARE_SCAN_REQUIRED;
    delete process.env.CLAMAV_HOST;
    delete process.env.CLAMAV_PORT;
  });

  afterEach(async () => {
    if (clamd) await clamd.close();
    clamd = null;
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  });

  it('is a failed, required check in production when no scanner is configured, and holds the report at not_ready', async () => {
    const body = await readiness();
    const scanner = checkNamed(body, 'MALWARE_SCANNER');

    expect(scanner).toMatchObject({ category: 'media', required: true, ok: false });
    expect(scanner?.message).toMatch(/CLAMAV_HOST/);
    expect(scanner?.message).toMatch(/résumés and documents are being refused/);
    expect(body.status).toBe('not_ready');
  });

  it('passes, with the scanner\'s version, when it answers', async () => {
    clamd = await startClamd();
    process.env.CLAMAV_HOST = '127.0.0.1';
    process.env.CLAMAV_PORT = String(clamd.port);

    const body = await readiness();
    const scanner = checkNamed(body, 'MALWARE_SCANNER');

    expect(scanner).toMatchObject({ required: true, ok: true });
    expect(scanner?.message).toMatch(/ClamAV/);
    expect(body.status).toBe('ready');
  });

  it('fails, naming where it looked, when a host is set and nothing answers there', async () => {
    process.env.CLAMAV_HOST = '127.0.0.1';
    process.env.CLAMAV_PORT = String(await closedPort());

    const body = await readiness();
    const scanner = checkNamed(body, 'MALWARE_SCANNER');

    expect(scanner).toMatchObject({ required: true, ok: false });
    expect(scanner?.message).toContain('127.0.0.1');
    expect(body.status).toBe('not_ready');
  });

  it('is reported but not required when the deployment has decided not to scan', async () => {
    process.env.MALWARE_SCAN_REQUIRED = 'off';

    const body = await readiness();
    const scanner = checkNamed(body, 'MALWARE_SCANNER');

    expect(scanner).toMatchObject({ required: false, ok: false });
    expect(scanner?.message).toMatch(/uploads are not scanned/);
    expect(body.status).toBe('ready');
  });

  it('is not required outside production, but still says what it found', async () => {
    process.env.NODE_ENV = 'development';

    const scanner = checkNamed(await readiness(), 'MALWARE_SCANNER');

    expect(scanner).toMatchObject({ required: false, ok: false });
  });
});
