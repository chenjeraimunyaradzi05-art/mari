/**
 * The ranker's absence has to be countable.
 *
 * rerankWithMl already fell back correctly when the ML service was missing, and
 * that was the whole problem: it fell back in complete silence. An operator who
 * had configured ML_SERVICE_URL and whose service never came up got exactly the
 * feed they would have got without it, with nothing in the log and nothing in
 * /health to tell them the dependency they were paying for had never once
 * applied. These tests pin the counters /health/detailed reads, and the rule
 * that a feed load is never spammed into the log.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../ml.service', () => ({
  mlService: { isReady: jest.fn(async () => true), generateFeed: jest.fn() },
}));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { mlService } from '../ml.service';
import { logger } from '../../utils/logger';
import { rerankWithMl, mlRankingStats, resetMlRankingStats } from '../feed-ml.service';

const ml: any = mlService;

const post = (id: string) => ({ id, authorId: `author-${id}`, type: 'TEXT', createdAt: new Date('2026-09-01T00:00:00Z') });
const POSTS = [post('a'), post('b')];

describe('ML feed ranking counters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMlRankingStats();
    process.env.ML_SERVICE_URL = 'http://ml.internal:8000';
    delete process.env.ML_FEED_RANKING;
    ml.isReady.mockResolvedValue(true);
  });

  it('reports the ranker as off, and counts nothing, when no operator configured it', async () => {
    delete process.env.ML_SERVICE_URL;

    await rerankWithMl(POSTS, { userId: 'u1' });

    const stats = mlRankingStats();
    expect(stats.enabled).toBe(false);
    expect(stats.attempts).toBe(0);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('counts every feed the model actually re-ordered', async () => {
    ml.generateFeed.mockResolvedValue({
      feed_items: [{ id: 'b', item_type: 'post', score: 0.9, position: 0, reason: '', is_sponsored: false }],
    });

    await rerankWithMl(POSTS, { userId: 'u1' });

    expect(mlRankingStats()).toMatchObject({ enabled: true, attempts: 1, applied: 1, skippedNotReady: 0 });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('a configured service that is not up is counted and said out loud once', async () => {
    ml.isReady.mockResolvedValue(false);

    await rerankWithMl(POSTS, { userId: 'u1' });
    await rerankWithMl(POSTS, { userId: 'u2' });
    await rerankWithMl(POSTS, { userId: 'u3' });

    const stats = mlRankingStats();
    expect(stats.attempts).toBe(3);
    expect(stats.applied).toBe(0);
    expect(stats.skippedNotReady).toBe(3);
    expect(stats.lastSkipReason).toBe('service not ready');
    expect(stats.lastSkipAt).not.toBeNull();

    // Three skips, one line: a feed load happens on every refresh, so a line
    // per skip would be the signal drowning itself.
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'ML feed ranking did not apply; engagement order kept',
      expect.objectContaining({ reason: 'service not ready' })
    );
  });

  it('counts a refusal apart from a service that could not be reached', async () => {
    ml.generateFeed.mockRejectedValue(Object.assign(new Error('ML Service error: 422'), { status: 422 }));
    await rerankWithMl(POSTS, { userId: 'u1' });

    ml.generateFeed.mockRejectedValue(new Error('ML Service request timeout'));
    await rerankWithMl(POSTS, { userId: 'u2' });

    const stats = mlRankingStats();
    expect(stats).toMatchObject({ attempts: 2, applied: 0, refused: 1, unavailable: 1 });
    expect(stats.lastSkipReason).toBe('ML Service request timeout');
  });

  it('counts an answer with no items, because that is not the ranker working either', async () => {
    ml.generateFeed.mockResolvedValue({ feed_items: [] });

    const result = await rerankWithMl(POSTS, { userId: 'u1' });

    expect(result.applied).toBe(false);
    expect(result.posts).toBe(POSTS);
    expect(mlRankingStats()).toMatchObject({ attempts: 1, applied: 0, emptyResponse: 1 });
  });
});
