'use client';

/**
 * Wellness, in public. The crisis lines first, because someone may have
 * landed here at 2am; a check a visitor can take before she signs up (the
 * K10, the same ten questions the national health survey uses), the way
 * into the health dashboard, the forums and circles, the practitioner
 * directory and the library, and the library's topics open to read.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Moon } from 'lucide-react';
import { PageHero, PageShell, Section } from '@/components/layout/PageShell';
import { wellnessApi, wellnessError, type CrisisLine } from '@/lib/wellness-api';
import { CrisisStrip, HealthDisclaimer, useLoad } from '@/components/wellness/WellnessUi';
import { WELLNESS_GROUPS, WELLNESS_TONES } from '@/lib/wellness-nav';
import { cn } from '@/lib/utils';

type Reference = { crisisLines: CrisisLine[]; k10: { questions: Array<{ id: number; text: string }>; options: Array<{ value: number; label: string }> } };
type Library = { topics: Array<{ key: string; name: string; blurb: string; items: Array<{ key: string; title: string; summary: string; source: string; url: string; kind: string }> }> };
type K10 = { score: number; band: string; label: string; meaning: string; nextStep: string; crisisLines: CrisisLine[] };

export default function WellnessPage() {
  const ref = useLoad<Reference>(() => wellnessApi.reference());
  const lib = useLoad<Library>(() => wellnessApi.library());
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<K10 | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questions = ref.data?.k10.questions ?? [];
  const options = ref.data?.k10.options ?? [];
  const complete = questions.length > 0 && questions.every((q) => answers[q.id]);

  const score = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await wellnessApi.k10(questions.map((q) => answers[q.id]));
      setResult(res.data?.data ?? null);
    } catch (err) {
      setError(wellnessError(err, 'That could not be scored.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell width="wide">
      <PageHero
        kicker="Health and wellbeing"
        title="Looked after, on your terms"
        description="Track what matters, see what the days are saying, find care that takes you seriously, and talk to women who get it. Everything health-related is encrypted and read only by you."
        primaryAction={{ label: 'Open the health dashboard', href: '/dashboard/wellness' }}
        secondaryAction={{ label: 'Find a practitioner', href: '/dashboard/wellness/practitioners' }}
      />

      <div className="mt-6"><CrisisStrip lines={ref.data?.crisisLines} /></div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {WELLNESS_GROUPS.map((g) => (
            <section key={g.key} aria-labelledby={`wellness-${g.key}`}>
              <h2 id={`wellness-${g.key}`} className="rail-title">{g.title}</h2>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{g.intro}</p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {g.items.map((t) => (
                  <li key={t.href}>
                    <Link href={t.href} className="tile-soft group flex h-full items-start gap-3 p-4">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', WELLNESS_TONES[g.tone])}><t.icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-slate-900 dark:text-white">{t.label}</span>
                        <span className="mt-0.5 block text-sm leading-6 text-slate-600 dark:text-slate-400">{t.blurb}</span>
                        <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-rose-600 dark:text-rose-400">
                          {t.gated ? 'Sign in and open' : 'Open'} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div id="check" className="scroll-mt-24">
        <Section icon={Moon} title="How have the last four weeks been?" description="The K10, the ten questions used in the national health survey. Nothing you answer here is stored.">
          {result ? (
            <div className="space-y-3">
              <div className={cn('rounded-xl p-4', result.band === 'low' ? 'bg-emerald-50 dark:bg-emerald-900/20' : result.band === 'mild' ? 'bg-sky-50 dark:bg-sky-900/20' : 'bg-amber-50 dark:bg-amber-900/20')}>
                <p className="text-xs text-slate-500 dark:text-slate-400">Your score</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{result.score} <span className="text-base font-medium text-slate-600 dark:text-slate-300">of 50, {result.label.toLowerCase()}</span></p>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{result.meaning}</p>
                <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">{result.nextStep}</p>
              </div>
              {(result.band === 'moderate' || result.band === 'severe') && <CrisisStrip lines={result.crisisLines} compact />}
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/wellness/track" className="btn-primary text-sm">Start the daily check-in</Link>
                <button type="button" onClick={() => { setResult(null); setAnswers({}); }} className="btn-ghost text-sm">Take it again</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">In the past four weeks, about how often did you feel…</p>
              {questions.map((q) => (
                <fieldset key={q.id}>
                  <legend className="text-sm text-slate-800 dark:text-slate-200">{q.id}. …{q.text}</legend>
                  <div className="mt-1.5 grid grid-cols-5 gap-1">
                    {options.map((o) => (
                      <button key={o.value} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.value }))} title={o.label} className={cn('rounded-md py-1.5 text-xs font-semibold transition', answers[q.id] === o.value ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-rose-100 dark:bg-slate-800 dark:text-slate-300')}>
                        {o.value}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
              {questions.length > 0 && <p className="text-[11px] text-slate-500">1 none of the time · 5 all of the time</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="button" onClick={score} disabled={!complete || busy} className="btn-primary w-full text-sm disabled:opacity-50">{busy ? 'Scoring' : 'See my score'}</button>
            </div>
          )}
        </Section>
        </div>
      </div>

      <section id="library" className="mt-10 scroll-mt-24">
        <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-rose-500" /><h2 className="rail-title">The library</h2></div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Australian sources, plainly summarised. Sign in for the coping strategies the circles use and for anything tied to your own records.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(lib.data?.topics ?? []).map((t) => (
            <div key={t.key} className="surface p-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">{t.name}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t.blurb}</p>
              <ul className="mt-3 space-y-2">
                {t.items.slice(0, 3).map((i) => (
                  <li key={i.key}>
                    <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-800 hover:text-rose-600 dark:text-slate-200">{i.title}</a>
                    <p className="text-[11px] text-slate-500">{i.source}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8"><HealthDisclaimer /></div>
    </PageShell>
  );
}
