'use client';

/**
 * The wellness superlink: one entry in a header that opens the whole area.
 *
 * A header keeps the menu's state with `useWellnessMenu` and renders two
 * parts wherever they fit: the trigger (in its navigation) and the panel
 * (below the header, full width). Click toggles it; on a device with a
 * real pointer, resting on the trigger opens it after a moment and leaving
 * both trigger and panel closes it; Escape, a click elsewhere and a
 * navigation close it. The phone menu uses the plain list instead.
 *
 * The panel is warm on purpose: a soft serif, a blush card, a human
 * sentence, and the crisis lines in the corner where someone who opened
 * this at 2am will see them first.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronDown, HeartPulse, Lock, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks';
import { WELLNESS_CHECK, WELLNESS_GROUPS, WELLNESS_HOME, WELLNESS_TODAY, WELLNESS_TONES, type WellnessGroup } from '@/lib/wellness-nav';

const GRADIENT = 'bg-[linear-gradient(135deg,#f43f5e_0%,#a855f7_55%,#f59e0b_100%)]';

const hoverCapable = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

export function useWellnessMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const reactId = useId();
  const panelId = `wellness-menu-${reactId.replace(/[^a-zA-Z0-9-]/g, '')}`;
  const rootRef = useRef<HTMLElement | null>(null);
  const timers = useRef<{ open?: number; close?: number }>({});
  const hoverOpenedAt = useRef(0);

  const clear = useCallback(() => {
    window.clearTimeout(timers.current.open);
    window.clearTimeout(timers.current.close);
  }, []);

  // Closes on navigation, and never leaks a timer.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => () => clear(), [clear]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: MouseEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const toggle = useCallback(() => {
    // A tap on a touch screen fires a hover first; do not let the click undo it.
    setOpen((o) => (o && Date.now() - hoverOpenedAt.current < 400 ? true : !o));
  }, []);

  const hoverProps = {
    onMouseEnter: () => {
      if (!hoverCapable()) return;
      clear();
      timers.current.open = window.setTimeout(() => { hoverOpenedAt.current = Date.now(); setOpen(true); }, 120);
    },
    onMouseLeave: () => {
      if (!hoverCapable()) return;
      clear();
      timers.current.close = window.setTimeout(() => setOpen(false), 220);
    },
  };

  return { open, setOpen, toggle, panelId, rootRef, hoverProps };
}

export type WellnessMenuState = ReturnType<typeof useWellnessMenu>;

export function WellnessTrigger({ menu, active, className }: { menu: WellnessMenuState; active?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={menu.toggle}
      aria-expanded={menu.open}
      aria-controls={menu.panelId}
      aria-haspopup="true"
      data-active={active ? 'true' : undefined}
      className={cn('focusable inline-flex items-center gap-1.5 rounded-full transition-colors', className)}
    >
      <HeartPulse className="h-4 w-4" />
      <span>Wellness</span>
      <ChevronDown aria-hidden className={cn('h-3.5 w-3.5 opacity-70 transition-transform duration-200', menu.open && 'rotate-180')} />
    </button>
  );
}

export function WellnessPanel({ menu, className }: { menu: WellnessMenuState; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {menu.open && (
        <motion.div
          id={menu.panelId}
          role="region"
          aria-label="Wellness"
          {...menu.hoverProps}
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={cn('absolute inset-x-0 top-full z-50 px-3 pb-4 pt-2', className)}
        >
          <WellnessMenuPanel onNavigate={() => menu.setOpen(false)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function GroupColumn({ group, onNavigate, signedIn, compact }: { group: WellnessGroup; onNavigate?: () => void; signedIn: boolean; compact?: boolean }) {
  return (
    <div>
      <h4 className="font-display text-[15px] font-semibold text-slate-900 dark:text-white">{group.title}</h4>
      {!compact && <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{group.intro}</p>}
      <ul className={cn('mt-2 space-y-0.5', compact && 'mt-1')}>
        {group.items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className="focusable group flex items-start gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-rose-50/80 dark:hover:bg-white/5"
            >
              <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', WELLNESS_TONES[group.tone])}>
                <item.icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white">
                  {item.label}
                  {item.gated && !signedIn && <Lock aria-label="Sign in first" className="h-3 w-3 text-slate-400" />}
                </span>
                {!compact && <span className="block text-xs leading-5 text-slate-500 dark:text-slate-400">{item.blurb}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The full panel: the invitation on the left, the four groups on the right. */
export function WellnessMenuPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { isAuthenticated } = useAuth();
  return (
    <div className="mx-auto max-w-6xl rounded-3xl border border-rose-100/80 bg-white/95 p-4 shadow-[0_30px_70px_-35px_rgba(168,85,247,0.55)] backdrop-blur-xl sm:p-5 dark:border-white/10 dark:bg-slate-950/95">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,17rem)_1fr]">
        <div className="relative overflow-hidden rounded-2xl bg-[radial-gradient(120%_120%_at_0%_0%,rgba(254,205,211,0.9)_0%,rgba(233,213,255,0.75)_55%,rgba(254,243,199,0.7)_100%)] p-5 dark:bg-[radial-gradient(120%_120%_at_0%_0%,rgba(244,63,94,0.25)_0%,rgba(168,85,247,0.2)_55%,rgba(245,158,11,0.15)_100%)]">
          <p className="font-display text-sm italic text-rose-700 dark:text-rose-300">Health and wellbeing</p>
          <h3 className="font-display mt-1 text-2xl font-semibold leading-tight text-slate-900 dark:text-white">Looked after, on your terms.</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">Track what matters, see what the days are saying, talk to women who get it, and find care that takes you seriously. Encrypted, and read only by you.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={isAuthenticated ? WELLNESS_TODAY : WELLNESS_HOME} onClick={onNavigate} className={cn('focusable inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(168,85,247,0.7)] transition hover:shadow-[0_10px_30px_-8px_rgba(244,63,94,0.7)]', GRADIENT)}>
              {isAuthenticated ? 'Open today' : 'See the whole map'} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href={WELLNESS_CHECK} onClick={onNavigate} className="focusable inline-flex items-center rounded-full border border-white/70 bg-white/60 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15">
              The four-week check
            </Link>
          </div>
          <div className="mt-5 border-t border-rose-300/40 pt-4 text-xs dark:border-white/10">
            <p className="inline-flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-300"><Phone className="h-3.5 w-3.5" /> If today is hard</p>
            <p className="mt-1 leading-5 text-slate-700 dark:text-slate-300">
              Lifeline <a href="tel:131114" className="font-medium tabular-nums hover:underline">13 11 14</a> · Beyond Blue <a href="tel:1300224636" className="font-medium tabular-nums hover:underline">1300 22 4636</a> · in danger, <a href="tel:000" className="font-medium hover:underline">000</a>.
              {' '}<Link href={WELLNESS_HOME} onClick={onNavigate} className="underline-offset-2 hover:underline">All the lines</Link>.
            </p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {WELLNESS_GROUPS.map((g) => <GroupColumn key={g.key} group={g} onNavigate={onNavigate} signedIn={isAuthenticated} />)}
        </div>
      </div>
    </div>
  );
}

/** The phone version: the groups stacked, labels only, with the lines at the top. */
export function WellnessMenuList({ onNavigate }: { onNavigate?: () => void }) {
  const { isAuthenticated } = useAuth();
  return (
    <div>
      <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">
        If today is hard: Lifeline <a href="tel:131114" className="font-medium tabular-nums">13 11 14</a>, Beyond Blue <a href="tel:1300224636" className="font-medium tabular-nums">1300 22 4636</a>.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {WELLNESS_GROUPS.map((g) => <GroupColumn key={g.key} group={g} onNavigate={onNavigate} signedIn={isAuthenticated} compact />)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={isAuthenticated ? WELLNESS_TODAY : WELLNESS_HOME} onClick={onNavigate} className={cn('focusable inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white', GRADIENT)}>
          {isAuthenticated ? 'Open today' : 'See the whole map'} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link href={WELLNESS_CHECK} onClick={onNavigate} className="focusable inline-flex items-center rounded-full border border-rose-200/70 px-4 py-2 text-sm font-medium text-slate-800 dark:border-white/10 dark:text-slate-100">The four-week check</Link>
      </div>
    </div>
  );
}
