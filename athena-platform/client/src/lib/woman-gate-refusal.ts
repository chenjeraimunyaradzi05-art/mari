/**
 * The two ways the server refuses a member on the women-only check, and what
 * the app does with them.
 *
 * WOMAN_VERIFICATION_REQUIRED: this part of ATHENA asks for the completed check
 * and hers is not. She can fix it, so the answer carries `setup`, the page.
 * WOMAN_VERIFICATION_REJECTED: a reviewer has refused her. There is nothing to
 * complete, so the answer says how to appeal, and she is not sent to the form
 * that would only ask her to do it again.
 *
 * Neither was recognised anywhere in the client, so a refused or unchecked
 * member got a bare error toast from whichever button she pressed and no way
 * to the page that fixes it. The shared API client now announces both through
 * this event, and WomanGateRefusalNotice (mounted in the dashboard) shows one
 * notice with the way forward, wherever the refusal came from.
 */

import { safeRedirect } from './safe-redirect';

export const WOMAN_GATE_REFUSAL_EVENT = 'athena:woman-gate-refusal';

/** Where a member who has not completed the check goes to complete it. */
export const WOMAN_GATE_FALLBACK_SETUP = '/dashboard/settings/profile';

/** Where a refused member goes to ask a person to look again. */
export const WOMAN_GATE_APPEAL_PATH = '/help/appeal';

export type WomanGateRefusal = {
  kind: 'REQUIRED' | 'REJECTED';
  /** The server's own sentence, so what the member reads matches what every other surface says. */
  message: string;
  /** A path on this site, or the fallback. Never an address the server could point somewhere else. */
  setup: string;
};

type RefusalBody = { code?: unknown; message?: unknown; error?: unknown; setup?: unknown };

/** The refusal an error from the API carries, or null when it is anything else. */
export function womanGateRefusalOf(error: unknown): WomanGateRefusal | null {
  const response = (error as { response?: { status?: number; data?: RefusalBody } } | null)?.response;
  if (response?.status !== 403) return null;

  const code = response.data?.code;
  if (code !== 'WOMAN_VERIFICATION_REQUIRED' && code !== 'WOMAN_VERIFICATION_REJECTED') return null;

  const sentence = [response.data?.message, response.data?.error].find(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0
  );
  const kind = code === 'WOMAN_VERIFICATION_REJECTED' ? 'REJECTED' : 'REQUIRED';
  const setup = safeRedirect(typeof response.data?.setup === 'string' ? response.data.setup : null);

  return {
    kind,
    message:
      sentence?.trim() ??
      (kind === 'REJECTED'
        ? 'Your membership did not pass the women-only check. You can appeal and a person will look again.'
        : 'This part of ATHENA is open to members who have completed the women-only check.'),
    setup: kind === 'REQUIRED' ? (setup ?? WOMAN_GATE_FALLBACK_SETUP) : WOMAN_GATE_APPEAL_PATH,
  };
}

/** Tells the page, once per refusal. Does nothing on the server, where there is no one to tell. */
export function announceWomanGateRefusal(refusal: WomanGateRefusal): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<WomanGateRefusal>(WOMAN_GATE_REFUSAL_EVENT, { detail: refusal }));
}
