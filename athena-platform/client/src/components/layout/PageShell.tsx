'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The page primitives the homepage is built from, extracted so every other
 * public page can be built from the same parts.
 *
 * Before this, each page hand-rolled its own shell and they drifted apart:
 * `/jobs` sat on `bg-slate-50` with `primary-500` accents, `/learning` and
 * `/communities` used `text-muted-foreground` and a `container mx-auto max-w-5xl`,
 * `/search` centred everything at `max-w-3xl`, and none of them used the
 * `.surface` / `.kicker` / `.rail-title` / `.tile-soft` utilities that give the
 * homepage its look. The result was seven pages that each felt like a different
 * product.
 *
 * The rules encoded here, all taken from the homepage:
 *   - page ground is white / slate-950, never slate-50
 *   - the accent is rose, never `primary-*`
 *   - cards are `.surface`, inset tiles are `.tile-soft`
 *   - an eyebrow is `.kicker`, a section heading is `.rail-title`
 *   - body copy is `text-sm leading-6 text-slate-600 dark:text-slate-400`
 */

/** The warm gradient the homepage hero uses. Kept in one place. */
export const ATHENA_GRADIENT =
  'bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)]';

/**
 * The way back.
 *
 * These pages are reachable straight from a search result or a shared link, so
 * a visitor can land on one with no history to go back through and no header
 * above it. Every page built on PageShell gets this, and it is a real link to
 * `/` rather than `router.back()` — going "back" from a cold landing is either
 * a no-op or sends the reader off the site entirely.
 */
export function BackToHome({ label = 'Back to home', href = '/' }: { label?: string; href?: string }) {
  return (
    <Link
      href={href}
      className="focusable group mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-2 pr-3.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-rose-200 hover:text-rose-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:text-rose-400"
    >
      <span
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full text-white transition-transform group-hover:-translate-x-0.5',
          ATHENA_GRADIENT
        )}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </span>
      {label}
    </Link>
  );
}

export function PageShell({
  children,
  width = 'default',
  backTo,
  showBack = true,
}: {
  children: ReactNode;
  /** `wide` for grid-heavy browse pages, `narrow` for reading pages. */
  width?: 'default' | 'wide' | 'narrow';
  /** Override the destination, e.g. a detail page returning to its own list. */
  backTo?: { href: string; label: string };
  /** Set false only where a surrounding chrome already offers the way back. */
  showBack?: boolean;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
      <div
        className={cn(
          'mx-auto w-full px-4 py-8 sm:px-6 lg:py-10',
          width === 'wide' && 'max-w-7xl',
          width === 'default' && 'max-w-6xl',
          width === 'narrow' && 'max-w-3xl'
        )}
      >
        {showBack && <BackToHome href={backTo?.href} label={backTo?.label} />}
        {children}
      </div>
    </div>
  );
}

/**
 * The hero. One kicker, one sentence of promise, and at most two actions —
 * the homepage's own shape. Three "feature chips" in a row is what made these
 * pages read as brochures, so `facts` is for short, checkable statements only.
 */
export function PageHero({
  kicker,
  title,
  description,
  primaryAction,
  secondaryAction,
  facts,
}: {
  kicker: string;
  title: string;
  description: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  facts?: string[];
}) {
  return (
    <section
      className={cn('overflow-hidden rounded-2xl p-6 text-white sm:p-8', ATHENA_GRADIENT)}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">{kicker}</span>
      <h1 className="mt-3 max-w-2xl text-2xl font-semibold leading-snug sm:text-3xl">{title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-white/90">{description}</p>

      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap gap-2">
          {primaryAction && (
            <Link
              href={primaryAction.href}
              className="focusable rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              {primaryAction.label}
            </Link>
          )}
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="focusable rounded-lg border border-white/50 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}

      {facts && facts.length > 0 && (
        <p className="mt-5 text-xs text-white/80">{facts.join(' · ')}</p>
      )}
    </section>
  );
}

/**
 * A titled card. Matches the homepage rails exactly: icon + heading on the
 * left, one line of explanation under it, an optional "see all" on the right.
 */
export function Section({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('surface p-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-rose-500" />}
            <h2 className="rail-title">{title}</h2>
          </div>
          {description && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
          )}
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400"
          >
            {action.label} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * The empty state.
 *
 * `reason` is the important prop. "Nothing matches those filters" and "nobody
 * has listed one yet" are different problems with different fixes, and showing
 * "try adjusting your filters" to someone who set no filters sends them hunting
 * for listings that are not there. `filtered` keeps the clear-filters path;
 * `empty` asks the reader to be the first, which is the only thing that
 * actually fills an empty marketplace.
 */
export function EmptyState({
  icon: Icon,
  reason,
  title,
  description,
  primaryAction,
  secondaryAction,
  onClear,
}: {
  icon: LucideIcon;
  reason: 'empty' | 'filtered';
  title: string;
  description: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  onClear?: () => void;
}) {
  return (
    <div className="surface px-6 py-12 text-center">
      <Icon className="mx-auto mb-4 h-10 w-10 text-slate-300 dark:text-slate-600" />
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
        {description}
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {reason === 'filtered' && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="focusable rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Clear filters
          </button>
        )}
        {primaryAction && (
          <Link
            href={primaryAction.href}
            className="focusable rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {primaryAction.label}
          </Link>
        )}
        {secondaryAction && (
          <Link
            href={secondaryAction.href}
            className="focusable rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            {secondaryAction.label}
          </Link>
        )}
      </div>
    </div>
  );
}

/** Loading placeholders shaped like the tiles they replace. */
export function TileSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className={cn(
            'h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800',
            className
          )}
        />
      ))}
    </>
  );
}

/** A filter pill. The homepage's topic circles use the same rose-filled state. */
export function FilterPill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'focusable rounded-full px-3 py-1.5 text-sm font-medium transition',
        active
          ? 'bg-rose-600 text-white'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
      )}
    >
      {children}
    </button>
  );
}
