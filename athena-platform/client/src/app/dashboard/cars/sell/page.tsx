'use client';

/**
 * Selling: her listings with their offers and status, and the form to
 * list a car. Photos through the shared uploader, a price guide worked
 * out as she types, the declarations a buyer will read, and the checks the
 * listing is put through before it goes live. A car from the garage
 * prefills the form.
 */

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Sparkles } from 'lucide-react';
import { autoApi, autoError, aud0, km, type ListingCard, type VehicleCard } from '@/lib/automotive-api';
import { AutoNav, Empty, ErrorBox, Loading, PageTitle, PhotoUploader, StatusChip, VerdictChip, useLoad, useReference } from '@/components/automotive/AutoUi';
import { Check, Field, NumberInput, Panel, Pending, SelectInput, Stat, inputClass, num, opt, useCalc } from '@/components/strategy/StrategyUi';

type Mine = ListingCard & { offers: number; purchases: Array<{ id: string; status: string; offerAmount: number }>; inspections: Array<{ id: string; status: string; outcome: string | null }> };
type Valuation = { low: number; mid: number; high: number; tradeIn: number; newPriceAssumed: boolean };

export const EMPTY_LISTING = { title: '', make: 'Toyota', model: '', year: String(new Date().getFullYear() - 4), variant: '', bodyType: 'SUV', fuelType: 'PETROL', transmission: 'AUTOMATIC', odometerKm: '', price: '', colour: '', seats: '', description: '', features: '', photos: [] as string[], videoUrl: '', suburb: '', city: '', state: 'QLD', postcode: '', vin: '', rego: '', regoExpires: '', serviceHistory: 'UNKNOWN', accidentHistory: 'NONE', ownersCount: '', ppsrChecked: false, ppsrCertificateUrl: '', roadworthy: false, warranty: 'NONE', warrantyNote: '', condition: 'GOOD', newPrice: '', vehicleId: '' };
export type ListingForm = typeof EMPTY_LISTING;

export function toPayload(f: ListingForm) {
  const orNull = (s: string) => (s.trim() ? s.trim() : null);
  return { title: f.title, make: f.make, model: f.model, year: num(f.year), variant: orNull(f.variant), bodyType: f.bodyType, fuelType: f.fuelType, transmission: f.transmission, odometerKm: num(f.odometerKm), price: num(f.price), colour: orNull(f.colour), seats: f.seats ? num(f.seats) : null, description: f.description, features: f.features.split(',').map((s) => s.trim()).filter(Boolean), photos: f.photos, videoUrl: orNull(f.videoUrl), suburb: orNull(f.suburb), city: orNull(f.city), state: f.state, postcode: orNull(f.postcode), vin: orNull(f.vin), rego: orNull(f.rego), regoExpires: orNull(f.regoExpires), serviceHistory: f.serviceHistory, accidentHistory: f.accidentHistory, ownersCount: f.ownersCount ? num(f.ownersCount) : null, ppsrChecked: f.ppsrChecked, ppsrCertificateUrl: orNull(f.ppsrCertificateUrl), roadworthy: f.roadworthy, warranty: f.warranty, warrantyNote: orNull(f.warrantyNote), condition: f.condition, newPrice: opt(f.newPrice), vehicleId: f.vehicleId || null };
}

export function ListingFields({ f, setF }: { f: ListingForm; setF: (fn: (x: ListingForm) => ListingForm) => void }) {
  const ref = useReference();
  const set = (k: keyof ListingForm, v: string | boolean | string[]) => setF((x) => ({ ...x, [k]: v }));
  const guide = useCalc<Valuation>(autoApi.valuation.estimate, { year: num(f.year), odometerKm: num(f.odometerKm), bodyType: f.bodyType, fuelType: f.fuelType, condition: f.condition, make: f.make, model: f.model || undefined, newPrice: opt(f.newPrice) }, num(f.odometerKm) > 0 && num(f.year) > 1980);
  return (
    <>
      <Panel title="The car">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Make"><SelectInput value={f.make} onChange={(v) => set('make', v)} options={(ref.data?.makes ?? ['Toyota']).map((m) => ({ value: m, label: m }))} /></Field>
          <Field label="Model"><input value={f.model} onChange={(e) => set('model', e.target.value)} className={inputClass} /></Field>
          <Field label="Year"><NumberInput value={f.year} onChange={(v) => set('year', v)} /></Field>
          <Field label="Variant"><input value={f.variant} onChange={(e) => set('variant', e.target.value)} className={inputClass} placeholder="Maxx Sport" /></Field>
          <Field label="Body"><SelectInput value={f.bodyType} onChange={(v) => set('bodyType', v)} options={(ref.data?.bodyTypes ?? []).map((b) => ({ value: b.key, label: b.label }))} /></Field>
          <Field label="Fuel"><SelectInput value={f.fuelType} onChange={(v) => set('fuelType', v)} options={(ref.data?.fuelTypes ?? []).map((b) => ({ value: b.key, label: b.label }))} /></Field>
          <Field label="Transmission"><SelectInput value={f.transmission} onChange={(v) => set('transmission', v)} options={[{ value: 'AUTOMATIC', label: 'Automatic' }, { value: 'MANUAL', label: 'Manual' }]} /></Field>
          <Field label="Kilometres"><NumberInput value={f.odometerKm} onChange={(v) => set('odometerKm', v)} suffix="km" /></Field>
          <Field label="Colour"><input value={f.colour} onChange={(e) => set('colour', e.target.value)} className={inputClass} /></Field>
          <Field label="Seats"><NumberInput value={f.seats} onChange={(v) => set('seats', v)} /></Field>
          <Field label="Condition, honestly"><SelectInput value={f.condition} onChange={(v) => set('condition', v)} options={(ref.data?.conditions ?? []).map((c) => ({ value: c.key, label: c.label }))} /></Field>
          <Field label="New price, if known" hint="Sharpens the guide."><NumberInput value={f.newPrice} onChange={(v) => set('newPrice', v)} prefix="$" /></Field>
        </div>
      </Panel>
      <Panel title="The price" intro="The guide is worked out from the year, kilometres, condition and make as you type. A price well under it gets the listing held for a look; a price well over it just sits.">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Field label="Asking"><NumberInput value={f.price} onChange={(v) => set('price', v)} prefix="$" /></Field>
          <Pending loading={guide.loading} error={guide.error}>{guide.result ? <div className="grid grid-cols-2 gap-2"><Stat label="Private sale guide" value={`${aud0(guide.result.low)} to ${aud0(guide.result.high)}`} sub={guide.result.newPriceAssumed ? 'from a typical new price; give the real one for better' : 'from the new price'} /><Stat label="A dealer would offer about" value={aud0(guide.result.tradeIn)} /></div> : <p className="text-sm text-slate-500">Fill in the year and kilometres for a guide.</p>}</Pending>
        </div>
      </Panel>
      <Panel title="Photos and words" intro="Buyers trust what they can see. Eight photos and a plain description sell a car; superlatives do not.">
        <PhotoUploader photos={f.photos} onChange={(urls) => set('photos', urls)} />
        <div className="mt-4 grid gap-3">
          <Field label="Title"><input value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={120} className={inputClass} placeholder="2021 Mazda CX-5 Maxx Sport, one owner, full history" /></Field>
          <Field label="Description" hint="Why you are selling, how it has been used, what has been done, what is not perfect. Anything you would want to know."><textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={6} maxLength={6000} className={inputClass} /></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Features" hint="Comma separated."><input value={f.features} onChange={(e) => set('features', e.target.value)} className={inputClass} placeholder="Apple CarPlay, tow bar, roof racks" /></Field><Field label="A walk-around video" hint="A link. Thirty seconds of the car running says a lot."><input value={f.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} className={inputClass} placeholder="https://" /></Field></div>
        </div>
      </Panel>
      <Panel title="Where, and the papers" intro="The VIN and registration are shown masked to strangers and in full to a buyer whose money is held. They let buyers run the PPSR and registration checks, which is what makes them trust you.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Suburb"><input value={f.suburb} onChange={(e) => set('suburb', e.target.value)} className={inputClass} /></Field>
          <Field label="City"><input value={f.city} onChange={(e) => set('city', e.target.value)} className={inputClass} /></Field>
          <Field label="State"><SelectInput value={f.state} onChange={(v) => set('state', v)} options={['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s }))} /></Field>
          <Field label="Postcode"><input value={f.postcode} onChange={(e) => set('postcode', e.target.value)} maxLength={4} className={inputClass} /></Field>
          <Field label="VIN" hint="Seventeen characters, on the compliance plate."><input value={f.vin} onChange={(e) => set('vin', e.target.value.toUpperCase())} maxLength={17} className={`${inputClass} font-mono`} /></Field>
          <Field label="Registration"><input value={f.rego} onChange={(e) => set('rego', e.target.value.toUpperCase())} maxLength={10} className={inputClass} /></Field>
          <Field label="Registered until"><input type="date" value={f.regoExpires} onChange={(e) => set('regoExpires', e.target.value)} className={inputClass} /></Field>
          <Field label="Owners"><NumberInput value={f.ownersCount} onChange={(v) => set('ownersCount', v)} /></Field>
          <Field label="Service history"><SelectInput value={f.serviceHistory} onChange={(v) => set('serviceHistory', v)} options={[{ value: 'FULL', label: 'Full, stamped' }, { value: 'PARTIAL', label: 'Partial' }, { value: 'NONE', label: 'None' }, { value: 'UNKNOWN', label: 'Not sure' }]} /></Field>
          <Field label="Accidents"><SelectInput value={f.accidentHistory} onChange={(v) => set('accidentHistory', v)} options={[{ value: 'NONE', label: 'None' }, { value: 'MINOR_REPAIRED', label: 'Minor, repaired' }, { value: 'MAJOR_REPAIRED', label: 'Major, repaired' }, { value: 'UNKNOWN', label: 'Not sure' }]} /></Field>
          <Field label="Warranty"><SelectInput value={f.warranty} onChange={(v) => set('warranty', v)} options={[{ value: 'NONE', label: 'None' }, { value: 'BALANCE_OF_NEW_CAR', label: 'Balance of new-car warranty' }, { value: 'STATUTORY', label: 'Statutory dealer warranty' }, { value: 'DEALER', label: 'Dealer warranty' }, { value: 'EXTENDED', label: 'Extended warranty' }]} /></Field>
          <Field label="Warranty note"><input value={f.warrantyNote} onChange={(e) => set('warrantyNote', e.target.value)} maxLength={300} className={inputClass} placeholder="Until June 2027 or 100,000 km" /></Field>
          <Field label="PPSR certificate link" className="sm:col-span-2"><input value={f.ppsrCertificateUrl} onChange={(e) => set('ppsrCertificateUrl', e.target.value)} className={inputClass} placeholder="https://" /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4"><Check checked={f.ppsrChecked} onChange={(v) => set('ppsrChecked', v)} label="I have run a PPSR check: no money owing, not written off" /><Check checked={f.roadworthy} onChange={(v) => set('roadworthy', v)} label="Sold with a safety certificate" /></div>
        <p className="mt-2 text-xs text-slate-500">Both of these are shown to buyers as your word, not as something ATHENA has checked: we do not run the PPSR search or read the certificate you link. Buyers are told to run their own for two dollars, and ticking the box does not change how your listing is ranked or reviewed.</p>
      </Panel>
    </>
  );
}

function Sell() {
  const search = useSearchParams();
  const router = useRouter();
  const mine = useLoad<Mine[]>(() => autoApi.myListings());
  const garage = useLoad<{ vehicles: VehicleCard[] }>(() => autoApi.garage());
  const [creating, setCreating] = useState(Boolean(search.get('vehicle')));
  const [f, setF] = useState<ListingForm>({ ...EMPTY_LISTING, vehicleId: search.get('vehicle') ?? '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const v = garage.data?.vehicles.find((x) => x.id === f.vehicleId);
    if (!v) return;
    setF((x) => ({ ...x, make: v.make, model: v.model, year: String(v.year), variant: v.variant ?? '', bodyType: v.bodyType ?? x.bodyType, fuelType: v.fuelType, odometerKm: v.odometerNow ? String(v.odometerNow) : x.odometerKm, colour: v.colour ?? '', rego: v.rego ?? '', vin: v.vin ?? '', state: v.regoState ?? x.state, newPrice: v.newPrice ? String(v.newPrice) : x.newPrice, title: x.title || `${v.year} ${v.make} ${v.model}${v.variant ? ` ${v.variant}` : ''}` }));
  }, [garage.data, f.vehicleId]);

  const submit = async (publish: boolean) => {
    setBusy(true);
    try {
      const res = await autoApi.createListing({ ...toPayload(f), publish });
      const l = res.data.data;
      toast.success(l.status === 'ACTIVE' ? 'Live. Buyers can see it now.' : l.status === 'SUSPENDED' ? 'Saved and held for a quick review before it goes live; you will hear soon.' : 'Saved as a draft.');
      router.push(`/dashboard/cars/sell/${l.id}`);
    } catch (err) { toast.error(autoError(err, 'That could not be saved.')); } finally { setBusy(false); }
  };
  const ready = f.title.trim().length >= 6 && f.model.trim() && num(f.odometerKm) >= 0 && num(f.price) >= 500 && f.description.trim().length >= 30;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={Sparkles} kicker="Cars" title="Sell a car" blurb="A price guide, a safe handover, and the money held until the buyer has the keys. ATHENA's fee comes from your side when it is released." action={<button type="button" onClick={() => setCreating((c) => !c)} className="btn-primary text-sm">{creating ? 'Close the form' : 'List a car'}</button>} />
      <AutoNav current="/dashboard/cars/sell" />
      {creating && (
        <div className="space-y-6">
          {garage.data && garage.data.vehicles.length > 0 && <Panel title="From your garage?" intro="Prefills the form and links the sale to the car's history."><SelectInput value={f.vehicleId} onChange={(v) => setF((x) => ({ ...x, vehicleId: v }))} options={[{ value: '', label: 'A car not in my garage' }, ...garage.data.vehicles.map((v) => ({ value: v.id, label: v.name }))]} /></Panel>}
          <ListingFields f={f} setF={setF} />
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => submit(true)} disabled={busy || !ready} className="btn-primary text-sm disabled:opacity-50">Publish</button><button type="button" onClick={() => submit(false)} disabled={busy || !ready} className="btn-secondary text-sm disabled:opacity-50">Save as a draft</button>{!ready && <span className="self-center text-xs text-slate-500">A title, the model, kilometres, a price of at least $500 and thirty words of description are needed.</span>}</div>
        </div>
      )}
      {mine.loading && <Loading />}
      <ErrorBox error={mine.error} />
      {mine.data && mine.data.length === 0 && !creating && <Empty title="No listings yet" body="List a car and it gets a price guide, the checks a buyer wants, and buyer protection from the first offer." action={<button type="button" onClick={() => setCreating(true)} className="btn-primary text-sm">List a car</button>} />}
      <ul className="space-y-3">
        {(mine.data ?? []).map((l) => (
          <li key={l.id} className="flex flex-wrap items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            {l.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.photos[0]} alt="" className="h-20 w-28 rounded-lg object-cover" />
            ) : <div className="h-20 w-28 rounded-lg bg-slate-100 dark:bg-slate-800" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><Link href={`/dashboard/cars/sell/${l.id}`} className="font-semibold text-slate-900 hover:text-rose-600 dark:text-white">{l.title}</Link><StatusChip status={l.status} /><VerdictChip verdict={l.priceVerdict} /></div>
              <p className="text-xs text-slate-500">{aud0(l.price)} · {km(l.odometerKm)} · {l.viewCount} views · saved {l.saveCount} · {l.offers} open offer{l.offers === 1 ? '' : 's'}{l.inspections.length ? ` · ${l.inspections.length} inspection${l.inspections.length === 1 ? '' : 's'}` : ''}</p>
              {l.status === 'SUSPENDED' && <p className="mt-1 text-xs text-rose-600">{l.suspendedReason}. The checks it tripped: {(l.riskFlags ?? []).join(', ') || 'none'}.</p>}
            </div>
            <div className="flex gap-2"><Link href={`/dashboard/cars/sell/${l.id}`} className="btn-secondary text-sm">Manage</Link>{['ACTIVE', 'UNDER_OFFER', 'SOLD'].includes(l.status) && <Link href={`/cars/preloved/${l.id}`} className="btn-ghost text-sm">View</Link>}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SellPage() {
  return <Suspense fallback={<div className="p-6"><Loading /></div>}><Sell /></Suspense>;
}
