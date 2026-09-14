'use client';

/**
 * A dealership: what it carries, its used stock listed under buyer
 * protection, the new models in the catalogue for its brands, a test
 * drive request, and a trade-in request addressed to it.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Globe, MessageSquare, Phone, Store } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { useAuth } from '@/lib/hooks';
import { autoApi, autoError, aud0, km, type CarCard, type DealershipCard, type ListingCard, type VehicleCard } from '@/lib/automotive-api';
import { AncapBadge, Chip, ErrorBox, Loading, PageTitle, Stars, VerdictChip, useLoad, useReference } from '@/components/automotive/AutoUi';
import { Field, NumberInput, Panel, SelectInput, inputClass, num } from '@/components/strategy/StrategyUi';
import { safeHref } from '@/lib/safe-href';

type Detail = DealershipCard & { about: string | null; email: string | null; isOwner: boolean; listings: ListingCard[]; models: CarCard[]; canRequest: boolean };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DealershipPage() {
  const params = useParams<{ slug: string }>();
  const ref = useReference();
  const { isAuthenticated } = useAuth();
  const data = useLoad<Detail>(() => autoApi.dealership(params.slug), [params.slug]);
  const garage = useLoad<{ vehicles: VehicleCard[] }>(() => (isAuthenticated ? autoApi.garage() : Promise.resolve({ data: { data: { vehicles: [] } } } as never)), [isAuthenticated]);
  const [drive, setDrive] = useState({ carModelId: '', preferredAt: '', note: '' });
  const [trade, setTrade] = useState({ vehicleId: '', make: '', model: '', year: '', odometerKm: '', condition: 'GOOD', notes: '' });
  const [busy, setBusy] = useState(false);
  const d = data.data;

  const requestDrive = async () => {
    if (!d) return;
    setBusy(true);
    try { await autoApi.requestTestDrive({ dealershipId: d.id, carModelId: drive.carModelId || undefined, preferredAt: new Date(drive.preferredAt).toISOString(), note: drive.note || undefined }); toast.success('Requested. The dealership will confirm a time.'); setDrive({ carModelId: '', preferredAt: '', note: '' }); }
    catch (err) { toast.error(autoError(err, 'That could not be requested.')); } finally { setBusy(false); }
  };
  const requestTrade = async () => {
    if (!d) return;
    setBusy(true);
    try { await autoApi.requestTradeIn({ dealershipId: d.id, vehicleId: trade.vehicleId || undefined, make: trade.make || undefined, model: trade.model || undefined, year: trade.year ? num(trade.year) : undefined, odometerKm: trade.odometerKm ? num(trade.odometerKm) : undefined, condition: trade.condition, notes: trade.notes || undefined }); toast.success('Sent. Their quote lands on your requests page beside the guide.'); }
    catch (err) { toast.error(autoError(err, 'That could not be sent.')); } finally { setBusy(false); }
  };

  return (
    <PageShell width="wide" backTo={{ href: '/cars/dealerships', label: 'Back to dealerships' }}>
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {d && (
        <div className="space-y-6">
          <PageTitle icon={Store} kicker={[d.suburb || d.city, d.state].filter(Boolean).join(', ') || 'Dealership'} title={d.name} blurb={d.headline} action={d.isOwner ? <Link href="/dashboard/cars/dealership" className="btn-secondary text-sm">Edit your dealership</Link> : undefined} />
          <div className="flex flex-wrap items-center gap-2">{d.womenLed && <Chip tone="rose">Women-led</Chip>}{d.financeAvailable && <Chip tone="emerald">Finance on site{d.financePartners.length ? `: ${d.financePartners.join(', ')}` : ''}</Chip>}{d.isVerified && <Chip tone="amber">Verified</Chip>}{d.brands.map((b) => <Chip key={b}>{b}</Chip>)}<Stars value={d.ratingAvg} count={d.ratingCount || undefined} label="No buyer ratings yet" />{d.contactUserId && !d.isOwner && isAuthenticated && <a href={`/dashboard/messages?user=${d.contactUserId}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600"><MessageSquare className="h-4 w-4" /> Message the dealership</a>}</div>
          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <div className="space-y-6">
              {d.about && <Panel title="About"><p className="whitespace-pre-line text-sm leading-7 text-slate-800 dark:text-slate-200">{d.about}</p><div className="mt-3 flex flex-wrap gap-3 text-sm">{d.phone && <a href={`tel:${d.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 text-rose-600"><Phone className="h-4 w-4" /> {d.phone}</a>}{d.website && <a href={safeHref(d.website)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-rose-600"><Globe className="h-4 w-4" /> Website</a>}{d.address && <span className="text-slate-600 dark:text-slate-400">{d.address}</span>}</div>{d.hours && <ul className="mt-3 grid grid-cols-2 gap-1 text-xs text-slate-600 sm:grid-cols-4 dark:text-slate-400">{DAYS.map((day, i) => <li key={day}>{day}: {d.hours?.[String(i)]?.map((r) => `${r[0]}–${r[1]}`).join(', ') ?? 'closed'}</li>)}</ul>}</Panel>}
              <Panel title="Used stock, under buyer protection" intro={d.listings.length ? `${d.listings.length} listed. ATHENA's fee on a dealer sale is ${ref.data?.fees.purchasePercent.DEALER ?? 4}%.` : 'Nothing listed right now.'}>
                <ul className="grid gap-3 sm:grid-cols-2">{d.listings.map((l) => <li key={l.id}><Link href={`/cars/preloved/${l.id}`} className="tile-soft block h-full overflow-hidden">{l.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photos[0]} alt="" className="aspect-[4/3] w-full object-cover" />) : <div className="aspect-[4/3] w-full bg-gradient-to-br from-rose-100 via-purple-50 to-amber-50 dark:from-rose-900/20 dark:via-purple-900/10 dark:to-amber-900/10" />}<div className="p-3"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900 dark:text-white">{aud0(l.price)}</span><VerdictChip verdict={l.priceVerdict} /></div><p className="text-sm text-slate-800 dark:text-slate-200">{l.year} {l.make} {l.model}</p><p className="text-xs text-slate-500">{km(l.odometerKm)} · {l.fuelLabel}</p></div></Link></li>)}</ul>
              </Panel>
              {d.models.length > 0 && <Panel title="New, from the catalogue" intro="The models in ATHENA's catalogue for the brands this dealership carries.">
                <ul className="grid gap-2 sm:grid-cols-2">{d.models.map((c) => <li key={c.id}><Link href={`/cars/new/${c.slug}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-sm hover:bg-rose-50 dark:bg-slate-800/60"><span className="text-slate-800 dark:text-slate-200">{c.make} {c.model} <span className="text-xs text-slate-500">from {aud0(c.priceFrom)}</span></span><AncapBadge ancap={c.ancap} stars={c.ancapStars} compact /></Link></li>)}</ul>
              </Panel>}
            </div>
            <div className="space-y-6">
              <Panel title="Book a test drive" intro="Requested first; the dealership confirms a time.">
                {!d.canRequest ? <Link href={`/login?redirect=/cars/dealerships/${d.slug}`} className="btn-primary inline-block text-sm">Sign in to book</Link> : (
                  <div className="space-y-3">
                    <Field label="Which car"><SelectInput value={drive.carModelId} onChange={(v) => setDrive((x) => ({ ...x, carModelId: v }))} options={[{ value: '', label: 'Any, I will say in the note' }, ...d.models.map((c) => ({ value: c.id, label: `${c.make} ${c.model}` }))]} /></Field>
                    <Field label="When suits you"><input type="datetime-local" value={drive.preferredAt} onChange={(e) => setDrive((x) => ({ ...x, preferredAt: e.target.value }))} className={inputClass} /></Field>
                    <Field label="A note"><input value={drive.note} onChange={(e) => setDrive((x) => ({ ...x, note: e.target.value }))} maxLength={300} className={inputClass} /></Field>
                    <button type="button" onClick={requestDrive} disabled={busy || !drive.preferredAt} className="btn-primary w-full text-sm disabled:opacity-50">Request a test drive</button>
                  </div>
                )}
              </Panel>
              <Panel title="Ask for a trade-in quote" intro="The guide is written in with your request, so you know where their number sits.">
                {!d.canRequest ? <p className="text-sm text-slate-500">Sign in to ask.</p> : (
                  <div className="space-y-3">
                    {garage.data && garage.data.vehicles.length > 0 && <Field label="From your garage"><SelectInput value={trade.vehicleId} onChange={(v) => setTrade((x) => ({ ...x, vehicleId: v }))} options={[{ value: '', label: 'Describe it below' }, ...garage.data.vehicles.map((v) => ({ value: v.id, label: v.name }))]} /></Field>}
                    {!trade.vehicleId && <div className="grid grid-cols-2 gap-2"><Field label="Make"><SelectInput value={trade.make} onChange={(v) => setTrade((x) => ({ ...x, make: v }))} options={[{ value: '', label: 'Pick' }, ...(ref.data?.makes ?? []).map((m) => ({ value: m, label: m }))]} /></Field><Field label="Model"><input value={trade.model} onChange={(e) => setTrade((x) => ({ ...x, model: e.target.value }))} className={inputClass} /></Field><Field label="Year"><NumberInput value={trade.year} onChange={(v) => setTrade((x) => ({ ...x, year: v }))} /></Field><Field label="Kilometres"><NumberInput value={trade.odometerKm} onChange={(v) => setTrade((x) => ({ ...x, odometerKm: v }))} /></Field></div>}
                    <Field label="Condition"><SelectInput value={trade.condition} onChange={(v) => setTrade((x) => ({ ...x, condition: v }))} options={(ref.data?.conditions ?? []).map((c) => ({ value: c.key, label: c.label }))} /></Field>
                    <Field label="Anything to know"><input value={trade.notes} onChange={(e) => setTrade((x) => ({ ...x, notes: e.target.value }))} maxLength={300} className={inputClass} /></Field>
                    <button type="button" onClick={requestTrade} disabled={busy || (!trade.vehicleId && (!trade.make || !trade.model || !trade.year || !trade.odometerKm))} className="btn-secondary w-full text-sm disabled:opacity-50">Ask for a quote</button>
                  </div>
                )}
              </Panel>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
