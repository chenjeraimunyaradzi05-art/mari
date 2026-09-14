'use client';

/**
 * Test drives she has asked for and trade-in requests with the quotes
 * that came back beside the guide, so a dealer's number is never read
 * without the range it should sit in.
 */

import Link from 'next/link';
import toast from 'react-hot-toast';
import { Tag } from 'lucide-react';
import { autoApi, autoError, aud0, km } from '@/lib/automotive-api';
import { AutoNav, Confirm, Empty, ErrorBox, Loading, PageTitle, StatusChip, fmtDay, fmtWhen, useLoad } from '@/components/automotive/AutoUi';
import { Panel } from '@/components/strategy/StrategyUi';

type TestDrive = { id: string; status: string; preferredAt: string; alternativeAt: string | null; note: string | null; dealerNote: string | null; dealership: { id: string; name: string; slug: string; phone: string | null } | null; car: string | null; carSlug: string | null; listingId: string | null; createdAt: string };
type TradeIn = { id: string; make: string; model: string; year: number; variant: string | null; odometerKm: number; condition: string; status: string; estimateLow: number; estimateMid: number; estimateHigh: number; tradeInGuide: number; expiresAt: string; createdAt: string; dealership: { name: string; slug: string } | null; quotes: Array<{ dealershipId: string; name: string; amount: number; validUntil: string; note: string | null; at: string }> };

export default function RequestsPage() {
  const drives = useLoad<TestDrive[]>(() => autoApi.testDrives());
  const trades = useLoad<TradeIn[]>(() => autoApi.tradeIns());
  const act = async (fn: () => Promise<unknown>, done: string) => { try { await fn(); toast.success(done); drives.reload(); trades.reload(); } catch (err) { toast.error(autoError(err, 'That did not work.')); } };
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={Tag} kicker="Cars" title="Test drives and trade-ins" blurb="What you have asked dealerships for, and the quotes that came back, each beside the guide." action={<Link href="/cars/dealerships" className="btn-ghost text-sm">Dealerships</Link>} />
      <AutoNav current="/dashboard/cars/requests" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Test drives" intro="Requested first; the dealership confirms a time.">
          {drives.loading && <Loading />}
          <ErrorBox error={drives.error} />
          {drives.data && drives.data.length === 0 && <p className="text-sm text-slate-500">None yet. Book one from a car's page or a dealership's page.</p>}
          <ul className="space-y-2">{(drives.data ?? []).map((t) => <li key={t.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-900 dark:text-white">{t.car ?? 'Any car'} at {t.dealership ? <Link href={`/cars/dealerships/${t.dealership.slug}`} className="text-rose-600">{t.dealership.name}</Link> : 'a dealership'}</span><StatusChip status={t.status} /></div><p className="mt-1 text-xs text-slate-500">{fmtWhen(t.preferredAt)}{t.alternativeAt ? ` or ${fmtWhen(t.alternativeAt)}` : ''}</p>{t.dealerNote && <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">They said: {t.dealerNote}</p>}<div className="mt-2 flex gap-2">{['REQUESTED', 'CONFIRMED'].includes(t.status) && <Confirm label="Cancel" tone="slate" onConfirm={() => act(() => autoApi.cancelTestDrive(t.id), 'Cancelled')} />}{t.dealership?.phone && <a href={`tel:${t.dealership.phone.replace(/\s+/g, '')}`} className="btn-ghost text-xs">Call</a>}</div></li>)}</ul>
        </Panel>
        <Panel title="Trade-in quotes" intro="The guide is written in when you ask, so every quote is read against it.">
          {trades.loading && <Loading />}
          <ErrorBox error={trades.error} />
          {trades.data && trades.data.length === 0 && <p className="text-sm text-slate-500">None yet. Ask from the valuation page or a dealership's page.</p>}
          <ul className="space-y-2">{(trades.data ?? []).map((t) => <li key={t.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-900 dark:text-white">{t.year} {t.make} {t.model}{t.variant ? ` ${t.variant}` : ''} · {km(t.odometerKm)}</span><StatusChip status={t.status} /></div><p className="mt-1 text-xs text-slate-500">Guide {aud0(t.estimateLow)} to {aud0(t.estimateHigh)} privately, trade-in about {aud0(t.tradeInGuide)} · {t.dealership ? `asked ${t.dealership.name}` : 'open to dealerships'} · until {fmtDay(t.expiresAt)}</p>{t.quotes.length > 0 ? <ul className="mt-2 space-y-1">{t.quotes.map((q) => <li key={q.dealershipId} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white p-2 dark:bg-slate-900"><span><span className="font-semibold text-slate-900 dark:text-white">{aud0(q.amount)}</span> from {q.name}<span className="text-xs text-slate-500"> · valid to {fmtDay(q.validUntil)}{q.note ? ` · ${q.note}` : ''}</span><span className={`ml-2 text-xs font-semibold ${q.amount >= t.tradeInGuide ? 'text-emerald-600' : 'text-amber-600'}`}>{q.amount >= t.tradeInGuide ? 'at or above the trade-in guide' : `${aud0(t.tradeInGuide - q.amount)} under the trade-in guide`}</span></span>{['OPEN', 'QUOTED'].includes(t.status) && <Confirm label="Accept" tone="emerald" onConfirm={() => act(() => autoApi.updateTradeIn(t.id, { status: 'ACCEPTED', dealershipId: q.dealershipId }), 'Accepted. The dealership has been told.')} />}</li>)}</ul> : <p className="mt-1 text-xs text-slate-500">No quotes yet.</p>}<div className="mt-2">{['OPEN', 'QUOTED'].includes(t.status) && <Confirm label="Withdraw" tone="slate" onConfirm={() => act(() => autoApi.updateTradeIn(t.id, { status: 'WITHDRAWN' }), 'Withdrawn')} />}</div></li>)}</ul>
        </Panel>
      </div>
    </div>
  );
}
