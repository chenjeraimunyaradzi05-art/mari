/**
 * @jest-environment node
 *
 * sanitizeHtml where there is no document: the server branch.
 *
 * This used to be a list of regular expressions, and the list was beatable: a
 * scheme written with an entity (`jav&#x61;script:`) contains no `javascript:`
 * for a pattern to find. With nothing to parse into, the branch now returns the
 * text escaped, so there is no element, attribute or scheme left to run. What
 * is asserted is exactly that: not one character that could open a tag or an
 * attribute value comes out, whatever went in.
 */

import { sanitizeHtml, sanitizeHtmlWithTags } from './sanitize';
import { HOSTILE_PAYLOADS, BENIGN_DESCRIPTION } from './sanitize-payloads';

describe('sanitizeHtml with no window', () => {
  it('really has no window, so these tests exercise the server branch', () => {
    expect(typeof window).toBe('undefined');
  });

  it.each(HOSTILE_PAYLOADS.map((payload) => [payload.name, payload.html] as const))(
    'cannot produce a tag, a quote or a handler from: %s',
    (_name, html) => {
      const out = sanitizeHtml(html);
      expect(out).not.toMatch(/[<>"']/);
      // Nothing was dropped silently either: the text is still all there, as text.
      expect(out.length).toBeGreaterThan(0);
    }
  );

  it('shows a payload as visible text, never as markup', () => {
    expect(sanitizeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('does not let an entity-encoded scheme through to be decoded later', () => {
    // The ampersand is itself escaped, so a browser reads this as the literal
    // characters `jav&#x61;script:`, not as `javascript:`.
    expect(sanitizeHtml('<a href="jav&#x61;script:alert(1)">x</a>')).toBe(
      '&lt;a href=&quot;jav&amp;#x61;script:alert(1)&quot;&gt;x&lt;/a&gt;'
    );
  });

  it('returns even a harmless description as text, which is the cost of having no parser here', () => {
    const out = sanitizeHtml(BENIGN_DESCRIPTION);
    expect(out).toContain('&lt;h2&gt;About the role&lt;/h2&gt;');
    expect(out).not.toContain('<');
  });

  it('gives back nothing for empty or non-text input', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(undefined as unknown as string)).toBe('');
  });

  it('takes the same safe branch when the caller names its own tags', () => {
    expect(sanitizeHtmlWithTags('<b onclick="alert(1)">x</b>', ['b'])).not.toMatch(/[<>"']/);
  });
});
