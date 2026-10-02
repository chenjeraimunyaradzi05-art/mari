import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterEach, afterAll } from '@jest/globals';

import { shippedMigrationNames, appliedMigrationRows, type MigrationRow } from './support/applied-migrations';

/**
 * What /health/launch-readiness says about the database's migrations.
 *
 * start.ts runs `prisma migrate deploy` before it boots and then boots anyway
 * when that fails, on purpose, so /health can answer and the deploy logs can be
 * read. The cost was that nothing downstream could tell: an API running against
 * a database that lacked the Session.revokedAt column answered 500 on sign-in
 * while every readiness check said Configured. Prisma records how each
 * migration ended in _prisma_migrations, so the check reads it and compares it
 * with the migrations this build ships. A row with no finish time and no
 * rollback is a migration that failed or stopped half way, and a shipped
 * migration with no finished row has not run.
 *
 * Mounted on a bare express app for the same reason as
 * launch-readiness-media.test.ts: the handler reads process.env, the database
 * and the migrations directory, and nothing else.
 */

const mockQueryRaw = jest.fn<() => Promise<unknown>>();

jest.mock('../src/utils/prisma', () => ({ prisma: { $queryRaw: (...args: unknown[]) => (mockQueryRaw as any)(...args) } }));
jest.mock('../src/utils/cache', () => ({ getRedisClient: () => null }));
jest.mock('../src/utils/opensearch', () => ({ getOpenSearchClient: () => null }));
jest.mock('../src/services/ml.service', () => ({ mlService: { healthCheck: jest.fn() } }));
jest.mock('../src/services/feed-ml.service', () => ({ mlRankingStats: () => ({}) }));
jest.mock('../src/services/moderation.service', () => ({ isTextModerationConfigured: () => true }));
jest.mock('../src/utils/media-storage', () => ({
  probeMediaStorage: async () => ({ reachable: true, detail: 'S3 bucket athena-uploads is reachable' }),
}));

// After the mocks, so the router resolves the doubles rather than real clients.
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

/** Every variable the production list requires, so each test fails only on what it is about. */
function configuredProduction(): void {
  Object.assign(process.env, {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    CLIENT_URL: 'https://example.test',
    ALLOWED_ORIGINS: 'https://example.test',
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

const migrationsCheck = (body: ReadinessBody) => body.checks.find((check) => check.key === 'MIGRATIONS');

const finished = new Date('2026-09-01T00:00:00.000Z');
const row = (name: string, overrides: Partial<MigrationRow> = {}): MigrationRow => ({
  migration_name: name,
  finished_at: finished,
  rolled_back_at: null,
  ...overrides,
});

describe('GET /health/launch-readiness — migrations', () => {
  const shipped = shippedMigrationNames();
  const [first, second] = shipped;

  beforeEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    configuredProduction();
    mockQueryRaw.mockReset();
    mockQueryRaw.mockImplementation(async () => appliedMigrationRows());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  });

  it('ships migrations to compare with, or the other cases prove nothing', () => {
    expect(shipped.length).toBeGreaterThan(2);
    expect(shipped).toContain('20260211010000_add_session_revoked_updated');
    expect(shipped).toContain('20260128051430_women_only_gate');
  });

  it('passes when every migration this build ships has finished', async () => {
    const body = await readiness();
    const check = migrationsCheck(body);

    expect(check).toMatchObject({ category: 'core', required: true, ok: true });
    expect(check?.message).toBe(`All ${shipped.length} migrations this build ships with are applied`);
    expect(body.status).toBe('ready');
  });

  it('fails, and names it, when a migration has no finish time and no rollback', async () => {
    mockQueryRaw.mockResolvedValue(
      appliedMigrationRows().map((r) => (r.migration_name === first ? { ...r, finished_at: null } : r))
    );

    const body = await readiness();
    const check = migrationsCheck(body);

    expect(check).toMatchObject({ required: true, ok: false });
    expect(check?.message).toContain('1 failed or stopped half way');
    expect(check?.message).toContain(first);
    expect(check?.message).not.toMatch(/not applied yet/);
    expect(check?.message).toMatch(/migrate status/);
    expect(body.status).toBe('not_ready');
  });

  it('fails as pending when a shipped migration has no row at all', async () => {
    mockQueryRaw.mockResolvedValue(appliedMigrationRows().filter((r) => r.migration_name !== second));

    const body = await readiness();
    const check = migrationsCheck(body);

    expect(check).toMatchObject({ required: true, ok: false });
    expect(check?.message).toContain('1 not applied yet');
    expect(check?.message).toContain(second);
    expect(body.status).toBe('not_ready');
  });

  it('counts a rolled-back migration as not applied', async () => {
    mockQueryRaw.mockResolvedValue(
      appliedMigrationRows().map((r) => (r.migration_name === first ? { ...r, finished_at: null, rolled_back_at: finished } : r))
    );

    const check = migrationsCheck(await readiness());

    expect(check?.ok).toBe(false);
    expect(check?.message).toContain('not applied yet');
    expect(check?.message).toContain(first);
  });

  it('accepts a migration that failed once and was re-run to the end', async () => {
    mockQueryRaw.mockResolvedValue([row(first, { finished_at: null }), ...appliedMigrationRows()]);

    expect(migrationsCheck(await readiness())).toMatchObject({ ok: true });
  });

  it('reports both problems when there are both, and shortens a long list', async () => {
    const present = appliedMigrationRows();
    mockQueryRaw.mockResolvedValue([
      { ...present[0], finished_at: null },
      ...present.slice(1, present.length - 7),
    ]);

    const check = migrationsCheck(await readiness());

    expect(check?.message).toContain('1 failed or stopped half way');
    expect(check?.message).toContain('7 not applied yet');
    expect(check?.message).toMatch(/and 2 more/);
  });

  it('leaves alone rows for migrations this build does not ship, because the database is shared', async () => {
    mockQueryRaw.mockResolvedValue([
      ...appliedMigrationRows(),
      row('20990101000000_somebody_elses_migration', { finished_at: null }),
    ]);

    expect(migrationsCheck(await readiness())).toMatchObject({ ok: true });
  });

  it('fails rather than passes when the migration table cannot be read', async () => {
    mockQueryRaw.mockRejectedValue(new Error('relation "_prisma_migrations" does not exist'));

    const body = await readiness();
    const check = migrationsCheck(body);

    expect(check).toMatchObject({ required: true, ok: false });
    expect(check?.message).toMatch(/could not be read/);
    expect(check?.message).toMatch(/_prisma_migrations/);
    expect(body.status).toBe('not_ready');
  });

  it('fails rather than passes when the query returns nothing readable', async () => {
    mockQueryRaw.mockResolvedValue(undefined);

    expect(migrationsCheck(await readiness())).toMatchObject({ ok: false });
  });

  it('reports a database that never answers instead of holding the request open', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    mockQueryRaw.mockImplementation(() => new Promise(() => undefined));

    const pending = sendReadiness().then((response) => response.body as ReadinessBody);

    // The request travels over a real socket, so wait on the event loop until
    // the handler has actually asked the database before moving the clock.
    for (let turn = 0; turn < 500 && mockQueryRaw.mock.calls.length === 0; turn += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(5_000);
    const body = await pending;

    expect(migrationsCheck(body)).toMatchObject({ required: true, ok: false });
    expect(migrationsCheck(body)?.message).toMatch(/did not answer within 5 seconds/);
    expect(body.status).toBe('not_ready');
  });

  it('does not ask the database when there is no database configured, and says so', async () => {
    delete process.env.DATABASE_URL;

    const check = migrationsCheck(await readiness());

    expect(check).toMatchObject({ ok: false });
    expect(check?.message).toMatch(/DATABASE_URL is not configured/);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('is not required outside production, but still says what it found', async () => {
    process.env.NODE_ENV = 'development';
    mockQueryRaw.mockResolvedValue(appliedMigrationRows().slice(0, 3));

    const body = await readiness();
    const check = migrationsCheck(body);

    expect(check).toMatchObject({ required: false, ok: false });
    expect(check?.message).toContain('not applied yet');
    expect(body.status).toBe('ready');
  });
});
