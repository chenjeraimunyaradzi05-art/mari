/**
 * HTML Sanitization Utility
 * Prevents XSS attacks when rendering user-generated HTML content
 * Uses DOMPurify for production-grade sanitization
 */

import DOMPurify from 'dompurify';

// Configure DOMPurify with safe defaults
const ALLOWED_TAGS = [
  'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'span', 'div',
];

// No `class` and no `id`. This renders text an employer wrote, inside a page
// whose stylesheet is Tailwind, so a class is not decoration, it is a way to
// lay an element of the author's choosing over the whole page (`fixed inset-0
// z-50` with a link in it is a phishing screen drawn by ATHENA itself), and an
// id names a target for the page's own scripts to trip over. The tags above
// carry all the structure a job description needs.
const ALLOWED_ATTR = ['href', 'target', 'rel'];

/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses DOMPurify with strict configuration
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      ADD_ATTR: ['target'], // Allow target attribute
      FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    });
  }
  
  // No document, so no DOMPurify (it needs one to parse into). What stood here
  // was a list of regular expressions, and a pattern list is not a sanitiser:
  // `jav&#x61;script:` has no `javascript:` in it for the pattern to find, and
  // the browser decodes the entity to one. With nothing to parse the text
  // safely, the safe answer is not to try: the markup is returned as plain text,
  // every angle bracket and quote escaped, so nothing in it can become an
  // element or a handler. The one caller is a client component that renders
  // after its data arrives, so the server never has a description to show here;
  // if one ever does, it appears as visible text for a moment and is sanitised
  // properly as soon as the page is in a browser.
  return escapeHtml(html);
}

/**
 * Sanitize HTML with custom allowed tags
 */
export function sanitizeHtmlWithTags(html: string, allowedTags: string[]): string {
  if (!html || typeof html !== 'string') return '';
  
  if (typeof window !== 'undefined') {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
    });
  }
  
  // Fallback to basic sanitization on server
  return sanitizeHtml(html);
}

/**
 * Escape HTML entities (for when you want plain text, not HTML)
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Convert plain text to HTML with safe line breaks
 */
export function textToHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return escapeHtml(text)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}
