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
import { assertContentAllowed, CONTENT_REVIEW_FLAG } from '../moderation.service';

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
