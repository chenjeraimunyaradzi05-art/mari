/**
 * What a failed request means, in words a member can act on.
 *
 * Every screen in this app used to read `error?.response?.data?.message` off
 * an `any`, each in its own slightly different way, and the pillar screens
 * that replaced the "opens on the web" placeholders would have added fifteen
 * more copies. These are that reading, done once and typed: the server's own
 * sentence when it sent one (the API normalises every error body so the
 * reason is always under `message`), and otherwise a sentence that says the
 * request did not get through, never one that says the thing asked for does
 * not exist.
 */

type ErrorShape = {
  response?: { status?: number; data?: { message?: unknown; error?: unknown; code?: unknown } };
  message?: unknown;
};

function shape(error: unknown): ErrorShape {
  return error && typeof error === 'object' ? (error as ErrorShape) : {};
}

/** The HTTP status of a failed request, or null when no answer came back at all. */
export function errorStatus(error: unknown): number | null {
  const status = shape(error).response?.status;
  return typeof status === 'number' ? status : null;
}

/** True only when the server answered 404: the thing really is not there. */
export function isNotFound(error: unknown): boolean {
  return errorStatus(error) === 404;
}

/**
 * The server's own reason when it gave one, otherwise the fallback.
 *
 * `error` is read as well as `message` for the routes that still answer
 * `{ error }` inline; the server's normaliser copies one into the other, but a
 * reply that came from something in front of the API (a proxy, a gateway) has
 * not been through it.
 */
export function apiMessage(error: unknown, fallback: string): string {
  const data = shape(error).response?.data;
  for (const candidate of [data?.message, data?.error]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      const sentence = candidate.trim();
      // A member turned away because she has not completed the women-only check
      // is told where it is finished: the check is done on the website, and the
      // refusal's own pointer is a page of the website, which a phone cannot
      // open from an error line. A refused member's sentence already says to
      // appeal from Settings, so it is left as it is.
      return womanGateCode(error) === 'WOMAN_VERIFICATION_REQUIRED' && !/website/i.test(sentence)
        ? `${sentence} You can finish the check from Settings on the ATHENA website.`
        : sentence;
    }
  }
  return fallback;
}

/**
 * The code the server sends when it turns a member away on the women-only
 * check (middleware/account-gates.ts): WOMAN_VERIFICATION_REQUIRED, which she
 * can fix, or WOMAN_VERIFICATION_REJECTED, which is a reviewer's decision and
 * is appealed. Null for any other refusal, and for a status that is not 403.
 */
export function womanGateCode(error: unknown): 'WOMAN_VERIFICATION_REQUIRED' | 'WOMAN_VERIFICATION_REJECTED' | null {
  const response = shape(error).response;
  if (response?.status !== 403) return null;
  const code = response?.data?.code;
  return code === 'WOMAN_VERIFICATION_REQUIRED' || code === 'WOMAN_VERIFICATION_REJECTED' ? code : null;
}

/**
 * The line a screen shows when a load failed. `what` is the thing that could
 * not be loaded, as a sentence subject: "Your savings goals", "This car".
 */
export function loadFailure(error: unknown, what: string): string {
  return apiMessage(error, `${what} could not be loaded. Check your connection and try again.`);
}
