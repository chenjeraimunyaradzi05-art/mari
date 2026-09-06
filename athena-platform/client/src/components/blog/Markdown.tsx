'use client';

/**
 * Markdown, rendered for reading.
 *
 * Articles are stored as Markdown and turned into HTML here, then passed
 * through DOMPurify with an allow-list that admits what an article needs
 * (headings, lists, links, images, tables, code) and nothing that runs.
 * Raw HTML in the source is not rendered at all.
 */

import { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

// Outside links open in a new tab without handing over the opener.
const renderLink = md.renderer.rules.link_open || ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet('href') || '';
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  return renderLink(tokens, idx, options, env, self);
};

const ALLOWED_TAGS = ['p', 'br', 'b', 'i', 'u', 's', 'del', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'span', 'div', 'img', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sup', 'sub', 'figure', 'figcaption'];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'id', 'src', 'alt', 'title', 'width', 'height', 'loading', 'start'];

export function renderMarkdown(source: string): string {
  const html = md.render(source || '');
  if (typeof window === 'undefined') return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  });
}

export default function Markdown({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(source), [source]);
  return <div className={cn('prose prose-slate max-w-none dark:prose-invert prose-a:text-primary-600 prose-img:rounded-xl', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
