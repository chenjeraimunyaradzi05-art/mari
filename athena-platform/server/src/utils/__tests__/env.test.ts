/**
 * What the process refuses to start with, and what it only warns about.
 *
 * validateEnvironment() had no test at all. Three of the things it is meant to
 * stop were passing it:
 *
 *  - a JWT_SECRET that is long enough and was never random. The example env
 *    file's value was 47 characters, so a deployment that copied the example
 *    signed every member's session with a string printed in the repository;
 *  - no SendGrid key or sender, which let the API boot and then answer every
 *    sign-up with a 503 after the account row had been written;
 *  - a staging deployment (NODE_ENV not exactly "production") with no secret,
 *    which signed tokens with a public constant.
 *
 * scripts/check-env.js runs before the build and cannot import TypeScript, so it
 * carries a copy of the strength rules. The last block holds the copy to the
 * same answers as the original.
 */

import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { validateEnvironment, validateEnvironmentOrExit } from '../env';
import { secretWeakness, isStrongSecret } from '../secret-strength';
import { senderAddressProblem } from '../sender-address';

// Generated once with `openssl rand -hex 32` for this file; not used anywhere.
const RANDOM_HEX = '21c983cb1baec38efae62af1e84dc644fdc9306f8b190a8e76dd98eed44be44b';
const OTHER_RANDOM_HEX = '1e7668712a2dfacf98da6906a9b348287f7013dbba1cd6f6421e36f7273132e1';
// What Render's `generateValue: true` produces: a base64 string of 256 bits.
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
    SENDGRID_API_KEY: 'SG.not-a-real-key',
    SENDGRID_FROM_EMAIL: 'noreply@mail.ourdomain.org',
    ...overrides,
  };
  for (const key of Object.keys(env)) if (env[key] === undefined) delete env[key];
  return env as NodeJS.ProcessEnv;
}

describe('validateEnvironment', () => {
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

  it('starts when every secret is real and the mail sender is named', () => {
    const result = validate();
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  describe('JWT_SECRET', () => {
    it('refuses a missing secret', () => {
      const result = validate({ JWT_SECRET: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required environment variable: JWT_SECRET');
    });

    it('refuses 31 characters and accepts 32', () => {
      expect(validate({ JWT_SECRET: RANDOM_HEX.slice(0, 31) }).errors.join('\n')).toMatch(/JWT_SECRET must be a random value/);
      expect(validate({ JWT_SECRET: RANDOM_HEX.slice(0, 32) }).errors).toEqual([]);
    });

    it('refuses the placeholder the example env file used to ship, which is 47 characters', () => {
      const shipped = 'your-super-secret-jwt-key-change-in-production';
      expect(shipped.length).toBeGreaterThan(32);
      expect(validate({ JWT_SECRET: shipped }).errors.join('\n')).toMatch(/JWT_SECRET must be a random value/);
    });

    it('refuses what the example env files ship today, so a copied example does not boot', () => {
      for (const file of ['.env.example', '.env.production.template']) {
        const text = fs.readFileSync(path.join(SERVER_ROOT, file), 'utf8');
        const line = text.split(/\r?\n/).find((l) => l.startsWith('JWT_SECRET='));
        expect(line).toBeDefined();
        const value = line!.slice('JWT_SECRET='.length).replace(/^["']|["']$/g, '');
        expect(isStrongSecret(value)).toBe(false);
        expect(validate({ JWT_SECRET: value }).valid).toBe(false);
      }
    });

    it('refuses a long run of one character and a short pattern repeated', () => {
      expect(validate({ JWT_SECRET: 'a'.repeat(64) }).valid).toBe(false);
      expect(validate({ JWT_SECRET: 'abcd'.repeat(16) }).valid).toBe(false);
      expect(validate({ JWT_SECRET: '0123456789'.repeat(4) }).valid).toBe(false);
    });

    it('accepts hex from openssl and the base64 value Render generates', () => {
      expect(validate({ JWT_SECRET: RANDOM_HEX }).valid).toBe(true);
      expect(validate({ JWT_SECRET: RANDOM_BASE64 }).valid).toBe(true);
    });

    it('never puts the secret itself in the message', () => {
      const secret = 'your-super-secret-jwt-key-change-in-production';
      const result = validate({ JWT_SECRET: secret });
      expect(result.errors.join('\n')).not.toContain(secret);
    });
  });

  describe('the other secrets', () => {
    it('refuses the all-zero DV key the example env file used to ship, though it is valid hex', () => {
      const zeros = '0'.repeat(64);
      expect(/^[0-9a-fA-F]{64}$/.test(zeros)).toBe(true);
      expect(validate({ DV_ENCRYPTION_KEY: zeros }).errors.join('\n')).toMatch(/DV_ENCRYPTION_KEY must be a random/);
      expect(validate({ DV_ENCRYPTION_KEY: RANDOM_HEX.slice(0, 63) }).valid).toBe(false);
    });

    it('holds PROXY_SHARED_SECRET to the same standard', () => {
      expect(validate({ PROXY_SHARED_SECRET: 'change-me-change-me-change-me-change' }).valid).toBe(false);
      expect(validate({ PROXY_SHARED_SECRET: RANDOM_HEX.slice(0, 20) }).valid).toBe(false);
      expect(validate({ PROXY_SHARED_SECRET: RANDOM_HEX }).valid).toBe(true);
    });

    it('only warns when the ban-list key is missing or weak, because setting it later is the operator’s call', () => {
      const missing = validate();
      expect(missing.valid).toBe(true);
      expect(missing.warnings.join('\n')).toMatch(/BANNED_IDENTITY_HASH_KEY is not set/);

      const weak = validate({ BANNED_IDENTITY_HASH_KEY: 'change-me-change-me-change-me-change' });
      expect(weak.valid).toBe(true);
      expect(weak.warnings.join('\n')).toMatch(/BANNED_IDENTITY_HASH_KEY must be a random value/);

      const set = validate({ BANNED_IDENTITY_HASH_KEY: OTHER_RANDOM_HEX });
      expect(set.warnings.join('\n')).not.toMatch(/BANNED_IDENTITY_HASH_KEY/);
    });
  });

  describe('the other encryption keys', () => {
    const ZEROS = '0'.repeat(64);

    it('lets the health and authenticator keys be unset, because both fall back to the safe-chat key', () => {
      const result = validate();
      expect(result.errors).toEqual([]);
      expect(result.warnings.join('\n')).not.toMatch(/HEALTH_ENCRYPTION_KEY|TOTP_ENCRYPTION_KEY/);
    });

    it.each(['HEALTH_ENCRYPTION_KEY', 'TOTP_ENCRYPTION_KEY'])('refuses a %s that is set and is not a real key', (name) => {
      for (const value of [ZEROS, RANDOM_HEX.slice(0, 63), 'z'.repeat(64), 'deadbeef'.repeat(8)]) {
        const result = validate({ [name]: value });
        expect(result.valid).toBe(false);
        expect(result.errors.join('\n')).toContain(`${name} must be a random 64-character hex key`);
      }
    });

    it.each(['HEALTH_ENCRYPTION_KEY', 'TOTP_ENCRYPTION_KEY'])('accepts a %s that is a random key', (name) => {
      expect(validate({ [name]: RANDOM_HEX }).valid).toBe(true);
    });

    it('never puts a key in the message', () => {
      const result = validate({ HEALTH_ENCRYPTION_KEY: ZEROS, DV_ENCRYPTION_KEY_PREVIOUS: 'not-a-key-but-private-looking' });
      expect(result.errors.join('\n')).not.toContain(ZEROS);
      expect(result.errors.join('\n')).not.toContain('private-looking');
    });

    it('refuses a retired key that is malformed, because it would be skipped and what it sealed would stay unreadable', () => {
      for (const name of ['DV_ENCRYPTION_KEY_PREVIOUS', 'HEALTH_ENCRYPTION_KEY_PREVIOUS', 'TOTP_ENCRYPTION_KEY_PREVIOUS']) {
        const result = validate({ [name]: `${OTHER_RANDOM_HEX}, ${RANDOM_HEX.slice(0, 40)}` });
        expect(result.valid).toBe(false);
        expect(result.errors.join('\n')).toContain(`${name} must hold 64-character hex keys`);
      }
    });

    it('accepts retired keys, including one that would be refused as a current key, because that is the key being retired', () => {
      expect(validate({ DV_ENCRYPTION_KEY_PREVIOUS: ZEROS }).valid).toBe(true);
      expect(validate({ DV_ENCRYPTION_KEY_PREVIOUS: `${ZEROS},${OTHER_RANDOM_HEX}` }).valid).toBe(true);
      expect(validate({ DV_ENCRYPTION_KEY_PREVIOUS: '' }).valid).toBe(true);
    });

    it('asks none of it outside production', () => {
      for (const nodeEnv of ['development', 'test']) {
        const result = validate({ NODE_ENV: nodeEnv, HEALTH_ENCRYPTION_KEY: ZEROS, DV_ENCRYPTION_KEY_PREVIOUS: 'nope' });
        expect(result.errors.join('\n')).not.toMatch(/ENCRYPTION_KEY/);
      }
    });

    it('stops production starting on any of it', () => {
      process.env = productionEnvironment({ HEALTH_ENCRYPTION_KEY: ZEROS });
      expect(() => validateEnvironmentOrExit()).toThrow('Invalid environment configuration');
    });
  });

  describe('STRIPE_CONNECT_WEBHOOK_SECRET', () => {
    it('is a warning when unset in production, not a reason to refuse to start', () => {
      const result = validate({ STRIPE_CONNECT_WEBHOOK_SECRET: undefined });
      expect(result.valid).toBe(true);
      expect(result.warnings.join('\n')).toMatch(/STRIPE_CONNECT_WEBHOOK_SECRET is not set/);
    });

    it('is warned about when it is not a Stripe signing secret', () => {
      const result = validate({ STRIPE_CONNECT_WEBHOOK_SECRET: 'sk_live_not_a_signing_secret' });
      expect(result.valid).toBe(true);
      expect(result.warnings.join('\n')).toMatch(/STRIPE_CONNECT_WEBHOOK_SECRET must start with whsec_/);
    });

    it('is quiet once it is a signing secret', () => {
      const result = validate({ STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_abcdefghijklmnop' });
      expect(result.warnings.join('\n')).not.toMatch(/STRIPE_CONNECT_WEBHOOK_SECRET/);
    });
  });

  describe('a deployment that is not called "production"', () => {
    it('refuses to start with no JWT_SECRET, because the built-in key is public', () => {
      for (const nodeEnv of ['staging', 'preview', 'qa', undefined]) {
        const result = validate({ NODE_ENV: nodeEnv, JWT_SECRET: undefined });
        expect(result.valid).toBe(false);
        expect(result.errors.join('\n')).toMatch(/JWT_SECRET is not set, and NODE_ENV is not "development" or "test"/);
      }
    });

    it('lets development and test use the built-in key', () => {
      for (const nodeEnv of ['development', 'test']) {
        const result = validate({ NODE_ENV: nodeEnv, JWT_SECRET: undefined });
        expect(result.errors.join('\n')).not.toMatch(/JWT_SECRET/);
      }
    });

    it('is satisfied by a secret on staging', () => {
      expect(validate({ NODE_ENV: 'staging' }).errors.join('\n')).not.toMatch(/JWT_SECRET/);
    });

    it('does not start the process: a boot that carries on answers every sign-in with a 500', () => {
      for (const nodeEnv of ['staging', 'preview', undefined]) {
        process.env = productionEnvironment({ NODE_ENV: nodeEnv, JWT_SECRET: undefined });
        expect(() => validateEnvironmentOrExit()).toThrow(/JWT_SECRET is not set/);
      }
    });

    it('still lets a development or test process start without one, on the built-in key', () => {
      for (const nodeEnv of ['development', 'test']) {
        process.env = productionEnvironment({ NODE_ENV: nodeEnv, JWT_SECRET: undefined });
        expect(() => validateEnvironmentOrExit()).not.toThrow();
      }
    });

    it('goes on tolerating the other non-production faults, which are not about signing', () => {
      // A short operator token is a warning; a malformed database address is an
      // error that outside production is logged and carried on from.
      process.env = productionEnvironment({ NODE_ENV: 'staging', METRICS_TOKEN: 'short', DATABASE_URL: 'not-a-database-url' });
      expect(validateEnvironment().valid).toBe(false);
      expect(() => validateEnvironmentOrExit()).not.toThrow();
    });
  });

  describe('transactional email', () => {
    it('refuses to start in production without a SendGrid key', () => {
      const result = validate({ SENDGRID_API_KEY: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required environment variable: SENDGRID_API_KEY');
    });

    it('refuses to start in production without a sender address', () => {
      const result = validate({ SENDGRID_FROM_EMAIL: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required environment variable: SENDGRID_FROM_EMAIL');
    });

    it('refuses a key that is not a SendGrid key', () => {
      const result = validate({ SENDGRID_API_KEY: 'not-a-sendgrid-key' });
      expect(result.errors).toContain('SENDGRID_API_KEY must start with SG.');
    });

    it.each([
      ['the unowned athena.com default', 'noreply@athena.com'],
      ['a subdomain of it', 'noreply@mail.athena.com'],
      ['example.com', 'noreply@example.com'],
      ['example.org', 'noreply@example.org'],
      ['the template placeholder', 'noreply@your-domain.com'],
      ['a display name', 'ATHENA <noreply@mail.ourdomain.org>'],
      ['two addresses', 'a@mail.ourdomain.org, b@mail.ourdomain.org'],
      ['no domain', 'noreply'],
      ['a domain with no dot', 'noreply@localhost'],
    ])('refuses %s as the sender', (_label, address) => {
      const result = validate({ SENDGRID_FROM_EMAIL: address });
      expect(result.valid).toBe(false);
      expect(result.errors.join('\n')).toMatch(/SENDGRID_FROM_EMAIL must be one plain address on a domain ATHENA owns/);
    });

    it('accepts an address on a domain that is not on the denylist', () => {
      expect(validate({ SENDGRID_FROM_EMAIL: 'noreply@mail.ourdomain.org' }).valid).toBe(true);
      expect(validate({ SENDGRID_FROM_EMAIL: 'hello@ourdomain.com.au' }).valid).toBe(true);
    });

    it('asks for none of it outside production', () => {
      for (const nodeEnv of ['development', 'test']) {
        const result = validate({
          NODE_ENV: nodeEnv,
          SENDGRID_API_KEY: undefined,
          SENDGRID_FROM_EMAIL: undefined,
        });
        expect(result.errors.join('\n')).not.toMatch(/SENDGRID/);
        expect(result.warnings.join('\n')).not.toMatch(/SENDGRID/);
      }
    });
  });

  describe('validateEnvironmentOrExit', () => {
    it('throws in production when anything is wrong, and says what', () => {
      process.env = productionEnvironment({ JWT_SECRET: 'change-me-change-me-change-me-change' });
      expect(() => validateEnvironmentOrExit()).toThrow('Invalid environment configuration');
    });

    it('does not throw for a complete production environment', () => {
      process.env = productionEnvironment();
      expect(() => validateEnvironmentOrExit()).not.toThrow();
    });
  });
});

describe('secretWeakness', () => {
  it('says why, in words that do not repeat the value', () => {
    expect(secretWeakness('')).toBe('not set');
    expect(secretWeakness(undefined)).toBe('not set');
    expect(secretWeakness('short')).toBe('shorter than 32 characters');
    expect(secretWeakness('your-super-secret-jwt-key-change-in-production')).toBe('a placeholder from an example file');
    expect(secretWeakness('a'.repeat(40))).toBe('made of a repeating pattern, not random');
    expect(secretWeakness(RANDOM_HEX)).toBeNull();
  });

  it('asks 64 characters of a hex key', () => {
    expect(secretWeakness(RANDOM_HEX, 64)).toBeNull();
    expect(secretWeakness(RANDOM_HEX.slice(0, 40), 64)).toBe('shorter than 64 characters');
  });

  it('ignores surrounding whitespace, as a pasted value often carries it', () => {
    expect(secretWeakness(`  ${RANDOM_HEX}\n`)).toBeNull();
    expect(secretWeakness(`  ${'a'.repeat(40)}\n`)).toBe('made of a repeating pattern, not random');
  });
});

describe('senderAddressProblem', () => {
  it('names the reason, so whoever sets the variable knows what to change', () => {
    expect(senderAddressProblem(undefined)).toBe('is not set');
    expect(senderAddressProblem('noreply@athena.com')).toMatch(/uses athena\.com, which is not a domain ATHENA owns/);
    expect(senderAddressProblem('Name <a@b.org>')).toMatch(/not a single plain email address/);
    expect(senderAddressProblem('  noreply@mail.ourdomain.org  ')).toBeNull();
  });
});

/**
 * scripts/check-env.js runs in CI before anything is built, so it cannot import
 * the TypeScript rules and keeps its own. Two copies of a rule drift; this is
 * what makes the drift a failing test instead of a CI check that disagrees with
 * the process it is guarding.
 */
describe('scripts/check-env.js keeps the same standard', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { secretWeakness: scriptWeakness } = require(path.join(SERVER_ROOT, 'scripts', 'check-env.js')) as {
    secretWeakness: (value: string | undefined, minLength?: number) => string | null;
  };

  const corpus: Array<[string | undefined, number | undefined]> = [
    [undefined, undefined],
    ['', undefined],
    ['short', undefined],
    [RANDOM_HEX.slice(0, 31), undefined],
    [RANDOM_HEX.slice(0, 32), undefined],
    [RANDOM_HEX, undefined],
    [RANDOM_HEX, 64],
    [RANDOM_HEX.slice(0, 40), 64],
    [RANDOM_BASE64, undefined],
    ['your-super-secret-jwt-key-change-in-production', undefined],
    ['generate-with-openssl-rand-hex-32', undefined],
    ['CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_MIN_32_CHARS', undefined],
    ['0'.repeat(64), 64],
    ['a'.repeat(40), undefined],
    ['abcd'.repeat(16), undefined],
    ['0123456789'.repeat(4), undefined],
    ['dev-only-secret-not-for-production', undefined],
    ['  padded-with-spaces-but-otherwise-fine-Zq3Vb0mP7y  ', undefined],
  ];

  it.each(corpus)('agrees about %p (minimum %p)', (value, minLength) => {
    expect(scriptWeakness(value, minLength)).toBe(secretWeakness(value, minLength));
  });

  it('does not run the checker when it is only imported', () => {
    // The require above would have exited the process or printed a report if
    // the guard on main() were missing; reaching this line is the assertion.
    expect(typeof scriptWeakness).toBe('function');
  });
});
