/**
 * Small secrets at rest: the authenticator seed behind two-factor sign-in, and
 * the personal safety plan.
 *
 * A TOTP secret is the second factor; stored in the clear, a copy of the
 * users table is a copy of every second factor too. It is sealed with
 * AES-256-GCM under TOTP_ENCRYPTION_KEY, falling back to DV_ENCRYPTION_KEY so
 * a deployment that already protects the safe chats protects these, and
 * marked with a prefix so a value written before sealing existed is still
 * read as it is. Production refuses to run without a real key.
 *
 * A safety plan is sealed the same way but only ever under DV_ENCRYPTION_KEY,
 * the key the safe chats use, never the authenticator key. The two have
 * different lives: a second factor can be re-enrolled, so rotating
 * TOTP_ENCRYPTION_KEY is a routine thing to do, and a plan sealed under it
 * would be lost with no way for her to know until she opened it.
 *
 * The keys themselves, their checks and the retired-key list are in
 * encryption-key.ts, shared with the safe chats and the health records.
 */

import { isSealed, openText, sealText } from './encryption-key';

export { isSealed };

export function sealSecret(plain: string): string {
  return sealText('secret', plain);
}

/**
 * The secret as it was sealed. A value without the prefix predates sealing
 * and is returned as it is; a sealed value this host cannot open (wrong key,
 * tampered bytes) is null, which reads as "no second factor matches".
 */
export function openSecret(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined || stored === '') return null;
  if (!isSealed(stored)) return stored;
  return openText('secret', stored);
}

/** Text from a personal safety plan, sealed under DV_ENCRYPTION_KEY alone. */
export function sealSafetyText(plain: string): string {
  return sealText('safety-plan', plain);
}

/** The same rules as openSecret, for what sealSafetyText wrote. */
export function openSafetyText(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined || stored === '') return null;
  if (!isSealed(stored)) return stored;
  return openText('safety-plan', stored);
}
