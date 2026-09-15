import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
// No Redis at all: the lockout must still lock.
jest.mock('../cache', () => ({ getRedisClient: jest.fn(() => null) }));

import { clearFailedLogins, getLockoutStatus, recordFailedLogin, resetLoginAttemptMemory } from '../loginAttempts';

describe('Login lockout without Redis', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env = { ...env, NODE_ENV: 'test' };
    delete process.env.REDIS_URL;
    resetLoginAttemptMemory();
  });
  afterEach(() => {
    process.env = env;
  });

  it('locks the address and account after the fifth failure, and says how long for', async () => {
    for (let i = 0; i < 4; i += 1) {
      await expect(recordFailedLogin('her@athena.com', '203.0.113.7')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });
    }
    const fifth = await recordFailedLogin('her@athena.com', '203.0.113.7');
    expect(fifth.locked).toBe(true);
    expect(fifth.retryAfterSeconds).toBeGreaterThan(0);

    const status = await getLockoutStatus('her@athena.com', '203.0.113.7');
    expect(status.locked).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keeps addresses and accounts apart, and clears on success', async () => {
    for (let i = 0; i < 5; i += 1) await recordFailedLogin('her@athena.com', '203.0.113.7');
    await expect(getLockoutStatus('her@athena.com', '198.51.100.9')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });
    await expect(getLockoutStatus('someone@athena.com', '203.0.113.7')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });

    await clearFailedLogins('her@athena.com', '203.0.113.7');
    await expect(getLockoutStatus('her@athena.com', '203.0.113.7')).resolves.toEqual({ locked: false, retryAfterSeconds: 0 });
  });
});
