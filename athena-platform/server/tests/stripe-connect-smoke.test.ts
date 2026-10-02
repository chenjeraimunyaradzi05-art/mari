import path from 'path';
import { spawnSync } from 'child_process';
import { describe, it, expect } from '@jest/globals';

/**
 * scripts/stripe-connect-smoke.js drives Stripe's side of the Connect money loop.
 *
 * It makes real calls when it is given a test key, so what can be tested without
 * the network is the half that matters before any call: it will not run with no
 * key, with a live key, or with anything it cannot prove is a test key, and it
 * never prints the key it was refused. It opens no database connection and calls no
 * ATHENA API, so it cannot touch real money or real members.
 */

const script = path.resolve(__dirname, '..', 'scripts', 'stripe-connect-smoke.js');

function run(env: Record<string, string | undefined>, args: string[] = []) {
  const clean: NodeJS.ProcessEnv = { ...process.env };
  delete clean.STRIPE_SECRET_KEY;
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...clean, ...env } as NodeJS.ProcessEnv });
}

describe('stripe-connect-smoke.js refuses to run against anything but test mode', () => {
  it('stops with no key at all, and says to use a test key', () => {
    const result = run({});

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/STRIPE_SECRET_KEY is not set/);
  });

  it.each([
    ['a live secret key', 'sk_live_fixture-not-a-key'],
    ['a restricted live key', 'rk_live_fixture-not-a-key'],
    ['a publishable key', 'pk_test_abcdefghijklmnopqrstuvwx'],
    ['something that is not a Stripe key', 'definitely-not-a-key'],
  ])('refuses %s, so it cannot move real money', (_label, key) => {
    const result = run({ STRIPE_SECRET_KEY: key });

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/not a test key/);
    // The key it refused is not echoed anywhere.
    expect(result.stdout + result.stderr).not.toContain(key);
  });

  it('prints how to use it without a key, for --help', () => {
    const result = run({}, ['--help']);

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/--account acct_/);
  });

  it('refuses a malformed --account before it calls Stripe', () => {
    const result = run({ STRIPE_SECRET_KEY: 'sk_test_fixture-not-a-key' }, ['--account', 'not-an-account']);

    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/needs an account id/);
  });
});
