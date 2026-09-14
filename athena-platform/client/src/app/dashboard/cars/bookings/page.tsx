'use client';

/**
 * Workshop bookings: the quote to read line by line and accept, the job
 * paid into holding and released when the car is back, the calendar file,
 * the cancellation inside the rules, and the rating with its second mark
 * for whether the charges were explained.
 */

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ClipboardCheck } from 'lucide-react';
import { autoApi, autoError, aud0, type BookingCard } from '@/lib/automotive-api';
import { AutoNav, Confirm, Empty, ErrorBox, Loading, PageTitle, PayHold, StarPicker, StatusChip, fmtWhen, useLoad } from '@/components/automotive/AutoUi';
import { Field, inputClass } from '@/components/strategy/StrategyUi';

export default function BookingsPage() {
  const data = useLoad<BookingCard[]>(() => autoApi.bookings());
  const [paying, setPaying] = useState<{ id: string; clientSecret: string | null; amount: number } | null>(null);
  const [rating, setRating] = useState<Record<string, { rating: number; transparency: number; comment: string }>>({});
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>, done: string) => { setBusy(true); try { await fn(); toast.success(done); data.reload(); } catch (err) { toast.error(autoError(err, 'That did not work.')); } finally { setBusy(false); } };
  const pay = async (b: BookingCard) => { setBusy(true); try { const res = await autoApi.payBooking(b.id); if (res.data.data.alreadyHeld) toast('Already held.'); else setPaying({ id: b.id, clientSecret: res.data.data.payment?.clientSecret ?? null, amount: res.data.data.payment?.amount ?? (b.quoteAmount ?? 0) * 100 }); } catch (err) { toast.error(autoError(err, 'The payment could not be started.')); } finally { setBusy(false); } };
  const ics = async (b: BookingCard) => { try { const res = await autoApi.bookingIcs(b.id); const blob = new Blob([res.data], { type: 'text/calendar' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `car-service-${b.id.slice(0, 8)}.ics`; a.click(); URL.revokeObjectURL(url); } catch (err) { toast.error(autoError(err, 'The calendar file could not be made.')); } };
  const upcoming = (data.data ?? []).filter((b) => ['REQUESTED', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status));
  const past = (data.data ?? []).filter((b) => !['REQUESTED', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status));

  const Card = ({ b }: { b: BookingCard }) => {
    const r = rating[b.id] ?? { rating: 0, transparency: 0, comment: '' };
    return (
      <li className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><Link href={`/cars/mechanics/${b.mechanic.slug}`} className="font-semibold text-slate-900 hover:text-rose-600 dark:text-white">{b.kindLabel} at {b.mechanic.name}</Link><p className="text-xs text-slate-500">{fmtWhen(b.scheduledAt)} · {b.durationMinutes} min · {b.dropOff ? b.mechanic.place : `at ${b.address}`}{b.vehicle ? ` · ${b.vehicle.name}` : ''}</p></div><StatusChip status={b.status} /></div>
        {b.concern && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">“{b.concern}”</p>}
        {b.partsRequested.length > 0 && <p className="mt-1 text-xs text-slate-500">Parts asked for: {b.partsRequested.map((x) => `${x.qty} × ${x.name}`).join(', ')}</p>}
        {b.quoteLines.length > 0 && <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">The quote{b.quotedAt ? `, ${fmtWhen(b.quotedAt)}` : ''}</p><ul className="mt-1 space-y-0.5 text-sm">{b.quoteLines.map((l, i) => <li key={i} className="flex justify-between"><span className="text-slate-700 dark:text-slate-300">{l.label} <span className="text-xs text-slate-500">{l.kind.toLowerCase()}</span></span><span className="tabular-nums">{aud0(l.amount)}</span></li>)}<li className="flex justify-between border-t border-slate-200 pt-1 font-semibold dark:border-slate-700"><span>Total{b.quoteTotals.parts ? ` (parts ${aud0(b.quoteTotals.parts)}, labour ${aud0(b.quoteTotals.labour)})` : ''}</span><span className="tabular-nums">{aud0(b.quoteAmount)}</span></li></ul>{b.quoteNote && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{b.quoteNote}</p>}</div>}
        {b.workshopNote && b.status === 'COMPLETED' && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300"><span className="text-xs uppercase tracking-wide text-slate-500">From the workshop: </span>{b.workshopNote}</p>}
        {(b.partsWarrantyMonths || b.labourWarrantyMonths) && b.status === 'COMPLETED' && <p className="mt-1 text-xs text-slate-500">Warranty on this work: {[b.partsWarrantyMonths ? `${b.partsWarrantyMonths} months parts` : null, b.labourWarrantyMonths ? `${b.labourWarrantyMonths} months labour` : null].filter(Boolean).join(', ')}.</p>}
        {b.escrowStatus && <p className="mt-1 text-xs text-slate-500">Payment: {b.escrowStatus === 'CAPTURED' ? 'released to the workshop' : ['CANCELED', 'REFUNDED'].includes(b.escrowStatus) ? 'returned to you' : 'held by ATHENA until you release it'}.</p>}
        {paying?.id === b.id && <div className="mt-3"><PayHold clientSecret={paying.clientSecret} amountLabel={aud0(paying.amount / 100)} what="the job" onDone={() => { setPaying(null); toast.success('Held. Released when you confirm the work is done.'); data.reload(); }} onCancel={() => setPaying(null)} /></div>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {b.status === 'QUOTED' && <button type="button" disabled={busy} onClick={() => act(() => autoApi.updateBooking(b.id, { acceptQuote: true }), 'Quote accepted')} className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Accept the quote</button>}
          {['QUOTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.status) && b.quoteAmount && b.mechanic.takesPayment && !b.escrowStatus && <button type="button" disabled={busy} onClick={() => pay(b)} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">Pay {aud0(b.finalAmount ?? b.quoteAmount)} into holding</button>}
          {b.status === 'COMPLETED' && b.escrowStatus && !['CAPTURED', 'CANCELED', 'REFUNDED'].includes(b.escrowStatus) && <Confirm label="Release the payment" tone="emerald" hint="The car is back and the work is done?" onConfirm={() => act(() => autoApi.releaseBooking(b.id), 'Released to the workshop')} />}
          {['CONFIRMED', 'REQUESTED', 'QUOTED'].includes(b.status) && <button type="button" onClick={() => ics(b)} className="btn-ghost text-xs">Calendar file</button>}
          {b.canCancel && <Confirm label="Cancel" tone="slate" onConfirm={() => act(() => autoApi.updateBooking(b.id, { status: 'CANCELLED' }), 'Cancelled')} />}
          {b.mechanic.phone && <a href={`tel:${b.mechanic.phone.replace(/\s+/g, '')}`} className="btn-ghost text-xs">Call {b.mechanic.phone}</a>}
        </div>
        {b.status === 'COMPLETED' && !b.reviewed && <div className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700"><div className="grid gap-3 sm:grid-cols-2"><StarPicker label="The job" value={r.rating} onChange={(v) => setRating((x) => ({ ...x, [b.id]: { ...r, rating: v } }))} /><StarPicker label="Were the charges explained before the work?" value={r.transparency} onChange={(v) => setRating((x) => ({ ...x, [b.id]: { ...r, transparency: v } }))} /></div><Field label="A word for the next woman" className="mt-2"><input value={r.comment} onChange={(e) => setRating((x) => ({ ...x, [b.id]: { ...r, comment: e.target.value } }))} maxLength={1000} className={inputClass} /></Field><button type="button" disabled={busy || !r.rating || !r.transparency} onClick={() => act(() => autoApi.reviewBooking(b.id, r), 'Thank you.')} className="btn-primary mt-2 text-sm disabled:opacity-50">Rate it</button></div>}
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={ClipboardCheck} kicker="Cars" title="Workshop bookings" blurb="Quotes to accept, jobs under way, payment held until the car is back, and the ratings that keep the directory honest." action={<Link href="/cars/mechanics" className="btn-primary text-sm">Find a mechanic</Link>} />
      <AutoNav current="/dashboard/cars/bookings" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {data.data && data.data.length === 0 && <Empty title="No bookings yet" body="Pick a workshop that shows its prices and book inside its hours; the quote comes before any work." action={<Link href="/cars/mechanics" className="btn-primary text-sm">Find a mechanic</Link>} />}
      {upcoming.length > 0 && <section><h2 className="rail-title">Coming up</h2><ul className="mt-3 space-y-3">{upcoming.map((b) => <Card key={b.id} b={b} />)}</ul></section>}
      {past.length > 0 && <section><h2 className="rail-title">Done</h2><ul className="mt-3 space-y-3">{past.map((b) => <Card key={b.id} b={b} />)}</ul></section>}
    </div>
  );
}
