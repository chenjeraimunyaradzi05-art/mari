'use client';

/**
 * Safety, explained, and the maintenance guide. Every acronym on a spec
 * sheet in plain words (what it does, why it matters, what to look for),
 * how ANCAP ratings work and why they lapse, and what a car needs doing,
 * how often, and what it should cost, with the electric differences.
 */

import Link from 'next/link';
import { Gauge, ShieldCheck } from 'lucide-react';
import { PageHero, PageShell, Section } from '@/components/layout/PageShell';
import { AutoDisclaimer, Loading, useReference } from '@/components/automotive/AutoUi';

export default function SafetyPage() {
  const ref = useReference();
  const r = ref.data;
  return (
    <PageShell backTo={{ href: '/cars', label: 'Back to cars' }}>
      <PageHero kicker="Safety and upkeep" title="What the acronyms do for you" description="A spec sheet is written to sell. This page is written to explain: what each safety feature actually does on a wet Tuesday, how to read a star rating, and what a car needs so it keeps you safe." primaryAction={{ label: 'Browse cars with current ratings', href: '/cars/new' }} secondaryAction={{ label: 'Find a mechanic', href: '/cars/mechanics' }} />
      {ref.loading && <div className="mt-6"><Loading /></div>}
      {r && (
        <div className="mt-8 space-y-8">
          <Section icon={ShieldCheck} title="Reading an ANCAP rating" description="Five stars is not five stars forever.">
            <div className="grid gap-4 sm:grid-cols-2">
              {[['What it is', r.ancap.what], ['The date stamp', r.ancap.dateStamp], ['Why ratings lapse', r.ancap.expiry], ['Unrated', r.ancap.unrated]].map(([t, b]) => <div key={t} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60"><p className="text-sm font-semibold text-slate-900 dark:text-white">{t}</p><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">{b}</p></div>)}
            </div>
            <a href={r.ancap.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-rose-600">Look a car up on ancap.com.au</a>
          </Section>

          <section id="features">
            <h2 className="rail-title">The features, one by one</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Every one of these is on the catalogue's comparison table, so you can see which cars have them.</p>
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {r.safetyFeatures.map((f) => (
                <li key={f.key} className="surface p-5">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{f.name}</h3>
                  <dl className="mt-2 space-y-2 text-sm">
                    <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">What it does</dt><dd className="leading-6 text-slate-700 dark:text-slate-300">{f.what}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Why it matters</dt><dd className="leading-6 text-slate-700 dark:text-slate-300">{f.why}</dd></div>
                    <div><dt className="text-[11px] uppercase tracking-wide text-slate-500">Look for</dt><dd className="leading-6 text-slate-700 dark:text-slate-300">{f.lookFor}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </section>

          <section id="maintenance" className="scroll-mt-24">
            <div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-rose-500" /><h2 className="rail-title">The maintenance guide</h2></div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">What needs doing, how often, and what it should cost. Your garage turns these into reminders once a car is in it; a workshop in the directory shows its own prices.</p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900"><th className="p-3">Item</th><th className="p-3">How often</th><th className="p-3">What and why</th><th className="p-3">Typical cost</th><th className="p-3">Electric</th></tr></thead>
                <tbody>{r.maintenance.map((m) => <tr key={m.key} className="border-t border-slate-100 align-top dark:border-slate-800"><td className="p-3 font-medium text-slate-900 dark:text-white">{m.title}</td><td className="p-3 text-slate-700 dark:text-slate-300">{m.every}</td><td className="p-3 leading-6 text-slate-700 dark:text-slate-300">{m.what}</td><td className="p-3 text-slate-700 dark:text-slate-300">{m.cost}</td><td className="p-3 text-slate-500">{m.ev === 'none' ? 'Not needed' : m.ev === 'different' ? 'Different' : 'Same'}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap gap-2"><Link href="/dashboard/cars/garage" className="btn-primary text-sm">Put your car in the garage for reminders</Link><Link href="/cars/mechanics" className="btn-secondary text-sm">Find a workshop that shows its prices</Link></div>
          </section>

          <section>
            <h2 className="rail-title">Before you buy a used car</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">The things a fraud looks like, and the checks that cost almost nothing.</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="surface p-5"><h3 className="font-semibold text-slate-900 dark:text-white">Warning signs</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-300">{r.fraudSigns.map((s) => <li key={s}>{s}</li>)}</ul></div>
              <div className="surface p-5"><h3 className="font-semibold text-slate-900 dark:text-white">What an inspection covers</h3><ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300">{r.inspectionSections.map((s) => <li key={s.key}><span className="font-medium text-slate-900 dark:text-white">{s.label}:</span> {s.items.join('; ')}.</li>)}</ul><Link href="/cars/preloved" className="mt-3 inline-block text-sm font-semibold text-rose-600">Listings with buyer protection</Link></div>
            </div>
          </section>
          <AutoDisclaimer what="This is general information written from Australian sources." />
        </div>
      )}
    </PageShell>
  );
}
