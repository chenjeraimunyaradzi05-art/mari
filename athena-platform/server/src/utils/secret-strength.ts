/**
 * Whether a configured secret is one somebody would have to guess.
 *
 * Length was the only thing the boot check asked of JWT_SECRET, and length is
 * not strength. The example env file ships
 * `your-super-secret-jwt-key-change-in-production`, which is 47 characters, so
 * a deployment that copied the example passed every check we had and signed
 * every member's session with a string printed in the repository. The same was
 * true of the all-zero DV_ENCRYPTION_KEY in that file, which is a perfectly
 * valid 64 hex characters.
 *
 * This answers the question the checks meant to ask: is this a value a person
 * generated (`openssl rand -hex 32`), or a value somebody typed, copied or left
 * in from a template. It never needs the value to be printed: the reasons
 * describe the shape of the problem, not the secret.
 *
 * scripts/check-env.js runs before the build and cannot import TypeScript, so it
 * keeps a mirror of these rules; utils/__tests__/env.test.ts holds the two to
 * the same answers. Change one, change the other.
 */

/** Below this a secret can be brute-forced; 32 characters of hex is 128 bits. */
export const MIN_SECRET_LENGTH = 32;

/**
 * A real random value has roughly as many distinct characters as its alphabet:
 * 32 hex characters carry about fourteen. Fewer than this is a keyboard
 * pattern or a run of one character, and the chance of a genuine random
 * 32-character hex string falling below it is about four in a hundred million.
 */
const MIN_DISTINCT_CHARACTERS = 8;

/**
 * Words that appear in example files and never in generated output. Matched as
 * substrings of the lower-cased value, which is safe for a random one: the
 * shortest of these is five characters, so the chance of generated base64
 * containing one by accident is far below one in a billion.
 */
const PLACEHOLDER_FRAGMENTS = [
  'change',
  'your-',
  'your_',
  'placeholder',
  'example',
  'replace',
  'insert',
  'generate',
  'openssl',
  'dev-only',
  'not-for-prod',
  'not_for_prod',
  'not_configured',
];

/** Short values a person types when they mean "fill this in later". */
const PLACEHOLDER_WHOLE_VALUES = new Set([
  'secret',
  'password',
  'changeme',
  'change_me',
  'todo',
  'xxx',
  'test',
  'development',
]);

/** True when the whole value is one short pattern repeated, such as `abcabcabc…`. */
function isShortPatternRepeated(value: string): boolean {
  for (let period = 1; period <= 16; period += 1) {
    let repeats = true;
    for (let index = period; index < value.length; index += 1) {
      if (value[index] !== value[index % period]) {
        repeats = false;
        break;
      }
    }
    if (repeats) return true;
  }
  return false;
}

/**
 * Why this value cannot be trusted as a secret, or null when nothing about its
 * shape gives it away. `minLength` is the length the caller needs: 32 for a
 * signing secret, 64 for a hex-encoded 256-bit key.
 */
export function secretWeakness(value: string | undefined | null, minLength: number = MIN_SECRET_LENGTH): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'not set';
  if (trimmed.length < minLength) return `shorter than ${minLength} characters`;

  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_WHOLE_VALUES.has(lower) || PLACEHOLDER_FRAGMENTS.some((fragment) => lower.includes(fragment))) {
    return 'a placeholder from an example file';
  }
  if (new Set(trimmed).size < MIN_DISTINCT_CHARACTERS || isShortPatternRepeated(trimmed)) {
    return 'made of a repeating pattern, not random';
  }
  return null;
}

/** Whether the value is long enough and does not look typed, copied or left over from a template. */
export function isStrongSecret(value: string | undefined | null, minLength: number = MIN_SECRET_LENGTH): boolean {
  return secretWeakness(value, minLength) === null;
}
