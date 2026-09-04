import { describe, it, expect } from '@jest/globals';
import { containsMutedWord, mutedWordMatcher, normalizeMutedWords } from '../muted-words';
import { authorAudienceWhere } from '../../services/audience.service';

describe('Muted words', () => {
  it('matches whole words, case-insensitively', () => {
    expect(containsMutedWord('Layoffs announced today', ['layoffs'])).toBe(true);
    expect(containsMutedWord('The playoff was great', ['layoff'])).toBe(false);
    expect(containsMutedWord('#Diet culture again', ['diet'])).toBe(true);
    expect(containsMutedWord('No match here', ['layoff', 'diet'])).toBe(false);
  });

  it('handles phrases and punctuation', () => {
    expect(containsMutedWord('Thoughts on weight loss?', ['weight loss'])).toBe(true);
    expect(containsMutedWord('C++ is fine', ['c++'])).toBe(true);
  });

  it('normalises the list and gives no matcher for an empty one', () => {
    expect(normalizeMutedWords([' Layoff ', 'layoff', '', 42, 'diet'])).toEqual(['layoff', 'diet']);
    expect(mutedWordMatcher([])).toBeNull();
    expect(mutedWordMatcher(['x'])!(null)).toBe(false);
  });
});

describe('Author audience', () => {
  it('allows public authors, the viewer, and followed connections-only authors', () => {
    const where = authorAudienceWhere('me', ['ana', 'me', 'ben']);
    expect(where.OR).toEqual([
      { author: { safetySettings: { is: null } } },
      { author: { safetySettings: { is: { profileVisibility: 'public' } } } },
      { authorId: 'me' },
      { authorId: { in: ['ana', 'ben'] }, author: { safetySettings: { is: { profileVisibility: 'connections' } } } },
    ]);
  });

  it('a signed-out reader sees public authors only', () => {
    expect(authorAudienceWhere().OR).toHaveLength(2);
  });
});
