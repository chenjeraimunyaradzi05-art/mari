'use client';

/**
 * Medications and supplements: what she takes and when, today's doses
 * ticked off, how the last month went, the refill that is coming, and
 * the notes she keeps for a visit. Names and doses are encrypted; the
 * reminder that arrives says only that a dose is due.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Pill, Plus, RefreshCw, StickyNote, Trash2 } from 'lucide-react';
import { wellnessApi, wellnessError } from '@/lib/wellness-api';
import { Empty, ErrorBox, HealthDisclaimer, Loading, PageTitle, Ring, WellnessNav, fmtDay, useLoad } from '@/components/wellness/WellnessUi';
import { Field, NumberInput, Panel, Stat, inputClass, num } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Med = { id: string; details: { name?: string; dose?: string; instructions?: string; prescribedBy?: string; pharmacy?: string; notes?: string }; times: string[]; daysOfWeek: number[]; startDate: string; endDate: string | null; repeatsLeft: number | null; nextRefillDue: string | null; isActive: boolean; today: Array<{ time: string; status: string | null }>; refillSoon: boolean };
type Data = { today: string; medications: Med[]; adherence: { days: number; perMedication: Array<{ id: string; name?: string; expected: number; taken: number; skipped: number; pct: number | null }>; overallPct: number | null } };
type Note = { id: string; title: string; body: string; bookingId: string | null; updatedAt: string };

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const EMPTY = { name: '', dose: '', instructions: '', prescribedBy: '', pharmacy: '', times: ['08:00'], daysOfWeek: [] as number[], repeatsLeft: '', nextRefillDue: '', endDate: '' };

export default function MedicationsPage() {
  const data = useLoad<Data>(() => wellnessApi.medications());
  const notes = useLoad<Note[]>(() => wellnessApi.notes());
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ title: '', body: '' });
  const meds = data.data?.medications ?? [];

  const add = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await wellnessApi.addMedication({ name: form.name.trim(), dose: form.dose || undefined, instructions: form.instructions || undefined, prescribedBy: form.prescribedBy || undefined, pharmacy: form.pharmacy || undefined, times: form.times.filter(Boolean), daysOfWeek: form.daysOfWeek, repeatsLeft: form.repeatsLeft === '' ? undefined : num(form.repeatsLeft), nextRefillDue: form.nextRefillDue || undefined, endDate: form.endDate || undefined });
      toast.success('Added');
      setForm(EMPTY); setShowForm(false); data.reload();
    } catch (err) { toast.error(wellnessError(err, 'That could not be added.')); } finally { setBusy(false); }
  };
  const dose = async (id: string, time: string, status: 'taken' | 'skipped') => { try { await wellnessApi.logDose(id, { time, status }); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be logged.')); } };
  const stop = async (m: Med) => { try { await wellnessApi.updateMedication(m.id, { isActive: !m.isActive }); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be changed.')); } };
  const remove = async (m: Med) => { if (!window.confirm('Remove this medication and its dose history?')) return; try { await wellnessApi.deleteMedication(m.id); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be removed.')); } };
  const refilled = async (m: Med) => { const next = window.prompt('Next refill due (YYYY-MM-DD), or leave blank', ''); try { await wellnessApi.updateMedication(m.id, { nextRefillDue: next || null, repeatsLeft: m.repeatsLeft !== null ? Math.max(0, m.repeatsLeft - 1) : undefined }); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be updated.')); } };
  const addNote = async () => { if (!note.title.trim()) return; try { await wellnessApi.addNote({ title: note.title.trim(), body: note.body }); setNote({ title: '', body: '' }); notes.reload(); } catch (err) { toast.error(wellnessError(err, 'The note could not be saved.')); } };
  const removeNote = async (id: string) => { try { await wellnessApi.deleteNote(id); notes.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be removed.')); } };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={Pill} kicker="Wellness" title="Medications" blurb="Doses, reminders, refills, and how the month went. Names and doses are encrypted; the reminder never says which." action={<button type="button" onClick={() => setShowForm((v) => !v)} className="btn-primary inline-flex items-center gap-2 text-sm"><Plus className="h-4 w-4" /> Add a medication</button>} />
      <WellnessNav current="/dashboard/wellness/medications" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />

      {showForm && (
        <Panel title="A medication or supplement" intro="Times of day drive the reminders; leave the days empty for every day.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name"><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={80} className={inputClass} placeholder="Sertraline, iron, the pill" /></Field>
            <Field label="Dose"><input value={form.dose} onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))} maxLength={60} className={inputClass} placeholder="50 mg" /></Field>
            <Field label="Prescribed by"><input value={form.prescribedBy} onChange={(e) => setForm((f) => ({ ...f, prescribedBy: e.target.value }))} maxLength={80} className={inputClass} placeholder="Dr Nguyen" /></Field>
            <Field label="Instructions" className="sm:col-span-2"><input value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} maxLength={200} className={inputClass} placeholder="With food" /></Field>
            <Field label="Pharmacy"><input value={form.pharmacy} onChange={(e) => setForm((f) => ({ ...f, pharmacy: e.target.value }))} maxLength={80} className={inputClass} /></Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Times</span>
              <div className="mt-1.5 space-y-1.5">{form.times.map((t, i) => <div key={i} className="flex gap-1.5"><input type="time" value={t} onChange={(e) => setForm((f) => ({ ...f, times: f.times.map((x, j) => (j === i ? e.target.value : x)) }))} className={inputClass} />{form.times.length > 1 && <button type="button" onClick={() => setForm((f) => ({ ...f, times: f.times.filter((_, j) => j !== i) }))} className="text-slate-400" aria-label="Remove time"><Trash2 className="h-4 w-4" /></button>}</div>)}{form.times.length < 6 && <button type="button" onClick={() => setForm((f) => ({ ...f, times: [...f.times, '20:00'] }))} className="text-xs font-medium text-rose-600">+ Another time</button>}</div>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Days</span>
              <div className="mt-1.5 flex flex-wrap gap-1">{DAYS.map((d, i) => <button key={d} type="button" onClick={() => setForm((f) => ({ ...f, daysOfWeek: f.daysOfWeek.includes(i) ? f.daysOfWeek.filter((x) => x !== i) : [...f.daysOfWeek, i] }))} className={cn('rounded-md px-2 py-1 text-xs font-semibold', form.daysOfWeek.includes(i) ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{d}</button>)}</div>
              <p className="mt-1 text-xs text-slate-500">{form.daysOfWeek.length === 0 ? 'Every day' : `${form.daysOfWeek.length} days a week`}</p>
            </div>
            <div className="space-y-3">
              <Field label="Repeats left"><NumberInput value={form.repeatsLeft} onChange={(v) => setForm((f) => ({ ...f, repeatsLeft: v }))} min={0} max={99} /></Field>
              <Field label="Next refill due"><input type="date" value={form.nextRefillDue} onChange={(e) => setForm((f) => ({ ...f, nextRefillDue: e.target.value }))} className={inputClass} /></Field>
              <Field label="Stop on" hint="Leave blank if ongoing."><input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className={inputClass} /></Field>
            </div>
          </div>
          <div className="mt-4 flex gap-2"><button type="button" onClick={add} disabled={busy || !form.name.trim()} className="btn-primary text-sm disabled:opacity-50">Save</button><button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-sm">Cancel</button></div>
        </Panel>
      )}

      {data.data && (
        <>
          {meds.filter((m) => m.isActive).length === 0 && !showForm && <Empty title="Nothing set up" body="Add what you take and the reminders, the refill nudge and the adherence report follow." action={<button type="button" onClick={() => setShowForm(true)} className="btn-primary text-sm">Add a medication</button>} />}
          {meds.filter((m) => m.isActive).map((m) => {
            const a = data.data!.adherence.perMedication.find((x) => x.id === m.id);
            return (
              <Panel key={m.id} title={`${m.details.name ?? 'Medication'}${m.details.dose ? `, ${m.details.dose}` : ''}`} intro={[m.details.instructions, m.details.prescribedBy ? `Prescribed by ${m.details.prescribedBy}` : '', m.daysOfWeek.length ? m.daysOfWeek.map((d) => DAYS[d]).join(' ') : 'Every day', m.endDate ? `until ${fmtDay(m.endDate)}` : ''].filter(Boolean).join(' · ')} aside={<div className="flex gap-2"><button type="button" onClick={() => stop(m)} className="btn-ghost text-xs">Pause</button><button type="button" onClick={() => remove(m)} className="btn-ghost text-xs text-slate-500" aria-label="Remove"><Trash2 className="h-4 w-4" /></button></div>}>
                <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Today</p>
                    <ul className="mt-2 space-y-1.5">
                      {m.today.map((t) => <li key={t.time} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60"><span className="font-medium text-slate-800 dark:text-slate-200">{t.time}</span>{t.status ? <span className={cn('text-xs font-semibold', t.status === 'taken' ? 'text-emerald-600' : 'text-amber-600')}>{t.status}</span> : <div className="flex gap-1"><button type="button" onClick={() => dose(m.id, t.time, 'taken')} className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">Taken</button><button type="button" onClick={() => dose(m.id, t.time, 'skipped')} className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">Skipped</button></div>}</li>)}
                      {m.today.length === 0 && <li className="text-sm text-slate-500">No times set; nothing to tick.</li>}
                    </ul>
                    {(m.refillSoon || m.nextRefillDue) && <div className={cn('mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm', m.refillSoon ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-slate-800/60')}><span className="text-slate-800 dark:text-slate-200">{m.nextRefillDue ? `Refill due ${fmtDay(m.nextRefillDue)}` : ''}{m.repeatsLeft !== null ? `${m.nextRefillDue ? ' · ' : ''}${m.repeatsLeft} repeat${m.repeatsLeft === 1 ? '' : 's'} left` : ''}{m.refillSoon && m.repeatsLeft !== null && m.repeatsLeft <= 1 ? ' · book the GP before it runs out' : ''}</span><button type="button" onClick={() => refilled(m)} className="btn-ghost inline-flex items-center gap-1 text-xs"><RefreshCw className="h-3.5 w-3.5" /> Refilled</button></div>}
                  </div>
                  <div><Ring pct={a?.pct ?? 0} label={`${a?.pct ?? 0}% taken`} sub={a ? `${a.taken} of ${a.expected} doses in ${data.data!.adherence.days} days${a.skipped ? `, ${a.skipped} skipped` : ''}` : 'No doses logged yet'} tone={(a?.pct ?? 0) >= 80 ? 'emerald' : 'amber'} /></div>
                </div>
              </Panel>
            );
          })}
          {meds.filter((m) => !m.isActive).length > 0 && <div className="text-sm text-slate-500">Paused: {meds.filter((m) => !m.isActive).map((m) => <button key={m.id} type="button" onClick={() => stop(m)} className="mr-2 underline">{m.details.name}</button>)}</div>}
          {data.data.adherence.overallPct !== null && <Stat label="All medications, last 30 days" value={`${data.data.adherence.overallPct}% of doses taken`} tone={data.data.adherence.overallPct >= 80 ? 'good' : 'warn'} />}
        </>
      )}

      <Panel icon={StickyNote} title="Health notes" intro="What the doctor said, a question to ask next time, what changed. Encrypted, and yours.">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <Field label="Title"><input value={note.title} onChange={(e) => setNote((n) => ({ ...n, title: e.target.value }))} maxLength={120} className={inputClass} placeholder="Questions for Thursday" /></Field>
          <Field label="Note"><input value={note.body} onChange={(e) => setNote((n) => ({ ...n, body: e.target.value }))} maxLength={5000} className={inputClass} placeholder="Ask about the iron result" /></Field>
          <button type="button" onClick={addNote} disabled={!note.title.trim()} className="btn-primary mb-1 text-sm disabled:opacity-50">Save note</button>
        </div>
        <ul className="mt-4 space-y-2">
          {(notes.data ?? []).map((n) => <li key={n.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60"><div><p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</p>{n.body && <p className="text-sm text-slate-600 dark:text-slate-400">{n.body}</p>}<p className="text-[11px] text-slate-500">{new Date(n.updatedAt).toLocaleDateString('en-AU')}{n.bookingId ? ' · attached to a visit' : ''}</p></div><button type="button" onClick={() => removeNote(n.id)} className="text-slate-400 hover:text-rose-500" aria-label="Remove note"><Trash2 className="h-4 w-4" /></button></li>)}
        </ul>
      </Panel>
      <HealthDisclaimer />
    </div>
  );
}
