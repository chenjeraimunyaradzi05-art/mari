/**
 * Link previews: the Open Graph card for the first link in a post.
 *
 * Fetched after the post is stored, never before it is answered, so posting
 * is not held up by someone else's server. Only public http(s) hosts are
 * fetched: anything resolving to localhost, a private range or a link-local
 * address is refused, because a post is untrusted input and this server has
 * things on its network that the internet does not.
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { bestEffort } from '../utils/best-effort';
import { fetchPublic, isFetchableHost } from '../utils/outbound-url';

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/i;
const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;

/** The first bare link in the text; mention markup and hashtags never match. */
export function firstLinkIn(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = URL_PATTERN.exec(text);
  return match ? match[0].replace(/[.,;:!?]+$/, '') : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function metaContent(html: string, key: string): string | null {
  // <meta property="og:title" content="..."> in either attribute order.
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return null;
}

/** Pulls the card out of a page. Exported for the tests; no network here. */
export function parseOpenGraph(html: string, url: string): LinkPreview | null {
  const head = html.slice(0, 200_000);
  const title =
    metaContent(head, 'og:title') ??
    metaContent(head, 'twitter:title') ??
    (/<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1] ? decodeEntities(/<title[^>]*>([^<]*)<\/title>/i.exec(head)![1]) : null);
  const description = metaContent(head, 'og:description') ?? metaContent(head, 'twitter:description') ?? metaContent(head, 'description');
  let image = metaContent(head, 'og:image') ?? metaContent(head, 'twitter:image');
  const siteName = metaContent(head, 'og:site_name');

  if (image) {
    try {
      image = new URL(image, url).toString();
      if (!/^https?:/i.test(image)) image = null;
    } catch {
      image = null;
    }
  }

  if (!title && !description && !image) return null;
  return {
    url,
    title: title ? title.slice(0, 200) : null,
    description: description ? description.slice(0, 300) : null,
    image,
    siteName: siteName ? siteName.slice(0, 80) : null,
  };
}

// The page fetch itself (public hosts only, every redirect hop checked) is
// the shared one in utils/outbound-url, so the video pipeline and anything
// else that follows a member's link applies the same rules.
async function fetchPublicPage(start: URL, signal: AbortSignal): Promise<Response | null> {
  return fetchPublic(start, {
    signal,
    maxRedirects: 3,
    headers: {
      'user-agent': 'ATHENA-LinkPreview/1.0 (+https://athena-empress.netlify.app)',
      accept: 'text/html,application/xhtml+xml',
    },
  });
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  if (!(await isFetchableHost(parsed.hostname))) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchPublicPage(parsed, controller.signal);
    if (!response || !response.ok) return null;
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('html')) return null;

    // Read at most MAX_BYTES; the tags we want are in the head.
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
    }
    // Hanging up on the rest of the body is best effort — the card is already
    // read either way — but `.catch(() => {})` meant a cancel that failed took
    // the socket with it in silence, and a link preview runs on every post with
    // a link in it, so a host that reliably refuses the cancel leaks a
    // connection per post with nothing anywhere to point at it. Still not
    // awaited, exactly as before: this function is finished with the response.
    void bestEffort('link-preview.cancel-response-body', () => reader.cancel());
    const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
    return parseOpenGraph(html, response.url || parsed.toString());
  } catch (error) {
    logger.debug('Link preview not fetched', { url, error: error instanceof Error ? error.message : String(error) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Runs after a post is stored; a failure leaves the post without a card. */
export function enrichPostLinkPreview(postId: string, content: string): void {
  const url = firstLinkIn(content);
  if (!url) return;
  fetchLinkPreview(url)
    .then(async (preview) => {
      if (!preview) return;
      await prisma.post.update({
        where: { id: postId },
        data: { linkPreview: preview as unknown as Record<string, string | null> },
      });
    })
    .catch((error) => {
      logger.debug('Link preview not stored', { postId, error: error instanceof Error ? error.message : String(error) });
    });
}
