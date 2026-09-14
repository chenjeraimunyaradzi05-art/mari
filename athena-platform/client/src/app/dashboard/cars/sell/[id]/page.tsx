'use client';

/**
 * Managing one listing: the offers that have come in and each purchase's
 * state, the inspections, the listing's own checks, and the edit form.
 * Withdraw it, mark it sold elsewhere, or publish a draft.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Tag } from 'lucide-react';
import { autoApi, autoError, aud0, type InspectionCard, type ListingCard, type PurchaseCard } from '@/lib/automotive-api';
import { AutoNav, Confirm, ErrorBox, Loading, PageTitle, StatusChip, VerdictChip, fmtDay, useLoad } from '@/components/automotive/AutoUi';
import { Panel } from '@/components/strategy/StrategyUi';
import { EMPTY_LISTING, ListingFields, toPayload, type ListingForm } from '../page';

type Detail = ListingCard & { description: string; features: string[]; ppsrCertificateUrl: string | null; isOwner: boolean; guide: { guideLow: number; guideHigh: number; verdict: string; words: string }; beforeYouPay: Array<{ key: string; label: string; advice: string }>; inspections: Array<Partial<InspectionCard> & { id: string; kind: string; status: string; outcome: string | null; summary: string | null; completedAt: string | null; inspector: { name: string } | null }> };

export default function ManageListingPage() {
  const params = useParams<{ id: string }>();
  const data = useLoad<Detail>(() => autoApi.listing(params.id), [params.id]);
  const purchases = useLoad<{ selling: PurchaseCard[] }>(() => autoApi.purchases());
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<ListingForm>(EMPTY_LISTING);
  const [busy, setBusy] = useState(false);
  const l = data.data;
  const offers = (purchases.data?.selling ?? []).filter((p) => p.listing.id === params.id);

  useEffect(() => { if (l) setF({ ...EMPTY_LISTING, title: l.title, make: l.make, model: l.model, year: String(l.year), variant: l.variant ?? '', bodyType: l.bodyType, fuelType: l.fuelType, transmission: l.transmission, odometerKm: String(l.odometerKm), price: String(l.price), colour: l.colour ?? '', seats: l.seats ? String(l.seats) : '', description: l.description, features: l.features.join(', '), photos: l.photos, videoUrl: l.videoUrl ?? '', suburb: l.suburb ?? '', city: l.city ?? '', state: l.state, postcode: l.postcode ?? '', vin: l.vin ?? '', rego: l.rego ?? '', regoExpires: l.regoExpires ?? '', serviceHistory: l.serviceHistory, accidentHistory: l.accidentHistory, ownersCount: l.ownersCount ? String(l.ownersCount) : '', ppsrChecked: l.ppsrChecked, ppsrCertificateUrl: l.ppsrCertificateUrl ?? '', roadworthy: l.roadworthy, warranty: l.warranty, warrantyNote: l.warrantyNote ?? '' }); }, [l]);

  const act = async (fn: () => Promise<unknown>, done: string) => { setBusy(true); try { await fn(); toast.success(done); data.reload(); purchases.reload(); } catch (err) { toast.error(autoError(err, 'That did not work.')); } finally { setBusy(false); } };
  const save = (publish?: boolean) => act(() => autoApi.updateListing(params.id, { ...toPayload(f), ...(publish === undefined ? {} : { publish }) }), publish ? 'Published' : 'Saved');

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <AutoNav current="/dashboard/cars/sell" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {l && (
        <>
          <PageTitle icon={Tag} kicker="Your listing" title={l.title} blurb={`${aud0(l.price)} · ${l.viewCount} views · saved ${l.saveCount} time${l.saveCount === 1 ? '' : 's'} · listed ${fmtDay(l.createdAt)}`} action={<div className="flex flex-wrap items-center gap-2"><StatusChip status={l.status} /><VerdictChip verdict={l.priceVerdict} />{['ACTIVE', 'UNDER_OFFER', 'SOLD'].includes(l.status) && <Link href={`/cars/preloved/${l.id}`} className="btn-ghost text-sm">View as a buyer</Link>}</div>} />
          {l.status === 'SUSPENDED' && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm dark:border-rose-800 dark:bg-rose-900/20"><p className="font-semibold text-rose-900 dark:text-rose-100">{l.suspendedReason ?? 'Held for review'}</p><p className="mt-1 text-rose-800 dark:text-rose-200">It tripped these checks: {(l.riskFlags ?? []).join(', ') || 'none recorded'}. Fixing them (photos, the VIN, a PPSR certificate, a price nearer the guide, plainer words) and saving sends it back for review.</p></div>}
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Offers and purchases" intro={offers.length ? 'Accept one to agree the price; the buyer then pays and the money is held.' : 'No offers yet. A fair price, eight photos and a PPSR certificate bring them.'}>
              <ul className="space-y-2">{offers.map((p) => <li key={p.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium text-slate-900 dark:text-white">{aud0(p.agreedAmount ?? p.offerAmount)} from {p.buyer.name}</span><StatusChip status={p.status} /></div>{p.message && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">“{p.message}”</p>}<p className="mt-1 text-xs text-slate-500">{p.nextStep}</p><div className="mt-2 flex flex-wrap gap-2">{p.status === 'OFFERED' && <><button type="button" disabled={busy} onClick={() => act(() => autoApi.acceptOffer(p.id), 'Accepted. The buyer has been asked to pay.')} className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Accept</button><button type="button" disabled={busy} onClick={() => act(() => autoApi.declineOffer(p.id), 'Declined')} className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">Decline</button></>}<Link href={`/dashboard/cars/purchases/${p.id}`} className="btn-ghost text-xs">Open</Link></div></li>)}</ul>
            </Panel>
            <Panel title="Inspections and checks" intro="What buyers have asked for, and the checks your listing is shown with.">
              {l.inspections.length > 0 && <ul className="mb-3 space-y-1 text-sm">{l.inspections.map((i) => <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60"><span>{i.kind === 'SELLER_PROVIDED' ? 'Your report' : i.inspector ? `By ${i.inspector.name}` : 'Requested by a buyer'}{i.completedAt ? ` · ${fmtDay(i.completedAt)}` : ''}</span><StatusChip status={i.outcome ?? i.status} /></li>)}</ul>}
              {l.beforeYouPay.length ? <ul className="space-y-1.5 text-sm">{l.beforeYouPay.map((b) => <li key={b.key}><span className="font-medium text-slate-900 dark:text-white">{b.label}.</span> <span className="text-slate-600 dark:text-slate-400">{b.advice}</span></li>)}</ul> : <p className="text-sm text-emerald-700 dark:text-emerald-300">Nothing flagged. Buyers see a clean listing.</p>}
              <p className="mt-3 text-xs text-slate-500">Guide {aud0(l.guide.guideLow)} to {aud0(l.guide.guideHigh)}. {l.guide.words}</p>
            </Panel>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setEditing((x) => !x)} className="btn-secondary text-sm">{editing ? 'Close the editor' : 'Edit the listing'}</button>
            {l.status === 'DRAFT' && <button type="button" disabled={busy} onClick={() => save(true)} className="btn-primary text-sm disabled:opacity-50">Publish</button>}
            {['ACTIVE', 'UNDER_OFFER', 'DRAFT', 'SUSPENDED'].includes(l.status) && <Confirm label="Withdraw" tone="slate" hint="Open offers are cancelled." onConfirm={() => act(() => autoApi.withdrawListing(l.id), 'Withdrawn')} />}
            {['ACTIVE', 'UNDER_OFFER'].includes(l.status) && <Confirm label="Sold elsewhere" tone="slate" hint="Marks it sold and cancels open offers." onConfirm={() => act(() => autoApi.markSold(l.id), 'Marked sold')} />}
          </div>
          {editing && <div className="space-y-6"><ListingFields f={f} setF={setF} /><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => save()} className="btn-primary text-sm disabled:opacity-50">Save changes</button><button type="button" onClick={() => setEditing(false)} className="btn-ghost text-sm">Cancel</button></div></div>}
        </>
      )}
    </div>
  );
}
