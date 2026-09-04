'use client';

import { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { REACTIONS, type ReactionType } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Reactions with a meaning. A tap toggles the plain like; holding, hovering
 * or pressing the chevron opens the picker for the other four. The summary
 * lists the top reactions with their counts so a post that made people
 * celebrate reads differently from one that made them think.
 */
export type ReactionCounts = Partial<Record<ReactionType, number>>;

export function reactionEmoji(type: ReactionType): string {
  return REACTIONS.find((r) => r.type === type)?.emoji ?? '❤️';
}

export function reactionLabel(type: ReactionType): string {
  return REACTIONS.find((r) => r.type === type)?.label ?? 'Like';
}

export function totalReactions(counts: ReactionCounts | undefined, fallback = 0): number {
  if (!counts) return fallback;
  const sum = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  return sum > 0 ? sum : fallback;
}

/** "🎉 12 · 💡 3", the top three reaction types by count. */
export function ReactionSummary({ counts, fallback = 0, className }: { counts?: ReactionCounts; fallback?: number; className?: string }) {
  const entries = Object.entries(counts ?? {})
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3) as Array<[ReactionType, number]>;
  const total = totalReactions(counts, fallback);
  if (total === 0) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400', className)}>
      {entries.length > 0 ? (
        <span className="inline-flex -space-x-0.5">
          {entries.map(([type]) => (
            <span key={type} title={reactionLabel(type)} className="text-sm leading-none">
              {reactionEmoji(type)}
            </span>
          ))}
        </span>
      ) : (
        <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
      )}
      <span>{total.toLocaleString()}</span>
    </span>
  );
}

interface ReactionButtonProps {
  value: ReactionType | null;
  onChange: (next: ReactionType | null) => void;
  disabled?: boolean;
  /** Compact renders just the icon; the label is for the wide post card. */
  compact?: boolean;
  className?: string;
}

export function ReactionButton({ value, onChange, disabled, compact = false, className }: ReactionButtonProps) {
  const [open, setOpen] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const startHold = () => {
    holdTimer.current = setTimeout(() => setOpen(true), 350);
  };
  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const choose = (type: ReactionType) => {
    setOpen(false);
    onChange(value === type ? null : type);
  };

  const active = value !== null;

  return (
    <div ref={rootRef} className={cn('relative inline-flex items-center', className)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(active ? null : 'LIKE')}
        onMouseEnter={() => setOpen(true)}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
        aria-label={active ? `Remove your ${reactionLabel(value)} reaction` : 'Like'}
        aria-pressed={active}
        className={cn(
          'inline-flex items-center gap-2 rounded-md transition-colors',
          compact ? 'p-0' : 'px-3 py-3 text-sm font-medium',
          active ? 'text-rose-600' : compact ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:bg-slate-100'
        )}
      >
        {active && value !== 'LIKE' ? (
          <span className={cn('leading-none', compact ? 'text-[22px] lg:text-[19px]' : 'text-xl')} aria-hidden>
            {reactionEmoji(value)}
          </span>
        ) : (
          <Heart
            key={String(active)}
            className={cn(
              compact ? 'h-6 w-6 lg:h-5 lg:w-5' : 'h-5 w-5',
              active ? 'fill-rose-500 text-rose-500 animate-heart-pop' : 'hover:opacity-60'
            )}
          />
        )}
        {!compact && <span>{active ? reactionLabel(value) : 'Like'}</span>}
      </button>

      {open && !disabled && (
        <div
          role="menu"
          aria-label="React"
          className="absolute bottom-full left-0 z-20 mb-1 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {REACTIONS.map((reaction) => (
            <button
              key={reaction.type}
              type="button"
              role="menuitem"
              onClick={() => choose(reaction.type)}
              title={reaction.label}
              aria-label={reaction.label}
              className={cn(
                'rounded-full px-1.5 py-0.5 text-xl leading-none transition hover:scale-125',
                value === reaction.type && 'bg-rose-50 dark:bg-rose-900/30'
              )}
            >
              {reaction.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
