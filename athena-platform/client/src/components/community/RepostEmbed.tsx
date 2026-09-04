'use client';

/**
 * The original inside a repost or quote: author, when, the words, the first
 * piece of media. Links through to the post itself. A withdrawn original
 * shows a quiet placeholder rather than nothing.
 */

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Repeat2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { renderSocialText } from '@/lib/social-text';
import { cn } from '@/lib/utils';

export type RepostOriginal = {
  id: string;
  content: string;
  type?: string;
  mediaUrls?: unknown;
  createdAt: string | Date;
  isSensitive?: boolean;
  author?: {
    id: string;
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
    headline?: string | null;
  } | null;
};

export function originalAuthorName(
  author: { displayName?: string | null; firstName?: string | null; lastName?: string | null } | null | undefined
): string {
  return (
    author?.displayName?.trim() ||
    [author?.firstName, author?.lastName].filter(Boolean).join(' ').trim() ||
    'Member'
  );
}

const VIDEO = /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i;

export function RepostEmbed({
  original,
  unavailable,
  className,
}: {
  original?: RepostOriginal | null;
  unavailable?: boolean;
  className?: string;
}) {
  if (!original) {
    if (!unavailable) return null;
    return (
      <div className={cn('rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400', className)}>
        This post is no longer available.
      </div>
    );
  }

  const name = originalAuthorName(original.author);
  const media = Array.isArray(original.mediaUrls) ? (original.mediaUrls as unknown[]).filter((m): m is string => typeof m === 'string') : [];
  const first = media[0];
  const posted = (() => {
    const date = new Date(original.createdAt);
    return Number.isNaN(date.getTime()) ? '' : formatDistanceToNow(date, { addSuffix: true });
  })();

  return (
    <Link
      href={`/posts/${original.id}`}
      className={cn(
        'block rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800',
        className
      )}
      aria-label={`Original post by ${name}`}
    >
      <div className="flex items-center gap-2">
        <Avatar src={original.author?.avatar || undefined} alt={name} fallback={name.slice(0, 2).toUpperCase()} size="xs" />
        <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</span>
        {posted && <span className="text-xs text-slate-400">· {posted}</span>}
      </div>
      {original.content && (
        <p className={cn('mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200', original.isSensitive && 'blur-sm')}>
          {renderSocialText(original.content)}
        </p>
      )}
      {first && (
        <div className="mt-2 overflow-hidden rounded-lg">
          {VIDEO.test(first) || String(original.type).toUpperCase() === 'VIDEO' ? (
            <video src={first} muted playsInline preload="metadata" className={cn('max-h-64 w-full object-cover', original.isSensitive && 'blur-lg')} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={first} alt="" className={cn('max-h-64 w-full object-cover', original.isSensitive && 'blur-lg')} />
          )}
        </div>
      )}
    </Link>
  );
}

/** "Sarah D. reposted" above a plain repost. */
export function RepostedBy({ name, className }: { name: string; className?: string }) {
  return (
    <p className={cn('flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400', className)}>
      <Repeat2 className="h-3.5 w-3.5" /> {name} reposted
    </p>
  );
}
