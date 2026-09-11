'use client';

/**
 * Appointments: what is coming, what happened, and after a visit the
 * follow-up: how it went, a rating that only a real visit can leave, a
 * note of what was said, a symptom to keep an eye on, and the next one
 * booked with the same practitioner.
 */

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { CalendarCheck, Link2, Star } from 'lucide-react';
import { wellnessApi, wellnessError } from '@/lib/wellness-api';
import { Chip, Empty, ErrorBox, HealthDisclaimer, Loading, PageTitle, Scale, WellnessNav, fmtWhen, useLoad } from '@/components/wellness/WellnessUi';
import { Field, inputClass } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Booking = { id: string; scheduledAt: string; durationMinutes: number; mode: string; status: string; reason: string | null; practitionerNote: string | null; meetingLink: string | null; followUpOfId: string | null; practitioner: { id: string; slug: string; name: string; kind: string; headline: string }; review: { rating: number; comment: string | null } | null; canCancel: boolean; share: { token: string; expiresAt: string; revokedAt: string | null; openedCount: number } | null; noteCount: number };
type Data = { upcoming: Booking[]; past: Booking[] };
const STATUS: Record<string, { label: string; tone: 'sky' | 'emerald' | 'slate' | 'rose' | 'amber' }> = { REQUESTED: { label: 'Requested', tone: 'sky' }, CONFIRMED: { label: 'Confirmed', tone: 'emerald' }, DECLINED: { label: 'Declined', tone: 'rose' }, CANCELLED: { label: 'Cancelled', tone: 'slate' }, COMPLETED: { label: 'Done', tone: 'emerald' }, NO_SHOW: { label: 'Missed', tone: 'amber' } };

function Bookings() {
  const search = useSearchParams();
  const highlight = search.get('visit');
  const data = useLoad<Data>(() => wellnessApi.bookings());
  const [rating, setRating] = useState<Record<string, number>>({});
  const [comment, setComment] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [symptom, setSymptom] = useState<Record<string, { name: string; severity: number | null }>>({});

  const act = async (fn: () => Promise<unknown>, done: string) => { try { await fn(); toast.success(done); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That did not work.')); } };
  const cancel = (b: Booking) => { if (window.confirm('Cancel this appointment?')) act(() => wellnessApi.cancelBooking(b.id), 'Cancelled'); };
  const review = (b: Booking) => act(() => wellnessApi.reviewBooking(b.id, { rating: rating[b.id], comment: comment[b.id] || undefined }), 'Thank you. That helps the next woman looking.');
  const saveNote = (b: Booking) => act(async () => { await wellnessApi.addNote({ title: `${b.practitioner.name}, ${new Date(b.scheduledAt).toLocaleDateString('en-AU')}`, body: note[b.id], bookingId: b.id }); setNote((n) => ({ ...n, [b.id]: '' })); }, 'Note kept');
  const logSymptom = (b: Booking) => { const s = symptom[b.id]; if (!s?.name || !s.severity) return; act(async () => { await wellnessApi.addEntry({ kind: 'SYMPTOM', payload: { name: s.name, severity: s.severity, bookingId: b.id } }); setSymptom((x) => ({ ...x, [b.id]: { name: '', severity: null } })); }, 'Logged'); };

  const Card = ({ b }: { b: Booking }) => (
    <li id={b.id} className={cn('rounded-2xl border bg-white p-4 dark:bg-slate-900', highlight === b.id ? 'border-rose-300 dark:border-rose-700' : 'border-slate-200 dark:border-slate-800')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><Link href={`/dashboard/wellness/practitioners/${b.practitioner.slug}`} className="font-semibold text-slate-900 hover:text-rose-600 dark:text-white">{b.practitioner.name}</Link><p className="text-sm text-slate-600 dark:text-slate-400">{fmtWhen(b.scheduledAt)} · {b.durationMinutes} min · {b.mode === 'TELEHEALTH' ? 'telehealth' : 'in person'}{b.followUpOfId ? ' · follow-up' : ''}</p></div>
        <Chip tone={STATUS[b.status]?.tone ?? 'slate'}>{STATUS[b.status]?.label ?? b.status}</Chip>
      </div>
      {b.reason && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300"><span className="text-slate-500">About:</span> {b.reason}</p>}
      {b.practitionerNote && <p className="mt-1 text-sm text-slate-700 dark:text-slate-300"><span className="text-slate-500">From the practitioner:</span> {b.practitionerNote}</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {b.status === 'CONFIRMED' && b.meetingLink && <a href={b.meetingLink} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">Join the call</a>}
        {b.canCancel && <button type="button" onClick={() => cancel(b)} className="btn-ghost text-sm">Cancel</button>}
        {b.share && !b.share.revokedAt && <span className="inline-flex items-center gap-1 self-center text-xs text-slate-500"><Link2 className="h-3.5 w-3.5" /> Summary shared · opened {b.share.openedCount}×</span>}
        {b.noteCount > 0 && <Link href="/dashboard/wellness/medications" className="self-center text-xs text-slate-500 underline">{b.noteCount} note{b.noteCount === 1 ? '' : 's'}</Link>}
      </div>
      {b.status === 'COMPLETED' && (
        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 dark:border-slate-800 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How did it go?</p>
            {b.review ? <p className="mt-1 inline-flex items-center gap-1 text-sm text-amber-600">{Array.from({ length: b.review.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}<span className="ml-1 text-xs text-slate-500">rated</span></p> : (
              <div className="mt-1 space-y-2"><Scale label="Rating" value={rating[b.id] ?? null} onChange={(v) => setRating((r) => ({ ...r, [b.id]: v }))} /><input value={comment[b.id] ?? ''} onChange={(e) => setComment((c) => ({ ...c, [b.id]: e.target.value }))} maxLength={1000} className={inputClass} placeholder="What the next woman should know" /><button type="button" onClick={() => review(b)} disabled={!rating[b.id]} className="btn-secondary text-xs disabled:opacity-50">Rate the visit</button></div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What was said</p>
            <textarea value={note[b.id] ?? ''} onChange={(e) => setNote((n) => ({ ...n, [b.id]: e.target.value }))} rows={3} maxLength={5000} className={`${inputClass} mt-1`} placeholder="The plan, the next test, the thing to watch." />
            <button type="button" onClick={() => saveNote(b)} disabled={!note[b.id]?.trim()} className="btn-secondary mt-1 text-xs disabled:opacity-50">Keep a note</button>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Something to watch</p>
            <div className="mt-1 space-y-2"><input value={symptom[b.id]?.name ?? ''} onChange={(e) => setSymptom((s) => ({ ...s, [b.id]: { name: e.target.value, severity: s[b.id]?.severity ?? null } }))} maxLength={60} className={inputClass} placeholder="Headaches after the new dose" /><Scale label="How bad" words="severity" value={symptom[b.id]?.severity ?? null} onChange={(v) => setSymptom((s) => ({ ...s, [b.id]: { name: s[b.id]?.name ?? '', severity: v } }))} /><button type="button" onClick={() => logSymptom(b)} className="btn-secondary text-xs">Log symptom</button></div>
            <FollowUp b={b} onDone={data.reload} />
          </div>
        </div>
      )}
    </li>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageTitle icon={CalendarCheck} kicker="Wellness" title="Appointments" blurb="What is coming, what happened, and the follow-up after each visit." action={<Link href="/dashboard/wellness/practitioners" className="btn-primary text-sm">Find care</Link>} />
      <WellnessNav current="/dashboard/wellness/bookings" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {data.data && (
        <>
          <section><h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Coming up</h2>{data.data.upcoming.length ? <ul className="space-y-3">{data.data.upcoming.map((b) => <Card key={b.id} b={b} />)}</ul> : <Empty title="Nothing booked" body="Find a GP, psychologist or specialist and request a time." action={<Link href="/dashboard/wellness/practitioners" className="btn-primary text-sm">Find care</Link>} />}</section>
          {data.data.past.length > 0 && <section><h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Past</h2><ul className="space-y-3">{data.data.past.map((b) => <Card key={b.id} b={b} />)}</ul></section>}
        </>
      )}
      <HealthDisclaimer />
    </div>
  );
}

function FollowUp({ b, onDone }: { b: Booking; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const days = useLoad<{ nextAvailable: Array<{ day: string; slots: number }>; acceptsBookings: boolean }>(() => (open ? wellnessApi.practitioner(b.practitioner.slug) : Promise.resolve({ data: { data: null } } as never)), [open]);
  const slots = useLoad<{ slots: Array<{ start: string; label: string }> }>(() => (day ? wellnessApi.slots(b.practitioner.id, day) : Promise.resolve({ data: { data: null } } as never)), [day]);
  const pick = async (start: string) => { try { await wellnessApi.followUp(b.id, { scheduledAt: start }); toast.success('Follow-up requested'); setOpen(false); onDone(); } catch (err) { toast.error(wellnessError(err, 'That could not be booked.')); } };
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-3 text-xs font-medium text-rose-600">Book a follow-up with {b.practitioner.name}</button>;
  if (days.data && !days.data.acceptsBookings) return <p className="mt-3 text-xs text-slate-500">This practitioner takes bookings on their own site.</p>;
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-1">{(days.data?.nextAvailable ?? []).map((d) => <button key={d.day} type="button" onClick={() => setDay(d.day)} className={cn('rounded-md px-2 py-1 text-[11px] font-medium', day === d.day ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-800')}>{d.day.slice(5)}</button>)}</div>
      {day && <div className="flex flex-wrap gap-1">{(slots.data?.slots ?? []).map((s) => <button key={s.start} type="button" onClick={() => pick(s.start)} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium hover:bg-rose-100 dark:bg-slate-800">{s.label}</button>)}</div>}
      <Field label=""><button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 underline">Never mind</button></Field>
    </div>
  );
}

export default function BookingsPage() {
  return <Suspense fallback={<div className="p-6"><Loading /></div>}><Bookings /></Suspense>;
}
