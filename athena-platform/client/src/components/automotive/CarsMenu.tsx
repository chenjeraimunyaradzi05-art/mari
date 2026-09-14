'use client';

/**
 * The cars superlink: one entry in the header that opens the whole area,
 * on the same menu mechanics as wellness (click, rest, Escape, a click
 * elsewhere, a navigation). The panel is warm on purpose: a soft serif,
 * a blush card, one human sentence, and the two things a visitor most
 * often came for (what a loan costs a month, what her car is worth)
 * linked before she has to look.
 */

import { type MutableRefObject } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Car, ChevronDown, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks';
import { useAreaMenu, type AreaMenuState } from '@/components/wellness/WellnessMenu';
import { AUTO_GROUPS, AUTO_TONES, CARS_DASHBOARD, CARS_HOME, type AutoGroup } from '@/lib/automotive-nav';

const GRADIENT = 'bg-[linear-gradient(135deg,#f59e0b_0%,#f43f5e_55%,#a855f7_100%)]';

export function useCarsMenu(sharedRoot?: MutableRefObject<HTMLElement | null>) {
  return useAreaMenu('cars-menu', sharedRoot);
}

export function CarsTrigger({ menu, active, className }: { menu: AreaMenuState; active?: boolean; className?: string }) {
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
      <Car className="h-4 w-4" />
      <span>Cars</span>
      <ChevronDown aria-hidden className={cn('h-3.5 w-3.5 opacity-70 transition-transform duration-200', menu.open && 'rotate-180')} />
    </button>
  );
}

export function CarsPanel({ menu, className }: { menu: AreaMenuState; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {menu.open && (
        <motion.div
          id={menu.panelId}
          role="region"
          aria-label="Cars"
          {...menu.hoverProps}
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={cn('absolute inset-x-0 top-full z-50 px-3 pb-4 pt-2', className)}
        >
          <CarsMenuPanel onNavigate={() => menu.setOpen(false)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function GroupColumn({ group, onNavigate, signedIn, compact }: { group: AutoGroup; onNavigate?: () => void; signedIn: boolean; compact?: boolean }) {
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
              <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', AUTO_TONES[group.tone])}>
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
export function CarsMenuPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { isAuthenticated } = useAuth();
  return (
    <div className="mx-auto max-w-6xl rounded-3xl border border-rose-100/80 bg-white/95 p-4 shadow-[0_30px_70px_-35px_rgba(245,158,11,0.55)] backdrop-blur-xl sm:p-5 dark:border-white/10 dark:bg-slate-950/95">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,17rem)_1fr]">
        <div className="relative overflow-hidden rounded-2xl bg-[radial-gradient(120%_120%_at_0%_0%,rgba(254,243,199,0.9)_0%,rgba(254,205,211,0.8)_55%,rgba(233,213,255,0.7)_100%)] p-5 dark:bg-[radial-gradient(120%_120%_at_0%_0%,rgba(245,158,11,0.2)_0%,rgba(244,63,94,0.22)_55%,rgba(168,85,247,0.18)_100%)]">
          <p className="font-display text-sm italic text-rose-700 dark:text-rose-300">Cars</p>
          <h3 className="font-display mt-1 text-2xl font-semibold leading-tight text-slate-900 dark:text-white">Bought with the right questions asked.</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">Safety before the badge, running costs before the sticker, a mechanic who explains the bill, and a used car bought with the money held until the keys are in your hand.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={isAuthenticated ? CARS_DASHBOARD : '/cars/new'} onClick={onNavigate} className={cn('focusable inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(244,63,94,0.7)] transition hover:shadow-[0_10px_30px_-8px_rgba(245,158,11,0.7)]', GRADIENT)}>
              {isAuthenticated ? 'Your cars' : 'Browse new cars'} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/cars/value" onClick={onNavigate} className="focusable inline-flex items-center rounded-full border border-white/70 bg-white/60 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15">
              What is mine worth
            </Link>
          </div>
          <div className="mt-5 border-t border-rose-300/40 pt-4 text-xs dark:border-white/10">
            <p className="inline-flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-300"><ShieldCheck className="h-3.5 w-3.5" /> Buyer protection</p>
            <p className="mt-1 leading-5 text-slate-700 dark:text-slate-300">
              On a pre-loved car the money is held by ATHENA for fourteen days after you have it, and released only when you say so.
              {' '}<Link href={CARS_HOME} onClick={onNavigate} className="underline-offset-2 hover:underline">The whole map</Link>.
            </p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {AUTO_GROUPS.map((g) => <GroupColumn key={g.key} group={g} onNavigate={onNavigate} signedIn={isAuthenticated} />)}
        </div>
      </div>
    </div>
  );
}

/** The phone version: the groups stacked, labels only. */
export function CarsMenuList({ onNavigate }: { onNavigate?: () => void }) {
  const { isAuthenticated } = useAuth();
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {AUTO_GROUPS.map((g) => <GroupColumn key={g.key} group={g} onNavigate={onNavigate} signedIn={isAuthenticated} compact />)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={isAuthenticated ? CARS_DASHBOARD : '/cars/new'} onClick={onNavigate} className={cn('focusable inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white', GRADIENT)}>
          {isAuthenticated ? 'Your cars' : 'Browse new cars'} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link href="/cars/value" onClick={onNavigate} className="focusable inline-flex items-center rounded-full border border-rose-200/70 px-4 py-2 text-sm font-medium text-slate-800 dark:border-white/10 dark:text-slate-100">What is mine worth</Link>
      </div>
    </div>
  );
}
