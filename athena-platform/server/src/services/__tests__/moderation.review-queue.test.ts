/**
 * What the text gate does with content the provider thinks is borderline.
 *
 * It published it and wrote a logger.warn. No flag, no queue row, no report:
 * the provider's judgement that a person should look went into a log line and
 * nowhere a moderator would ever see it. These tests hold the queue that
 * replaced that, and the line between a judgement about a post and an outage.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const moderationsCreate = jest.fn();

jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({ moderations: { create: moderationsCreate } }))
);

jest.mock('../../utils/prisma', () => ({
  prisma: { adminFlag: { create: jest.fn(async () => ({ id: 'flag-1' })) } },
}));

jest.mock('../../utils/cache', () => ({
  cacheGet: jest.fn(async () => null),
  cacheSet: jest.fn(async () => undefined),
}));

jest.mock('../../utils/ops-metrics', () => ({ recordFailure: jest.fn() }));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

process.env.AI_OPENAI_API_KEY = 'test-key';

import { prisma as prismaTyped } from '../../utils/prisma';
import { recordFailure } from '../../utils/ops-metrics';
import { cacheGet } from '../../utils/cache';
import { assertContentAllowed, CONTENT_REVIEW_FLAG, MESSAGE_CHECK_UNAVAILABLE, moderateText } from '../moderation.service';

const prisma: any = prismaTyped;

function providerAnswer(scores: Record<string, number>) {
  moderationsCreate.mockResolvedValue({
    results: [{ flagged: true, category_scores: scores, categories: {} }],
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Borderline content goes in front of a person', () => {
  it('publishes the post and files a review flag against its author', async () => {
    // One category over its threshold: review, not block.
    providerAnswer({ harassment: 0.65, hate: 0.1 });

    await expect(
      assertContentAllowed('You know exactly what you did.', { kind: 'post', userId: 'author-1' })
    ).resolves.toBeUndefined();

    expect(prisma.adminFlag.create).toHaveBeenCalledTimes(1);
    const data = prisma.adminFlag.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: 'author-1',
      type: CONTENT_REVIEW_FLAG,
      // Below the HIGH crisis flags, so it can never push one of those down.
      severity: 'MEDIUM',
      flaggedById: 'system',
    });
    expect(data.reason).toContain('harassment');
    expect(data.notes).toContain('You know exactly what you did.');
  });

  it('refuses outright what the provider would block, and files nothing', async () => {
    providerAnswer({ 'harassment/threatening': 0.9 });

    await expect(assertContentAllowed('a threat', { kind: 'comment', userId: 'author-1' })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(prisma.adminFlag.create).not.toHaveBeenCalled();
  });

  it('counts a provider outage as an outage, not as a flag against the member', async () => {
    moderationsCreate.mockRejectedValue(new Error('provider timed out') as never);

    await assertContentAllowed('an ordinary post', { kind: 'post', userId: 'author-1' });

    expect(prisma.adminFlag.create).not.toHaveBeenCalled();
    expect(recordFailure).toHaveBeenCalledWith('moderation.provider_unavailable', expect.any(Error));
  });

  it('does not lose the post when the flag cannot be written', async () => {
    providerAnswer({ harassment: 0.65 });
    prisma.adminFlag.create.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(assertContentAllowed('borderline', { kind: 'post', userId: 'author-1' })).resolves.toBeUndefined();
    expect(recordFailure).toHaveBeenCalledWith('moderation.review_queue', expect.any(Error));
  });

  it('keeps only an excerpt of a long post on the flag', async () => {
    providerAnswer({ harassment: 0.65 });

    await assertContentAllowed('y'.repeat(5000), { kind: 'post', userId: 'author-1' });

    const notes: string = prisma.adminFlag.create.mock.calls[0][0].data.notes;
    expect(notes.length).toBeLessThan(700);
  });
});

describe('A provider outage on the conversational surfaces', () => {
  it.each(['message', 'group_message', 'channel_message', 'live_chat'] as const)(
    'holds a %s back with a 503 instead of delivering it unscreened',
    async (kind) => {
      moderationsCreate.mockRejectedValue(new Error('provider timed out') as never);

      await expect(assertContentAllowed('see you soon', { kind, userId: 'sender-1' })).rejects.toMatchObject({
        statusCode: 503,
        message: MESSAGE_CHECK_UNAVAILABLE,
      });
      // Counted once, where the outage happened, and never filed against her.
      expect(recordFailure).toHaveBeenCalledWith('moderation.provider_unavailable', expect.any(Error));
      expect(prisma.adminFlag.create).not.toHaveBeenCalled();
    }
  );

  it('still publishes a post during the same outage', async () => {
    moderationsCreate.mockRejectedValue(new Error('provider timed out') as never);

    await expect(assertContentAllowed('a post', { kind: 'post', userId: 'author-1' })).resolves.toBeUndefined();
  });

  it('marks the unanswered verdict as unavailable so callers can tell it from a judgement', async () => {
    moderationsCreate.mockRejectedValue(new Error('provider timed out') as never);

    await expect(moderateText('anything')).resolves.toMatchObject({ action: 'review', unavailable: true });
  });
});

describe('The verdict cache', () => {
  it('keys verdicts by a SHA-256 of the text under a versioned prefix', async () => {
    providerAnswer({ harassment: 0.01 });

    await moderateText('Aa');
    await moderateText('BB');

    // 'Aa' and 'BB' shared a key under the old 31-bit hash, so a cached allow
    // for one was served for the other.
    const keys = jest.mocked(cacheGet).mock.calls.map((call) => String(call[0]));
    expect(keys[0]).toMatch(/^moderation:v2:[0-9a-f]{64}$/);
    expect(keys[0]).not.toBe(keys[1]);
  });
});
