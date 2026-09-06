'use client';

/**
 * What the home rails share: a glass panel with a gradient edge, a header
 * with a coloured icon disc, a warm title, one line of context and a pill
 * to see the rest, and a staggered rise for the cards inside.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Tone = 'rose' | 'violet' | 'amber' | 'emerald' | 'sky';

const DISC: Record<Tone, string> = {
  rose: 'from-rose-500 to-pink-500 shadow-[0_8px_20px_-8px_rgba(244,63,94,0.8)]',
  violet: 'from-violet-500 to-indigo-500 shadow-[0_8px_20px_-8px_rgba(139,92,246,0.8)]',
  amber: 'from-amber-400 to-orange-500 shadow-[0_8px_20px_-8px_rgba(245,158,11,0.8)]',
  emerald: 'from-emerald-400 to-teal-500 shadow-[0_8px_20px_-8px_rgba(16,185,129,0.8)]',
  sky: 'from-sky-400 to-cyan-500 shadow-[0_8px_20px_-8px_rgba(14,165,233,0.8)]',
};

export const TILE_GRADIENTS = ['from-rose-500 to-pink-500', 'from-violet-500 to-indigo-500', 'from-amber-400 to-orange-500', 'from-emerald-400 to-teal-500', 'from-sky-400 to-cyan-500', 'from-fuchsia-500 to-purple-600'];

export function IconDisc({ icon: Icon, tone, className }: { icon: LucideIcon; tone: Tone; className?: string }) {
  return (
    <span className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white', DISC[tone], className)}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

export function RailCta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="focusable group inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-rose-200/80 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-rose-300 hover:bg-rose-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10">
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function RailHeader({ icon, tone, kicker, title, description, cta, titleId }: { icon: LucideIcon; tone: Tone; kicker: string; title: string; description?: ReactNode; cta?: { href: string; label: string }; titleId?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <IconDisc icon={icon} tone={tone} />
        <div className="min-w-0">
          <span className="kicker">{kicker}</span>
          <h2 id={titleId} className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>}
        </div>
      </div>
      {cta && <RailCta href={cta.href}>{cta.label}</RailCta>}
    </div>
  );
}

export function Rail({ children, className, ...header }: { children: ReactNode; className?: string } & Parameters<typeof RailHeader>[0]) {
  return (
    <section aria-labelledby={header.titleId} className={cn('glow-card rail-panel p-5 sm:p-6', className)}>
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
        <li key={i} aria-hidden className={cn('animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/80', height)} />
      ))}
    </>
  );
}
