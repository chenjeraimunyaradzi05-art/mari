/**
 * Muted words: a member's own list of words they do not want to read.
 * Stored on UserSafetySettings.blockedKeywords; honoured by the feeds and
 * by comment threads. Matching is whole-word and case-insensitive, so muting
 * "layoff" hides "Layoffs are..." but not "playoff".
 */

function escape(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeMutedWords(words: unknown): string[] {
  if (!Array.isArray(words)) return [];
  return Array.from(
    new Set(
      words
        .filter((w): w is string => typeof w === 'string')
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length > 0 && w.length <= 60)
    )
  ).slice(0, 100);
}

/** A matcher for the list, or null when there is nothing to mute. */
export function mutedWordMatcher(words: string[]): ((text: string | null | undefined) => boolean) | null {
  const clean = normalizeMutedWords(words);
  if (clean.length === 0) return null;
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(?:${clean.map(escape).join('|')})(?=$|[^\\p{L}\\p{N}_])`, 'iu');
  return (text) => (text ? pattern.test(text) : false);
}

export function containsMutedWord(text: string | null | undefined, words: string[]): boolean {
  const matcher = mutedWordMatcher(words);
  return matcher ? matcher(text) : false;
}
