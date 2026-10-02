/**
 * Ceilings on how often one member may reach the same other member.
 *
 * Every per-member limit counts what an account does to everybody, and all of
 * them are comfortable for a campaign aimed at one woman: thirty comments in five
 * minutes is a lot across a feed and nothing when every one is under the same
 * person's posts. These are keyed by the pair.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../rateLimiter', () => {
  const actual: any = jest.requireActual('../rateLimiter');
  return {
    ...actual,
    // What the limiter does with no Redis, kept in this process, asked directly.
    slidingWindowRateLimit: jest.fn(async (key: string, windowMs: number, max: number) =>
      actual.memorySlidingWindow(key, windowMs, max)
    ),
  };
});

import { resetMemoryRateLimits } from '../rateLimiter';
import { TARGET_LIMITS, withinTargetLimit, type TargetedKind } from '../socialLimits';

const savedEnv = { ...process.env };

beforeEach(() => {
  // The limits stand down in tests (and with no Redis), so these cases say they are live.
  process.env.NODE_ENV = 'development';
  process.env.REDIS_URL = 'redis://localhost:6379';
  resetMemoryRateLimits();
});

afterEach(() => {
  process.env = { ...savedEnv };
});

async function useUp(kind: TargetedKind, actor: string, target: string, times: number): Promise<boolean[]> {
  const answers: boolean[] = [];
  for (let i = 0; i < times; i += 1) answers.push(await withinTargetLimit(kind, actor, target));
  return answers;
}

describe('withinTargetLimit', () => {
  it.each(Object.keys(TARGET_LIMITS) as TargetedKind[])('lets %s through up to its ceiling and refuses the next', async (kind) => {
    const { max } = TARGET_LIMITS[kind];

    const answers = await useUp(kind, 'a', 'b', max + 1);

    expect(answers.slice(0, max).every(Boolean)).toBe(true);
    expect(answers[max]).toBe(false);
  });

  it('counts the pair, so the same account is untouched elsewhere', async () => {
    const { max } = TARGET_LIMITS.follow;
    await useUp('follow', 'a', 'b', max + 1);

    // Another member of hers, and another account of his.
    expect(await withinTargetLimit('follow', 'a', 'c')).toBe(true);
    expect(await withinTargetLimit('follow', 'x', 'b')).toBe(true);
  });

  it('counts the direction, so she is not limited for answering him', async () => {
    const { max } = TARGET_LIMITS.follow;
    await useUp('follow', 'a', 'b', max + 1);

    expect(await withinTargetLimit('follow', 'b', 'a')).toBe(true);
  });

  it('counts each kind on its own', async () => {
    const { max } = TARGET_LIMITS.mention;
    await useUp('mention', 'a', 'b', max + 1);

    expect(await withinTargetLimit('mention', 'a', 'b')).toBe(false);
    expect(await withinTargetLimit('comment', 'a', 'b')).toBe(true);
    expect(await withinTargetLimit('follow', 'a', 'b')).toBe(true);
  });

  it('is generous enough for people who know each other', () => {
    // Five follows an hour is more than anyone presses by accident, and twelve
    // comments is a conversation: these are floors this test holds the ceilings to.
    expect(TARGET_LIMITS.follow.max).toBeGreaterThanOrEqual(3);
    expect(TARGET_LIMITS.comment.max).toBeGreaterThanOrEqual(10);
    expect(TARGET_LIMITS.notice.max).toBeGreaterThanOrEqual(20);
  });

  it('stands down when there is nothing to count against, as the per-member limits do', async () => {
    delete process.env.REDIS_URL;
    const { max } = TARGET_LIMITS.follow;

    const answers = await useUp('follow', 'a', 'b', max + 3);

    expect(answers.every(Boolean)).toBe(true);
  });
});
