'use client';

import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSeeFewerFrom } from '@/lib/social-hooks';

/**
 * "Why this?": the plain-words reasons the feed put a post in front of you,
 * and one control that changes the feed ("See fewer posts from X"). The
 * reasons come from the ranking itself, so they are true rather than decor.
 */
interface WhyThisProps {
  reasons?: string[];
  authorId: string;
  authorName: string;
  isOwn?: boolean;
  onHidden?: () => void;
  className?: string;
}

export function WhyThis({ reasons, authorId, authorName, isOwn, onHidden, className }: WhyThisProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const seeFewer = useSeeFewerFrom();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (!reasons || reasons.length === 0) return null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Why am I seeing this post?"
        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        <Info className="h-3 w-3" />
        <span>{reasons[0]}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <p className="font-semibold text-slate-900 dark:text-white">Why this is in your feed</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-600 dark:text-slate-300">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {!isOwn && (
            <button
              type="button"
              disabled={seeFewer.isPending}
              onClick={() =>
                seeFewer.mutate(authorId, {
                  onSuccess: () => {
                    setOpen(false);
                    onHidden?.();
                  },
                })
              }
              className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              See fewer posts from {authorName}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default WhyThis;
