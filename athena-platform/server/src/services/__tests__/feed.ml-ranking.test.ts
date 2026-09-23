import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../ml.service', () => ({
  mlService: { isReady: jest.fn(async () => true), generateFeed: jest.fn() },
}));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { mlService } from '../ml.service';
import { logger } from '../../utils/logger';
import { rerankWithMl, toFeedCandidate, mlRankingEnabled, feedItemTypeFor } from '../feed-ml.service';

const ml: any = mlService;

const post = (id: string, likeCount = 0) => ({ id, authorId: `author-${id}`, type: 'TEXT', createdAt: new Date('2026-09-01T00:00:00Z'), likeCount, hashtags: ['founders'] });
const POSTS = [post('a', 30), post('b', 20), post('c', 10), post('d', 0)];

describe('ML feed ranking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ML_SERVICE_URL = 'http://ml.internal:8000';
    delete process.env.ML_FEED_RANKING;
    ml.isReady.mockResolvedValue(true);
  });

  it('is off until an operator configures the service', async () => {
    delete process.env.ML_SERVICE_URL;
    expect(mlRankingEnabled()).toBe(false);
    const result = await rerankWithMl(POSTS, { userId: 'u1' });
    expect(result.applied).toBe(false);
    expect(result.posts).toBe(POSTS);
    expect(ml.generateFeed).not.toHaveBeenCalled();

    process.env.ML_SERVICE_URL = 'http://ml.internal:8000';
    process.env.ML_FEED_RANKING = 'false';
    expect(mlRankingEnabled()).toBe(false);
  });

  it('keeps the engagement order when the service is not up', async () => {
    ml.isReady.mockResolvedValue(false);
    const result = await rerankWithMl(POSTS, { userId: 'u1' });
    expect(result.applied).toBe(false);
    expect(ml.generateFeed).not.toHaveBeenCalled();
  });

  it('re-orders by the model’s positions, keeps what it did not score after, and carries its reasons', async () => {
    ml.generateFeed.mockResolvedValue({
      feed_items: [
        { id: 'c', item_type: 'post', score: 0.9, position: 0, reason: 'Founders you follow are talking about this', is_sponsored: false },
        { id: 'a', item_type: 'post', score: 0.7, position: 1, reason: '', is_sponsored: false },
      ],
    });

    const result = await rerankWithMl(POSTS, { userId: 'u1', persona: 'FOUNDER' });

    expect(result.applied).toBe(true);
    expect(result.posts.map((p) => p.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(result.reasons.get('c')).toBe('Founders you follow are talking about this');
    expect(result.reasons.has('a')).toBe(false);
    const [context, candidates] = ml.generateFeed.mock.calls[0];
    expect(context).toEqual({ user_id: 'u1', persona: 'FOUNDER' });
    expect(candidates[0]).toMatchObject({ id: 'a', item_type: 'post', author_id: 'author-a', like_count: 30, tags: ['founders'] });
  });

  it('a failing model leaves the feed exactly as it was, with a warning', async () => {
    ml.generateFeed.mockRejectedValue(new Error('ML Service request timeout'));
    const result = await rerankWithMl(POSTS, { userId: 'u1' });
    expect(result.applied).toBe(false);
    expect(result.posts).toBe(POSTS);
    expect(logger.warn).toHaveBeenCalledWith('ML feed ranking unavailable; engagement order kept', expect.objectContaining({ error: 'ML Service request timeout' }));
  });

  it('maps a post into the candidate the model expects', () => {
    expect(toFeedCandidate({ id: 'x', authorId: 'u', type: 'VIDEO', createdAt: '2026-09-01T00:00:00.000Z', viewCount: null, likeCount: 4 })).toEqual({
      id: 'x',
      item_type: 'video',
      author_id: 'u',
      created_at: '2026-09-01T00:00:00.000Z',
      view_count: 0,
      like_count: 4,
      comment_count: 0,
      share_count: 0,
      tags: [],
      is_sponsored: false,
    });
  });

  // Every PostType in the schema has to land on a word the model's pydantic
  // enum accepts. It did not before: lowercasing the Prisma value sent 'text'
  // and 'job_share', one rejected candidate failed the whole batch, and the
  // ranker silently never ran on any feed that was not purely video.
  it('translates every post type into a word the model accepts', () => {
    const MODEL_VOCABULARY = ['post', 'video', 'job', 'course', 'ad', 'mentor', 'event', 'story'];
    const POST_TYPES = ['TEXT', 'IMAGE', 'VIDEO', 'ARTICLE', 'JOB_SHARE', 'COURSE_SHARE', 'POLL', 'WIN'];

    for (const type of POST_TYPES) {
      expect(MODEL_VOCABULARY).toContain(feedItemTypeFor(type));
    }

    expect(feedItemTypeFor('TEXT')).toBe('post');
    expect(feedItemTypeFor('VIDEO')).toBe('video');
    expect(feedItemTypeFor('JOB_SHARE')).toBe('job');
    expect(feedItemTypeFor('COURSE_SHARE')).toBe('course');
    // A type the schema gains later still has to produce a valid word rather
    // than losing the batch.
    expect(feedItemTypeFor('SOMETHING_NEW')).toBe('post');
    expect(feedItemTypeFor(null)).toBe('post');
  });

  it('a refused batch is logged as an error, not swallowed as a warning', async () => {
    ml.generateFeed.mockRejectedValue(
      Object.assign(new Error('ML Service error: 422'), {
        status: 422,
        detail: [{ loc: ['body', 'candidates', 0, 'item_type'], msg: 'Input should be a valid enumeration member' }],
      })
    );

    const result = await rerankWithMl(POSTS, { userId: 'u1' });

    expect(result.applied).toBe(false);
    expect(result.posts).toBe(POSTS);
    expect(logger.error).toHaveBeenCalledWith(
      'ML feed ranking refused the candidates; engagement order kept',
      expect.objectContaining({ status: 422, itemTypes: ['post'] })
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
