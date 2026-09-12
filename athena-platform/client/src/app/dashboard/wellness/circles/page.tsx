'use client';

/**
 * Support circles: four to six women, one topic, eight weeks of weekly
 * check-ins, a facilitator, and an option to keep going. Any member can
 * start one; small is the point.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Plus, Users } from 'lucide-react';
import { localDay, wellnessApi, wellnessError, type Author } from '@/lib/wellness-api';
import { Chip, Empty, ErrorBox, Loading, PageTitle, WellnessNav, fmtDay, useLoad } from '@/components/wellness/WellnessUi';
import { Field, NumberInput, Panel, SelectInput, inputClass, num } from '@/components/strategy/StrategyUi';

type Circle = { id: string; name: string; topic: string; description: string; capacity: number; weeks: number; startsOn: string; endsOn: string; meetingDay: number; meetingTime: string; format: string; status: string; facilitator: Author; memberCount: number; spotsLeft: number; isMember: boolean; isFacilitator: boolean; currentWeek: number | null };
type Data = { circles: Circle[]; topics: string[] };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const title = (s: string) => s.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export default function CirclesPage() {
  const router = useRouter();
  const [mine, setMine] = useState(false);
  const data = useLoad<Data>(() => wellnessApi.circles(mine ? { mine: 'true' } : {}), [mine]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', topic: 'burnout', description: '', capacity: '6', weeks: '8', startsOn: localDay(), meetingDay: '2', meetingTime: '19:00', format: 'VIDEO', meetingLink: '', location: '' });
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const res = await wellnessApi.createCircle({ ...form, capacity: num(form.capacity, 6), weeks: num(form.weeks, 8), meetingDay: num(form.meetingDay, 2), meetingLink: form.meetingLink || null, location: form.location || null });
      toast.success('Circle started');
      router.push(`/dashboard/wellness/circles/${res.data?.data?.id}`);
    } catch (err) { toast.error(wellnessError(err, 'That could not be started.')); } finally { setBusy(false); }
  };
  const join = async (c: Circle) => { try { await wellnessApi.joinCircle(c.id); toast.success(`You are in ${c.name}`); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That did not work.')); } };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={Users} kicker="Wellness" title="Support circles" blurb="Four to six women, one topic, eight weeks. A weekly check-in, a strategy to try, and people who notice when you go quiet." action={<button type="button" onClick={() => setOpen((v) => !v)} className="btn-primary inline-flex items-center gap-2 text-sm"><Plus className="h-4 w-4" /> Start a circle</button>} />
      <WellnessNav current="/dashboard/wellness/circles" />
      <div className="flex gap-2"><button type="button" onClick={() => setMine(false)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${!mine ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>Open now</button><button type="button" onClick={() => setMine(true)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${mine ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>Mine</button></div>

      {open && (
        <Panel title="A new circle" intro="You facilitate: you hold the time, open the check-ins and keep it kind. A guide for each week is on the circle page.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={80} className={inputClass} placeholder="Back from burnout, spring cohort" /></Field>
            <Field label="Topic"><SelectInput value={form.topic} onChange={(v) => setForm((f) => ({ ...f, topic: v }))} options={(data.data?.topics ?? ['burnout']).map((t) => ({ value: t, label: title(t) }))} /></Field>
            <Field label="What it is for" className="sm:col-span-2"><textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} maxLength={1500} className={inputClass} placeholder="Who it is for, what a week looks like, what you ask of people." /></Field>
            <Field label="Members" hint="Four to six is where it works."><NumberInput value={form.capacity} onChange={(v) => setForm((f) => ({ ...f, capacity: v }))} min={3} max={8} /></Field>
            <Field label="Weeks"><NumberInput value={form.weeks} onChange={(v) => setForm((f) => ({ ...f, weeks: v }))} min={4} max={12} /></Field>
            <Field label="Starts"><input type="date" value={form.startsOn} onChange={(e) => setForm((f) => ({ ...f, startsOn: e.target.value }))} className={inputClass} /></Field>
            <Field label="Meets on"><SelectInput value={form.meetingDay} onChange={(v) => setForm((f) => ({ ...f, meetingDay: v }))} options={DAYS.map((d, i) => ({ value: String(i), label: d }))} /></Field>
            <Field label="At"><input type="time" value={form.meetingTime} onChange={(e) => setForm((f) => ({ ...f, meetingTime: e.target.value }))} className={inputClass} /></Field>
            <Field label="Format"><SelectInput value={form.format} onChange={(v) => setForm((f) => ({ ...f, format: v }))} options={[{ value: 'VIDEO', label: 'Video call' }, { value: 'ASYNC', label: 'Written, in your own time' }, { value: 'IN_PERSON', label: 'In person' }]} /></Field>
            {form.format === 'VIDEO' && <Field label="Meeting link" hint="Members see it; nobody else does."><input value={form.meetingLink} onChange={(e) => setForm((f) => ({ ...f, meetingLink: e.target.value }))} className={inputClass} placeholder="https://meet…" /></Field>}
            {form.format === 'IN_PERSON' && <Field label="Where"><input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} maxLength={160} className={inputClass} /></Field>}
          </div>
          <div className="mt-4 flex gap-2"><button type="button" onClick={create} disabled={busy || form.name.trim().length < 3 || form.description.trim().length < 10} className="btn-primary text-sm disabled:opacity-50">Start it</button><button type="button" onClick={() => setOpen(false)} className="btn-ghost text-sm">Cancel</button></div>
        </Panel>
      )}

      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {data.data && data.data.circles.length === 0 && <Empty title={mine ? 'You are not in a circle' : 'No circle is open right now'} body={mine ? 'Join one that is open, or start one on the thing you are carrying.' : 'Start one. It takes a name, a topic and a Tuesday.'} action={<button type="button" onClick={() => { setMine(false); setOpen(true); }} className="btn-primary text-sm">Start a circle</button>} />}
      <ul className="grid gap-4 md:grid-cols-2">
        {(data.data?.circles ?? []).map((c) => (
          <li key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2"><Chip tone="rose">{title(c.topic)}</Chip><Chip tone={c.status === 'RUNNING' ? 'emerald' : c.status === 'OPEN' ? 'sky' : 'slate'}>{c.status === 'RUNNING' ? `Week ${c.currentWeek ?? '–'} of ${c.weeks}` : c.status === 'OPEN' ? `Starts ${fmtDay(c.startsOn)}` : c.status.toLowerCase()}</Chip>{c.isMember && <Chip tone="amber">{c.isFacilitator ? 'You facilitate' : 'You are in'}</Chip>}</div>
            <Link href={`/dashboard/wellness/circles/${c.id}`} className="mt-2 block text-lg font-semibold text-slate-900 hover:text-rose-600 dark:text-white">{c.name}</Link>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{c.description.length > 180 ? `${c.description.slice(0, 179)}…` : c.description}</p>
            <p className="mt-2 text-xs text-slate-500">{DAYS[c.meetingDay]}s at {c.meetingTime} · {c.format === 'VIDEO' ? 'video' : c.format === 'ASYNC' ? 'written' : 'in person'} · {c.memberCount} of {c.capacity} · facilitated by {c.facilitator.name}</p>
            <div className="mt-3 flex gap-2">
              <Link href={`/dashboard/wellness/circles/${c.id}`} className="btn-secondary text-sm">Open</Link>
              {!c.isMember && c.spotsLeft > 0 && (c.status === 'OPEN' || c.status === 'RUNNING') && <button type="button" onClick={() => join(c)} className="btn-primary text-sm">Join</button>}
              {!c.isMember && c.spotsLeft === 0 && <span className="self-center text-xs text-slate-500">Full, on purpose</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
