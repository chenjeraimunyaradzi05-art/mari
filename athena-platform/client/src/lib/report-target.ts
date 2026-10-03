/**
 * Working out what a woman means when she pastes into the report form.
 *
 * The form asks for "the URL or ID of the content", and until now sent the raw
 * string as the id. The server finds the member behind a report by looking the
 * id up, so a pasted link came back "We could not find the content", and the
 * woman who had gone to the trouble of copying it was left to guess that she
 * should have copied only the last part. A report that cannot be filed because
 * of how it was pasted is a report that was not made.
 *
 * The link shapes are the ones the site itself produces: the ones notifications
 * and shares carry (server utils/social-notifications.ts socialLinks) and the
 * addresses the same pages answer at.
 */

/** What the public report form can file, as the server's report route names them. */
export type ReportContentType = 'post' | 'video' | 'comment' | 'profile' | 'job' | 'event' | 'housing_listing';

export const REPORT_CONTENT_TYPES: ReadonlyArray<{ value: ReportContentType; label: string }> = [
  { value: 'post', label: 'Post or article' },
  { value: 'video', label: 'Reel' },
  { value: 'profile', label: 'Member profile' },
  { value: 'comment', label: 'Comment' },
  { value: 'job', label: 'Job listing' },
  { value: 'event', label: 'Event' },
  { value: 'housing_listing', label: 'Housing listing' },
];

const KNOWN_TYPES = new Set<string>(REPORT_CONTENT_TYPES.map((type) => type.value));

/** A type from a link or a query string, or null when it is not one the form files. */
export function asReportContentType(value: string | null | undefined): ReportContentType | null {
  const normalised = (value ?? '').trim().toLowerCase();
  return KNOWN_TYPES.has(normalised) ? (normalised as ReportContentType) : null;
}

/**
 * Every id on the platform is a UUID or something shorter that is made of the
 * same characters; the server refuses anything over a hundred.
 */
const ID_SHAPE = /^[A-Za-z0-9_-]{1,100}$/;

/** [path pattern, what it is]. The first capture group is the id. */
const PATH_SHAPES: ReadonlyArray<[RegExp, ReportContentType]> = [
  [/^\/posts\/([^/]+)$/i, 'post'],
  // The old share address, which only forwards to /posts/:id.
  [/^\/dashboard\/community\/post\/([^/]+)$/i, 'post'],
  [/^\/explore\/video\/([^/]+)$/i, 'video'],
  // The address the phone app puts on a shared reel.
  [/^\/videos\/([^/]+)$/i, 'video'],
  [/^\/profile\/([^/]+)$/i, 'profile'],
  [/^\/dashboard\/profile\/([^/]+)$/i, 'profile'],
  [/^\/jobs\/([^/]+)$/i, 'job'],
  [/^\/dashboard\/jobs\/([^/]+)$/i, 'job'],
];

export type ReportTargetResult =
  | {
      ok: true;
      contentType: ReportContentType;
      contentId: string;
      /** True when the type came from the link rather than from the list she chose from. */
      fromLink: boolean;
    }
  | { ok: false; message: string };

/** Looks like something with a scheme or a path rather than a bare id. */
function looksLikeAddress(text: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text) || text.startsWith('/') || /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(text);
}

function pathAndQueryOf(text: string): { path: string; query: URLSearchParams } | null {
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
    const url = new URL(hasScheme ? text : text.startsWith('/') ? `https://athena.invalid${text}` : `https://${text}`);
    return { path: url.pathname.replace(/\/+$/, '') || '/', query: url.searchParams };
  } catch {
    return null;
  }
}

const COULD_NOT_TELL =
  'We could not tell what that link is to. Open the post, reel, profile or listing itself and copy the address from the top of the browser, or choose what it is from the list and paste its ID.';

/**
 * What to file, from what she pasted and the type she chose.
 *
 * A link says what it is to, and the link wins over the list: someone who left
 * the list on "Post" and pasted the address of a reel meant the reel. A bare id
 * is taken to be of the type she chose.
 */
export function resolveReportTarget(raw: string, chosenType: ReportContentType): ReportTargetResult {
  const text = raw.trim();
  if (!text) return { ok: false, message: 'Paste the link to what you are reporting, or its ID.' };

  if (!looksLikeAddress(text)) {
    if (!ID_SHAPE.test(text)) {
      return { ok: false, message: 'That does not look like an ID. Paste the link to what you are reporting instead.' };
    }
    return { ok: true, contentType: chosenType, contentId: text, fromLink: false };
  }

  const parsed = pathAndQueryOf(text);
  if (!parsed) return { ok: false, message: COULD_NOT_TELL };

  // A reel opens on the explore page, whichever tab or topic she was on.
  if (parsed.path === '/explore') {
    const id = parsed.query.get('video');
    if (id && ID_SHAPE.test(id)) return { ok: true, contentType: 'video', contentId: id, fromLink: true };
    return { ok: false, message: COULD_NOT_TELL };
  }

  // An event has no page of its own: the link its share button copies is the
  // events list with the event named in the query, as a reel's is.
  if (parsed.path === '/events' || parsed.path === '/dashboard/events') {
    const id = parsed.query.get('event');
    if (id && ID_SHAPE.test(id)) return { ok: true, contentType: 'event', contentId: id, fromLink: true };
    return { ok: false, message: COULD_NOT_TELL };
  }

  for (const [pattern, contentType] of PATH_SHAPES) {
    const id = parsed.path.match(pattern)?.[1];
    if (!id) continue;
    let decoded = id;
    try {
      decoded = decodeURIComponent(id);
    } catch {
      return { ok: false, message: COULD_NOT_TELL };
    }
    if (ID_SHAPE.test(decoded)) return { ok: true, contentType, contentId: decoded, fromLink: true };
  }

  // A conversation's address is not a message's. Say so rather than send the
  // conversation's id to be looked up as one.
  if (/^\/dashboard\/messages(\/|$)/i.test(parsed.path)) {
    return {
      ok: false,
      message:
        'That is a link to a conversation. To report a message, open the conversation and choose Report on the message itself. That keeps a copy of what was said.',
    };
  }

  return { ok: false, message: COULD_NOT_TELL };
}
