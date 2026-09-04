import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({ prisma: {} }));
jest.mock('../../utils/cache', () => ({ cacheGetOrSet: jest.fn(), CacheKeys: { feedTrending: jest.fn() } }));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { reasonsFor } from '../feed.service';
import { extractMentions, mentionsToPlainText } from '../../utils/mentions';
import { parseScheduledFor } from '../scheduled-posts.service';

const base = {
  id: 'p1',
  authorId: 'a1',
  type: 'TEXT',
  likeCount: 0,
  commentCount: 0,
  shareCount: 0,
  createdAt: new Date(Date.now() - 6 * 3600000),
  author: { displayName: 'Mei C.', persona: 'EARLY_CAREER' },
};

describe('reasonsFor', () => {
  it('names the follow relationship first', () => {
    expect(reasonsFor(base, { userId: 'v', followingIds: ['a1'] })).toEqual(['You follow Mei C.']);
  });

  it('says why a discovery or trending post is there', () => {
    expect(reasonsFor(base, { followingIds: [], source: 'trending' })).toEqual(['Trending in the community']);
    expect(reasonsFor(base, { followingIds: [], source: 'discovery', userPersona: 'EARLY_CAREER' })).toEqual([
      'Popular with members like you',
    ]);
  });

  it('mentions the shared career stage and freshness, at most two reasons', () => {
    const fresh = { ...base, createdAt: new Date(Date.now() - 10 * 60000) };
    expect(reasonsFor(fresh, { followingIds: ['a1'], userPersona: 'EARLY_CAREER' })).toEqual([
      'You follow Mei C.',
      'Same career stage as you',
    ]);
    expect(reasonsFor(fresh, { followingIds: [] })).toEqual(['Just posted']);
  });

  it('always has something honest to say', () => {
    expect(reasonsFor(base, { followingIds: [] })).toEqual(['Recent in the community']);
    expect(reasonsFor({ ...base, likeCount: 30 }, { followingIds: [] })).toEqual(['Getting a lot of responses']);
    expect(reasonsFor({ ...base, type: 'WIN' }, { followingIds: [] })).toEqual(['A win worth celebrating']);
    expect(reasonsFor(base, { userId: 'a1', followingIds: ['a1'] })).toEqual(['Your post']);
  });
});

describe('mentions', () => {
  it('reads @[Name](id) markup and ignores the rest', () => {
    const text = 'Thanks @[Mei Chen](11111111-1111-4111-8111-111111111111) and @[Mei Chen](11111111-1111-4111-8111-111111111111), also @nobody and email@example.com';
    expect(extractMentions(text)).toEqual([{ name: 'Mei Chen', userId: '11111111-1111-4111-8111-111111111111' }]);
    expect(mentionsToPlainText(text)).toContain('Thanks @Mei Chen and @Mei Chen');
  });
});

describe('parseScheduledFor', () => {
  const now = new Date('2026-09-04T10:00:00Z');

  it('accepts a time inside the window and returns undefined for none', () => {
    expect(parseScheduledFor(undefined, now)).toBeUndefined();
    expect(parseScheduledFor('', now)).toBeUndefined();
    expect(parseScheduledFor('2026-09-05T10:00:00Z', now)?.toISOString()).toBe('2026-09-05T10:00:00.000Z');
  });

  it('refuses the past, the next minute and next season', () => {
    expect(() => parseScheduledFor('2026-09-04T09:00:00Z', now)).toThrow(/at least 5 minutes/);
    expect(() => parseScheduledFor('2026-09-04T10:02:00Z', now)).toThrow(/at least 5 minutes/);
    expect(() => parseScheduledFor('2026-12-01T10:00:00Z', now)).toThrow(/up to 30 days/);
    expect(() => parseScheduledFor('not a date', now)).toThrow(/valid date/);
  });
});
