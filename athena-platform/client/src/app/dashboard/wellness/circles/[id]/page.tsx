'use client';

/**
 * One circle: the schedule, this week's check-in (a win, a blocker, the
 * next step, and how you are), what the others wrote this week, the
 * strategies for the topic, and the facilitator's controls.
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { CalendarPlus, Users, Video } from 'lucide-react';
import { wellnessApi, wellnessError, type Author } from '@/lib/wellness-api';
import { Chip, ErrorBox, Loading, PageTitle, Scale, WellnessNav, fmtDay, useLoad } from '@/components/wellness/WellnessUi';
import { Field, Panel, inputClass } from '@/components/strategy/StrategyUi';
import { downloadText } from '@/lib/download';
import { cn } from '@/lib/utils';

type CheckIn = { id: string; week: number; mood: number; wins: string; blockers: string; nextStep: string; createdAt: string; author?: Author };
type Data = { id: string; name: string; topic: string; description: string; capacity: number; weeks: number; startsOn: string; endsOn: string; meetingDay: number; meetingTime: string; format: string; meetingLink: string | null; location: string | null; status: string; facilitator: Author; memberCount: number; spotsLeft: number; isMember: boolean; isFacilitator: boolean; currentWeek: number | null; strategies: Array<{ key: string; name: string; minutes: number; how: string[]; source: string; url: string }>; schedule: Array<{ week: number; day: string; time: string }>; members: Array<Author & { role: string; continueRequested: boolean }>; checkIns: CheckIn[]; myCheckIns: CheckIn[]; continueRequests?: number };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function CirclePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const data = useLoad<Data>(() => wellnessApi.circle(params.id), [params.id]);
  const [form, setForm] = useState({ mood: null as number | null, wins: '', blockers: '', nextStep: '' });
  const [busy, setBusy] = useState(false);
  const [linkEdit, setLinkEdit] = useState<string | null>(null);
  const c = data.data;
  const mine = c?.currentWeek ? c.myCheckIns.find((x) => x.week === c.currentWeek) : undefined;

  const act = async (fn: () => Promise<unknown>, done?: string) => { setBusy(true); try { await fn(); if (done) toast.success(done); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That did not work.')); } finally { setBusy(false); } };
  const checkIn = () => act(() => wellnessApi.circleCheckIn(params.id, { mood: form.mood, wins: form.wins, blockers: form.blockers, nextStep: form.nextStep }), 'Checked in');
  const leave = () => { if (window.confirm('Leave this circle?')) act(async () => { await wellnessApi.leaveCircle(params.id); router.push('/dashboard/wellness/circles'); }); };
  const addToCalendar = async () => {
    if (!c) return;
    try { const res = await wellnessApi.circleIcs(c.id); downloadText(`athena-circle-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'circle'}.ics`, String(res.data), 'text/calendar;charset=utf-8'); toast.success('Every meeting, as a calendar file'); } catch (err) { toast.error(wellnessError(err, 'The calendar file could not be made.')); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <WellnessNav current="/dashboard/wellness/circles" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {c && (
        <>
          <PageTitle icon={Users} kicker={c.topic.replace(/-/g, ' ')} title={c.name} blurb={c.description} action={
            <div className="flex flex-wrap gap-2">
              {!c.isMember && c.spotsLeft > 0 && (c.status === 'OPEN' || c.status === 'RUNNING') && <button type="button" disabled={busy} onClick={() => act(() => wellnessApi.joinCircle(c.id), 'You are in')} className="btn-primary text-sm">Join this circle</button>}
              {c.isMember && !c.isFacilitator && <button type="button" disabled={busy} onClick={leave} className="btn-ghost text-sm">Leave</button>}
              {c.isMember && c.meetingLink && <a href={c.meetingLink} target="_blank" rel="noopener noreferrer" className="btn-secondary inline-flex items-center gap-2 text-sm"><Video className="h-4 w-4" /> Join the call</a>}
              {c.isMember && c.status !== 'COMPLETED' && c.status !== 'CANCELLED' && <button type="button" onClick={addToCalendar} className="btn-ghost inline-flex items-center gap-2 text-sm"><CalendarPlus className="h-4 w-4" /> Add the weeks to my calendar</button>}
            </div>
          } />
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Chip tone={c.status === 'RUNNING' ? 'emerald' : c.status === 'OPEN' ? 'sky' : 'slate'}>{c.status === 'RUNNING' ? `Week ${c.currentWeek ?? '–'} of ${c.weeks}` : c.status.toLowerCase()}</Chip>
            <span>{DAYS[c.meetingDay]}s at {c.meetingTime}</span><span>·</span><span>{fmtDay(c.startsOn)} to {fmtDay(c.endsOn)}</span><span>·</span><span>{c.memberCount} of {c.capacity}</span><span>·</span><span>facilitated by {c.facilitator.name}</span>{c.isMember && c.location && <><span>·</span><span>{c.location}</span></>}
          </div>

          {c.isMember && c.currentWeek && (
            <Panel title={`Week ${c.currentWeek} check-in`} intro={mine ? 'Done for this week. You can change it until the week ends.' : 'Before you meet. A win, a blocker, the next step, and how you are, honestly.'}>
              {mine && !form.wins && !form.blockers ? (
                <div className="space-y-2 text-sm"><p><span className="font-semibold">Win:</span> {mine.wins || '–'}</p><p><span className="font-semibold">Blocker:</span> {mine.blockers || '–'}</p><p><span className="font-semibold">Next step:</span> {mine.nextStep || '–'}</p><p><span className="font-semibold">How you are:</span> {mine.mood} of 5</p><button type="button" onClick={() => setForm({ mood: mine.mood, wins: mine.wins, blockers: mine.blockers, nextStep: mine.nextStep })} className="text-rose-600">Change it</button></div>
              ) : (
                <div className="space-y-3">
                  <Scale label="How you are" words="mood" value={form.mood} onChange={(v) => setForm((f) => ({ ...f, mood: v }))} />
                  <Field label="A win, however small"><input value={form.wins} onChange={(e) => setForm((f) => ({ ...f, wins: e.target.value }))} maxLength={1000} className={inputClass} /></Field>
                  <Field label="What is in the way"><input value={form.blockers} onChange={(e) => setForm((f) => ({ ...f, blockers: e.target.value }))} maxLength={1000} className={inputClass} /></Field>
                  <Field label="The next step, by next week"><input value={form.nextStep} onChange={(e) => setForm((f) => ({ ...f, nextStep: e.target.value }))} maxLength={500} className={inputClass} /></Field>
                  <button type="button" onClick={checkIn} disabled={busy || !form.mood} className="btn-primary text-sm disabled:opacity-50">Check in</button>
                </div>
              )}
            </Panel>
          )}

          {c.isMember && (
            <Panel title={`This week, from the circle`} intro={c.checkIns.length ? 'Read before you meet; the meeting starts from here.' : 'Nobody has checked in yet this week.'}>
              <ul className="space-y-3">
                {c.checkIns.map((ci) => <li key={ci.id} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{ci.author?.name}{ci.author?.isYou ? ' (you)' : ''} · {ci.mood} of 5</p><p className="mt-1"><span className="text-slate-500">Win</span> {ci.wins || '–'}</p><p><span className="text-slate-500">Blocker</span> {ci.blockers || '–'}</p><p><span className="text-slate-500">Next</span> {ci.nextStep || '–'}</p></li>)}
              </ul>
            </Panel>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="The weeks" intro="Meeting day each week. Week one is settling in; the last week is what you keep.">
              <ol className="space-y-1 text-sm">{c.schedule.map((s) => <li key={s.week} className={cn('flex justify-between rounded-md px-2 py-1', s.week === c.currentWeek && 'bg-rose-50 font-semibold dark:bg-rose-900/20')}><span>Week {s.week}</span><span className="text-slate-500">{fmtDay(s.day)} {s.time}</span></li>)}</ol>
              {c.isMember && c.currentWeek && c.currentWeek >= c.weeks - 1 && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                  <p className="text-slate-700 dark:text-slate-300">Nearly the end. {c.continueRequests ?? 0} of {c.memberCount} want to keep going.</p>
                  <div className="mt-2 flex gap-2">
                    {!c.members.find((m) => m.isYou)?.continueRequested && <button type="button" disabled={busy} onClick={() => act(() => wellnessApi.continueCircle(c.id), 'Noted')} className="btn-secondary text-xs">I would keep going</button>}
                    {c.isFacilitator && <button type="button" disabled={busy} onClick={() => act(() => wellnessApi.updateCircle(c.id, { extendWeeks: 8 }), 'Extended by eight weeks')} className="btn-primary text-xs">Extend eight weeks</button>}
                  </div>
                </div>
              )}
            </Panel>
            <Panel title="Strategies for this topic" intro="Evidence-based, and each one from the place that teaches it.">
              <ul className="space-y-3">{c.strategies.map((s) => <li key={s.key}><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{s.name} <span className="font-normal text-slate-500">· {s.minutes} min</span></p><ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-slate-600 dark:text-slate-400">{s.how.map((h) => <li key={h}>{h}</li>)}</ol><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-slate-500 underline-offset-2 hover:underline">{s.source}</a></li>)}</ul>
            </Panel>
          </div>

          {c.isMember && (
            <Panel title="Who is here" intro="Names are shown to members only.">
              <ul className="flex flex-wrap gap-2">{c.members.map((m) => <li key={m.id ?? m.name} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">{m.name}{m.role === 'FACILITATOR' ? ' · facilitator' : ''}</li>)}</ul>
              {c.isFacilitator && (
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="flex flex-wrap gap-2">
                    {c.status !== 'COMPLETED' && <button type="button" disabled={busy} onClick={() => act(() => wellnessApi.updateCircle(c.id, { status: 'COMPLETED' }), 'Circle closed')} className="btn-ghost text-xs">Close the circle</button>}
                    <button type="button" disabled={busy} onClick={() => setLinkEdit((v) => (v === null ? c.meetingLink ?? '' : null))} className="btn-ghost text-xs">{linkEdit === null ? 'Change the meeting link' : 'Never mind'}</button>
                  </div>
                  {linkEdit !== null && (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <div className="min-w-[16rem] flex-1"><Field label="Meeting link" hint="Members see it; nobody else does. Leave it empty to remove it."><input value={linkEdit} onChange={(e) => setLinkEdit(e.target.value)} className={inputClass} placeholder="https://meet…" /></Field></div>
                      <button type="button" disabled={busy} onClick={() => act(() => wellnessApi.updateCircle(c.id, { meetingLink: linkEdit.trim() || null }), 'Saved').then(() => setLinkEdit(null))} className="btn-primary mb-1 text-xs">Save</button>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
