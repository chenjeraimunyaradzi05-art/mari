'use client';

/**
 * The dealership page: the profile (brands, women-led, finance on site,
 * hours), the test drives to confirm, and the trade-in requests to quote
 * against the guide. A new profile waits for verification.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Save, Store } from 'lucide-react';
import { autoApi, autoError, aud0, km, type DealershipCard, type ReferralCard } from '@/lib/automotive-api';
import { AutoNav, Chip, ErrorBox, Loading, PageTitle, StatusChip, fmtDay, fmtWhen, useLoad } from '@/components/automotive/AutoUi';
import { Check, Field, NumberInput, Panel, SelectInput, inputClass, num } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Profile = DealershipCard & { about: string | null; email: string | null; isActive: boolean };
type Data = { profile: Profile | null; counts: { testDrives: number; tradeIns: number; stock: number } | null; makes: string[]; referrals: ReferralCard[]; referralFee: { percent: number; min: number; max: number; words: string } };
type TestDrive = { id: string; status: string; preferredAt: string; alternativeAt: string | null; note: string | null; dealerNote: string | null; car: string | null; member?: { name: string; email: string } };
type TradeIn = { id: string; make: string; model: string; year: number; variant: string | null; odometerKm: number; condition: string; notes: string | null; photos: string[]; estimateLow: number; estimateMid: number; estimateHigh: number; status: string; expiresAt: string; addressedToYou: boolean; by: string; myQuote: { amount: number; validUntil: string } | null };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = { '1': [['08:30', '17:30']], '2': [['08:30', '17:30']], '3': [['08:30', '17:30']], '4': [['08:30', '17:30']], '5': [['08:30', '17:30']], '6': [['08:30', '16:00']] } as Record<string, Array<[string, string]>>;
const EMPTY = { name: '', headline: '', about: '', brands: [] as string[], suburb: '', city: '', state: 'QLD', postcode: '', address: '', phone: '', website: '', email: '', womenLed: false, financeAvailable: false, financePartners: '', hours: HOURS };

export default function DealershipDashboardPage() {
  const data = useLoad<Data>(() => autoApi.myDealership());
  const requests = useLoad<{ testDrives: TestDrive[]; tradeIns: TradeIn[] }>(() => (data.data?.profile ? autoApi.dealershipRequests() : Promise.resolve({ data: { data: { testDrives: [], tradeIns: [] } } } as never)), [data.data?.profile?.id]);
  const [f, setF] = useState(EMPTY);
  const [quotes, setQuotes] = useState<Record<string, { amount: string; note: string; validDays: string }>>({});
  const [busy, setBusy] = useState(false);
  const p = data.data?.profile;
  useEffect(() => { if (p) setF({ name: p.name, headline: p.headline, about: p.about ?? '', brands: p.brands, suburb: p.suburb ?? '', city: p.city ?? '', state: p.state ?? 'QLD', postcode: p.postcode ?? '', address: p.address ?? '', phone: p.phone ?? '', website: p.website ?? '', email: p.email ?? '', womenLed: p.womenLed, financeAvailable: p.financeAvailable, financePartners: p.financePartners.join(', '), hours: p.hours ?? HOURS }); }, [p]);
  const orNull = (s: string) => (s.trim() ? s.trim() : null);
  const save = async () => { setBusy(true); try { const res = await autoApi.saveDealership({ ...f, about: orNull(f.about), suburb: orNull(f.suburb), city: orNull(f.city), state: f.state || null, postcode: orNull(f.postcode), address: orNull(f.address), phone: orNull(f.phone), website: orNull(f.website), email: orNull(f.email), financePartners: f.financePartners.split(',').map((s) => s.trim()).filter(Boolean) }); toast.success(res.data?.data?.pendingVerification ? 'Saved. Your dealership shows once it is verified.' : 'Saved'); data.reload(); } catch (err) { toast.error(autoError(err, 'That could not be saved.')); } finally { setBusy(false); } };
  const act = (fn: () => Promise<unknown>, done: string) => fn().then(() => { toast.success(done); requests.reload(); }).catch((err) => toast.error(autoError(err, 'That did not work.')));
  const setHours = (day: string, on: boolean) => setF((x) => { const a = { ...x.hours }; if (on) a[day] = a[day]?.length ? a[day] : [['08:30', '17:30']]; else delete a[day]; return { ...x, hours: a }; });
  const setRange = (day: string, i: number, which: 0 | 1, v: string) => setF((x) => { const a = { ...x.hours }; a[day] = a[day].map((r, j) => (j === i ? ((which === 0 ? [v, r[1]] : [r[0], v]) as [string, string]) : r)); return { ...x, hours: a }; });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={Store} kicker="Cars" title="Your dealership" blurb="Your profile, the test drives to confirm, the trade-in requests to quote, and your stock listed under buyer protection." action={p ? <div className="flex items-center gap-2"><Chip tone={p.isVerified ? 'emerald' : 'amber'}>{p.isVerified ? 'Verified and listed' : 'Awaiting verification'}</Chip>{p.isVerified && <Link href={`/cars/dealerships/${p.slug}`} className="btn-ghost text-sm">View</Link>}<Link href="/dashboard/cars/sell" className="btn-secondary text-sm">Stock ({data.data?.counts?.stock ?? 0})</Link></div> : undefined} />
      <AutoNav current="/dashboard/cars/dealership" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {data.data && (
        <>
          {p && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Test drives" intro={`${data.data.counts?.testDrives ?? 0} waiting.`}>
                {requests.loading && <Loading />}
                <ul className="space-y-2">{(requests.data?.testDrives ?? []).map((t) => <li key={t.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-900 dark:text-white">{t.car ?? 'Any car'} · {t.member?.name} <span className="text-xs font-normal text-slate-500">{t.member?.email}</span></span><StatusChip status={t.status} /></div><p className="mt-1 text-xs text-slate-500">{fmtWhen(t.preferredAt)}{t.alternativeAt ? ` or ${fmtWhen(t.alternativeAt)}` : ''}{t.note ? ` · ${t.note}` : ''}</p><div className="mt-2 flex flex-wrap gap-1">{t.status === 'REQUESTED' && <><button type="button" onClick={() => { const n = window.prompt('A note for the member (optional)', '') ?? undefined; act(() => autoApi.updateTestDriveAsDealer(t.id, { status: 'CONFIRMED', dealerNote: n || null }), 'Confirmed'); }} className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">Confirm</button><button type="button" onClick={() => act(() => autoApi.updateTestDriveAsDealer(t.id, { status: 'DECLINED' }), 'Declined')} className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">Decline</button></>}{t.status === 'CONFIRMED' && <button type="button" onClick={() => act(() => autoApi.updateTestDriveAsDealer(t.id, { status: 'COMPLETED' }), 'Marked done')} className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">Done, no sale</button>}{['CONFIRMED', 'COMPLETED'].includes(t.status) && <button type="button" onClick={() => { const price = window.prompt('What did it sell for? The referral fee is worked out from the price.', ''); if (price && num(price) > 0) act(() => autoApi.updateTestDriveAsDealer(t.id, { status: 'COMPLETED', sold: true, salePrice: num(price) }), 'Thank you. The sale is recorded and the fee is on the ledger.'); }} className="rounded-md bg-rose-500 px-2 py-1 text-xs font-semibold text-white">{t.status === 'COMPLETED' ? 'It sold' : 'Done, and it sold'}</button>}</div></li>)}{requests.data && requests.data.testDrives.length === 0 && <li className="text-sm text-slate-500">None yet.</li>}</ul>
              </Panel>
              <Panel title="Trade-in requests" intro="Members see your quote beside the guide, so a fair number wins.">
                <ul className="space-y-2">{(requests.data?.tradeIns ?? []).map((t) => { const qv = quotes[t.id] ?? { amount: '', note: '', validDays: '7' }; return <li key={t.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-900 dark:text-white">{t.year} {t.make} {t.model}{t.variant ? ` ${t.variant}` : ''} · {km(t.odometerKm)} · {t.condition.toLowerCase()}</span><span className="flex gap-1">{t.addressedToYou && <Chip tone="rose">Asked you</Chip>}<StatusChip status={t.status} /></span></div><p className="mt-1 text-xs text-slate-500">Guide {aud0(t.estimateLow)} to {aud0(t.estimateHigh)} privately · from {t.by} · until {fmtDay(t.expiresAt)}{t.notes ? ` · ${t.notes}` : ''}</p>{t.photos.length > 0 && <div className="mt-1 flex gap-1">{t.photos.slice(0, 4).map((ph) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={ph} src={ph} alt="" className="h-12 w-16 rounded object-cover" />))}</div>}{t.myQuote ? <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">You quoted {aud0(t.myQuote.amount)}, valid to {fmtDay(t.myQuote.validUntil)}.</p> : <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-1"><NumberInput value={qv.amount} onChange={(v) => setQuotes((x) => ({ ...x, [t.id]: { ...qv, amount: v } }))} prefix="$" placeholder={String(Math.round(t.estimateMid * 0.85))} /><input value={qv.note} onChange={(e) => setQuotes((x) => ({ ...x, [t.id]: { ...qv, note: e.target.value } }))} placeholder="Note" className={inputClass} /><button type="button" disabled={num(qv.amount) <= 0} onClick={() => act(() => autoApi.quoteTradeIn(t.id, { amount: num(qv.amount), note: qv.note || undefined, validDays: num(qv.validDays, 7) }), 'Quote sent')} className="rounded-md bg-rose-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">Quote</button></div>}</li>; })}{requests.data && requests.data.tradeIns.length === 0 && <li className="text-sm text-slate-500">None open.</li>}</ul>
              </Panel>
              <Panel title="Referral fees" intro={`${data.data.referralFee?.words ?? ''} Report a sale from the test drive it began with, and the fee appears here, pending until ATHENA confirms it with you.`}>
                <ul className="space-y-1">{(data.data.referrals ?? []).map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-800/60"><span className="text-slate-800 dark:text-slate-200">{r.kindLabel}{r.member ? ` · ${r.member.name}` : ''} · {aud0(r.basisAmount)} · {fmtDay(r.createdAt)}</span><span className="flex items-center gap-2"><span className="font-semibold text-slate-900 dark:text-white">{aud0(r.fee)}</span><StatusChip status={r.status} /></span></li>)}{(data.data.referrals ?? []).length === 0 && <li className="text-sm text-slate-500">None yet.</li>}</ul>
              </Panel>
            </div>
          )}
          <Panel title={p ? 'Your profile' : 'Create your profile'} intro="What members see. Brands decide which trade-in requests and catalogue pages you appear on.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Dealership name"><input value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} className={inputClass} /></Field>
              <Field label="One line"><input value={f.headline} onChange={(e) => setF((x) => ({ ...x, headline: e.target.value }))} maxLength={140} className={inputClass} /></Field>
              <Field label="About" className="sm:col-span-2"><textarea value={f.about} onChange={(e) => setF((x) => ({ ...x, about: e.target.value }))} rows={4} maxLength={4000} className={inputClass} /></Field>
              <Field label="Phone"><input value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value }))} className={inputClass} /></Field>
              <Field label="Email"><input value={f.email} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} className={inputClass} /></Field>
              <Field label="Website"><input value={f.website} onChange={(e) => setF((x) => ({ ...x, website: e.target.value }))} className={inputClass} placeholder="https://" /></Field>
              <Field label="Address"><input value={f.address} onChange={(e) => setF((x) => ({ ...x, address: e.target.value }))} className={inputClass} /></Field>
              <Field label="Suburb"><input value={f.suburb} onChange={(e) => setF((x) => ({ ...x, suburb: e.target.value }))} className={inputClass} /></Field>
              <Field label="City"><input value={f.city} onChange={(e) => setF((x) => ({ ...x, city: e.target.value }))} className={inputClass} /></Field>
              <Field label="State"><SelectInput value={f.state} onChange={(v) => setF((x) => ({ ...x, state: v }))} options={['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s }))} /></Field>
              <Field label="Postcode"><input value={f.postcode} onChange={(e) => setF((x) => ({ ...x, postcode: e.target.value }))} maxLength={4} className={inputClass} /></Field>
              <Field label="Finance partners" hint="Comma separated."><input value={f.financePartners} onChange={(e) => setF((x) => ({ ...x, financePartners: e.target.value }))} className={inputClass} /></Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-4"><Check checked={f.womenLed} onChange={(v) => setF((x) => ({ ...x, womenLed: v }))} label="Women-led" /><Check checked={f.financeAvailable} onChange={(v) => setF((x) => ({ ...x, financeAvailable: v }))} label="Finance arranged on site" /></div>
            <div className="mt-4"><span className="text-xs font-medium uppercase tracking-wide text-slate-500">Brands</span><div className="mt-1.5 flex flex-wrap gap-1.5">{data.data.makes.map((m) => <button key={m} type="button" onClick={() => setF((x) => ({ ...x, brands: x.brands.includes(m) ? x.brands.filter((b) => b !== m) : [...x.brands, m] }))} className={cn('rounded-full px-2.5 py-1 text-xs font-medium', f.brands.includes(m) ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{m}</button>)}</div></div>
            <div className="mt-4"><span className="text-xs font-medium uppercase tracking-wide text-slate-500">Hours</span><ul className="mt-2 space-y-2">{DAYS.map((d, i) => { const key = String(i); const on = Boolean(f.hours[key]); return <li key={key} className="flex flex-wrap items-center gap-3 text-sm"><label className="flex w-16 items-center gap-2"><input type="checkbox" checked={on} onChange={(e) => setHours(key, e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-rose-500" /> {d}</label>{on && f.hours[key].map((rg, j) => <span key={j} className="flex items-center gap-1"><input type="time" value={rg[0]} onChange={(e) => setRange(key, j, 0, e.target.value)} className={inputClass} /><span className="text-slate-400">to</span><input type="time" value={rg[1]} onChange={(e) => setRange(key, j, 1, e.target.value)} className={inputClass} /></span>)}</li>; })}</ul></div>
            <button type="button" onClick={save} disabled={busy || f.name.trim().length < 2 || f.headline.trim().length < 5} className="btn-primary mt-4 inline-flex items-center gap-2 text-sm disabled:opacity-50"><Save className="h-4 w-4" /> {p ? 'Save changes' : 'Create the profile'}</button>
          </Panel>
        </>
      )}
    </div>
  );
}
