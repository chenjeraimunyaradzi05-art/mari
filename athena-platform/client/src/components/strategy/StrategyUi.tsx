'use client';

/**
 * The parts the four strategy pages are built from: fields, result panels,
 * two small charts, a debounced calculator hook, and the bar that saves a
 * plan and brings it back next visit.
 *
 * The pages ask for numbers and answer with numbers, which is exactly the
 * kind of screen that turns into a spreadsheet. These parts keep each answer
 * to one figure with a sentence under it, and put the working behind a
 * "how this was worked out" fold.
 */

import { ReactNode, useEffect, useRef, useState } from 'react';
import type { AxiosResponse } from 'axios';
import toast from 'react-hot-toast';
import { ChevronDown, Loader2, Save, Trash2, type LucideIcon } from 'lucide-react';
import { strategyApi, apiMessage, type StrategyArea } from '@/lib/strategy-api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

export const inputClass = 'w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm text-slate-900 dark:text-white';

export const aud = (n: number | null | undefined) => formatCurrency(Number(n) || 0, 'AUD', 'en-AU');
export const pct = (n: number | null | undefined, digits = 0) => `${(Number(n) || 0).toFixed(digits)}%`;

// ------------------------------------------------------------- fields

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  );
}

export function NumberInput({ value, onChange, placeholder, prefix, suffix, min, max, step }: { value: string; onChange: (v: string) => void; placeholder?: string; prefix?: string; suffix?: string; min?: number; max?: number; step?: number }) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, prefix && 'pl-7', suffix && 'pr-10')}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{suffix}</span>}
    </div>
  );
}

export function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-500 focus:ring-rose-400" />
      <span>
        {label}
        {hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}

// ------------------------------------------------------------- panels

export function Panel({ id, icon: Icon, title, intro, children, aside }: { id?: string; icon?: LucideIcon; title: string; intro?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-rose-500" />}
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
          </div>
          {intro && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">{intro}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone = 'plain', big }: { label: string; value: string; sub?: string; tone?: 'plain' | 'good' | 'warn' | 'rose'; big?: boolean }) {
  const tones = {
    plain: 'bg-slate-50 dark:bg-slate-800/60',
    good: 'bg-emerald-50 dark:bg-emerald-900/20',
    warn: 'bg-amber-50 dark:bg-amber-900/20',
    rose: 'bg-rose-50 dark:bg-rose-900/20',
  };
  return (
    <div className={cn('rounded-xl p-4', tones[tone])}>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn('mt-1 font-semibold text-slate-900 dark:text-white', big ? 'text-2xl' : 'text-lg')}>{value}</p>
      {sub && <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{sub}</p>}
    </div>
  );
}

export function Notes({ items, title = 'How this was worked out' }: { items?: string[]; title?: string }) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300" aria-expanded={open}>
        {title}
        <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <ul className="space-y-1.5 px-3 pb-3 text-xs leading-5 text-slate-600 dark:text-slate-400">
          {items.map((n) => (
            <li key={n} className="flex gap-2"><span className="text-rose-400">•</span><span>{n}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Disclaimer({ asAt, advice = false }: { asAt?: string; advice?: boolean }) {
  return (
    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
      Estimates from published rates{asAt ? ` for the ${asAt}` : ''}, for planning. {advice ? 'This is general information, not personal financial advice; a licensed adviser or registered tax agent can give that.' : 'Check the figures with the official calculator or your accountant before you act on them.'}
    </p>
  );
}

export function Pending({ loading, error, children }: { loading: boolean; error: string | null; children: ReactNode }) {
  return (
    <div className="relative">
      {error && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
      <div className={cn(loading && 'opacity-60')}>{children}</div>
      {loading && <Loader2 className="absolute right-0 top-0 h-4 w-4 animate-spin text-slate-400" />}
    </div>
  );
}

// -------------------------------------------------------------- charts

export function Bars({ rows, max }: { rows: Array<{ label: string; value: number; display?: string; color?: string; marker?: number }>; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => Math.abs(r.value)), ...rows.map((r) => r.marker ?? 0));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300">{r.label}</span>
            <span className="font-medium text-slate-900 dark:text-white">{r.display ?? r.value}</span>
          </div>
          <div className="relative mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
            <div className={cn('h-2 rounded-full', r.color ?? 'bg-rose-400')} style={{ width: `${Math.min(100, (Math.abs(r.value) / top) * 100)}%` }} />
            {r.marker !== undefined && <span className="absolute -top-1 h-4 w-0.5 bg-slate-500" style={{ left: `${Math.min(100, (r.marker / top) * 100)}%` }} aria-hidden />}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LineChart({ series, labels, height = 180, money = true }: { series: Array<{ label: string; color: string; values: number[] }>; labels?: string[]; height?: number; money?: boolean }) {
  const width = 640;
  const pad = { l: 8, r: 8, t: 10, b: 22 };
  const all = series.flatMap((s) => s.values);
  const lo = Math.min(0, ...all);
  const hi = Math.max(1, ...all);
  const n = Math.max(2, ...series.map((s) => s.values.length));
  const x = (i: number) => pad.l + (i / (n - 1)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (height - pad.t - pad.b);
  const fmt = (v: number) => (money ? (Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`) : String(Math.round(v)));
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={series.map((s) => s.label).join(', ')}>
        {[0, 0.5, 1].map((t) => {
          const v = lo + (hi - lo) * t;
          return (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth={1} />
              <text x={pad.l} y={y(v) - 3} className="fill-slate-400" fontSize={10}>{fmt(v)}</text>
            </g>
          );
        })}
        {series.map((s) => (
          <polyline key={s.label} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
        ))}
        {labels && labels.map((l, i) => (i === 0 || i === labels.length - 1 || i % Math.ceil(labels.length / 6) === 0) && (
          <text key={l} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'} className="fill-slate-400" fontSize={10}>{l}</text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full" style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- hook

/**
 * Runs a calculator when its inputs settle. A stale response is dropped so
 * fast typing never paints an older answer over a newer one.
 */
export function useCalc<TOut>(runner: (input: Record<string, unknown>) => Promise<AxiosResponse>, input: Record<string, unknown>, enabled = true, delay = 400) {
  const [result, setResult] = useState<TOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const key = JSON.stringify(input);

  useEffect(() => {
    if (!enabled) return;
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await runner(JSON.parse(key) as Record<string, unknown>);
        if (mine !== seq.current) return;
        setResult((res.data?.data ?? null) as TOut | null);
        setError(null);
      } catch (err) {
        if (mine !== seq.current) return;
        setError(apiMessage(err, 'That could not be worked out. Check the numbers.'));
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { result, loading, error };
}

export const num = (s: string, fallback = 0) => {
  const n = Number(s);
  return Number.isFinite(n) && s !== '' ? n : fallback;
};
export const opt = (s: string) => (s === '' ? undefined : num(s));

// ------------------------------------------------------------ the plan

type SavedPlan = { id: string; area: StrategyArea; title?: string | null; inputs: Record<string, unknown>; result: Record<string, unknown>; updatedAt: string };

/**
 * Saving a plan keeps the inputs and the headline result under one title,
 * one plan per area. When the page opens it asks for the saved plan and
 * hands the inputs back through `onLoaded` so every field fills in.
 */
export function SavePlanBar({ area, inputs, result, onLoaded, onSaved, summary }: { area: StrategyArea; inputs: Record<string, unknown>; result: Record<string, unknown>; onLoaded: (inputs: Record<string, unknown>, title: string, result: Record<string, unknown>) => void; onSaved?: (result: Record<string, unknown>) => void; summary?: string }) {
  const [title, setTitle] = useState('');
  const [saved, setSaved] = useState<SavedPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    strategyApi.getPlans()
      .then((res) => {
        const plans: SavedPlan[] = res.data?.data ?? [];
        const mine = plans.find((p) => p.area === area);
        if (mine) {
          setSaved(mine);
          setTitle(mine.title ?? '');
          onLoaded(mine.inputs ?? {}, mine.title ?? '', mine.result ?? {});
        }
      })
      .catch(() => { /* a visitor without a session sees the calculators only */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await strategyApi.savePlan(area, { title: title.trim() || undefined, inputs, result });
      setSaved(res.data?.data ?? null);
      onSaved?.(res.data?.data?.result ?? {});
      toast.success('Plan saved');
    } catch (err) {
      toast.error(apiMessage(err, 'Sign in to save a plan.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!saved) return;
    setBusy(true);
    try {
      await strategyApi.deletePlan(area);
      setSaved(null);
      toast.success('Plan removed');
    } catch (err) {
      toast.error(apiMessage(err, 'That could not be removed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4 dark:border-rose-900/40 dark:bg-rose-900/10 sm:flex-row sm:items-center">
      <div className="flex-1">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name this plan, e.g. Brisbane by 2028" className={cn(inputClass, 'bg-white dark:bg-slate-900')} maxLength={120} />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {saved ? `Saved ${formatDate(saved.updatedAt)}.` : 'Nothing saved yet.'} {summary}
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={busy} className="btn-primary inline-flex items-center gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save plan
        </button>
        {saved && (
          <button type="button" onClick={remove} disabled={busy} className="btn-ghost inline-flex items-center gap-2 text-slate-600 dark:text-slate-300" aria-label="Remove saved plan">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** A row of jump links to the panels on a long page. */
export function JumpLinks({ items }: { items: Array<{ id: string; label: string }> }) {
  return (
    <nav aria-label="On this page" className="flex flex-wrap gap-2">
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-rose-100 hover:text-rose-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-900/30">
          {i.label}
        </a>
      ))}
    </nav>
  );
}
