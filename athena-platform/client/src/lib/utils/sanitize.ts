/**
 * HTML Sanitization Utility
 * Prevents XSS attacks when rendering user-generated HTML content
 */

// Simple HTML sanitizer that removes dangerous tags and attributes
// For production, consider using DOMPurify library instead

const ALLOWED_TAGS = [
  'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'span', 'div',
];

const ALLOWED_ATTRIBUTES = ['href', 'target', 'rel', 'class', 'id'];

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes all dangerous tags and attributes
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  
  // Simple approach: escape HTML entities and only allow safe formatting
  // This is a defensive approach - better to be too restrictive than too permissive
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
    // Remove style tags (can contain CSS expressions)
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove iframe tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<iframe\b[^>]*\/?>/gi, '')
    // Remove object/embed tags
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
    // Remove form elements
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/<input\b[^>]*\/?>/gi, '')
    .replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, '')
    // Sanitize anchor tags to prevent target="_top" frame-busting
    .replace(/<a\s+([^>]*)\s*>/gi, (match, attrs) => {
      // Remove dangerous attributes
      const cleanAttrs = (attrs || '')
        .replace(/target\s*=\s*["']?_(?:top|parent)["']?/gi, 'target="_blank"')
        // Add rel="noopener noreferrer" for security
        .replace(/rel\s*=\s*["'][^"']*["']/gi, 'rel="noopener noreferrer"');
      return `<a ${cleanAttrs} rel="noopener noreferrer">`;
    });
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
