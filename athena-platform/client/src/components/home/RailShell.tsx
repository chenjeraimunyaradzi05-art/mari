'use client';

/**
 * What the home rails share: a soft glass panel with a blush edge, a header
 * with a coloured disc, an italic eyebrow in the display face, a warm serif
 * title with a small flourish beneath it, one gentle line of context, and a
 * pill to see the rest. Cards rise in one after another as a rail scrolls
 * into view.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Tone = 'rose' | 'violet' | 'amber' | 'emerald' | 'sky';

const DISC: Record<Tone, string> = {
  rose: 'from-rose-400 to-pink-500 shadow-[0_10px_24px_-10px_rgba(244,63,94,0.7)]',
  violet: 'from-violet-400 to-fuchsia-500 shadow-[0_10px_24px_-10px_rgba(168,85,247,0.7)]',
  amber: 'from-amber-300 to-rose-400 shadow-[0_10px_24px_-10px_rgba(251,146,60,0.7)]',
  emerald: 'from-emerald-300 to-teal-400 shadow-[0_10px_24px_-10px_rgba(20,184,166,0.6)]',
  sky: 'from-sky-300 to-violet-400 shadow-[0_10px_24px_-10px_rgba(139,92,246,0.6)]',
};

const EYEBROW: Record<Tone, string> = {
  rose: 'text-rose-500 dark:text-rose-300',
  violet: 'text-violet-500 dark:text-violet-300',
  amber: 'text-amber-600 dark:text-amber-300',
  emerald: 'text-emerald-600 dark:text-emerald-300',
  sky: 'text-sky-600 dark:text-sky-300',
};

/** Soft, warm gradients for initials and marks. */
export const TILE_GRADIENTS = ['from-rose-400 to-pink-500', 'from-violet-400 to-fuchsia-500', 'from-amber-300 to-rose-400', 'from-emerald-300 to-teal-400', 'from-sky-300 to-violet-400', 'from-fuchsia-400 to-purple-500'];

export function IconDisc({ icon: Icon, tone, className }: { icon: LucideIcon; tone: Tone; className?: string }) {
  return (
    <span className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white', DISC[tone], className)}>
      <Icon className="h-5 w-5" strokeWidth={1.75} />
    </span>
  );
}

/** The small round "go" button on a card: blush, turning warmer on hover. */
export function GoButton({ className }: { className?: string }) {
  return (
    <span className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500 transition-colors group-hover:bg-rose-500 group-hover:text-white dark:bg-rose-500/15 dark:text-rose-200 dark:group-hover:bg-rose-400 dark:group-hover:text-slate-950', className)}>
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </span>
  );
}

export function RailCta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="focusable group inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25">
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function RailHeader({ icon, tone, kicker, title, description, cta, titleId }: { icon: LucideIcon; tone: Tone; kicker: string; title: string; description?: ReactNode; cta?: { href: string; label: string }; titleId?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3.5">
        <IconDisc icon={icon} tone={tone} />
        <div className="min-w-0">
          <span className={cn('eyebrow-soft', EYEBROW[tone])}>{kicker}</span>
          <h2 id={titleId} className="title-flourish mt-0.5 font-display text-2xl font-medium leading-tight tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          {description && <p className="mt-2.5 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>}
        </div>
      </div>
      {cta && <RailCta href={cta.href}>{cta.label}</RailCta>}
    </div>
  );
}

export function Rail({ children, className, ...header }: { children: ReactNode; className?: string } & Parameters<typeof RailHeader>[0]) {
  return (
    <section aria-labelledby={header.titleId} className={cn('rail-panel glow-card p-5 sm:p-6', className)}>
      <RailHeader {...header} />
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** A list whose items rise in one after another, once, as it scrolls into view. */
export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <ul className={className}>{children}</ul>;
  return (
    <motion.ul className={className} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-30px' }} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}>
      {children}
    </motion.ul>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <li className={className}>{children}</li>;
  return (
    <motion.li className={className} variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } }}>
      {children}
    </motion.li>
  );
}

export function SkeletonTiles({ count, height }: { count: number; height: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} aria-hidden className={cn('animate-pulse rounded-2xl bg-rose-50/80 dark:bg-slate-800/70', height)} />
      ))}
    </>
  );
}
