'use client';

/**
 * The cars overview: what is due on the cars in the garage, the purchases
 * and offers in flight and where the money is, the bookings to accept or
 * rate, the pre-approvals, and the doors into the rest. A workshop owner
 * or a dealer sees her other hat here too.
 */

import Link from 'next/link';
import { ArrowRight, Car, ClipboardCheck, FileCheck2, KeyRound, ShieldCheck, Store, Wrench } from 'lucide-react';
import { autoApi, aud0, type ApplicationCard, type BookingCard, type PurchaseCard, type Reminder, type VehicleCard } from '@/lib/automotive-api';
import { AUTO_GROUPS, AUTO_TONES } from '@/lib/automotive-nav';
import { AutoNav, ErrorBox, Loading, PageTitle, StatusChip, fmtDay, fmtWhen, useLoad } from '@/components/automotive/AutoUi';
import { Panel } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Overview = { vehicles: VehicleCard[]; reminders: Reminder[]; purchases: PurchaseCard[]; bookings: BookingCard[]; applications: ApplicationCard[]; counts: { saved: number; listings: number; testDrives: number; tradeIns: number }; roles: { isMechanic: boolean; mechanicVerified: boolean; isDealer: boolean; dealerVerified: boolean; isAdmin: boolean } };

export function ReminderList({ reminders }: { reminders: Reminder[] }) {
  if (reminders.length === 0) return <p className="text-sm text-slate-500">Nothing due. The garage will say when something is.</p>;
  return (
    <ul className="space-y-2">
      {reminders.map((r) => (
        <li key={r.key} className={cn('rounded-xl p-3', r.urgency === 'overdue' ? 'bg-rose-50 dark:bg-rose-900/20' : r.urgency === 'soon' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-slate-800/60')}>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-900 dark:text-white">{r.title}</p><span className="text-xs text-slate-500">{r.daysAway !== null ? (r.daysAway < 0 ? `${Math.abs(r.daysAway)} days ago` : r.daysAway === 0 ? 'Today' : `In ${r.daysAway} day${r.daysAway === 1 ? '' : 's'}`) : ''}</span></div>
          <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{r.body}</p>
          <Link href={r.action.href} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-rose-600">{r.action.label} <ArrowRight className="h-3 w-3" /></Link>
        </li>
      ))}
    </ul>
  );
}

export default function CarsOverviewPage() {
  const data = useLoad<Overview>(() => autoApi.overview());
  const o = data.data;
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={Car} kicker="Cars" title="Your cars" blurb="What is due, what is in flight, and where the money is." action={<Link href="/cars" className="btn-ghost text-sm">The public cars page</Link>} />
      <AutoNav current="/dashboard/cars" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {o && (
        <>
          {(o.roles.isMechanic || o.roles.isDealer || o.roles.isAdmin) && (
            <div className="flex flex-wrap gap-2">
              {o.roles.isMechanic && <Link href="/dashboard/cars/workshop" className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-900/20 dark:text-amber-100"><Wrench className="h-4 w-4" /> Your workshop{o.roles.mechanicVerified ? '' : ' (awaiting verification)'}</Link>}
              {o.roles.isDealer && <Link href="/dashboard/cars/dealership" className="inline-flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900 dark:bg-sky-900/20 dark:text-sky-100"><Store className="h-4 w-4" /> Your dealership{o.roles.dealerVerified ? '' : ' (awaiting verification)'}</Link>}
              {o.roles.isAdmin && <Link href="/dashboard/cars/admin" className="inline-flex items-center gap-2 rounded-xl bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-900 dark:bg-purple-900/20 dark:text-purple-100"><ShieldCheck className="h-4 w-4" /> Automotive admin</Link>}
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel icon={KeyRound} title="The garage" intro={o.vehicles.length ? `${o.vehicles.length} car${o.vehicles.length === 1 ? '' : 's'}.` : 'No cars yet. Add one and the reminders, the service history and the valuation start.'} aside={<Link href="/dashboard/cars/garage" className="btn-secondary text-sm">{o.vehicles.length ? 'Open' : 'Add a car'}</Link>}>
              <ul className="space-y-2">{o.vehicles.map((v) => <li key={v.id}><Link href={`/dashboard/cars/garage/${v.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm hover:bg-rose-50 dark:bg-slate-800/60"><span className="font-medium text-slate-900 dark:text-white">{v.name}</span><span className="text-xs text-slate-500">{v.odometerNow ? `${v.odometerNow.toLocaleString('en-AU')} km · ` : ''}worth about {aud0(v.valuation.mid)}</span></Link></li>)}</ul>
              <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coming up</p><div className="mt-2"><ReminderList reminders={o.reminders} /></div></div>
            </Panel>
            <Panel icon={ShieldCheck} title="Offers and purchases" intro={o.purchases.length ? 'Where each one is, and where the money is.' : 'Nothing in flight.'} aside={<Link href="/dashboard/cars/purchases" className="btn-ghost text-sm">All</Link>}>
              <ul className="space-y-2">{o.purchases.map((p) => <li key={p.id}><Link href={`/dashboard/cars/purchases/${p.id}`} className="block rounded-lg bg-slate-50 p-3 hover:bg-rose-50 dark:bg-slate-800/60"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium text-slate-900 dark:text-white">{p.role === 'buyer' ? 'Buying' : 'Selling'}: {p.listing.title}</span><StatusChip status={p.status} /></div><p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{aud0(p.agreedAmount ?? p.offerAmount)} · {p.nextStep}</p></Link></li>)}</ul>
              <div className="mt-3 flex flex-wrap gap-2 text-xs"><Link href="/dashboard/cars/sell" className="btn-ghost">Your listings ({o.counts.listings})</Link><Link href="/dashboard/cars/saved" className="btn-ghost">Saved cars ({o.counts.saved})</Link><Link href="/dashboard/cars/requests" className="btn-ghost">Test drives and trade-ins ({o.counts.testDrives + o.counts.tradeIns})</Link></div>
            </Panel>
            <Panel icon={ClipboardCheck} title="Workshop bookings" intro={o.bookings.length ? 'Quotes to accept, jobs under way, and the ones to rate.' : 'No bookings coming up.'} aside={<Link href="/dashboard/cars/bookings" className="btn-ghost text-sm">All</Link>}>
              <ul className="space-y-2">{o.bookings.map((b) => <li key={b.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium text-slate-900 dark:text-white">{b.kindLabel} at {b.mechanic.name}</span><StatusChip status={b.status} /></div><p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{fmtWhen(b.scheduledAt)}{b.quoteAmount ? ` · quoted ${aud0(b.quoteAmount)}` : ''}{b.status === 'COMPLETED' && !b.reviewed ? ' · rate the job' : ''}</p></li>)}</ul>
              <Link href="/cars/mechanics" className="mt-3 inline-block text-sm font-semibold text-rose-600">Find a mechanic</Link>
            </Panel>
            <Panel icon={FileCheck2} title="Finance" intro={o.applications.length ? 'Your pre-approvals.' : 'No application yet. The public finance page has the arithmetic; the pre-approval starts here.'} aside={<Link href="/dashboard/cars/finance" className="btn-ghost text-sm">Open</Link>}>
              <ul className="space-y-2">{o.applications.map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><span className="text-slate-900 dark:text-white">{a.referenceCode} · {aud0(a.amount)} over {a.termMonths} months</span><span className="flex items-center gap-2"><StatusChip status={a.status} />{a.expiresAt && a.status === 'PRE_APPROVED' && <span className="text-xs text-slate-500">until {fmtDay(a.expiresAt)}</span>}</span></li>)}</ul>
            </Panel>
          </div>
          <section><h2 className="rail-title">Everything in the area</h2><ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{AUTO_GROUPS.flatMap((g) => g.items.map((t) => <li key={t.href}><Link href={t.href} className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60"><span className={cn('flex h-7 w-7 items-center justify-center rounded-full', AUTO_TONES[g.tone])}><t.icon className="h-3.5 w-3.5" /></span><span className="text-slate-800 dark:text-slate-200">{t.label}</span></Link></li>))}</ul></section>
        </>
      )}
    </div>
  );
}
