'use client';

/**
 * One car: what it is, the rating with its year, every safety feature and
 * whether it is fitted, five years of running costs worked out, a
 * repayment and an insurance estimate to make the price real, reviews
 * from women who own or drove one (and the form to add yours), the
 * dealerships that carry the brand with a test-drive request, and the
 * cars a buyer of this one also looks at.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { CarFront, Check as CheckIcon, Banknote, ShieldCheck, Store, Umbrella, Wrench } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { useAuth } from '@/lib/hooks';
import { autoApi, autoError, aud0, type CarCard, type DealershipCard } from '@/lib/automotive-api';
import { AncapBadge, AutoDisclaimer, Chip, ErrorBox, Loading, PageTitle, StarPicker, Stars, useLoad } from '@/components/automotive/AutoUi';
import { Field, NumberInput, Panel, SelectInput, Stat, inputClass } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';
import { safeHref } from '@/lib/safe-href';

type Review = { id: string; rating: number; reliability: number; safetyFeel: number; runningCosts: number; title: string; body: string; ownedMonths: number | null; videoUrl: string | null; isOwner: boolean; isHidden: boolean; by: string; createdAt: string; isYou: boolean };
type Detail = CarCard & { safety: Array<{ key: string; name: string; what: string; why: string; lookFor: string; fitted: boolean }>; reviews: Review[]; womenSay: { rating: number; reliability: number; safetyFeel: number; runningCosts: number; count: number; owners: number } | null; myReview: { id: string; rating: number } | null; ownership: { totals: { total: number; perYear: number; perWeek: number; perKm: number; depreciation: number; energy: number; insurance: number; rego: number; servicing: number; tyres: number; interest: number }; years: Array<{ year: number; total: number; valueAtEnd: number }>; assumptions: string[] }; finance: { repayment: number; deposit: number; amount: number; ratePct: number; termMonths: number; totalInterest: number }; insurance: { comprehensive: number; low: number; high: number; state: string }; similar: CarCard[]; dealerships: DealershipCard[]; canReview: boolean; canModerate: boolean };

const EMPTY = { rating: 0, reliability: 0, safetyFeel: 0, runningCosts: 0, title: '', body: '', ownedMonths: '', videoUrl: '' };

export default function CarPage() {
  const params = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState('QLD');
  const data = useLoad<Detail>(() => autoApi.car(params.slug, { state }), [params.slug, state]);
  const [form, setForm] = useState(EMPTY);
  const [writing, setWriting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drive, setDrive] = useState({ dealershipId: '', preferredAt: '', note: '' });
  const c = data.data;

  const submitReview = async () => {
    if (!c) return;
    setBusy(true);
    try {
      await autoApi.reviewCar(c.slug, { ...form, ownedMonths: form.ownedMonths ? Number(form.ownedMonths) : null, videoUrl: form.videoUrl || null });
      toast.success('Thank you. Your review is up.');
      setWriting(false); setForm(EMPTY); data.reload();
    } catch (err) { toast.error(autoError(err, 'That could not be saved.')); } finally { setBusy(false); }
  };
  const requestDrive = async () => {
    setBusy(true);
    try {
      await autoApi.requestTestDrive({ dealershipId: drive.dealershipId, carModelId: c!.id, preferredAt: new Date(drive.preferredAt).toISOString(), note: drive.note || undefined });
      toast.success('Requested. The dealership will confirm a time.');
      setDrive({ dealershipId: '', preferredAt: '', note: '' });
    } catch (err) { toast.error(autoError(err, 'That could not be requested.')); } finally { setBusy(false); }
  };
  const hide = async (id: string, isHidden: boolean) => { try { await autoApi.updateReview(id, { isHidden }); data.reload(); } catch (err) { toast.error(autoError(err, 'That did not work.')); } };

  return (
    <PageShell width="wide" backTo={{ href: '/cars/new', label: 'Back to the catalogue' }}>
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {c && (
        <div className="space-y-6">
          <PageTitle icon={CarFront} kicker={`${c.bodyLabel} · ${c.fuelLabel}`} title={`${c.make} ${c.model}`} blurb={`${c.variant ?? ''}${c.variant ? ' · ' : ''}from ${aud0(c.priceFrom)} before on-road costs · ${c.asAt ?? ''}`} action={<AncapBadge ancap={c.ancap} stars={c.ancapStars} />} />
          <div className="flex flex-wrap items-center gap-2">{c.highlights.map((h) => <Chip key={h}>{h}</Chip>)}{c.womenSay && <Stars value={c.womenSay.rating} count={c.womenSay.count} />}</div>

          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <div className="space-y-6">
              <Panel title="The numbers" intro="Published figures for the entry grade; the spec sheet for the grade you buy decides.">
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Consumption</dt><dd className="text-slate-800 dark:text-slate-200">{c.energy ?? 'Not published'}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Emissions</dt><dd className="text-slate-800 dark:text-slate-200">{c.emissions}. <a href="https://www.greenvehicleguide.gov.au" target="_blank" rel="noopener noreferrer" className="text-rose-600">The official figure</a></dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Warranty</dt><dd className="text-slate-800 dark:text-slate-200">{c.warranty}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Service</dt><dd className="text-slate-800 dark:text-slate-200">Every {c.serviceIntervalMonths} months or {(c.serviceIntervalKm ?? 0).toLocaleString('en-AU')} km{c.servicingCostYear ? `, about ${aud0(c.servicingCostYear)} a year` : ''}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Seats</dt><dd className="text-slate-800 dark:text-slate-200">{c.seats}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Transmission</dt><dd className="text-slate-800 dark:text-slate-200">{c.transmission === 'MANUAL' ? 'Manual' : 'Automatic'}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">ANCAP</dt><dd className="text-slate-800 dark:text-slate-200">{c.ancap.label}. <a href="https://www.ancap.com.au" target="_blank" rel="noopener noreferrer" className="text-rose-600">Check it</a></dd></div>
                </dl>
              </Panel>

              <Panel icon={ShieldCheck} title="Safety, feature by feature" intro="Fitted means typically standard across the range. Check means confirm it on the grade you are looking at; it may be on a higher grade or in a pack.">
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {c.safety.map((f) => (
                    <li key={f.key} className="flex gap-3 py-2.5">
                      <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', f.fitted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}>{f.fitted ? <CheckIcon className="h-3 w-3" /> : '?'}</span>
                      <div><p className="text-sm font-medium text-slate-900 dark:text-white">{f.name} <span className="font-normal text-slate-500">· {f.fitted ? 'fitted' : 'check'}</span></p><p className="text-xs leading-5 text-slate-600 dark:text-slate-400">{f.why}</p></div>
                    </li>
                  ))}
                </ul>
                <Link href="/cars/safety" className="mt-3 inline-block text-sm font-semibold text-rose-600">What each of these does, in plain words</Link>
              </Panel>

              <Panel title="From women who own one" intro={c.womenSay ? `${c.womenSay.count} review${c.womenSay.count === 1 ? '' : 's'}, ${c.womenSay.owners} from owners with the car in their garage. Reliability ${c.womenSay.reliability}, feels safe ${c.womenSay.safetyFeel}, running costs ${c.womenSay.runningCosts}, each out of five.` : 'No reviews yet. If you own or have driven one, yours is the first.'} aside={c.canReview && !c.myReview && !writing ? <button type="button" onClick={() => setWriting(true)} className="btn-primary text-sm">Write a review</button> : !isAuthenticated ? <Link href={`/login?redirect=/cars/new/${c.slug}`} className="btn-secondary text-sm">Sign in to review</Link> : undefined}>
                {writing && (
                  <div className="mb-4 space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                    <div className="grid gap-3 sm:grid-cols-2"><StarPicker label="Overall" value={form.rating} onChange={(v) => setForm((x) => ({ ...x, rating: v }))} /><StarPicker label="Reliability" value={form.reliability} onChange={(v) => setForm((x) => ({ ...x, reliability: v }))} /><StarPicker label="How safe it feels" value={form.safetyFeel} onChange={(v) => setForm((x) => ({ ...x, safetyFeel: v }))} /><StarPicker label="Running costs (5 is cheap)" value={form.runningCosts} onChange={(v) => setForm((x) => ({ ...x, runningCosts: v }))} /></div>
                    <Field label="In a sentence"><input value={form.title} onChange={(e) => setForm((x) => ({ ...x, title: e.target.value }))} maxLength={120} className={inputClass} placeholder="Three years, no drama" /></Field>
                    <Field label="The story" hint="What it is like to live with: the school run, the servicing bill, the thing nobody told you."><textarea value={form.body} onChange={(e) => setForm((x) => ({ ...x, body: e.target.value }))} rows={5} maxLength={4000} className={inputClass} /></Field>
                    <div className="grid gap-3 sm:grid-cols-2"><Field label="Months owned" hint="Leave blank if you drove one but do not own it."><NumberInput value={form.ownedMonths} onChange={(v) => setForm((x) => ({ ...x, ownedMonths: v }))} /></Field><Field label="A video, if you made one" hint="A link to your walk-around or testimonial."><input value={form.videoUrl} onChange={(e) => setForm((x) => ({ ...x, videoUrl: e.target.value }))} className={inputClass} placeholder="https://" /></Field></div>
                    <div className="flex gap-2"><button type="button" onClick={submitReview} disabled={busy || !form.rating || !form.reliability || !form.safetyFeel || !form.runningCosts || form.title.trim().length < 3 || form.body.trim().length < 20} className="btn-primary text-sm disabled:opacity-50">Publish</button><button type="button" onClick={() => setWriting(false)} className="btn-ghost text-sm">Cancel</button></div>
                  </div>
                )}
                <ul className="space-y-4">
                  {c.reviews.map((r) => (
                    <li key={r.id} className={cn('rounded-xl border border-slate-100 p-4 dark:border-slate-800', r.isHidden && 'opacity-60')}>
                      <div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} /><span className="text-xs text-slate-500">{r.by}{r.isOwner ? ' · owner' : ''}{r.ownedMonths ? ` · ${r.ownedMonths} months` : ''} · {new Date(r.createdAt).toLocaleDateString('en-AU')}</span>{r.isHidden && <Chip tone="rose">Hidden</Chip>}</div>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-white">{r.title}</p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-300">{r.body}</p>
                      <p className="mt-2 text-xs text-slate-500">Reliability {r.reliability} · feels safe {r.safetyFeel} · running costs {r.runningCosts}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">{r.videoUrl && <a href={safeHref(r.videoUrl)} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-600">Watch her video</a>}{r.isYou && <button type="button" onClick={() => { setForm({ rating: r.rating, reliability: r.reliability, safetyFeel: r.safetyFeel, runningCosts: r.runningCosts, title: r.title, body: r.body, ownedMonths: r.ownedMonths ? String(r.ownedMonths) : '', videoUrl: r.videoUrl ?? '' }); setWriting(true); }} className="text-slate-500 hover:text-rose-600">Edit yours</button>}{c.canModerate && <button type="button" onClick={() => hide(r.id, !r.isHidden)} className="text-slate-500 underline-offset-2 hover:underline">{r.isHidden ? 'Show it' : 'Hide it'}</button>}</div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <div className="space-y-6">
              <Panel title="Five years of owning it" intro={`Depreciation, energy, insurance, registration, servicing and tyres at 15,000 km a year in ${state}.`} aside={<div className="w-24"><SelectInput value={state} onChange={setState} options={['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s }))} /></div>}>
                <div className="grid grid-cols-2 gap-2"><Stat label="A week, all in" value={aud0(c.ownership.totals.perWeek)} tone="rose" big /><Stat label="Over five years" value={aud0(c.ownership.totals.total)} sub={`${aud0(c.ownership.totals.perYear)} a year`} /></div>
                <ul className="mt-3 space-y-1 text-sm">
                  {([['Value lost', c.ownership.totals.depreciation], ['Fuel or charging', c.ownership.totals.energy], ['Insurance', c.ownership.totals.insurance], ['Registration and CTP', c.ownership.totals.rego], ['Servicing', c.ownership.totals.servicing], ['Tyres', c.ownership.totals.tyres]] as Array<[string, number]>).map(([k, v]) => <li key={k} className="flex items-center justify-between"><span className="text-slate-600 dark:text-slate-400">{k}</span><span className="tabular-nums text-slate-900 dark:text-white">{aud0(v)}</span></li>)}
                </ul>
                <p className="mt-2 text-xs text-slate-500">Worth about {aud0(c.ownership.years[4]?.valueAtEnd)} after five years.</p>
                <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">How this was worked out</summary><ul className="mt-1 list-disc space-y-1 pl-4">{c.ownership.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></details>
              </Panel>

              <Panel icon={Banknote} title="If you borrowed for it" intro={`A ${aud0(c.finance.deposit)} deposit and ${aud0(c.finance.amount)} over ${c.finance.termMonths} months at ${c.finance.ratePct}%, a typical new-car secured rate.`}>
                <div className="grid grid-cols-2 gap-2"><Stat label="A month" value={aud0(c.finance.repayment)} big /><Stat label="Interest over the loan" value={aud0(c.finance.totalInterest)} /></div>
                <div className="mt-3 flex flex-wrap gap-2"><Link href={`/cars/finance?price=${c.priceFrom}`} className="btn-secondary text-sm">Compare loans and what you can carry</Link><Link href={`/dashboard/cars/finance?price=${c.priceFrom}&purpose=NEW&carModelId=${c.id}`} className="btn-ghost text-sm">Work out where you stand</Link></div>
              </Panel>

              <Panel icon={Umbrella} title="Insurance, roughly" intro={`Comprehensive cover for a 35-year-old in ${c.insurance.state} with a clean record.`}>
                <Stat label="A year" value={`${aud0(c.insurance.low)} to ${aud0(c.insurance.high)}`} sub={`about ${aud0(c.insurance.comprehensive)}`} />
                <Link href={`/cars/insurance?value=${c.priceFrom}&fuel=${c.fuelType}`} className="mt-3 inline-block text-sm font-semibold text-rose-600">Your own estimate, with the factors that move it</Link>
              </Panel>

              <Panel icon={Store} title="Drive one" intro={c.dealerships.length ? `Dealerships on ATHENA that carry ${c.make}.` : `No ${c.make} dealership has joined yet. When one does, the test drive is booked from here.`}>
                {c.dealerships.length > 0 && (isAuthenticated ? (
                  <div className="space-y-3">
                    <Field label="Dealership"><SelectInput value={drive.dealershipId} onChange={(v) => setDrive((x) => ({ ...x, dealershipId: v }))} options={[{ value: '', label: 'Pick one' }, ...c.dealerships.map((d) => ({ value: d.id, label: `${d.name}${d.city ? `, ${d.city}` : ''}` }))]} /></Field>
                    <Field label="When suits you"><input type="datetime-local" value={drive.preferredAt} onChange={(e) => setDrive((x) => ({ ...x, preferredAt: e.target.value }))} className={inputClass} /></Field>
                    <Field label="Anything to know"><input value={drive.note} onChange={(e) => setDrive((x) => ({ ...x, note: e.target.value }))} maxLength={300} className={inputClass} placeholder="Bringing a child seat to check the fit" /></Field>
                    <button type="button" onClick={requestDrive} disabled={busy || !drive.dealershipId || !drive.preferredAt} className="btn-primary w-full text-sm disabled:opacity-50">Request a test drive</button>
                  </div>
                ) : <Link href={`/login?redirect=/cars/new/${c.slug}`} className="btn-secondary text-sm">Sign in to book a test drive</Link>)}
                <ul className="mt-3 space-y-1 text-sm">{c.dealerships.map((d) => <li key={d.id}><Link href={`/cars/dealerships/${d.slug}`} className="font-medium text-slate-800 hover:text-rose-600 dark:text-slate-200">{d.name}</Link><span className="text-xs text-slate-500"> · {[d.suburb || d.city, d.state].filter(Boolean).join(', ')}{d.womenLed ? ' · women-led' : ''}</span></li>)}</ul>
              </Panel>

              <Panel icon={Wrench} title="Servicing it" intro={`Every ${c.serviceIntervalMonths} months or ${(c.serviceIntervalKm ?? 0).toLocaleString('en-AU')} km. A workshop in the directory shows its prices before you book.`}>
                <Link href={`/cars/mechanics?make=${encodeURIComponent(c.make)}&service=logbook`} className="btn-secondary text-sm">Workshops that service {c.make}</Link>
              </Panel>
            </div>
          </div>

          {c.similar.length > 0 && <section><h2 className="rail-title">Also worth a look</h2><ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{c.similar.map((s) => <li key={s.id}><Link href={`/cars/new/${s.slug}`} className="tile-soft block h-full p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{s.fuelLabel}</span><AncapBadge ancap={s.ancap} stars={s.ancapStars} compact /></div><p className="mt-1 font-semibold text-slate-900 dark:text-white">{s.make} {s.model}</p><p className="text-sm text-slate-600 dark:text-slate-400">From {aud0(s.priceFrom)}</p></Link></li>)}</ul></section>}
          <AutoDisclaimer />
        </div>
      )}
    </PageShell>
  );
}
