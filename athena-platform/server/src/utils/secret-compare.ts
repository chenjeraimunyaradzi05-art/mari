import { createHash, timingSafeEqual } from 'crypto';

/**
 * Whether a presented secret equals the configured one, in constant time.
 *
 * Both sides are hashed first, so the comparison takes the same time whatever
 * the lengths are: a plain length check would tell a caller how long the
 * secret is before a single byte had been compared. Nothing is configured,
 * nothing matches.
 */
export function secretMatches(provided: unknown, expected: string | undefined | null): boolean {
  if (!expected || typeof provided !== 'string' || provided.length === 0) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** True when the presented value equals any of the configured secrets. */
export function secretMatchesAny(provided: unknown, expected: Array<string | undefined | null>): boolean {
  // Every candidate is compared, so the answer's timing does not say which one matched.
  let matched = false;
  for (const candidate of expected) {
    if (secretMatches(provided, candidate)) matched = true;
  }
  return matched;
}
