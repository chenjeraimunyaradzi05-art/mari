'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The Open Graph card for the first link in a post, fetched by the server
 * after posting. Opens the link in a new tab; the whole card is the link.
 */
export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function LinkPreviewCard({ preview, className }: { preview: LinkPreview | null | undefined; className?: string }) {
  if (!preview || (!preview.title && !preview.description && !preview.image)) return null;
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'flex overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600',
        className
      )}
    >
      {preview.image && (
        // eslint-disable-next-line @next/next/no-img-element -- third-party image
        <img src={preview.image} alt="" className="h-24 w-24 flex-shrink-0 object-cover sm:h-28 sm:w-40" loading="lazy" />
      )}
      <div className="min-w-0 flex-1 p-3">
        <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400">
          <ExternalLink className="h-3 w-3" /> {preview.siteName || domainOf(preview.url)}
        </p>
        {preview.title && <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">{preview.title}</p>}
        {preview.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{preview.description}</p>}
      </div>
    </a>
  );
}

export default LinkPreviewCard;
