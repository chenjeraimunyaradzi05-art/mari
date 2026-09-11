'use client';

/**
 * Privacy and what is collected. Every tracker can be switched off, the
 * cycle can be told a typical length before there is history, forums can
 * default to anonymous, content warnings can be kept folded, the daily
 * reminder can be set or silenced, sharing with practitioners can be
 * turned off, and everything can be deleted, at once, for good.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Lock, Trash2 } from 'lucide-react';
import { wellnessApi, wellnessError } from '@/lib/wellness-api';
import { ErrorBox, Loading, PageTitle, WellnessNav, useLoad } from '@/components/wellness/WellnessUi';
import { Check, Field, NumberInput, Panel, SelectInput } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Settings = { trackers: Record<string, boolean>; cycleLengthHint: number | null; periodLengthHint: number | null; hiddenWarnings: string[]; anonymousByDefault: boolean; checkInReminderHour: number | null; shareWithPractitioners: boolean };
type Reference = { contentWarnings: string[] };
const TRACKERS: Array<{ key: string; label: string; what: string }> = [
  { key: 'checkin', label: 'Daily check-in', what: 'Mood, stress, anxiety, energy and a line about the day.' },
  { key: 'sleep', label: 'Sleep', what: 'Hours, quality, bed and wake times.' },
  { key: 'cycle', label: 'Cycle', what: 'Period days, flow, pain and symptoms, and the prediction built from them.' },
  { key: 'activity', label: 'Movement', what: 'What you did, for how long, and steps if you add them.' },
  { key: 'hydration', label: 'Water', what: 'Glasses a day.' },
  { key: 'nutrition', label: 'Food', what: 'Meals and, only if you want, calories. Off by default.' },
  { key: 'medications', label: 'Medications', what: 'What you take, the doses you log, and the reminders.' },
];

export default function WellnessSettingsPage() {
  const router = useRouter();
  const settings = useLoad<Settings>(() => wellnessApi.settings());
  const ref = useLoad<Reference>(() => wellnessApi.reference());
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (settings.data) setS(settings.data); }, [settings.data]);

  const save = async () => {
    if (!s) return;
    setBusy(true);
    try { await wellnessApi.saveSettings(s); toast.success('Saved'); settings.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be saved.')); } finally { setBusy(false); }
  };
  const deleteAll = async () => {
    if (window.prompt('This deletes every health record, medication, note, share link, mental load entry, habit and goal, and cannot be undone. Type DELETE to confirm.') !== 'DELETE') return;
    setBusy(true);
    try { const res = await wellnessApi.deleteData(); toast.success(`Deleted ${res.data?.data?.entries ?? 0} records and everything with them.`); router.push('/dashboard/wellness'); } catch (err) { toast.error(wellnessError(err, 'That could not be done.')); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageTitle icon={Lock} kicker="Wellness" title="Privacy and what is collected" blurb="Only what you switch on is collected. It is encrypted before it is stored, read only by you, never sold or shared with anyone but a practitioner you hand a link to, and deleted the moment you say." />
      <WellnessNav current="/dashboard/wellness/settings" />
      {settings.loading && <Loading />}
      <ErrorBox error={settings.error} />
      {s && (
        <>
          <Panel title="Trackers" intro="Off means nothing new is recorded and the page does not show it. What is already logged stays until you delete it below.">
            <ul className="space-y-3">{TRACKERS.map((t) => <li key={t.key}><Check checked={s.trackers[t.key] !== false} onChange={(v) => setS((x) => x && ({ ...x, trackers: { ...x.trackers, [t.key]: v } }))} label={t.label} hint={t.what} /></li>)}</ul>
          </Panel>
          <Panel title="The cycle, before there is history" intro="Used until two periods are logged; after that your own average takes over.">
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Typical cycle length" hint="First day to first day. 21 to 35 is the usual range."><NumberInput value={s.cycleLengthHint?.toString() ?? ''} onChange={(v) => setS((x) => x && ({ ...x, cycleLengthHint: v ? Number(v) : null }))} suffix="days" min={15} max={90} placeholder="28" /></Field><Field label="Typical period length"><NumberInput value={s.periodLengthHint?.toString() ?? ''} onChange={(v) => setS((x) => x && ({ ...x, periodLengthHint: v ? Number(v) : null }))} suffix="days" min={1} max={14} placeholder="5" /></Field></div>
          </Panel>
          <Panel title="Forums" intro="How you post, and what you would rather not see unfolded.">
            <Check checked={s.anonymousByDefault} onChange={(v) => setS((x) => x && ({ ...x, anonymousByDefault: v }))} label="Post anonymously by default" hint="You can change it on each post." />
            <div className="mt-4"><span className="text-xs font-medium uppercase tracking-wide text-slate-500">Keep folded</span><p className="text-xs text-slate-500">Posts carrying these warnings open folded on every page.</p><div className="mt-2 flex flex-wrap gap-1.5">{(ref.data?.contentWarnings ?? []).map((w) => <button key={w} type="button" onClick={() => setS((x) => x && ({ ...x, hiddenWarnings: x.hiddenWarnings.includes(w) ? x.hiddenWarnings.filter((y) => y !== w) : [...x.hiddenWarnings, w] }))} className={cn('rounded-full px-3 py-1 text-xs font-medium', s.hiddenWarnings.includes(w) ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{w}</button>)}</div></div>
          </Panel>
          <Panel title="Reminders and sharing">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Daily check-in reminder" hint="A notification if you have not checked in by then."><SelectInput value={s.checkInReminderHour === null ? '' : String(s.checkInReminderHour)} onChange={(v) => setS((x) => x && ({ ...x, checkInReminderHour: v === '' ? null : Number(v) }))} options={[{ value: '', label: 'Off' }, ...Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}` }))]} /></Field>
              <div className="pt-5"><Check checked={s.shareWithPractitioners} onChange={(v) => setS((x) => x && ({ ...x, shareWithPractitioners: v }))} label="Allow share links for practitioners" hint="Off means no summary link can be created, even from a booking." /></div>
            </div>
          </Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={save} disabled={busy} className="btn-primary text-sm">Save settings</button>
            <button type="button" onClick={deleteAll} disabled={busy} className="btn-ghost inline-flex items-center gap-2 text-sm text-rose-600"><Trash2 className="h-4 w-4" /> Delete all my health data</button>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
            <p className="font-semibold text-slate-800 dark:text-slate-200">How your health data is handled</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Each record is encrypted with AES-256-GCM before it reaches the database. The database can see what day and what kind of record it is, and nothing else.</li>
              <li>Nothing on these pages is sent to analytics, an advertiser or a data broker. There is no such integration to switch off.</li>
              <li>The insights are worked out from your records by rules, on the server, when you open the page. Nothing is kept from that.</li>
              <li>A share link shows a summary to whoever has the link until it expires or you withdraw it. Forum posts, circles and bookings are separate from this data and are not covered by the delete button above.</li>
              <li>Deleting removes the records themselves, not a copy; there is no copy.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
