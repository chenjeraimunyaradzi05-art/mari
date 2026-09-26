import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

/**
 * The ceiling on what the platform's OpenAI key may spend.
 *
 * There was none: nothing read `completion.usage`, premium chat had no period
 * quota, and the only limit anywhere was ten requests a minute. These guard the
 * two daily budgets, and the property that matters most about them — that the
 * ceiling holds when Redis does not.
 */

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockRecordFailure = jest.fn();
jest.mock('../../utils/ops-metrics', () => ({
  recordFailure: (...args: unknown[]) => mockRecordFailure(...args),
}));

let mockRedisClient: unknown = null;
jest.mock('../../utils/cache', () => ({
  getRedisClient: () => mockRedisClient,
}));

import {
  checkAiBudget,
  recordAiSpend,
  resetAiBudgetForTests,
  secondsUntilBudgetResets,
} from '../ai-budget.service';

const NOON = new Date('2026-09-26T12:00:00.000Z');
const NEXT_DAY = new Date('2026-09-27T00:30:00.000Z');

describe('AI daily budget', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    resetAiBudgetForTests();
    mockRecordFailure.mockClear();
    mockRedisClient = null;
    process.env.AI_DAILY_TOKENS_PER_MEMBER = '1000';
    process.env.AI_DAILY_TOKENS_GLOBAL = '5000';
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('lets a member spend up to her allowance and refuses her with 429 wording after it', async () => {
    await recordAiSpend({ userId: 'member-1' }, 'chat', { prompt_tokens: 400, completion_tokens: 200, total_tokens: 600 }, NOON);
    await expect(checkAiBudget('member-1', NOON)).resolves.toEqual({ allowed: true });

    await recordAiSpend({ userId: 'member-1' }, 'chat', { total_tokens: 450 }, NOON);
    const verdict = await checkAiBudget('member-1', NOON);

    expect(verdict).toEqual(expect.objectContaining({ allowed: false, scope: 'member' }));
    // Another member is not held to her count.
    await expect(checkAiBudget('member-2', NOON)).resolves.toEqual({ allowed: true });
  });

  it('stops everyone once the platform budget is used, and counts it where health can see it', async () => {
    for (let i = 0; i < 6; i += 1) {
      await recordAiSpend({ userId: `member-${i}` }, 'chat', { total_tokens: 900 }, NOON);
    }

    const verdict = await checkAiBudget('someone-new', NOON);

    expect(verdict).toEqual(expect.objectContaining({ allowed: false, scope: 'global' }));
    if (!verdict.allowed) expect(verdict.message).toMatch(/Nothing is wrong with your account/);
    expect(mockRecordFailure).toHaveBeenCalledWith('ai.budget_exhausted', expect.any(Error));
  });

  it('counts work nobody asked for against the platform and nobody else', async () => {
    await recordAiSpend(undefined, 'post_enrichment', { total_tokens: 5000 }, NOON);

    const verdict = await checkAiBudget('member-1', NOON);
    expect(verdict).toEqual(expect.objectContaining({ allowed: false, scope: 'global' }));
  });

  it('does not guess at a completion that reports no usage', async () => {
    await recordAiSpend({ userId: 'member-1' }, 'chat', undefined, NOON);
    await recordAiSpend({ userId: 'member-1' }, 'chat', {}, NOON);

    await expect(checkAiBudget('member-1', NOON)).resolves.toEqual({ allowed: true });
  });

  it('starts again when the UTC day turns over', async () => {
    await recordAiSpend({ userId: 'member-1' }, 'chat', { total_tokens: 2000 }, NOON);
    expect((await checkAiBudget('member-1', NOON)).allowed).toBe(false);

    await expect(checkAiBudget('member-1', NEXT_DAY)).resolves.toEqual({ allowed: true });
    expect(secondsUntilBudgetResets(NOON)).toBe(12 * 60 * 60);
  });

  it('keeps the ceiling in this process when Redis throws', async () => {
    const failing = () => Promise.reject(new Error('connection refused'));
    mockRedisClient = {
      mget: failing,
      pipeline: () => ({ incrby: () => undefined, expire: () => undefined, exec: failing }),
    };

    await recordAiSpend({ userId: 'member-1' }, 'chat', { total_tokens: 1200 }, NOON);

    expect((await checkAiBudget('member-1', NOON)).allowed).toBe(false);
  });

  it('believes the shared count when another instance has spent more than this one', async () => {
    mockRedisClient = {
      mget: async () => ['4000', '1500'],
      pipeline: () => ({ incrby: () => undefined, expire: () => undefined, exec: async () => [] }),
    };

    const verdict = await checkAiBudget('member-1', NOON);

    expect(verdict).toEqual(expect.objectContaining({ allowed: false, scope: 'member' }));
  });
});
