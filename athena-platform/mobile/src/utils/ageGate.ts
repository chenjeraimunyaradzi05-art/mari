/**
 * The minimum age on the phone: what the server refuses with, and the one rule
 * for a date she types.
 *
 * ATHENA is for adults. The server refuses every write from an account with no
 * date of birth on it (DATE_OF_BIRTH_REQUIRED), or one whose recorded date is
 * under the minimum (MINIMUM_AGE_NOT_MET). The web turns those into a notice
 * with a link; the phone had no handling at all, so a member with no date of
 * birth got "Request failed" from whichever button she pressed and no way to
 * the one thing that would let her through. This is the part both the API layer
 * and the prompt share, kept free of React so it can be tested alone.
 */

/** Kept in step with server/src/config/region.config.ts and the web form. */
export const PLATFORM_MINIMUM_AGE = 18;

export const DATE_OF_BIRTH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether a typed YYYY-MM-DD date makes her old enough, worked out on calendar
 * parts rather than by dividing milliseconds, so a birthday that has not come
 * round yet this year does not count and 29 February is not a special case.
 * A date in the future, or one that implies an age no one has reached, is not
 * a date of birth.
 */
export function isAdultDateOfBirth(value: string, now: Date = new Date()): boolean {
  if (!DATE_OF_BIRTH_PATTERN.test(value)) return false;
  const born = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return false;
  // `new Date('2026-02-31')` rolls over to March; a date that is not on the calendar is not one.
  if (born.toISOString().slice(0, 10) !== value) return false;
  if (born.getTime() > now.getTime()) return false;

  let years = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) years -= 1;

  return years >= PLATFORM_MINIMUM_AGE && years <= 120;
}

export type AgeGateRefusal = {
  code: 'DATE_OF_BIRTH_REQUIRED' | 'MINIMUM_AGE_NOT_MET';
  /** The server's own sentence, so what she reads matches every other surface. */
  message: string;
};

const DEFAULT_MESSAGES: Record<AgeGateRefusal['code'], string> = {
  DATE_OF_BIRTH_REQUIRED: 'Please add your date of birth before using this part of ATHENA.',
  MINIMUM_AGE_NOT_MET: 'ATHENA accounts are for adults, so this part of the platform is not available on your account.',
};

/** The refusal an error from the API carries, or null when it is anything else. */
export function ageGateRefusalOf(error: unknown): AgeGateRefusal | null {
  const response = (error as { response?: { status?: number; data?: { code?: unknown; message?: unknown; error?: unknown } } } | null)
    ?.response;
  if (response?.status !== 403) return null;

  const code = response.data?.code;
  if (code !== 'DATE_OF_BIRTH_REQUIRED' && code !== 'MINIMUM_AGE_NOT_MET') return null;

  const sentence = [response.data?.message, response.data?.error].find(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0
  );
  return { code, message: sentence?.trim() ?? DEFAULT_MESSAGES[code] };
}
