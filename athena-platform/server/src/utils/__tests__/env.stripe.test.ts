/**
 * What the process and the deploy check say about Stripe and simulated payments.
 *
 * Stripe is not a requirement to start, on purpose: a deployment that has not set
 * it up should answer /livez and be looked at, not exit, and utils/launch-readiness
 * says what is missing at every boot. What makes that safe is that nothing
 * pretends, so the missing key says what stops working, and the one switch that
 * lets a payment succeed without a processor (ALLOW_STRIPE_SIMULATION) is refused
 * in production, both by the process and by the check that runs before the deploy.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { validateEnvironment } from '../env';

// Generated once with `openssl rand -hex 32` for this file; not used anywhere.
const RANDOM_HEX = '21c983cb1baec38efae62af1e84dc644fdc9306f8b190a8e76dd98eed44be44b';
const OTHER_RANDOM_HEX = '1e7668712a2dfacf98da6906a9b348287f7013dbba1cd6f6421e36f7273132e1';
const RANDOM_BASE64 = 'q3Zb0mP7yTn1VwLk9RsXe4HfJcD2aUoGiN8tYhBxMlE=';

const SERVER_ROOT = path.resolve(__dirname, '..', '..', '..');

/** An environment a production API would start with, so each test changes one thing. */
function productionEnvironment(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = {
    NODE_ENV: 'production',
    JWT_SECRET: RANDOM_HEX,
    DV_ENCRYPTION_KEY: OTHER_RANDOM_HEX,
    PROXY_SHARED_SECRET: RANDOM_BASE64,
    DATABASE_URL: 'postgresql://athena:pw@db.internal:5432/athena',
    DIRECT_DATABASE_URL: 'postgresql://athena:pw@db.internal:5432/athena',
    REDIS_URL: 'redis://cache.internal:6379',
    API_URL: 'https://api.ourdomain.org',
    AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
    AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYzQ3Zb0mP7yTn1V',
    S3_BUCKET: 'athena-media-prod',
    CDN_URL: 'https://cdn.ourdomain.org',
    SENDGRID_API_KEY: 'SG.not-a-real-key',
    SENDGRID_FROM_EMAIL: 'noreply@mail.ourdomain.org',
    ...overrides,
  };
  for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
  return env as NodeJS.ProcessEnv;
}

describe('validateEnvironment: Stripe', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = {} as NodeJS.ProcessEnv;
  });
  afterEach(() => {
    process.env = original;
  });

  function validate(overrides: Record<string, string | undefined> = {}) {
    process.env = productionEnvironment(overrides);
    return validateEnvironment();
  }

  describe('ALLOW_STRIPE_SIMULATION', () => {
    it('stops a production process starting when it is on', () => {
      const result = validate({ ALLOW_STRIPE_SIMULATION: 'true' });

      expect(result.valid).toBe(false);
      expect(result.errors.join('\n')).toMatch(/ALLOW_STRIPE_SIMULATION must not be "true" in production/);
    });

    it('reads it however it is typed into a dashboard, because the cost of missing it is a registration paid for nothing', () => {
      for (const value of ['TRUE', ' true ', 'True']) {
        expect(validate({ ALLOW_STRIPE_SIMULATION: value }).valid).toBe(false);
      }
    });

    it('is quiet when it is off, empty or absent, which is how every deploy file ships it', () => {
      for (const value of ['false', '', undefined]) {
        const result = validate({ ALLOW_STRIPE_SIMULATION: value });
        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
      }
    });

    it('is left to a developer outside production, where the flag is meant to be used', () => {
      const result = validate({ NODE_ENV: 'development', ALLOW_STRIPE_SIMULATION: 'true' });

      expect(result.errors.join('\n')).not.toMatch(/ALLOW_STRIPE_SIMULATION/);
    });
  });

  describe('the keys that are recommended and not required', () => {
    it('says what stops working when STRIPE_SECRET_KEY is not set, and that nothing is simulated in its place', () => {
      const result = validate({ STRIPE_SECRET_KEY: undefined });

      // Not a reason to refuse to start: see the header of this file.
      expect(result.valid).toBe(true);
      const warning = result.warnings.find((w) => w.includes('STRIPE_SECRET_KEY is not set'));
      expect(warning).toMatch(/answers 503/);
      expect(warning).toMatch(/nothing is simulated/);
    });

    it('says what stops working when STRIPE_WEBHOOK_SECRET is not set', () => {
      const result = validate({ STRIPE_WEBHOOK_SECRET: undefined });

      expect(result.valid).toBe(true);
      expect(result.warnings.find((w) => w.includes('STRIPE_WEBHOOK_SECRET is not set'))).toMatch(/refused/);
    });

    it('stays quiet about both once they are set', () => {
      const result = validate({ STRIPE_SECRET_KEY: 'sk_test_abcdefghijklmnop', STRIPE_WEBHOOK_SECRET: 'whsec_abcdefghijklmnop' });

      expect(result.warnings.join('\n')).not.toMatch(/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET/);
    });
  });

  describe('STRIPE_CONNECT_PAYOUT_SCHEDULE', () => {
    it('is quiet when unset, manual or automatic', () => {
      for (const value of [undefined, 'manual', 'automatic', ' Manual ']) {
        expect(validate({ STRIPE_CONNECT_PAYOUT_SCHEDULE: value }).warnings.join('\n')).not.toMatch(/PAYOUT_SCHEDULE/);
      }
    });

    it('warns about anything else, and says only manual changes anything', () => {
      const result = validate({ STRIPE_CONNECT_PAYOUT_SCHEDULE: 'weekly' });

      expect(result.valid).toBe(true);
      expect(result.warnings.join('\n')).toMatch(/STRIPE_CONNECT_PAYOUT_SCHEDULE must be 'manual' or 'automatic'/);
    });
  });
});

/**
 * scripts/check-env.js runs before the deploy, against the file that would carry
 * a value there. It prints the names it objects to and never a value.
 */
describe('scripts/check-env.js: values production must never have', () => {
  const script = path.join(SERVER_ROOT, 'scripts', 'check-env.js');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'check-env-'));

  function run(file: string) {
    return spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
  }

  afterEach(() => {
    for (const entry of fs.readdirSync(directory)) fs.rmSync(path.join(directory, entry), { force: true });
  });

  it('fails an environment file that turns payment simulation on, and names it', () => {
    const file = path.join(directory, '.env.production');
    fs.writeFileSync(file, 'ALLOW_STRIPE_SIMULATION=true\n');

    const result = run(file);

    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/FORBIDDEN/);
    expect(result.stdout).toMatch(/ALLOW_STRIPE_SIMULATION=true/);
  });

  it('fails a blueprint that sets it to true', () => {
    const file = path.join(directory, 'render.yaml');
    fs.writeFileSync(file, 'services:\n  - type: web\n    envVars:\n      - key: ALLOW_STRIPE_SIMULATION\n        value: "true"\n');

    const result = run(file);

    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/FORBIDDEN/);
  });

  it('does not object to it being off, which is how the blueprint ships it', () => {
    const file = path.join(directory, '.env.production');
    fs.writeFileSync(file, 'ALLOW_STRIPE_SIMULATION=false\n');

    expect(run(file).stdout).not.toMatch(/FORBIDDEN/);
  });

  it('asks the blueprint for the Connect webhook secret, which readiness requires in production', () => {
    const file = path.join(directory, '.env.production');
    fs.writeFileSync(file, 'STRIPE_SECRET_KEY=sk_test_abcdefghijklmnop\n');

    const result = run(file);

    expect(result.stdout).toMatch(/MISSING/);
    expect(result.stdout).toMatch(/STRIPE_CONNECT_WEBHOOK_SECRET/);
  });

  it('passes the repository’s own blueprint', () => {
    const result = run(path.resolve(SERVER_ROOT, '..', '..', 'render.yaml'));

    expect(result.stdout).toMatch(/OK: every required variable is set/);
    expect(result.status).toBe(0);
  });
});
