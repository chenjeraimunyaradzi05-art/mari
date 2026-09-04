import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Renders a post caption with its hashtags and links made live.
 *
 * Hashtags open a search for the tag, which is where every other surface
 * sends topic clicks, so "#salary" behaves the same in a post, a comment and
 * a reel caption. Bare URLs become links that open in a new tab. Everything
 * else is left exactly as typed; nothing here interprets markdown.
 */

// One alternation so the pieces come back in document order. Hashtags allow
// letters and digits from any script, which is what the community page's
// trending-topic extractor accepts too.
const TOKEN = /(#[\p{L}\p{N}_]{2,64}|https?:\/\/[^\s<>"')\]]+)/gu;

export function hashtagHref(tag: string): string {
  return `/search?q=${encodeURIComponent(tag.startsWith('#') ? tag : `#${tag}`)}`;
}

export function renderSocialText(text: string, linkClassName = 'font-medium text-rose-600 hover:underline dark:text-rose-400'): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(TOKEN)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));

    if (token.startsWith('#')) {
      nodes.push(
        <Link key={key++} href={hashtagHref(token)} className={linkClassName} onClick={(e) => e.stopPropagation()}>
          {token}
        </Link>
      );
    } else {
      nodes.push(
        <a
          key={key++}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
          onClick={(e) => e.stopPropagation()}
        >
          {token}
        </a>
      );
    }
    last = start + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Turns a display name into an @handle: "Mei Chen" -> "meichen". */
export function handleFromName(name: string | null | undefined): string {
  const slug = (name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
  return slug || 'member';
}
