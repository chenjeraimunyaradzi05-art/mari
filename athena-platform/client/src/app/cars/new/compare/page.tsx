'use client';

/**
 * Two to four cars side by side: price, the rating with its year, the
 * consumption, the warranty, five years of running costs, a repayment,
 * what women who own one say, and every safety feature, one per row.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Scale } from 'lucide-react';
import { PageHero, PageShell } from '@/components/layout/PageShell';
import { autoApi, type CarCard } from '@/lib/automotive-api';
import { AncapBadge, AutoDisclaimer, ErrorBox, Loading, useLoad } from '@/components/automotive/AutoUi';

type Compare = { cars: CarCard[]; rows: Array<{ key: string; label: string; values: string[] }>; features: Array<{ key: string; label: string; values: string[] }> };

function Table() {
  const search = useSearchParams();
  const slugs = (search.get('slugs') ?? '').split(',').filter(Boolean);
  const data = useLoad<Compare>(() => autoApi.compare(slugs), [slugs.join(',')]);
  return (
    <PageShell width="wide" backTo={{ href: '/cars/new', label: 'Back to the catalogue' }}>
      <PageHero kicker="Compare" title="Side by side, the things that matter" description="The rating and its year, what it costs to buy and to run, and whether the safety feature you care about is on the spec sheet." />
      {data.loading && <div className="mt-6"><Loading /></div>}
      <ErrorBox error={data.error} />
      {data.data && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="bg-slate-50 dark:bg-slate-900"><th className="p-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">&nbsp;</th>{data.data.cars.map((c) => <th key={c.id} className="p-3 text-left"><Link href={`/cars/new/${c.slug}`} className="font-semibold text-slate-900 hover:text-rose-600 dark:text-white">{c.make} {c.model}</Link><p className="text-xs font-normal text-slate-500">{c.variant}</p><div className="mt-1"><AncapBadge ancap={c.ancap} stars={c.ancapStars} compact /></div></th>)}</tr></thead>
            <tbody>
              {data.data.rows.map((r) => <tr key={r.key} className="border-t border-slate-100 dark:border-slate-800"><th className="p-3 text-left text-xs font-medium text-slate-500">{r.label}</th>{r.values.map((v, i) => <td key={i} className="p-3 text-slate-800 dark:text-slate-200">{v}</td>)}</tr>)}
              <tr className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"><th colSpan={data.data.cars.length + 1} className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"><Scale className="mr-1 inline h-3.5 w-3.5" /> Safety features, typically standard; the grade's spec sheet decides</th></tr>
              {data.data.features.map((r) => <tr key={r.key} className="border-t border-slate-100 dark:border-slate-800"><th className="p-3 text-left text-xs font-medium text-slate-500">{r.label}</th>{r.values.map((v, i) => <td key={i} className={`p-3 ${v === 'Yes' ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'text-slate-500'}`}>{v}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4"><AutoDisclaimer /></div>
    </PageShell>
  );
}

export default function ComparePage() {
  return <Suspense fallback={<PageShell width="wide"><Loading /></PageShell>}><Table /></Suspense>;
}
