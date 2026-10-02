/**
 * sanitizeHtml, in a browser (jsdom here): nothing that runs may survive.
 *
 * The same payloads are run through the server branch, where there is no
 * document, in sanitize.server.test.ts. Both read the corpus from
 * sanitize-payloads.ts so that a payload added for one is tried on the other.
 *
 * Parsed with DOMParser rather than matched with a pattern, which is the point:
 * what matters is whether the result contains an element or an attribute that
 * runs, not whether the string looks safe.
 */

import { sanitizeHtml, sanitizeHtmlWithTags } from './sanitize';
import { HOSTILE_PAYLOADS, BENIGN_DESCRIPTION } from './sanitize-payloads';

function parse(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

const EXECUTABLE_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'style', 'svg', 'math', 'img', 'link', 'meta', 'base'];

function liveThings(html: string): string[] {
  const doc = parse(html);
  const found: string[] = [];
  doc.body.querySelectorAll('*').forEach((el) => {
    if (EXECUTABLE_TAGS.includes(el.tagName.toLowerCase())) found.push(`<${el.tagName.toLowerCase()}>`);
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name)) found.push(`${attr.name} on <${el.tagName.toLowerCase()}>`);
      if (['style', 'srcdoc', 'formaction', 'class', 'id'].includes(attr.name.toLowerCase())) {
        found.push(`${attr.name} on <${el.tagName.toLowerCase()}>`);
      }
    }
  });
  doc.body.querySelectorAll('[href], [src], [action], [xlink\\:href]').forEach((el) => {
    for (const name of ['href', 'src', 'action', 'xlink:href']) {
      const value = el.getAttribute(name);
      // Decoded by the parser, so an entity-encoded scheme is read as the browser would read it.
      if (value && /^\s*(javascript|data|vbscript):/i.test(value.replace(/[\u0000- ]/g, ''))) {
        found.push(`${name}="${value}"`);
      }
    }
  });
  return found;
}

describe('sanitizeHtml in a browser', () => {
  it('is running where there is a window, so these tests exercise DOMPurify', () => {
    expect(typeof window).toBe('object');
  });

  it.each(HOSTILE_PAYLOADS.map((payload) => [payload.name, payload.html] as const))(
    'leaves nothing live of: %s',
    (_name, html) => {
      expect(liveThings(sanitizeHtml(html))).toEqual([]);
    }
  );

  it('keeps what a job description is made of', () => {
    const out = sanitizeHtml(BENIGN_DESCRIPTION);
    const doc = parse(out);
    expect(doc.querySelector('h2')?.textContent).toBe('About the role');
    expect(doc.querySelector('strong')?.textContent).toBe('mentoring');
    expect(doc.querySelectorAll('li')).toHaveLength(2);
    expect(doc.querySelector('a')?.getAttribute('href')).toBe('https://example.org/apply');
  });

  it('draws nothing over the page: no class, no id, no inline style survives', () => {
    const out = sanitizeHtml('<div class="fixed inset-0 z-50 bg-white" id="x" style="position:fixed">Sign in again <a href="https://evil.example">here</a></div>');
    const div = parse(out).querySelector('div');
    expect(div).not.toBeNull();
    expect(div!.getAttributeNames()).toEqual([]);
  });

  it('gives back nothing for empty or non-text input', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(undefined as unknown as string)).toBe('');
    expect(sanitizeHtml(42 as unknown as string)).toBe('');
  });

  it('applies the same checks when the caller names its own tags', () => {
    const out = sanitizeHtmlWithTags('<b onclick="alert(1)">bold</b><script>alert(2)</script>', ['b']);
    expect(liveThings(out)).toEqual([]);
    expect(out).toContain('bold');
  });
});
