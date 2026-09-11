'use client';

/**
 * The library: eight topics from Australian sources, the coping
 * strategies the circles use, and anything the blog has published under
 * wellness. Reading, not tracking; nothing here is stored.
 */

import Link from 'next/link';
import { BookOpen, ExternalLink } from 'lucide-react';
import { wellnessApi, type CrisisLine } from '@/lib/wellness-api';
import { CrisisStrip, ErrorBox, HealthDisclaimer, Loading, PageTitle, WellnessNav, useLoad } from '@/components/wellness/WellnessUi';
import { JumpLinks, Panel } from '@/components/strategy/StrategyUi';

type Library = { asAt: string; topics: Array<{ key: string; name: string; blurb: string; items: Array<{ key: string; title: string; summary: string; source: string; url: string; kind: string; minutes?: number }> }>; strategies: Array<{ key: string; name: string; topics: string[]; minutes: number; how: string[]; source: string; url: string }>; crisisLines: CrisisLine[]; articles: Array<{ slug: string; title: string; excerpt: string | null; coverImage: string | null; publishedAt: string | null }> };

export default function LibraryPage() {
  const lib = useLoad<Library>(() => wellnessApi.library());
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={BookOpen} kicker="Wellness" title="The library" blurb="Sleep, eating, movement, stress, hormones, relationships, ageing and support, from the Australian sources that know." />
      <WellnessNav current="/dashboard/wellness/library" />
      <CrisisStrip lines={lib.data?.crisisLines} compact />
      {lib.loading && <Loading />}
      <ErrorBox error={lib.error} />
      {lib.data && (
        <>
          <JumpLinks items={[...lib.data.topics.map((t) => ({ id: t.key, label: t.name })), { id: 'strategies', label: 'Strategies' }]} />
          {lib.data.topics.map((t) => (
            <Panel key={t.key} id={t.key} title={t.name} intro={t.blurb}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {t.items.map((i) => <li key={i.key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><a href={i.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-slate-900 hover:text-rose-600 dark:text-white">{i.title} <ExternalLink className="h-3.5 w-3.5 text-slate-400" /></a><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{i.summary}</p><p className="mt-1 text-xs text-slate-500">{i.source}{i.minutes ? ` · ${i.minutes} min` : ''} · {i.kind}</p></li>)}
              </ul>
            </Panel>
          ))}
          <Panel id="strategies" title="Strategies" intro="What the circles practise. Three minutes to an hour, each from the place that teaches it.">
            <ul className="grid gap-3 md:grid-cols-2">
              {lib.data.strategies.map((s) => <li key={s.key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><p className="font-semibold text-slate-900 dark:text-white">{s.name} <span className="text-xs font-normal text-slate-500">· {s.minutes} min · {s.topics.join(', ')}</span></p><ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-slate-600 dark:text-slate-400">{s.how.map((h) => <li key={h}>{h}</li>)}</ol><a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-slate-500 underline-offset-2 hover:underline">{s.source}</a></li>)}
            </ul>
          </Panel>
          {lib.data.articles.length > 0 && (
            <Panel title="From the blog">
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{lib.data.articles.map((a) => <li key={a.slug}><Link href={`/blog/${a.slug}`} className="tile-soft block p-3"><p className="font-semibold text-slate-900 dark:text-white">{a.title}</p>{a.excerpt && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{a.excerpt}</p>}</Link></li>)}</ul>
            </Panel>
          )}
          <p className="text-xs text-slate-500">Sources checked {lib.data.asAt}.</p>
        </>
      )}
      <HealthDisclaimer />
    </div>
  );
}
