/**
 * Links a member types in (a workshop's website, a review's video, a
 * report file) are rendered as links on other members' pages, so they
 * must be links a browser can follow safely. `new URL()`, and therefore
 * zod's `.url()`, accepts `javascript:` and `data:` just as happily as
 * `https:`; this is the check that turns them away.
 */

import { z } from 'zod';

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** A trimmed http(s) URL of at most `max` characters, for zod schemas. */
export const httpUrl = (max = 500) =>
  z.string().trim().max(max).url().refine(isHttpUrl, 'Only http and https links are accepted');
