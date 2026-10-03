/**
 * The two ways the server refuses a write on the minimum age, and what the app
 * does with them.
 *
 * DATE_OF_BIRTH_REQUIRED: her account has no date of birth (it was made before
 * ATHENA asked for one) and every write is refused until she gives it. She can
 * fix it, so the answer carries `setup`, the page with the form.
 * MINIMUM_AGE_NOT_MET: the date on her account is under the minimum age. There
 * is nothing for her to fill in, and the app does not say the number back, so the
 * only way forward is to write to us.
 *
 * Neither was recognised anywhere in the client: a member with no date of birth
 * got a bare error toast from whichever button she pressed (post, comment, join,
 * buy), with no way to the form that would let her through. The shared API client
 * now announces both through this event, and AgeGateRefusalNotice (mounted in the
 * dashboard) shows one notice with the way forward, wherever the refusal came
 * from. It is the sibling of the women-only notice and works the same way.
 */

import { safeRedirect } from './safe-redirect';

export const AGE_GATE_REFUSAL_EVENT = 'athena:age-gate-refusal';

/** Where a member with no date of birth goes to give it. */
export const AGE_GATE_FALLBACK_SETUP = '/dashboard/settings/profile';

/** Where a member whose recorded date is under the minimum goes to ask a person. */
export const AGE_GATE_CONTACT_PATH = '/contact';

export type AgeGateRefusal = {
  kind: 'DATE_REQUIRED' | 'UNDER_AGE';
  /** The server's own sentence, so what the member reads matches what every other surface says. */
  message: string;
  /** A path on this site, or the fallback. Never an address the server could point somewhere else. */
  setup: string;
};

type RefusalBody = { code?: unknown; message?: unknown; error?: unknown; setup?: unknown };

/** The refusal an error from the API carries, or null when it is anything else. */
export function ageGateRefusalOf(error: unknown): AgeGateRefusal | null {
  const response = (error as { response?: { status?: number; data?: RefusalBody } } | null)?.response;
  if (response?.status !== 403) return null;

  const code = response.data?.code;
  if (code !== 'DATE_OF_BIRTH_REQUIRED' && code !== 'MINIMUM_AGE_NOT_MET') return null;

  const sentence = [response.data?.message, response.data?.error].find(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0
  );
  const kind = code === 'MINIMUM_AGE_NOT_MET' ? 'UNDER_AGE' : 'DATE_REQUIRED';
  const setup = safeRedirect(typeof response.data?.setup === 'string' ? response.data.setup : null);

  return {
    kind,
    message:
      sentence?.trim() ??
      (kind === 'UNDER_AGE'
        ? 'ATHENA accounts are for adults, so this part of the platform is not available on your account.'
        : 'Please add your date of birth before using this part of ATHENA.'),
    setup: kind === 'DATE_REQUIRED' ? (setup ?? AGE_GATE_FALLBACK_SETUP) : AGE_GATE_CONTACT_PATH,
  };
}

/** Tells the page, once per refusal. Does nothing on the server, where there is no one to tell. */
export function announceAgeGateRefusal(refusal: AgeGateRefusal): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AgeGateRefusal>(AGE_GATE_REFUSAL_EVENT, { detail: refusal }));
}

export const AGE_GATE_CLEARED_EVENT = 'athena:age-gate-cleared';

/**
 * Tells the page that her date of birth is now on the account, so a notice that
 * still asks for it is out of date and goes. The notice stays until dismissed,
 * which is right while it is true; left up after she has just answered it, it
 * would tell her to do what she has done. Only the "add your date" notice goes:
 * one that says her account is under the minimum age is not answered by this.
 */
export function announceAgeGateCleared(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AGE_GATE_CLEARED_EVENT));
}
