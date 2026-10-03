/**
 * Shared by the stored-XSS render tests: what to feed a component, and how to
 * tell whether anything in what it drew can run.
 *
 * Every member-written string on the platform (a post, a comment, a bio, a
 * name, a message, a link preview a stranger's web page supplied) is supposed
 * to be drawn as text. A test that renders a component with these strings in
 * every field it reads, and then asks `liveMarkupIn` what is in the DOM, fails
 * the day somebody reaches for dangerouslySetInnerHTML or builds an element
 * from a string.
 */

/** One string carrying every common way into a page. */
export const HOSTILE_TEXT =
  '<img src=x onerror=alert(1)><script>alert(2)</script><svg onload=alert(3)></svg><a href="javascript:alert(4)">click</a><iframe src="https://evil.example"></iframe>';

/** The address forms that must never end up in an href or src. */
export const HOSTILE_URLS = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)'];

// Elements no member's text may ever become. A form and its inputs are left off
// the list on purpose: a page has real ones (the message composer), and what
// they can do is not decided by text. The handlers and addresses below are.
const NEVER_DRAWN = ['script', 'iframe', 'object', 'embed', 'style', 'meta', 'base'];

/**
 * What is live inside this element, as short descriptions; an empty list means
 * nothing is. React never writes a handler as an attribute, so any `on*`
 * attribute in the DOM was put there by injected markup.
 */
export function liveMarkupIn(root: Element): string[] {
  const found: string[] = [];

  root.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (NEVER_DRAWN.includes(tag)) found.push(`<${tag}>`);
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name)) found.push(`${attr.name} on <${tag}>`);
      if (['href', 'src', 'action', 'formaction', 'xlink:href', 'srcdoc'].includes(attr.name.toLowerCase())) {
        const value = attr.value.replace(/[\u0000- ]/g, '');
        if (/^(javascript|vbscript|data):/i.test(value)) found.push(`${attr.name}="${attr.value}" on <${tag}>`);
      }
    }
  });

  return found;
}
