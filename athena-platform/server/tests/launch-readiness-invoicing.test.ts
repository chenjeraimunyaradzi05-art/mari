import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterAll } from '@jest/globals';

/**
 * What /health/launch-readiness says about whether an invoice can say who ATHENA
 * is.
 *
 * The five ATHENA_* values the invoice service reads were in no env example, no
 * deploy file and no check, so a deployment went live printing a placeholder
 * billing address and a made-up sender on every member's document with nothing
 * to say so. The invoice service no longer invents any of it: with the legal
 * name, billing address, billing mailbox or ABN missing no document is produced.
 * The report says what is missing, by name and never by value, and holds a
 * production launch back until the four are set. The GST registration date is
 * not asked for: not being registered is a legitimate state.
 *
 * Mounted on a bare express app, like launch-readiness-stripe-mode.test.ts.
 */

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
const INVOICING_KEYS = ['ATHENA_LEGAL_NAME', 'ATHENA_ABN', 'ATHENA_GST_REGISTERED_FROM', 'ATHENA_BILLING_ADDRESS', 'ATHENA_BILLING_EMAIL'];

async function invoicing(): Promise<{ check: ReadinessCheck | undefined; body: ReadinessBody }> {
  const response = await request(app).get('/health/launch-readiness').set('x-health-token', 'health-token');
  const body = response.body as ReadinessBody;
  return { check: body.checks.find((c) => c.key === 'ATHENA_INVOICING'), body };
}

/** 51 824 753 556 is the ATO's own published example ABN, which passes the checksum. */
const VALID_ABN = '51 824 753 556';

describe('GET /health/launch-readiness: invoicing', () => {
  beforeEach(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv, { NODE_ENV: 'production', HEALTH_DIAGNOSTICS_TOKEN: 'health-token' });
    for (const key of INVOICING_KEYS) delete process.env[key];
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  });

  it('is there, in the payments category, and required in production', async () => {
    const { check } = await invoicing();

    expect(check).toMatchObject({ category: 'payments', required: true });
  });

  it('is only reported, not required, outside production: a rehearsal needs no ABN', async () => {
    process.env.NODE_ENV = 'development';

    const { check, body } = await invoicing();

    expect(check).toMatchObject({ category: 'payments', required: false, ok: false });
    expect(body.checks.filter((c) => c.required && !c.ok).map((c) => c.key)).not.toContain('ATHENA_INVOICING');
  });

  it('says not configured, naming what is missing, when none of the five is set', async () => {
    const { check } = await invoicing();

    expect(check?.ok).toBe(false);
    expect(check?.message).toMatch(/ATHENA_LEGAL_NAME is not set/);
    expect(check?.message).toMatch(/ATHENA_BILLING_ADDRESS is not set/);
    expect(check?.message).toMatch(/ATHENA_BILLING_EMAIL is not set/);
    expect(check?.message).toMatch(/ATHENA_ABN is not set/);
    // What it means for a member, and that nothing is lost by setting them late.
    expect(check?.message).toMatch(/invoice download answers 503; the invoices themselves are kept/);
  });

  it('holds a production launch back until the identity is set, and reports the whole as not ready', async () => {
    const { body } = await invoicing();

    expect(body.status).toBe('not_ready');
    expect(body.checks.filter((c) => c.required && !c.ok).map((c) => c.key)).toContain('ATHENA_INVOICING');
  });

  it('no longer says the invoice would carry a placeholder: no placeholder exists', async () => {
    const { check } = await invoicing();

    expect(check?.message).not.toMatch(/placeholder|default sender/i);
  });

  it('refuses a billing mailbox on a domain ATHENA does not own', async () => {
    Object.assign(process.env, { ATHENA_LEGAL_NAME: 'ATHENA Pty Ltd', ATHENA_BILLING_ADDRESS: '1 Example St|Brisbane QLD 4000', ATHENA_BILLING_EMAIL: 'billing@athena.com' });

    const { check } = await invoicing();

    expect(check?.ok).toBe(false);
    expect(check?.message).toMatch(/ATHENA_BILLING_EMAIL uses athena\.com/);
  });

  it('says the ABN is missing when the identity is complete and there is none', async () => {
    Object.assign(process.env, { ATHENA_LEGAL_NAME: 'ATHENA Pty Ltd', ATHENA_BILLING_ADDRESS: '1 Example St|Brisbane QLD 4000', ATHENA_BILLING_EMAIL: 'billing@mail.athena-platform.org' });

    const { check } = await invoicing();

    expect(check?.ok).toBe(false);
    expect(check?.message).toMatch(/ATHENA_ABN is not set, or does not pass its checksum/);
    // Only the ABN is named: the name, address and mailbox are all set.
    expect(check?.message).not.toMatch(/ATHENA_LEGAL_NAME|ATHENA_BILLING_ADDRESS|ATHENA_BILLING_EMAIL/);
  });

  it('says the same for an ABN that fails its checksum', async () => {
    Object.assign(process.env, {
      ATHENA_LEGAL_NAME: 'ATHENA Pty Ltd',
      ATHENA_BILLING_ADDRESS: '1 Example St|Brisbane QLD 4000',
      ATHENA_BILLING_EMAIL: 'billing@mail.athena-platform.org',
      ATHENA_ABN: '12 345 678 901',
    });

    expect((await invoicing()).check?.ok).toBe(false);
  });

  it('is fine, and says what invoices will say, with an ABN and no GST registration yet', async () => {
    Object.assign(process.env, {
      ATHENA_LEGAL_NAME: 'ATHENA Pty Ltd',
      ATHENA_BILLING_ADDRESS: '1 Example St|Brisbane QLD 4000',
      ATHENA_BILLING_EMAIL: 'billing@mail.athena-platform.org',
      ATHENA_ABN: VALID_ABN,
    });

    const { check } = await invoicing();

    expect(check?.ok).toBe(true);
    expect(check?.message).toMatch(/say no GST is charged/);
    expect(check?.message).toMatch(/ATHENA_GST_REGISTERED_FROM/);
  });

  it('is fine, and mentions tax-inclusive Prices, when all five are set', async () => {
    Object.assign(process.env, {
      ATHENA_LEGAL_NAME: 'ATHENA Pty Ltd',
      ATHENA_BILLING_ADDRESS: '1 Example St|Brisbane QLD 4000',
      ATHENA_BILLING_EMAIL: 'billing@mail.athena-platform.org',
      ATHENA_ABN: VALID_ABN,
      ATHENA_GST_REGISTERED_FROM: '2026-07-01',
    });

    const { check } = await invoicing();

    expect(check?.ok).toBe(true);
    expect(check?.message).toMatch(/tax behaviour "Inclusive"/);
  });

  it('says so when the registration date is not a date', async () => {
    Object.assign(process.env, {
      ATHENA_LEGAL_NAME: 'ATHENA Pty Ltd',
      ATHENA_BILLING_ADDRESS: '1 Example St|Brisbane QLD 4000',
      ATHENA_BILLING_EMAIL: 'billing@mail.athena-platform.org',
      ATHENA_ABN: VALID_ABN,
      ATHENA_GST_REGISTERED_FROM: 'last July',
    });

    const { check } = await invoicing();

    expect(check?.ok).toBe(false);
    expect(check?.message).toMatch(/not a date/);
  });

  it('never prints a value it was given', async () => {
    Object.assign(process.env, {
      ATHENA_LEGAL_NAME: 'Secretive Holdings Pty Ltd',
      ATHENA_BILLING_ADDRESS: '9 Hidden Lane|Brisbane QLD 4000',
      ATHENA_BILLING_EMAIL: 'private.mailbox@mail.athena-platform.org',
      ATHENA_ABN: VALID_ABN,
      ATHENA_GST_REGISTERED_FROM: '2026-07-01',
    });

    const { check } = await invoicing();

    const text = JSON.stringify(check);
    for (const secret of ['Secretive', 'Hidden Lane', 'private.mailbox', '824 753 556', '2026-07-01']) {
      expect(text).not.toContain(secret);
    }
  });
});
