'use client';

/**
 * One pre-loved car: the photos, the price against the guide, what the
 * seller declared, the checks to run (PPSR, the registration, an
 * inspection), the inspection reports already done, what it costs to run
 * and to finance, and the way to buy it: an offer, then the money held
 * under buyer protection. The VIN is masked until you are the buyer.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Heart, MessageSquare, ShieldCheck, Tag } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { useAuth } from '@/lib/hooks';
import { autoApi, autoError, aud0, km, type InspectionCard, type ListingCard } from '@/lib/automotive-api';
import { AutoDisclaimer, Chip, ErrorBox, Kv, Loading, PageTitle, PhotoStrip, StatusChip, VerdictChip, fmtDay, useLoad, useReference } from '@/components/automotive/AutoUi';
import { Field, NumberInput, Panel, Stat, inputClass, num } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Detail = ListingCard & { description: string; features: string[]; ppsrCertificateUrl: string | null; isOwner: boolean; canOffer: boolean; guide: { guideLow: number; guideHigh: number; verdict: string; differencePct: number; words: string; assumed: boolean }; beforeYouPay: Array<{ key: string; label: string; advice: string }>; checks: { ppsr: { name: string; url: string; what: string; ready: boolean }; rego: { name: string; url: string; what: string; ready: boolean } | null; inspection: { name: string; what: string; sections: string[] }; fraudSigns: string[] }; protection: { inspectionDays: number; steps: string[]; feePercent: number }; inspections: Array<Partial<InspectionCard> & { id: string; kind: string; status: string; outcome: string | null; summary: string | null; report?: Array<{ key: string; label: string; result: string; notes: string }>; reportUrl: string | null; completedAt: string | null; inspector: { name: string; slug: string } | null; isMine: boolean; fee: number }>; myPurchase: { id: string; status: string; offerAmount: number } | null; sellerListings: number; running: { perWeek: number; perYear: number }; finance: { repayment: number; ratePct: number; deposit: number } };

const HISTORY: Record<string, string> = { FULL: 'Full service history', PARTIAL: 'Partial service history', NONE: 'No service history', UNKNOWN: 'Service history not stated' };
const ACCIDENT: Record<string, string> = { NONE: 'No accident history declared', MINOR_REPAIRED: 'Minor accident, repaired', MAJOR_REPAIRED: 'Major accident, repaired', UNKNOWN: 'Accident history unknown' };
const WARRANTY: Record<string, string> = { NONE: 'No warranty', BALANCE_OF_NEW_CAR: 'Balance of the new-car warranty', STATUTORY: 'Statutory dealer warranty', DEALER: 'Dealer warranty', EXTENDED: 'Extended warranty' };

export default function ListingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const data = useLoad<Detail>(() => autoApi.listing(params.id), [params.id]);
  const ref = useReference();
  const [offer, setOffer] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const l = data.data;

  const makeOffer = async () => {
    if (!l) return;
    setBusy(true);
    try { const res = await autoApi.offer(l.id, { amount: num(offer), message: message || undefined }); toast.success('Offer sent. You will hear when the seller answers.'); router.push(`/dashboard/cars/purchases/${res.data.data.id}`); }
    catch (err) { toast.error(autoError(err, 'That offer could not be sent.')); } finally { setBusy(false); }
  };
  const inspect = async () => {
    if (!l) return;
    setBusy(true);
    try { await autoApi.requestInspection(l.id, { kind: 'ATHENA_VETTED' }); toast.success('Requested. Workshops nearby that do inspections have been told; the fee is paid when one takes it on.'); data.reload(); }
    catch (err) { toast.error(autoError(err, 'That could not be requested.')); } finally { setBusy(false); }
  };
  const save = async () => { if (!l) return; try { if (l.saved) await autoApi.unsaveListing(l.id); else await autoApi.saveListing(l.id); data.reload(); } catch (err) { toast.error(autoError(err, 'That did not work.')); } };

  return (
    <PageShell width="wide" backTo={{ href: '/cars/preloved', label: 'Back to pre-loved' }}>
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {l && (
        <div className="space-y-6">
          <PageTitle icon={Tag} kicker={`${l.sellerKind === 'DEALER' ? 'Dealer' : 'Private seller'} · ${[l.suburb || l.city, l.state].filter(Boolean).join(', ')}`} title={l.title} blurb={`${l.year} ${l.make} ${l.model}${l.variant ? ` ${l.variant}` : ''} · ${km(l.odometerKm)} · ${l.fuelLabel} · ${l.transmission === 'MANUAL' ? 'manual' : 'automatic'}`} action={<div className="flex flex-wrap gap-2"><StatusChip status={l.status} />{l.isOwner && <Link href={`/dashboard/cars/sell/${l.id}`} className="btn-secondary text-sm">Edit your listing</Link>}</div>} />
          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <div className="space-y-6">
              <PhotoStrip photos={l.photos} title={l.title} />
              {l.videoUrl && <a href={l.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-rose-600">Watch the seller's walk-around video</a>}
              <Panel title="What the seller says">
                <p className="whitespace-pre-line text-sm leading-7 text-slate-800 dark:text-slate-200">{l.description}</p>
                {l.features.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{l.features.map((f) => <Chip key={f}>{f}</Chip>)}</div>}
                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Kv k="Body" v={`${l.bodyLabel}${l.seats ? `, ${l.seats} seats` : ''}`} /><Kv k="Colour" v={l.colour ?? 'Not stated'} /><Kv k="Owners" v={l.ownersCount ?? 'Not stated'} />
                  <Kv k="Service history" v={HISTORY[l.serviceHistory]} /><Kv k="Accidents" v={ACCIDENT[l.accidentHistory] ?? l.accidentHistory} /><Kv k="Warranty" v={`${WARRANTY[l.warranty]}${l.warrantyNote ? `: ${l.warrantyNote}` : ''}`} />
                  <Kv k="Registration" v={l.regoExpires ? `Until ${fmtDay(l.regoExpires, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Not stated'} /><Kv k="Safety certificate" v={l.roadworthy ? 'Yes' : 'Not yet'} /><Kv k="VIN" v={l.vin ? <span className="font-mono">{l.vin}</span> : 'Not given'} />
                </dl>
                {ref.data?.warranty && (
                  <details className="mt-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                    <summary className="cursor-pointer font-medium text-slate-900 dark:text-white">{l.sellerKind === 'DEALER' ? 'What a dealer\'s car comes with, warranty or not' : 'Warranties on a private sale, and the extended kind'}</summary>
                    <p className="mt-2 text-slate-700 dark:text-slate-300">{l.sellerKind === 'DEALER' ? ref.data.warranty.worthIt[0] : ref.data.warranty.worthIt[1]}</p>
                    <p className="mt-2 text-slate-700 dark:text-slate-300">{ref.data.warranty.what}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600 dark:text-slate-400">{ref.data.warranty.worthIt.slice(2).map((s) => <li key={s}>{s}</li>)}<li>Typically {aud0(ref.data.warranty.costRange.low)} to {aud0(ref.data.warranty.costRange.high)}. Usually does not cover {ref.data.warranty.doesNotCover[0].toLowerCase()}.</li></ul>
                    <p className="mt-2 text-xs text-slate-500">{ref.data.warranty.rights}</p>
                  </details>
                )}
              </Panel>

              <Panel icon={ShieldCheck} title="Before you pay" intro="The checks, in the order that catches the most. None of them takes long.">
                <ul className="space-y-3 text-sm">
                  <li className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60"><p className="font-medium text-slate-900 dark:text-white">1. {l.checks.ppsr.name} <span className={cn('ml-1 text-xs', l.checks.ppsr.ready ? 'text-emerald-600' : 'text-amber-600')}>{l.checks.ppsr.ready ? (l.ppsrChecked ? '· seller has attached one; run your own too' : '· VIN available') : '· ask the seller for the VIN first'}</span></p><p className="text-slate-600 dark:text-slate-400">{l.checks.ppsr.what}</p><div className="mt-1 flex flex-wrap gap-3"><a href={l.checks.ppsr.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-600">ppsr.gov.au</a>{l.ppsrCertificateUrl && <a href={l.ppsrCertificateUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-600">The seller's certificate</a>}</div></li>
                  {l.checks.rego && <li className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60"><p className="font-medium text-slate-900 dark:text-white">2. {l.checks.rego.name}</p><p className="text-slate-600 dark:text-slate-400">{l.checks.rego.what}</p><a href={l.checks.rego.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-600">Check the plates</a></li>}
                  <li className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60"><p className="font-medium text-slate-900 dark:text-white">3. {l.checks.inspection.name} <span className="text-xs text-slate-500">· from about {aud0(l.inspections[0]?.fee || 250)}</span></p><p className="text-slate-600 dark:text-slate-400">{l.checks.inspection.what}</p>
                    {l.inspections.length > 0 && <ul className="mt-2 space-y-2">{l.inspections.map((i) => <li key={i.id} className="rounded-md border border-slate-200 p-2 dark:border-slate-700"><div className="flex flex-wrap items-center gap-2"><StatusChip status={i.outcome ?? i.status} /><span className="text-xs text-slate-500">{i.kind === 'SELLER_PROVIDED' ? 'Provided by the seller' : i.inspector ? `By ${i.inspector.name}` : 'Awaiting a workshop'}{i.completedAt ? ` · ${fmtDay(i.completedAt)}` : ''}{i.isMine ? ' · yours' : ''}</span></div>{i.summary && <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{i.summary}</p>}{i.report && i.report.length > 0 && <ul className="mt-1 grid gap-1 sm:grid-cols-2">{i.report.map((s) => <li key={s.key} className="text-xs"><span className={cn('font-semibold', s.result === 'PASS' ? 'text-emerald-700' : s.result === 'FAIL' ? 'text-rose-700' : 'text-amber-700')}>{s.result}</span> {s.label}{s.notes ? `: ${s.notes}` : ''}</li>)}</ul>}{i.reportUrl && <a href={i.reportUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-rose-600">The report file</a>}</li>)}</ul>}
                    {!l.isOwner && isAuthenticated && l.canOffer && !l.inspections.some((i) => i.isMine && ['REQUESTED', 'ASSIGNED', 'SCHEDULED'].includes(i.status)) && <button type="button" onClick={inspect} disabled={busy} className="btn-secondary mt-2 text-sm disabled:opacity-50">Request an ATHENA-vetted inspection</button>}
                  </li>
                </ul>
                {l.beforeYouPay.length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Worth knowing about this listing</p><ul className="mt-1 space-y-1.5">{l.beforeYouPay.map((b) => <li key={b.key} className="text-sm"><span className="font-medium text-slate-900 dark:text-white">{b.label}.</span> <span className="text-slate-600 dark:text-slate-400">{b.advice}</span></li>)}</ul></div>}
              </Panel>
            </div>

            <div className="space-y-6">
              <Panel title="The price">
                <div className="flex flex-wrap items-center gap-3"><span className="text-3xl font-semibold text-slate-900 dark:text-white">{aud0(l.price)}</span><VerdictChip verdict={l.guide.verdict} /></div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Guide {aud0(l.guide.guideLow)} to {aud0(l.guide.guideHigh)}{l.guide.assumed ? ', from a typical new price' : ''}. {l.guide.words}</p>
                <div className="mt-3 grid grid-cols-2 gap-2"><Stat label="To run, a week" value={aud0(l.running.perWeek)} sub="fuel, insurance, rego, servicing, tyres, value lost" /><Stat label="Financed, a month" value={aud0(l.finance.repayment)} sub={`with ${aud0(l.finance.deposit)} down at ${l.finance.ratePct}% over 5 years`} /></div>
                <div className="mt-3 flex flex-wrap gap-2"><Link href={`/cars/finance?price=${l.price}`} className="btn-ghost text-sm">Loans compared</Link><Link href={`/cars/insurance?value=${l.price}&fuel=${l.fuelType}`} className="btn-ghost text-sm">Insurance estimate</Link></div>
              </Panel>

              {l.myPurchase ? (
                <Panel title="Your offer" intro="Every step, and where the money is, lives on the purchase page.">
                  <div className="flex flex-wrap items-center gap-2"><StatusChip status={l.myPurchase.status} /><span className="text-sm text-slate-700 dark:text-slate-300">{aud0(l.myPurchase.offerAmount)}</span></div>
                  <Link href={`/dashboard/cars/purchases/${l.myPurchase.id}`} className="btn-primary mt-3 inline-block text-sm">Open the purchase</Link>
                </Panel>
              ) : l.canOffer ? (
                <Panel icon={ShieldCheck} title="Make an offer" intro={`Accepted, you pay through ATHENA and the money is held. It reaches the seller ${l.protection.inspectionDays} days after you confirm you have the car, unless you open a dispute. ATHENA's ${l.protection.feePercent}% comes from the seller's side.`}>
                  <Field label="Your offer"><NumberInput value={offer} onChange={setOffer} prefix="$" placeholder={String(l.price)} /></Field>
                  <Field label="A word to the seller" className="mt-3"><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} className={inputClass} placeholder="When you could collect, and what you would like to see first." /></Field>
                  <button type="button" onClick={makeOffer} disabled={busy || num(offer) <= 0} className="btn-primary mt-3 w-full text-sm disabled:opacity-50">Send the offer</button>
                  <a href={`/dashboard/messages?user=${l.seller.id}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600"><MessageSquare className="h-4 w-4" /> Message the seller first</a>
                </Panel>
              ) : !isAuthenticated ? (
                <Panel title="Buy it with the money held"><p className="text-sm text-slate-700 dark:text-slate-300">Sign in to make an offer, request an inspection, or save this car.</p><Link href={`/login?redirect=/cars/preloved/${l.id}`} className="btn-primary mt-3 inline-block text-sm">Sign in</Link></Panel>
              ) : l.isOwner ? (
                <Panel title="This is your listing" intro={`${l.viewCount} views, saved ${l.saveCount} time${l.saveCount === 1 ? '' : 's'}.`}><Link href={`/dashboard/cars/sell/${l.id}`} className="btn-primary text-sm">Manage it</Link></Panel>
              ) : (
                <Panel title={l.status === 'SOLD' ? 'Sold' : 'Not available'} intro="This car has found its buyer."><Link href="/cars/preloved" className="btn-secondary text-sm">More like it</Link></Panel>
              )}

              <Panel title="The seller" intro={`${l.seller.name} · on ATHENA since ${new Date(l.seller.memberSince).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })} · ${l.sellerListings} listing${l.sellerListings === 1 ? '' : 's'}`}>
                {l.dealership && <Link href={`/cars/dealerships/${l.dealership.slug}`} className="text-sm font-semibold text-rose-600">{l.dealership.name}</Link>}
                <div className="mt-2 flex flex-wrap gap-2">{isAuthenticated && !l.isOwner && <button type="button" onClick={save} className={cn('inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold', l.saved ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300')}><Heart className={cn('h-3.5 w-3.5', l.saved && 'fill-current')} /> {l.saved ? 'Saved' : 'Save this car'}</button>}<Link href="/report" className="btn-ghost text-xs">Report this listing</Link></div>
              </Panel>
            </div>
          </div>
          <AutoDisclaimer what="The price guide is an estimate from typical depreciation, not a valuation." />
        </div>
      )}
    </PageShell>
  );
}
