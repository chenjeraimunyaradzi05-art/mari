'use client';

/**
 * The pieces the car pages share: the pill navigation, the ANCAP badge that
 * always carries its year, stars, a photo strip and an uploader, the
 * status chips, the payment hold (the same escrow form the rest of the
 * platform uses, with an honest note when no processor is configured), and
 * the disclaimers that keep an estimate an estimate.
 */

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Camera, Loader2, ShieldCheck, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mediaApi } from '@/lib/api';
import { stripeConfigured } from '@/lib/stripe';
import { PaymentIntentForm } from '@/components/payments/PaymentIntentForm';
import { AUTO_PILLS } from '@/lib/automotive-nav';
import { autoApi, autoError, type Ancap, type Reference } from '@/lib/automotive-api';
import { useLoad } from '@/components/wellness/WellnessUi';

export { Chip, Empty, ErrorBox, Loading, PageTitle, fmtDay, fmtWhen, useLoad } from '@/components/wellness/WellnessUi';

export function useReference() {
  return useLoad<Reference>(() => autoApi.reference());
}

/** The pill navigation across the car pages, from the same map the header reads. */
export function AutoNav({ current }: { current: string }) {
  return (
    <nav aria-label="Cars" className="flex flex-wrap gap-2 print:hidden">
      {AUTO_PILLS.map((n) => (
        <Link key={n.href} href={n.href} aria-current={current === n.href ? 'page' : undefined} className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition', current === n.href ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-rose-100 hover:text-rose-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-900/30')}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

/** Stars with their year. An expired rating is never shown as a current one. */
export function AncapBadge({ ancap, stars, compact = false }: { ancap: Ancap; stars?: number | null; compact?: boolean }) {
  const tone = ancap.status === 'current' ? (stars && stars >= 5 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' : stars && stars >= 4 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200') : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', tone)} title={ancap.label}>
      <ShieldCheck className="h-3 w-3" />
      {ancap.status === 'unrated' ? 'ANCAP: not rated' : compact ? `${stars}★ ${ancap.status === 'expired' ? 'lapsed' : ancap.label.split(', ')[1] ?? ''}`.trim() : ancap.label}
    </span>
  );
}

export function Stars({ value, count, size = 'h-3.5 w-3.5', label }: { value: number; count?: number; size?: string; label?: string }) {
  if (!count && !value) return <span className="text-xs text-slate-500">{label ?? 'No ratings yet'}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-amber-600">
      {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn(size, i < Math.round(value) ? 'fill-current' : 'opacity-30')} />)}
      <span className="ml-1 text-xs text-slate-600 dark:text-slate-300">{value}{count !== undefined ? ` from ${count}` : ''}</span>
    </span>
  );
}

export function StarPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-1 flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} of 5`} className={cn('rounded-md p-1 transition', n <= value ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300')}><Star className={cn('h-5 w-5', n <= value && 'fill-current')} /></button>)}</div>
    </div>
  );
}

export function PhotoStrip({ photos, title }: { photos: string[]; title: string }) {
  const [i, setI] = useState(0);
  if (photos.length === 0) return <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 via-purple-50 to-amber-50 text-sm text-slate-500 dark:from-rose-900/20 dark:via-purple-900/10 dark:to-amber-900/10">No photos yet</div>;
  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photos[Math.min(i, photos.length - 1)]} alt={title} className="aspect-[4/3] w-full rounded-2xl object-cover" />
      {photos.length > 1 && <div className="mt-2 flex gap-2 overflow-x-auto">{photos.map((p, j) => (
        // eslint-disable-next-line @next/next/no-img-element
        <button key={p + j} type="button" onClick={() => setI(j)} className={cn('shrink-0 overflow-hidden rounded-lg border-2', j === i ? 'border-rose-500' : 'border-transparent')}><img src={p} alt="" className="h-14 w-20 object-cover" /></button>
      ))}</div>}
    </div>
  );
}

/** Photos go through the shared media pipeline (the public posts folder), so a buyer can see them. */
export function PhotoUploader({ photos, onChange, max = 12 }: { photos: string[]; onChange: (urls: string[]) => void; max?: number }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const out = [...photos];
    try {
      for (const f of Array.from(files).slice(0, max - out.length)) {
        const res = await mediaApi.upload('post', f);
        const url = res.data?.data?.url;
        if (url) out.push(url);
      }
      onChange(out);
    } catch (err) { toast.error(autoError(err, 'That photo could not be uploaded.')); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={p + i} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p} alt="" className="h-20 w-28 rounded-lg object-cover" />
            <button type="button" onClick={() => onChange(photos.filter((_, j) => j !== i))} aria-label="Remove photo" className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900 p-0.5 text-white"><X className="h-3 w-3" /></button>
          </div>
        ))}
        {photos.length < max && <button type="button" onClick={() => input.current?.click()} disabled={busy} className="flex h-20 w-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-rose-400 hover:text-rose-600 disabled:opacity-50 dark:border-slate-700">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}{busy ? 'Uploading' : 'Add photos'}</button>}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
      <p className="mt-1 text-[11px] text-slate-500">Front, back, both sides, the odometer, the tyres, the engine bay and the compliance plate. Buyers trust what they can see.</p>
    </div>
  );
}

const STATUS_WORDS: Record<string, { label: string; tone: 'slate' | 'rose' | 'emerald' | 'amber' | 'sky' }> = {
  DRAFT: { label: 'Draft', tone: 'slate' }, ACTIVE: { label: 'Live', tone: 'emerald' }, UNDER_OFFER: { label: 'Under offer', tone: 'amber' }, SOLD: { label: 'Sold', tone: 'sky' }, WITHDRAWN: { label: 'Withdrawn', tone: 'slate' }, SUSPENDED: { label: 'Held for review', tone: 'rose' },
  OFFERED: { label: 'Offer made', tone: 'amber' }, ACCEPTED: { label: 'Accepted, awaiting payment', tone: 'amber' }, DECLINED: { label: 'Declined', tone: 'slate' }, PAID_HELD: { label: 'Money held', tone: 'sky' }, HANDED_OVER: { label: 'Inspection period', tone: 'sky' }, RELEASED: { label: 'Complete', tone: 'emerald' }, DISPUTED: { label: 'In dispute', tone: 'rose' }, REFUNDED: { label: 'Refunded', tone: 'slate' }, CANCELLED: { label: 'Cancelled', tone: 'slate' },
  REQUESTED: { label: 'Requested', tone: 'amber' }, QUOTED: { label: 'Quoted', tone: 'sky' }, CONFIRMED: { label: 'Confirmed', tone: 'emerald' }, IN_PROGRESS: { label: 'Under way', tone: 'sky' }, COMPLETED: { label: 'Done', tone: 'emerald' }, NO_SHOW: { label: 'Missed', tone: 'slate' }, ASSIGNED: { label: 'Taken on', tone: 'sky' }, SCHEDULED: { label: 'Scheduled', tone: 'sky' },
  SUBMITTED: { label: 'Submitted', tone: 'amber' }, IN_REVIEW: { label: 'Being read', tone: 'sky' }, PRE_APPROVED: { label: 'Withdrawn — was not an approval', tone: 'slate' }, EXPIRED: { label: 'Expired', tone: 'slate' }, OPEN: { label: 'Open', tone: 'amber' },
  PASS: { label: 'Passed', tone: 'emerald' }, ADVISORIES: { label: 'Advisories', tone: 'amber' }, FAIL: { label: 'Failed', tone: 'rose' },
  PENDING: { label: 'Pending', tone: 'amber' }, PAID: { label: 'Paid', tone: 'emerald' }, VOID: { label: 'Void', tone: 'slate' },
};

export function StatusChip({ status }: { status: string }) {
  const s = STATUS_WORDS[status] ?? { label: status.toLowerCase().replace(/_/g, ' '), tone: 'slate' as const };
  const tones = { slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200', emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200', amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200', sky: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200' };
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', tones[s.tone])}>{s.label}</span>;
}

export function VerdictChip({ verdict }: { verdict: string | null | undefined }) {
  if (!verdict) return null;
  const map: Record<string, { label: string; cls: string }> = { WELL_BELOW: { label: 'Well under the guide', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200' }, BELOW: { label: 'Under the guide', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' }, FAIR: { label: 'Fair price', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' }, ABOVE: { label: 'Above the guide', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' }, WELL_ABOVE: { label: 'Well above the guide', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200' } };
  const v = map[verdict];
  return v ? <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', v.cls)}>{v.label}</span> : null;
}

/**
 * The hold on a card. With a processor configured this is Stripe's own
 * element; without one (development, or before the keys are set) the
 * server's mock has already recorded the hold and the page says so plainly
 * rather than pretending a card was charged.
 *
 * Closing this is a supported way out, not an accident, so the way out says
 * so. It used to read "Not now" over a purchase the server had already marked
 * paid, which made leaving the form the start of a dead end rather than a
 * pause; the caller is expected to keep offering a way back in.
 */
export function PayHold({ clientSecret, amountLabel, onDone, onCancel, what, skipLabel = 'Finish this later' }: { clientSecret: string | null; amountLabel: string; onDone: () => void; onCancel?: () => void; what: string; skipLabel?: string }) {
  if (!clientSecret || !stripeConfigured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-900/20">
        <p className="font-semibold text-amber-900 dark:text-amber-100">{amountLabel} recorded as held for {what}.</p>
        <p className="mt-1 text-amber-800 dark:text-amber-200">No card processor is configured on this deployment, so nothing has left a card. When one is, this step becomes the card form and the hold is real.</p>
        <div className="mt-3 flex gap-2"><button type="button" onClick={onDone} className="btn-primary text-sm">Continue</button>{onCancel && <button type="button" onClick={onCancel} className="btn-ghost text-sm">{skipLabel}</button>}</div>
      </div>
    );
  }
  return <PaymentIntentForm clientSecret={clientSecret} amountLabel={amountLabel} onAuthorised={onDone} onSkip={onCancel} skipLabel={skipLabel} />;
}

export const AutoDisclaimer = ({ what = 'These figures are estimates from published rates and typical costs, for planning.' }: { what?: string }) => (
  <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{what} They are general information, not personal financial or legal advice; a licensed broker, insurer or adviser gives that. Check any safety rating on ancap.com.au before you decide.</p>
);

export function Money({ n, big }: { n: number | null | undefined; big?: boolean }) {
  return <span className={cn('tabular-nums', big && 'text-2xl font-semibold')}>{`$${Math.round(Number(n) || 0).toLocaleString('en-AU')}`}</span>;
}

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * A dealership's opening hours, beside the time picker for a test drive. The
 * server refuses a time outside them, so she should see them before she picks
 * one rather than learn them from the refusal.
 */
export function HoursLine({ hours }: { hours: Record<string, Array<[string, string]>> | null | undefined }) {
  const days = WEEK.filter((d) => (hours?.[String(d)] ?? []).length > 0);
  if (!hours || days.length === 0) return <p className="mt-1 text-[11px] text-slate-500">This dealership has not published its hours; they will confirm a time that suits them.</p>;
  return <p className="mt-1 text-[11px] text-slate-500">Open {days.map((d) => `${DAY_NAMES[d]} ${hours[String(d)].map(([a, b]) => `${a}–${b}`).join(', ')}`).join(' · ')}, their local time.</p>;
}

export function Kv({ k, v }: { k: string; v: ReactNode }) {
  return <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">{k}</dt><dd className="text-sm text-slate-800 dark:text-slate-200">{v}</dd></div>;
}

export function Confirm({ label, onConfirm, tone = 'rose', hint, disabled }: { label: string; onConfirm: () => void | Promise<void>; tone?: 'rose' | 'slate' | 'emerald'; hint?: string; disabled?: boolean }) {
  const [asking, setAsking] = useState(false);
  const cls = tone === 'emerald' ? 'bg-emerald-500 text-white' : tone === 'rose' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100';
  if (!asking) return <button type="button" disabled={disabled} onClick={() => setAsking(true)} className={cn('rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50', cls)}>{label}</button>;
  return <span className="inline-flex flex-wrap items-center gap-2 text-xs">{hint && <span className="text-slate-600 dark:text-slate-300">{hint}</span>}<button type="button" onClick={async () => { await onConfirm(); setAsking(false); }} className={cn('rounded-md px-3 py-1.5 font-semibold', cls)}>Yes, {label.toLowerCase()}</button><button type="button" onClick={() => setAsking(false)} className="btn-ghost text-xs">No</button></span>;
}
