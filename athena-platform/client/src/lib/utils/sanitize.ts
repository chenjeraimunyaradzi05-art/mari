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

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'id'];

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
  
  // Server-side fallback: use regex-based sanitization
  return html
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove on* event handlers
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '')
    // Remove javascript: URLs
    .replace(/javascript\s*:/gi, 'blocked:')
    // Remove data: URLs (can be used for XSS)
    .replace(/data\s*:/gi, 'blocked:')
    // Remove vbscript: URLs
    .replace(/vbscript\s*:/gi, 'blocked:')
    // Remove dangerous tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<iframe\b[^>]*\/?>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/<input\b[^>]*\/?>/gi, '')
    .replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, '');
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
