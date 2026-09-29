'use client';

/**
 * The automotive admin queues: workshops and dealerships to verify (and
 * feature), listings held by the checks, purchases in dispute, finance
 * applications for the desk, the referral fees still open with what has been
 * paid against them (the whole ledger, and the bank statement it is checked
 * against, are on /dashboard/cars/admin/referrals), the catalogue rows due a
 * check, and inspection requests nobody has taken.
 */

import { useId, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';
import { autoApi, autoError, aud0, km, type AdminReferralCard, type ApplicationCard, type DealershipCard, type InspectionCard, type LedgerAttentionRow, type ListingCard, type MechanicCard, type PaymentMethodWords, type PurchaseCard, type ReferralFees, type ReferralTotals } from '@/lib/automotive-api';
import { AutoNav, Confirm, ErrorBox, Loading, PageTitle, StatusChip, fmtDay, useLoad } from '@/components/automotive/AutoUi';
import { Field, Panel, SelectInput, inputClass } from '@/components/strategy/StrategyUi';
import { AddReferralFee, ReferralLedgerItem, ledgerIntro } from '@/components/automotive/ReferralLedger';

type Overview = { counts: { verifiedMechanics: number; verifiedDealers: number; liveListings: number; openPurchases: number }; catalogue: { active: number; due: number; ancapLapsed: number; recheckDays: number }; referrals: { totals: ReferralTotals; open: AdminReferralCard[]; attention: LedgerAttentionRow[]; fees: ReferralFees; methods: PaymentMethodWords; stripeConfigured: boolean }; mechanics: Array<MechanicCard & { about: string; licenceNumber: string | null; createdAt: string }>; dealerships: Array<DealershipCard & { about: string | null; email: string | null; createdAt: string }>; listings: ListingCard[]; disputes: PurchaseCard[]; applications: ApplicationCard[]; inspections: InspectionCard[] };

/** The server keeps a suspension reason to this many characters; the field says so before the admin writes more. */
const REASON_MAX = 500;
const REASON_DRAFT = 'The price is well under the guide and there are no photos; add photos and the VIN and it can go live.';

/**
 * The reason a seller reads when her listing stays held, written in a proper
 * field. It used to be a window.prompt: no length limit until the server
 * refused anything over 500 characters after the admin had sent it, nothing
 * like the rest of the console, and on some mobile browsers no prompt at all,
 * so the one string a member reads when her car is taken off the market was
 * the one input on the page with no field.
 */
function HoldReason({ busy, onSend }: { busy: boolean; onSend: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASON_DRAFT);
  const fieldId = useId();
  if (!open) return <button type="button" disabled={busy} onClick={() => setOpen(true)} className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-white">Keep held with a reason</button>;
  const text = reason.trim();
  return (
    <div className="w-full rounded-md bg-white p-2 dark:bg-slate-900">
      <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor={fieldId}>The reason the seller will read</label>
      <textarea id={fieldId} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={REASON_MAX} className={`${inputClass} mt-1`} />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-slate-500">{text.length} of {REASON_MAX}. Say what to change so it can go live.</span><span className="flex gap-1"><button type="button" disabled={busy || text.length === 0} onClick={() => onSend(text)} className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">Send and keep held</button><button type="button" onClick={() => setOpen(false)} className="btn-ghost text-xs">Cancel</button></span></div>
    </div>
  );
}

export default function AutoAdminPage() {
  const data = useLoad<Overview>(() => autoApi.admin.overview());
  const [decision, setDecision] = useState<Record<string, { status: string; lender: string; note: string; ratePct: string; days: string }>>({});
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>, done: string) => { setBusy(true); try { await fn(); toast.success(done); data.reload(); } catch (err) { toast.error(autoError(err, 'That did not work.')); } finally { setBusy(false); } };
  const o = data.data;
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={ShieldCheck} kicker="Cars · admin" title="Automotive queues" blurb={o ? `${o.counts.verifiedMechanics} verified workshops, ${o.counts.verifiedDealers} dealerships, ${o.counts.liveListings} live listings, ${o.counts.openPurchases} purchases with money held.` : 'Verification, held listings, disputes, finance and inspections.'} />
      <AutoNav current="/dashboard/cars/admin" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {o && (
        <div className="space-y-6">
          <Panel title={`Workshops to verify (${o.mechanics.length})`} intro="Check the licence number against the state register and the business against the ABN lookup before verifying.">
            <ul className="space-y-2">{o.mechanics.map((m) => <li key={m.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-900 dark:text-white">{m.name} <span className="text-xs font-normal text-slate-500">· {[m.suburb || m.city, m.state].filter(Boolean).join(', ')} · {m.licenceNumber ? `licence ${m.licenceNumber}` : 'no licence number'} · {fmtDay(m.createdAt)}</span></span><div className="flex gap-1"><button type="button" disabled={busy} onClick={() => act(() => autoApi.admin.mechanic(m.id, { isVerified: true }), 'Verified')} className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">Verify</button><button type="button" disabled={busy} onClick={() => act(() => autoApi.admin.mechanic(m.id, { isVerified: true, featuredDays: 30 }), 'Verified and featured for 30 days')} className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-white">Verify and feature</button><Confirm label="Hide" tone="slate" onConfirm={() => act(() => autoApi.admin.mechanic(m.id, { isActive: false }), 'Hidden')} /></div></div><p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{m.headline}. {m.about.slice(0, 200)}</p></li>)}{o.mechanics.length === 0 && <li className="text-sm text-slate-500">None waiting.</li>}</ul>
          </Panel>
          <Panel title={`Dealerships to verify (${o.dealerships.length})`}>
            <ul className="space-y-2">{o.dealerships.map((d) => <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><span className="font-medium text-slate-900 dark:text-white">{d.name} <span className="text-xs font-normal text-slate-500">· {d.brands.join(', ') || 'no brands'} · {[d.suburb || d.city, d.state].filter(Boolean).join(', ')} · {d.email ?? ''} · {fmtDay(d.createdAt)}</span></span><div className="flex gap-1"><button type="button" disabled={busy} onClick={() => act(() => autoApi.admin.dealership(d.id, { isVerified: true }), 'Verified')} className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">Verify</button><button type="button" disabled={busy} onClick={() => act(() => autoApi.admin.dealership(d.id, { isVerified: true, featuredDays: 30 }), 'Verified and featured')} className="rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-white">Verify and feature</button><Confirm label="Hide" tone="slate" onConfirm={() => act(() => autoApi.admin.dealership(d.id, { isActive: false }), 'Hidden')} /></div></li>)}{o.dealerships.length === 0 && <li className="text-sm text-slate-500">None waiting.</li>}</ul>
          </Panel>
          <Panel title={`Listings held by the checks (${o.listings.length})`} intro="Read it as a buyer would. Let it through, or take it down with a reason the seller can act on.">
            <ul className="space-y-2">{o.listings.map((l) => <li key={l.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/cars/preloved/${l.id}`} className="font-medium text-slate-900 hover:text-rose-600 dark:text-white">{l.title}</Link><span className="text-xs text-slate-500">{aud0(l.price)} · {km(l.odometerKm)} · {l.seller.name} · score {l.riskScore}</span></div><p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{(l.riskFlags ?? []).join(', ')}</p><div className="mt-2 flex flex-wrap gap-1"><button type="button" disabled={busy} onClick={() => act(() => autoApi.admin.listing(l.id, { status: 'ACTIVE' }), 'Live')} className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">Let it through</button><HoldReason busy={busy} onSend={(r) => act(() => autoApi.admin.listing(l.id, { status: 'SUSPENDED', suspendedReason: r }), 'Kept held, reason sent')} /><Confirm label="Take down" onConfirm={() => act(() => autoApi.admin.listing(l.id, { status: 'WITHDRAWN', suspendedReason: 'Removed by ATHENA' }), 'Taken down')} /></div></li>)}{o.listings.length === 0 && <li className="text-sm text-slate-500">None held.</li>}</ul>
          </Panel>
          <Panel title={`Disputes (${o.disputes.length})`} intro="Both sides have been asked for the facts. Decide on the purchase page.">
            <ul className="space-y-2">{o.disputes.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><span><span className="font-medium text-slate-900 dark:text-white">{p.listing.title}</span><span className="text-xs text-slate-500"> · {aud0(p.agreedAmount ?? p.offerAmount)} · {p.buyer.name} v {p.seller.name} · opened {p.disputeOpenedAt ? fmtDay(p.disputeOpenedAt) : ''}</span><p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{p.disputeReason}</p></span><Link href={`/dashboard/cars/purchases/${p.id}`} className="btn-primary text-xs">Decide</Link></li>)}{o.disputes.length === 0 && <li className="text-sm text-slate-500">None open.</li>}</ul>
          </Panel>
          <Panel title={`Finance desk (${o.applications.length})`} intro="Read it the way a lender would, then mark it read or close it with a note. ATHENA holds no credit licence and no lender has seen it, so there is no approval to give — her estimate stays on her page either way.">
            <ul className="space-y-3">{o.applications.map((a) => { const d = decision[a.id] ?? { status: 'IN_REVIEW', note: '' }; const setD = (v: Partial<typeof d>) => setDecision((x) => ({ ...x, [a.id]: { ...d, ...v } })); return <li key={a.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-900 dark:text-white">{a.referenceCode} · {a.applicant?.name} <span className="text-xs font-normal text-slate-500">{a.applicant?.email}</span></span><StatusChip status={a.status} /></div><p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{aud0(a.amount)} over {a.termMonths} months for a {aud0(a.vehiclePrice)} {a.purpose.toLowerCase()} car · income {aud0(a.incomeAnnual)} · expenses {aud0(a.expensesMonthly)}/mo · other debts {aud0(a.otherDebtsMonthly)}/mo · {a.employment.toLowerCase().replace('_', ' ')}{a.employmentMonths ? ` ${a.employmentMonths} months` : ''} · {a.residency?.toLowerCase() ?? ''} · readiness {a.readinessScore}</p><ul className="mt-1 list-disc pl-5 text-xs text-slate-500">{a.readinessNotes.slice(0, 4).map((n) => <li key={n}>{n}</li>)}</ul><div className="mt-2 grid gap-2 sm:grid-cols-2"><Field label="Decision"><SelectInput value={d.status} onChange={(v) => setD({ status: v })} options={[{ value: 'IN_REVIEW', label: 'Mark read' }, { value: 'WITHDRAWN', label: 'Close with a note' }]} /></Field><div className="flex items-end pb-1"><button type="button" disabled={busy} onClick={() => act(() => autoApi.admin.finance(a.id, { status: d.status, decisionNote: d.note || undefined }), 'Decision sent')} className="btn-primary w-full text-xs">Send</button></div></div><input value={d.note} onChange={(e) => setD({ note: e.target.value })} placeholder="A note the applicant will read" className={`${inputClass} mt-1`} /></li>; })}{o.applications.length === 0 && <li className="text-sm text-slate-500">Nothing waiting.</li>}</ul>
          </Panel>
          <Panel title="Referral fees" intro={ledgerIntro(o.referrals.totals)} aside={<Link href="/dashboard/cars/admin/referrals" className="btn-primary text-xs">The whole ledger</Link>}>
            {o.referrals.attention.length > 0 && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">{o.referrals.attention.length === 1 ? 'One fee needs' : `${o.referrals.attention.length} fees need`} a look: money against a void fee, a fee marked paid with no payment behind it, more paid than owed, or a Stripe payment not yet checked. <Link href="/dashboard/cars/admin/referrals" className="font-semibold underline-offset-2 hover:underline">See them on the ledger</Link>.</p>}
            <ul className="space-y-2">{o.referrals.open.map((r) => <ReferralLedgerItem key={r.id} referral={r} methods={o.referrals.methods} stripeConfigured={o.referrals.stripeConfigured} onChanged={data.reload} />)}{o.referrals.open.length === 0 && <li className="text-sm text-slate-500">Nothing owed right now.</li>}</ul>
            <AddReferralFee onDone={data.reload} />
            <p className="mt-2 text-xs leading-5 text-slate-500">{Object.values(o.referrals.fees).map((f) => f.words).join(' ')}</p>
          </Panel>
          <Panel title={`The new-car catalogue (${o.catalogue.due} to check)`} intro={`${o.catalogue.active} cars members can compare. ${o.catalogue.due === 0 ? `Every one has been checked in the last ${o.catalogue.recheckDays} days.` : `${o.catalogue.due} have never been checked by the team, or not in the last ${o.catalogue.recheckDays} days.`}${o.catalogue.ancapLapsed ? ` ${o.catalogue.ancapLapsed} carry an ANCAP rating that has lapsed; see whether the current model has been tested.` : ''}`} aside={<Link href="/dashboard/cars/admin/catalogue" className="btn-primary text-xs">Keep the catalogue</Link>}>
            <p className="text-xs text-slate-500">Prices, ANCAP ratings, consumption, warranties and servicing costs, each with the date it was checked and where it came from. Edit a car, record that it is still right, or bring in a corrected spreadsheet.</p>
          </Panel>
          <Panel title={`Inspection requests nobody has taken (${o.inspections.length})`} intro="Workshops that do inspections in the state have been told. If one sits, ring a workshop.">
            <ul className="space-y-1">{o.inspections.map((i) => <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-800/60"><span>{i.listing.year} {i.listing.make} {i.listing.model} · {i.listing.state} · {fmtDay(i.createdAt)} · asked by {i.requestedBy}</span><Link href={`/cars/preloved/${i.listing.id}`} className="btn-ghost text-xs">Listing</Link></li>)}{o.inspections.length === 0 && <li className="text-sm text-slate-500">None waiting.</li>}</ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
