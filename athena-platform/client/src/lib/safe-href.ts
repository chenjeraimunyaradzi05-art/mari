/**
 * A link the page may render from data someone else typed in: a workshop's
 * website, a review's video, a report file. Only http and https (and
 * relative paths on this site) come through; `javascript:` and `data:`
 * are dropped, so a value saved to one member's profile can never run in
 * another member's browser. The server refuses those schemes on the way
 * in as well; this is the second lock on the same door.
 */
export function safeHref(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed, 'https://athena.invalid');
    if (url.protocol === 'http:' || url.protocol === 'https:') return trimmed;
  } catch {
    // Not a URL at all.
  }
  return undefined;
}
