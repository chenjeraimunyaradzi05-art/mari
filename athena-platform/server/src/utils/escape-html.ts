/**
 * Escapes the five characters that let text become markup.
 *
 * Its own module, with no imports, because it is needed wherever an email is
 * built from something a member or a provider wrote, and those files (the
 * safety alert, the notification fallback, the breach notices) must not have to
 * load the whole mail sender, with its provider client and its suppression
 * list, to get at it. services/email.service re-exports it for the callers that
 * already import it from there.
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
