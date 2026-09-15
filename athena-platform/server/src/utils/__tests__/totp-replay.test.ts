import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { matchTotpStep, stepOf, TOTP_REPLAY_TTL_SECONDS } from '../totp';
import { claimTotpStep, resetTotpReplayMemory } from '../totp-replay';

const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('A one-time code is spent once', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env = { ...env, NODE_ENV: 'test' };
    delete process.env.REDIS_URL;
    resetTotpReplayMemory();
  });
  afterEach(() => {
    process.env = env;
  });

  it('names the step a code belongs to, wherever in the window it falls', () => {
    // RFC 6238 test vector: 287082 is the code for t=59s.
    expect(matchTotpStep('287082', SECRET, 59_000)).toBe(stepOf(59_000));
    // Thirty seconds on, the same code still matches, and still names its own step.
    expect(matchTotpStep('287082', SECRET, 89_000)).toBe(stepOf(59_000));
    expect(matchTotpStep('000000', SECRET, 59_000)).toBeNull();
    expect(matchTotpStep('nope', SECRET, 59_000)).toBeNull();
  });

  it('accepts the first claim on a step and refuses the second, per account', async () => {
    const step = stepOf(59_000);
    await expect(claimTotpStep('u1', step)).resolves.toBe(true);
    await expect(claimTotpStep('u1', step)).resolves.toBe(false);
    await expect(claimTotpStep('u1', step + 1)).resolves.toBe(true);
    await expect(claimTotpStep('u2', step)).resolves.toBe(true);
  });

  it('forgets a claim once the step has left the window', async () => {
    const step = stepOf(59_000);
    const t0 = 1_000_000;
    await expect(claimTotpStep('u1', step, t0)).resolves.toBe(true);
    await expect(claimTotpStep('u1', step, t0 + TOTP_REPLAY_TTL_SECONDS * 1000 - 1)).resolves.toBe(false);
    await expect(claimTotpStep('u1', step, t0 + TOTP_REPLAY_TTL_SECONDS * 1000 + 1)).resolves.toBe(true);
  });
});
