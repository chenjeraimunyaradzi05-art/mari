'use client';

/**
 * Bring your data: an Apple Health export, Google Fit's Takeout, or the
 * CSV this app writes. The file is read here in the browser, turned into
 * the entries the trackers understand, shown back as a summary, and only
 * what she approves is sent, in batches. A file imported twice leaves one
 * copy, because each record carries where it came from.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { CheckCircle2, FileUp, Upload } from 'lucide-react';
import { wellnessApi, wellnessError } from '@/lib/wellness-api';
import { createAppleHealthParser, detectFormat, parseAthenaCsv, parseGoogleFitDailyCsv, parseGoogleFitSessions, summarise, KIND_LABELS, type ImportEntry, type ImportKind, type ImportResult } from '@/lib/health-import';
import { ErrorBox, HealthDisclaimer, PageTitle, WellnessNav, fmtDay } from '@/components/wellness/WellnessUi';
import { Check, Field, Panel, Stat, inputClass } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Stage = 'pick' | 'reading' | 'review' | 'sending' | 'done';

const yearAgo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); };

/** The file, a line at a time, without ever holding the whole of it. */
async function readLines(file: File, onLine: (line: string) => void, onProgress: (fraction: number) => void) {
  if (typeof file.stream === 'function' && typeof TextDecoderStream !== 'undefined') {
    const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let read = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      read += value.length;
      let idx = buffer.indexOf('\n');
      while (idx >= 0) {
        onLine(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 1);
        idx = buffer.indexOf('\n');
      }
      onProgress(Math.min(1, read / Math.max(1, file.size)));
    }
    if (buffer) onLine(buffer);
  } else {
    const text = await file.text();
    for (const line of text.split(/\r?\n/)) onLine(line);
  }
  onProgress(1);
}

async function readFiles(files: File[], onProgress: (fraction: number) => void): Promise<ImportResult> {
  const first = files[0];
  const head = await first.slice(0, 6000).text();
  const format = detectFormat(first.name, head);
  if (!format) throw new Error('That does not look like an Apple Health export, a Google Fit file, or this app\'s CSV.');
  if (format === 'apple-health') {
    const parser = createAppleHealthParser();
    await readLines(first, parser.ingest, onProgress);
    return parser.finish();
  }
  if (format === 'google-fit-daily') { onProgress(1); return parseGoogleFitDailyCsv(await first.text()); }
  if (format === 'athena-csv') { onProgress(1); return parseAthenaCsv(await first.text()); }
  const texts = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
  onProgress(1);
  return parseGoogleFitSessions(texts);
}

export default function ImportPage() {
  const [stage, setStage] = useState<Stage>('pick');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kinds, setKinds] = useState<Record<string, boolean>>({});
  const [since, setSince] = useState(yearAgo());
  const [sent, setSent] = useState({ imported: 0, failed: 0, replaced: 0, errors: [] as string[] });
  const input = useRef<HTMLInputElement>(null);

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setError(null);
    setStage('reading');
    setProgress(0);
    try {
      const r = await readFiles(files, setProgress);
      setResult(r);
      setKinds(Object.fromEntries(summarise(r.entries).byKind.map((k) => [k.kind, true])));
      setStage('review');
    } catch (err) {
      setError((err as Error).message || 'That file could not be read.');
      setStage('pick');
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  const chosen: ImportEntry[] = (result?.entries ?? []).filter((e) => kinds[e.kind] !== false && e.day >= since);
  const summary = summarise(chosen);

  const send = async () => {
    if (!chosen.length) return;
    setStage('sending');
    setProgress(0);
    const totals = { imported: 0, failed: 0, replaced: 0, errors: [] as string[] };
    try {
      for (let i = 0; i < chosen.length; i += 400) {
        const batch = chosen.slice(i, i + 400).map((e) => ({ kind: e.kind, day: e.day, at: e.at, payload: e.payload }));
        const res = await wellnessApi.importEntries(batch);
        const d = res.data?.data ?? {};
        totals.imported += d.imported ?? 0; totals.failed += d.failed ?? 0; totals.replaced += d.replaced ?? 0;
        if (Array.isArray(d.errors)) totals.errors.push(...d.errors.slice(0, 10 - totals.errors.length));
        setProgress(Math.min(1, (i + batch.length) / chosen.length));
      }
      setSent(totals);
      setStage('done');
      toast.success(`${totals.imported} entries in.`);
    } catch (err) {
      toast.error(wellnessError(err, 'The import stopped part way. What was sent is in; try the rest again.'));
      setSent(totals);
      setStage('review');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageTitle icon={Upload} kicker="Wellness" title="Bring your data" blurb="What your phone already knows, into the trackers: nights, steps, workouts, water and period days. The file is read here, on your device, and only the summarised entries you approve are sent." />
      <WellnessNav current="/dashboard/wellness/track" />

      {(stage === 'pick' || stage === 'reading') && (
        <>
          <Panel icon={FileUp} title="The file" intro="One Apple Health export, one Google Fit daily summary, several Google Fit session files, or the CSV from the insights page.">
            <label className={cn('flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 p-8 text-center transition hover:border-rose-300 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-rose-900/10', stage === 'reading' && 'pointer-events-none opacity-70')}>
              <Upload className="h-6 w-6 text-rose-500" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{stage === 'reading' ? `Reading, ${Math.round(progress * 100)}%` : 'Choose a file, or drop it here'}</span>
              <span className="text-xs text-slate-500">export.xml · Daily Summaries.csv · session .json files · athena-health-….csv</span>
              <input ref={input} type="file" multiple accept=".xml,.csv,.json,text/xml,text/csv,application/json" className="sr-only" onChange={(e) => onFiles(e.target.files)} disabled={stage === 'reading'} />
            </label>
            {stage === 'reading' && <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-rose-400 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
            <ErrorBox error={error} />
          </Panel>
          <div className="grid gap-4 md:grid-cols-3">
            <Panel title="Apple Health" intro="On the iPhone.">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300"><li>Open Health, tap your picture, then Export All Health Data.</li><li>Save the zip somewhere you can reach, and unzip it.</li><li>Choose export.xml. It is big; reading it takes a minute.</li></ol>
              <p className="mt-2 text-xs text-slate-500">Brings sleep, steps, exercise minutes, workouts, mindful minutes, water and menstrual flow.</p>
            </Panel>
            <Panel title="Google Fit" intro="Through Google Takeout.">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300"><li>At takeout.google.com choose only Fit and create the export.</li><li>In it, find Daily activity metrics, then Daily Summaries.csv.</li><li>Sleep and workouts are in All Sessions; choose those .json files together.</li></ol>
              <p className="mt-2 text-xs text-slate-500">Brings days of steps and move minutes, and the sessions as workouts and nights.</p>
            </Panel>
            <Panel title="This app's CSV" intro="From another account, or a backup.">
              <p className="text-sm text-slate-700 dark:text-slate-300">The insights page writes every entry as a CSV. Choose that file and it comes back exactly as it was, dose logs aside.</p>
              <Link href="/dashboard/wellness/insights#report" className="mt-2 inline-block text-sm font-medium text-rose-600 dark:text-rose-400">The insights page</Link>
            </Panel>
          </div>
        </>
      )}

      {result && (stage === 'review' || stage === 'sending') && (
        <>
          <Panel icon={CheckCircle2} title="What was found" intro={result.notes.join(' ')}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Entries" value={String(result.entries.length)} sub={result.skipped ? `${result.skipped} rows skipped` : 'nothing skipped'} />
              <Stat label="From" value={summarise(result.entries).from ? fmtDay(summarise(result.entries).from, { day: 'numeric', month: 'short', year: 'numeric' }) : '–'} />
              <Stat label="To" value={summarise(result.entries).to ? fmtDay(summarise(result.entries).to, { day: 'numeric', month: 'short', year: 'numeric' }) : '–'} />
              <Stat label="Source" value={result.source === 'apple-health' ? 'Apple Health' : result.source === 'google-fit' ? 'Google Fit' : 'This app'} />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-[2fr_1fr]">
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Bring in</span>
                <ul className="mt-2 space-y-2">
                  {summarise(result.entries).byKind.map((k) => <li key={k.kind}><Check checked={kinds[k.kind] !== false} onChange={(v) => setKinds((x) => ({ ...x, [k.kind]: v }))} label={`${KIND_LABELS[k.kind as ImportKind]} (${k.count})`} /></li>)}
                </ul>
              </div>
              <Field label="Only from" hint="Older days are left in the file."><input type="date" value={since} onChange={(e) => e.target.value && setSince(e.target.value)} className={inputClass} /></Field>
            </div>
            <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">{chosen.length} entr{chosen.length === 1 ? 'y' : 'ies'}{summary.from ? `, ${fmtDay(summary.from, { day: 'numeric', month: 'short' })} to ${fmtDay(summary.to, { day: 'numeric', month: 'short' })}` : ''}, will be encrypted and stored. A tracker you switched off in the privacy settings is skipped.</p>
            {stage === 'sending' && <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-emerald-400 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
            {sent.errors.length > 0 && stage === 'review' && <ErrorBox error={sent.errors.join(' · ')} />}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={send} disabled={stage === 'sending' || chosen.length === 0} className="btn-primary text-sm disabled:opacity-50">{stage === 'sending' ? `Sending, ${Math.round(progress * 100)}%` : `Bring in ${chosen.length}`}</button>
              <button type="button" onClick={() => { setResult(null); setStage('pick'); }} disabled={stage === 'sending'} className="btn-ghost text-sm">Another file</button>
            </div>
          </Panel>
        </>
      )}

      {stage === 'done' && (
        <Panel icon={CheckCircle2} title="In" intro={`${sent.imported} entries stored${sent.replaced ? `, ${sent.replaced} earlier copies replaced` : ''}${sent.failed ? `, ${sent.failed} could not be` : ''}.`}>
          {sent.errors.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">{sent.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard/wellness/insights" className="btn-primary text-sm">What the days are saying</Link>
            <Link href="/dashboard/wellness/track" className="btn-secondary text-sm">The trackers</Link>
            <button type="button" onClick={() => { setResult(null); setStage('pick'); setSent({ imported: 0, failed: 0, replaced: 0, errors: [] }); }} className="btn-ghost text-sm">Another file</button>
          </div>
        </Panel>
      )}

      <HealthDisclaimer />
    </div>
  );
}
