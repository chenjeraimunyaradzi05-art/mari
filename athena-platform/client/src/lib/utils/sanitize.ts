/**
 * HTML Sanitization Utility
 * Prevents XSS attacks when rendering user-generated HTML content
 * Uses DOMPurify for production-grade sanitization
 */

import DOMPurify from 'dompurify';

// DOMPurify configuration for safe HTML
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'span', 'div',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
  ALLOW_DATA_ATTR: false,
  // Force all links to open in new tab with security attributes
  ADD_ATTR: ['target', 'rel'] as string[],
};

/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses DOMPurify for comprehensive protection against XSS vectors
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // Browser: use DOMPurify directly
    const clean = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
    
    // Post-process to ensure all links have proper security attributes
    return clean.replace(/<a\s+([^>]*)>/gi, (match, attrs) => {
      let cleanAttrs = attrs || '';
      // Ensure target="_blank" for external links
      if (!cleanAttrs.includes('target=')) {
        cleanAttrs += ' target="_blank"';
      }
      // Ensure rel="noopener noreferrer"
      if (!cleanAttrs.includes('rel=')) {
        cleanAttrs += ' rel="noopener noreferrer"';
      } else {
        cleanAttrs = cleanAttrs.replace(/rel=["'][^"']*["']/i, 'rel="noopener noreferrer"');
      }
      return `<a ${cleanAttrs.trim()}>`;
    });
  }
  
  // Server-side: use regex fallback (for SSR)
  return serverSideSanitize(html);
}

/**
 * Server-side sanitization fallback for SSR environments
 * Uses regex-based approach when DOMPurify's DOM dependency isn't available
 */
function serverSideSanitize(html: string): string {
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
    // Sanitize anchor tags
    .replace(/<a\s+([^>]*)\s*>/gi, (match, attrs) => {
      const cleanAttrs = (attrs || '')
        .replace(/target\s*=\s*["']?_(?:top|parent)["']?/gi, 'target="_blank"')
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
