'use client';

/**
 * The practice page: a practitioner's own profile in the directory, her
 * weekly hours, and the requests that have come in. A new profile waits
 * for verification (an AHPRA number helps) before members can find it.
 */

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Stethoscope, Save } from 'lucide-react';
import { wellnessApi, wellnessError } from '@/lib/wellness-api';
import { Chip, ErrorBox, Loading, PageTitle, WellnessNav, fmtWhen, useLoad } from '@/components/wellness/WellnessUi';
import { Check, Field, NumberInput, Panel, SelectInput, inputClass, num } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Profile = { id: string; slug: string; name: string; kind: string; headline: string; bio: string; qualifications: string[]; modalities: string[]; specialties: string[]; languages: string[]; suburb: string | null; city: string | null; state: string | null; telehealth: boolean; inPerson: boolean; bulkBilling: boolean; medicareRebate: boolean; privateHealth: boolean; feeFrom: number | null; feeNote: string | null; ahpraNumber: string | null; website: string | null; phone: string | null; bookingUrl: string | null; availability: Record<string, Array<[string, string]>> | null; slotMinutes: number; acceptsBookings: boolean; isVerified: boolean };
type Data = { profile: Profile | null; counts: Record<string, number>; kinds: Array<{ key: string; label: string }>; modalities: string[]; specialties: string[] };
type Booking = { id: string; scheduledAt: string; durationMinutes: number; mode: string; status: string; reason: string | null; practitionerNote: string | null; meetingLink: string | null; member: { name: string; email: string } };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EMPTY = { name: '', kind: 'PSYCHOLOGIST', headline: '', bio: '', qualifications: '', modalities: [] as string[], specialties: [] as string[], languages: 'English', suburb: '', city: '', state: 'QLD', telehealth: true, inPerson: false, bulkBilling: false, medicareRebate: false, privateHealth: false, feeFrom: '', feeNote: '', ahpraNumber: '', website: '', phone: '', bookingUrl: '', slotMinutes: '50', acceptsBookings: true, availability: { '1': [['09:00', '17:00']], '2': [['09:00', '17:00']], '3': [['09:00', '17:00']], '4': [['09:00', '17:00']], '5': [['09:00', '17:00']] } as Record<string, Array<[string, string]>> };

export default function PracticePage() {
  const data = useLoad<Data>(() => wellnessApi.practice());
  const bookings = useLoad<Booking[]>(() => (data.data?.profile ? wellnessApi.practiceBookings() : Promise.resolve({ data: { data: [] } } as never)), [data.data?.profile?.id]);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const p = data.data?.profile;

  useEffect(() => {
    if (!p) return;
    setF({ name: p.name, kind: p.kind, headline: p.headline, bio: p.bio, qualifications: p.qualifications.join(', '), modalities: p.modalities, specialties: p.specialties, languages: p.languages.join(', '), suburb: p.suburb ?? '', city: p.city ?? '', state: p.state ?? 'QLD', telehealth: p.telehealth, inPerson: p.inPerson, bulkBilling: p.bulkBilling, medicareRebate: p.medicareRebate, privateHealth: p.privateHealth, feeFrom: p.feeFrom !== null ? String(p.feeFrom) : '', feeNote: p.feeNote ?? '', ahpraNumber: p.ahpraNumber ?? '', website: p.website ?? '', phone: p.phone ?? '', bookingUrl: p.bookingUrl ?? '', slotMinutes: String(p.slotMinutes), acceptsBookings: p.acceptsBookings, availability: p.availability ?? EMPTY.availability });
  }, [p]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await wellnessApi.savePractice({ ...f, qualifications: f.qualifications.split(',').map((s) => s.trim()).filter(Boolean), languages: f.languages.split(',').map((s) => s.trim()).filter(Boolean), suburb: f.suburb || null, city: f.city || null, state: f.state || null, feeFrom: f.feeFrom ? num(f.feeFrom) : null, feeNote: f.feeNote || null, ahpraNumber: f.ahpraNumber || null, website: f.website || null, phone: f.phone || null, bookingUrl: f.bookingUrl || null, slotMinutes: num(f.slotMinutes, 50) });
      toast.success(res.data?.data?.pendingVerification ? 'Saved. Your profile will show once it is verified.' : 'Saved');
      data.reload();
    } catch (err) { toast.error(wellnessError(err, 'That could not be saved.')); } finally { setBusy(false); }
  };
  const toggle = (k: 'modalities' | 'specialties', v: string) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((s) => s !== v) : [...x[k], v] }));
  const setHours = (day: string, on: boolean) => setF((x) => { const a = { ...x.availability }; if (on) a[day] = a[day]?.length ? a[day] : [['09:00', '17:00']]; else delete a[day]; return { ...x, availability: a }; });
  const setRange = (day: string, i: number, which: 0 | 1, v: string) => setF((x) => { const a = { ...x.availability }; a[day] = a[day].map((r, j) => (j === i ? ((which === 0 ? [v, r[1]] : [r[0], v]) as [string, string]) : r)); return { ...x, availability: a }; });
  const update = (b: Booking, patch: Record<string, unknown>, done: string) => wellnessApi.updatePracticeBooking(b.id, patch).then(() => { toast.success(done); bookings.reload(); }).catch((err) => toast.error(wellnessError(err, 'That did not work.')));

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageTitle icon={Stethoscope} kicker="Wellness" title="Your practice" blurb="Your entry in the directory, your hours, and the requests that come in. Members see it once it is verified." action={p ? <Chip tone={p.isVerified ? 'emerald' : 'amber'}>{p.isVerified ? 'Verified and listed' : 'Awaiting verification'}</Chip> : undefined} />
      <WellnessNav current="/dashboard/wellness/practitioners" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {data.data && (
        <>
          {p && (
            <Panel title="Requests and appointments" intro={Object.entries(data.data.counts).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ') || 'None yet.'}>
              {bookings.loading && <Loading />}
              <ul className="space-y-2">
                {(bookings.data ?? []).map((b) => (
                  <li key={b.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{b.member.name} <span className="font-normal text-slate-500">· {b.member.email}</span></p><p className="text-xs text-slate-500">{fmtWhen(b.scheduledAt)} · {b.mode === 'TELEHEALTH' ? 'telehealth' : 'in person'} · {b.status.toLowerCase()}</p></div>
                      <div className="flex flex-wrap gap-1">
                        {b.status === 'REQUESTED' && <><button type="button" onClick={() => { const link = b.mode === 'TELEHEALTH' ? window.prompt('Meeting link for the member (optional)', b.meetingLink ?? '') : null; update(b, { status: 'CONFIRMED', ...(link ? { meetingLink: link } : {}) }, 'Confirmed'); }} className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">Confirm</button><button type="button" onClick={() => update(b, { status: 'DECLINED' }, 'Declined')} className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">Decline</button></>}
                        {b.status === 'CONFIRMED' && <><button type="button" onClick={() => update(b, { status: 'COMPLETED' }, 'Marked done')} className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white">Done</button><button type="button" onClick={() => update(b, { status: 'NO_SHOW' }, 'Marked missed')} className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">No show</button></>}
                        {['CONFIRMED', 'COMPLETED'].includes(b.status) && <button type="button" onClick={() => { const n = window.prompt('A note for the member', b.practitionerNote ?? ''); if (n !== null) update(b, { practitionerNote: n || null }, 'Note saved'); }} className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">Note</button>}
                      </div></div>
                    {b.reason && <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{b.reason}</p>}
                  </li>
                ))}
                {bookings.data && bookings.data.length === 0 && <li className="text-sm text-slate-500">No requests yet.</li>}
              </ul>
            </Panel>
          )}
          <Panel title={p ? 'Your profile' : 'Create your profile'} intro="What members see. Be specific about who you work with; that is what they filter on.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><input value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} className={inputClass} /></Field>
              <Field label="You are a"><SelectInput value={f.kind} onChange={(v) => setF((x) => ({ ...x, kind: v }))} options={data.data.kinds.map((k) => ({ value: k.key, label: k.label }))} /></Field>
              <Field label="One line" className="sm:col-span-2"><input value={f.headline} onChange={(e) => setF((x) => ({ ...x, headline: e.target.value }))} maxLength={140} className={inputClass} placeholder="Perinatal psychologist, telehealth across Queensland" /></Field>
              <Field label="About" className="sm:col-span-2"><textarea value={f.bio} onChange={(e) => setF((x) => ({ ...x, bio: e.target.value }))} rows={5} maxLength={3000} className={inputClass} /></Field>
              <Field label="Qualifications" hint="Comma separated."><input value={f.qualifications} onChange={(e) => setF((x) => ({ ...x, qualifications: e.target.value }))} className={inputClass} /></Field>
              <Field label="AHPRA number" hint="Speeds up verification."><input value={f.ahpraNumber} onChange={(e) => setF((x) => ({ ...x, ahpraNumber: e.target.value }))} maxLength={20} className={inputClass} /></Field>
              <Field label="Languages" hint="Comma separated."><input value={f.languages} onChange={(e) => setF((x) => ({ ...x, languages: e.target.value }))} className={inputClass} /></Field>
              <Field label="Phone"><input value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value }))} className={inputClass} /></Field>
              <Field label="Website"><input value={f.website} onChange={(e) => setF((x) => ({ ...x, website: e.target.value }))} className={inputClass} placeholder="https://" /></Field>
              <Field label="External booking page" hint="If you would rather take bookings there."><input value={f.bookingUrl} onChange={(e) => setF((x) => ({ ...x, bookingUrl: e.target.value }))} className={inputClass} placeholder="https://" /></Field>
              <Field label="Suburb"><input value={f.suburb} onChange={(e) => setF((x) => ({ ...x, suburb: e.target.value }))} className={inputClass} /></Field>
              <Field label="City"><input value={f.city} onChange={(e) => setF((x) => ({ ...x, city: e.target.value }))} className={inputClass} /></Field>
              <Field label="State"><SelectInput value={f.state} onChange={(v) => setF((x) => ({ ...x, state: v }))} options={['QLD', 'NSW', 'VIC', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => ({ value: s, label: s }))} /></Field>
              <Field label="Fee from" hint="Leave blank to say “ask”."><NumberInput value={f.feeFrom} onChange={(v) => setF((x) => ({ ...x, feeFrom: v }))} prefix="$" /></Field>
              <Field label="Fee note" className="sm:col-span-2"><input value={f.feeNote} onChange={(e) => setF((x) => ({ ...x, feeNote: e.target.value }))} maxLength={160} className={inputClass} placeholder="Medicare rebate with a mental health plan; $80 gap" /></Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-4"><Check checked={f.telehealth} onChange={(v) => setF((x) => ({ ...x, telehealth: v }))} label="Telehealth" /><Check checked={f.inPerson} onChange={(v) => setF((x) => ({ ...x, inPerson: v }))} label="In person" /><Check checked={f.bulkBilling} onChange={(v) => setF((x) => ({ ...x, bulkBilling: v }))} label="Bulk billing" /><Check checked={f.medicareRebate} onChange={(v) => setF((x) => ({ ...x, medicareRebate: v }))} label="Medicare rebate" /><Check checked={f.privateHealth} onChange={(v) => setF((x) => ({ ...x, privateHealth: v }))} label="Private health" /></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><span className="text-xs font-medium uppercase tracking-wide text-slate-500">Specialties</span><div className="mt-1.5 flex flex-wrap gap-1.5">{data.data.specialties.map((s) => <button key={s} type="button" onClick={() => toggle('specialties', s)} className={cn('rounded-full px-2.5 py-1 text-xs font-medium', f.specialties.includes(s) ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{s}</button>)}</div></div>
              <div><span className="text-xs font-medium uppercase tracking-wide text-slate-500">Approach</span><div className="mt-1.5 flex flex-wrap gap-1.5">{data.data.modalities.map((s) => <button key={s} type="button" onClick={() => toggle('modalities', s)} className={cn('rounded-full px-2.5 py-1 text-xs font-medium', f.modalities.includes(s) ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{s}</button>)}</div></div>
            </div>
          </Panel>
          <Panel title="Hours and bookings" intro="Members book inside these hours, in your timezone (from your account settings). Requests come to you to confirm.">
            <div className="flex flex-wrap items-center gap-4"><Check checked={f.acceptsBookings} onChange={(v) => setF((x) => ({ ...x, acceptsBookings: v }))} label="Take bookings here" /><div className="w-40"><Field label="Appointment length"><NumberInput value={f.slotMinutes} onChange={(v) => setF((x) => ({ ...x, slotMinutes: v }))} suffix="min" min={10} max={180} /></Field></div></div>
            <ul className="mt-4 space-y-2">{DAYS.map((d, i) => { const key = String(i); const on = Boolean(f.availability[key]); return <li key={key} className="flex flex-wrap items-center gap-3 text-sm"><label className="flex w-16 items-center gap-2"><input type="checkbox" checked={on} onChange={(e) => setHours(key, e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-rose-500" /> {d}</label>{on && f.availability[key].map((r, j) => <span key={j} className="flex items-center gap-1"><input type="time" value={r[0]} onChange={(e) => setRange(key, j, 0, e.target.value)} className={inputClass} /><span className="text-slate-400">to</span><input type="time" value={r[1]} onChange={(e) => setRange(key, j, 1, e.target.value)} className={inputClass} /></span>)}</li>; })}</ul>
          </Panel>
          <button type="button" onClick={save} disabled={busy || f.name.trim().length < 2 || f.headline.trim().length < 5 || f.bio.trim().length < 20} className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50"><Save className="h-4 w-4" /> {p ? 'Save changes' : 'Create profile'}</button>
        </>
      )}
    </div>
  );
}
