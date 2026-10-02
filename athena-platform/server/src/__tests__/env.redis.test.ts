/**
 * Redis is required in production, and the process says so at boot.
 *
 * What is per instance without it is not a detail: the locks that stop the nine
 * scheduled sweeps running on every instance at once (duplicate escrow-expiry
 * warnings, duplicate wellness reminders, a scheduled post published as many
 * times as there are instances) and the counters behind the rate limits. The
 * boot check is the first half of that rule; the runtime half is in
 * utils/__tests__/redis.reconnect.test.ts. The wider suite for the validator is
 * utils/__tests__/env.test.ts; this holds the one variable.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { validateEnvironment, validateEnvironmentOrExit } from '../utils/env';
import { logger } from '../utils/logger';

// Generated once with `openssl rand -hex 32` for this file; not used anywhere.
const RANDOM_HEX = '21c983cb1baec38efae62af1e84dc644fdc9306f8b190a8e76dd98eed44be44b';
const OTHER_RANDOM_HEX = '1e7668712a2dfacf98da6906a9b348287f7013dbba1cd6f6421e36f7273132e1';
const RANDOM_BASE64 = 'q3Zb0mP7yTn1VwLk9RsXe4HfJcD2aUoGiN8tYhBxMlE=';

/** Everything else a production API starts with, so the one variable is the only difference. */
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
    SENDGRID_API_KEY: 'SG.not-a-real-key',
    SENDGRID_FROM_EMAIL: 'noreply@mail.ourdomain.org',
    ...overrides,
  };
  for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
  return env as NodeJS.ProcessEnv;
}

const original = process.env;

beforeEach(() => {
  process.env = {} as NodeJS.ProcessEnv;
});

afterEach(() => {
  process.env = original;
});

describe('REDIS_URL', () => {
  it('is an error in production when it is not set, and the error says what goes wrong without it', () => {
    process.env = productionEnvironment({ REDIS_URL: undefined });

    const result = validateEnvironment();

    expect(result.valid).toBe(false);
    const message = result.errors.find((error) => error.startsWith('REDIS_URL'));
    expect(message).toBeDefined();
    expect(message).toMatch(/rate limits/);
    expect(message).toMatch(/sweeps run unlocked/);
    expect(message).toMatch(/duplicate reminders/);
  });

  it('is an error in production when it is set to something that is not an address, such as spaces or a pasted name', () => {
    for (const value of ['   ', 'REDIS_URL', 'http://cache.internal:6379', 'cache.internal:6379']) {
      process.env = productionEnvironment({ REDIS_URL: value });

      const result = validateEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('REDIS_URL must be a redis:// or rediss:// address');
    }
  });

  it('accepts a TLS address and an address with credentials', () => {
    for (const value of ['rediss://default:pw@cache.upstash.io:6379', 'redis://:pw@red-abc:6379/0']) {
      process.env = productionEnvironment({ REDIS_URL: value });

      expect(validateEnvironment().errors).toEqual([]);
    }
  });

  it('passes in production when it is set', () => {
    process.env = productionEnvironment();

    const result = validateEnvironment();

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('does not stop a developer machine or a test run, which have no Redis to ask for', () => {
    process.env = productionEnvironment({ NODE_ENV: 'development', REDIS_URL: undefined });

    expect(validateEnvironment().errors.some((error) => error.startsWith('REDIS_URL'))).toBe(false);
  });

  it('stops the process from starting in production, rather than booting and logging a line', () => {
    process.env = productionEnvironment({ REDIS_URL: undefined });

    expect(() => validateEnvironmentOrExit()).toThrow('Invalid environment configuration');
    expect(logger.error).toHaveBeenCalledWith(
      'Environment validation failed',
      expect.objectContaining({ error: expect.stringMatching(/^REDIS_URL is required in production/) })
    );
  });
});
