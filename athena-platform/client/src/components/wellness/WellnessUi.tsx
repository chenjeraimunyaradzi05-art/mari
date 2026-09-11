'use client';

/**
 * The parts the wellness pages share: the strip of crisis lines that sits on
 * every mental health page, the five-point scale a check-in is made of, the
 * ring and the week of dots that show progress without a chart, the pill
 * navigation across the wellness area, a fold for a content warning, and a
 * small loader hook.
 *
 * The rules are the same as the money pages: one figure with a sentence
 * under it, warm rather than clinical, and nothing that tracks. These
 * pages send nothing to analytics.
 */

import { ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AxiosResponse } from 'axios';
import { ChevronDown, Loader2, Phone, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { wellnessError, type CrisisLine } from '@/lib/wellness-api';

export const DEFAULT_CRISIS: CrisisLine[] = [
  { key: 'emergency', name: 'Emergency', phone: '000', url: 'https://www.triplezero.gov.au', when: '24/7', who: 'Immediate danger' },
  { key: 'lifeline', name: 'Lifeline', phone: '13 11 14', url: 'https://www.lifeline.org.au', when: '24/7', who: 'Crisis support' },
  { key: 'beyond-blue', name: 'Beyond Blue', phone: '1300 22 4636', url: 'https://www.beyondblue.org.au', when: '24/7', who: 'Anxiety and depression' },
  { key: '13yarn', name: '13YARN', phone: '13 92 76', url: 'https://www.13yarn.org.au', when: '24/7', who: 'Aboriginal and Torres Strait Islander support' },
];

export function CrisisStrip({ lines, compact = false, title = 'If today is hard' }: { lines?: CrisisLine[]; compact?: boolean; title?: string }) {
  const shown = (lines && lines.length ? lines : DEFAULT_CRISIS).slice(0, compact ? 3 : 6);
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/50 dark:bg-rose-900/15" role="note" aria-label="Crisis support lines">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-700 dark:text-rose-300"><Phone className="h-4 w-4" /> {title}</span>
        {shown.map((l) => (
          <a key={l.key} href={`tel:${l.phone.replace(/\s+/g, '')}`} className="text-sm text-slate-700 hover:underline dark:text-slate-200" title={l.who}>
            <span className="font-medium">{l.name}</span> <span className="tabular-nums">{l.phone}</span>
          </a>
        ))}
      </div>
      {!compact && <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">Free, confidential, and staffed now. If someone is in immediate danger, call 000.</p>}
    </div>
  );
}

const NAV: Array<{ href: string; label: string }> = [
  { href: '/dashboard/wellness', label: 'Today' },
  { href: '/dashboard/wellness/track', label: 'Track' },
  { href: '/dashboard/wellness/insights', label: 'Insights' },
  { href: '/dashboard/wellness/habits', label: 'Habits and goals' },
  { href: '/dashboard/wellness/medications', label: 'Medications' },
  { href: '/dashboard/wellness/mental-load', label: 'Mental load' },
  { href: '/dashboard/wellness/forums', label: 'Forums' },
  { href: '/dashboard/wellness/circles', label: 'Circles' },
  { href: '/dashboard/wellness/practitioners', label: 'Find care' },
  { href: '/dashboard/wellness/bookings', label: 'Appointments' },
  { href: '/dashboard/wellness/library', label: 'Library' },
  { href: '/dashboard/wellness/settings', label: 'Privacy' },
];

export function WellnessNav({ current }: { current: string }) {
  return (
    <nav aria-label="Wellness" className="flex flex-wrap gap-2">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition', current === n.href ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-rose-100 hover:text-rose-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-900/30')}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function PageTitle({ icon: Icon, kicker, title, blurb, action }: { icon: LucideIcon; kicker: string; title: string; blurb: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <Icon className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">{kicker}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-slate-500 dark:text-slate-400">{blurb}</p>
      </div>
      {action}
    </div>
  );
}

const SCALE_WORDS: Record<string, string[]> = {
  mood: ['Very low', 'Low', 'Okay', 'Good', 'Great'],
  stress: ['None', 'A little', 'Some', 'A lot', 'Overwhelming'],
  anxiety: ['Calm', 'A little', 'Some', 'A lot', 'Panicky'],
  energy: ['Drained', 'Low', 'Okay', 'Good', 'Full'],
  quality: ['Awful', 'Poor', 'Okay', 'Good', 'Great'],
  pain: ['None', 'Mild', 'Noticeable', 'Bad', 'Severe'],
  severity: ['Mild', 'Noticeable', 'Bad', 'Severe', 'Worst'],
  generic: ['1', '2', '3', '4', '5'],
};

export function Scale({ label, value, onChange, words = 'generic', min = 1 }: { label: string; value: number | null; onChange: (v: number) => void; words?: keyof typeof SCALE_WORDS; min?: number }) {
  const w = SCALE_WORDS[words] ?? SCALE_WORDS.generic;
  const values = min === 0 ? [0, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5];
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{value === null ? 'Tap one' : w[Math.max(0, Math.min(4, (min === 0 ? value - 1 : value - 1)))] ?? value}</span>
      </div>
      <div className="mt-1.5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {values.map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cn('rounded-lg py-2 text-sm font-semibold transition', value === v ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-rose-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-900/30')}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Ring({ pct, label, sub, size = 96, tone = 'rose' }: { pct: number; label: string; sub?: string; size?: number; tone?: 'rose' | 'emerald' | 'amber' | 'sky' }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const colour = { rose: '#f43f5e', emerald: '#10b981', amber: '#f59e0b', sky: '#0ea5e9' }[tone];
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${Math.round(p)} percent`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={8} className="stroke-slate-200 dark:stroke-slate-800" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={8} stroke={colour} strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-slate-900 dark:fill-white" fontSize={size / 5} fontWeight={700}>{Math.round(p)}%</text>
      </svg>
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
        {sub && <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

export function DayDots({ days, onToggle }: { days: Array<{ day: string; done: boolean; future: boolean }>; onToggle?: (day: string) => void }) {
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div className="flex gap-1.5" aria-label="This week">
      {days.map((d, i) => (
        <button key={d.day} type="button" disabled={d.future || !onToggle} onClick={() => onToggle?.(d.day)} title={d.day} className={cn('flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition', d.done ? 'bg-emerald-500 text-white' : d.future ? 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600' : 'bg-slate-100 text-slate-500 hover:bg-rose-100 dark:bg-slate-800 dark:text-slate-400', !onToggle && 'cursor-default')}>
          {letters[i]}
        </button>
      ))}
    </div>
  );
}

export function Chip({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'rose' | 'emerald' | 'amber' | 'sky' }) {
  const tones = { slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' };
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', tones[tone])}>{children}</span>;
}

export function WarningFold({ warning, children }: { warning: string | null | undefined; children: ReactNode }) {
  const [open, setOpen] = useState(!warning);
  if (!warning) return <>{children}</>;
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" aria-expanded={open}>
        Content warning: {warning} <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
      </button>
      {open ? children : <p className="text-sm text-slate-400">Folded. Tap the warning to read.</p>}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
      <p className="font-semibold text-slate-800 dark:text-slate-200">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function InsightCard({ insight }: { insight: { kind: string; title: string; body: string; strength?: string; source?: { name: string; url: string }; action?: { label: string; href: string }; crisis?: boolean } }) {
  const tone = insight.kind === 'risk' ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10' : insight.kind === 'recommendation' ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';
  const external = insight.action?.href.startsWith('http');
  return (
    <article className={cn('rounded-xl border p-4', tone)}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900 dark:text-white">{insight.title}</h3>
        {insight.strength && <Chip tone={insight.strength === 'strong' ? 'rose' : 'slate'}>{insight.strength}</Chip>}
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">{insight.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {insight.source && <a href={insight.source.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 underline-offset-2 hover:underline dark:text-slate-400">Source: {insight.source.name}</a>}
        {insight.action && (external
          ? <a href={insight.action.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-600 dark:text-rose-400">{insight.action.label}</a>
          : <Link href={insight.action.href} className="font-semibold text-rose-600 dark:text-rose-400">{insight.action.label}</Link>)}
      </div>
      {insight.crisis && <div className="mt-3"><CrisisStrip compact /></div>}
    </article>
  );
}

/** Loads once, and again when asked. */
export function useLoad<T>(runner: () => Promise<AxiosResponse>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await runner();
      setData((res.data?.data ?? null) as T | null);
      setError(null);
    } catch (err) {
      setError(wellnessError(err, 'That could not be loaded.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {label}</div>;
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">{error}</div>;
}

export const HealthDisclaimer = () => (
  <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">General information from your own records and published Australian sources. It is not medical advice and not a diagnosis; a GP, psychologist or other registered practitioner can give that.</p>
);

export const fmtDay = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-AU', opts) : '');
export const fmtWhen = (iso: string | Date) => new Date(iso).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
