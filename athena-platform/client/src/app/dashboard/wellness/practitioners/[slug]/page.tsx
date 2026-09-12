'use client';

/**
 * A practitioner: who she is, what she offers, the ratings from real
 * visits, and the booking. Pick a day that has a slot, pick the slot, say
 * why, and choose what to share ahead of the visit.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { CalendarCheck, Globe, Phone, Star, Stethoscope, Video } from 'lucide-react';
import { wellnessApi, wellnessError } from '@/lib/wellness-api';
import { Chip, ErrorBox, HealthDisclaimer, Loading, PageTitle, WellnessNav, fmtDay, useLoad } from '@/components/wellness/WellnessUi';
import { Check, Field, Panel, SelectInput, inputClass } from '@/components/strategy/StrategyUi';
import { cn } from '@/lib/utils';

type Practitioner = { id: string; slug: string; name: string; kind: string; kindLabel: string; headline: string; bio: string; qualifications: string[]; modalities: string[]; specialties: string[]; languages: string[]; suburb: string | null; city: string | null; state: string | null; telehealth: boolean; inPerson: boolean; bulkBilling: boolean; medicareRebate: boolean; privateHealth: boolean; feeFrom: number | null; feeNote: string | null; ahpraNumber: string | null; website: string | null; phone: string | null; bookingUrl: string | null; acceptsBookings: boolean; isVerified: boolean; ratingAvg: number; ratingCount: number; slotMinutes: number; isOwner: boolean; canModerate?: boolean; reviews: Array<{ id: string; rating: number; comment: string | null; isHidden?: boolean; createdAt: string; by: string }>; nextAvailable: Array<{ day: string; slots: number }>; timezone: string };
type Slots = { day: string; slots: Array<{ start: string; end: string; label: string }>; timezone: string };
type Reference = { shareScopes: Array<{ key: string; label: string }> };

export default function PractitionerPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const data = useLoad<Practitioner>(() => wellnessApi.practitioner(params.slug), [params.slug]);
  const ref = useLoad<Reference>(() => wellnessApi.reference());
  const [day, setDay] = useState<string | null>(null);
  const slots = useLoad<Slots>(() => (day && data.data ? wellnessApi.slots(data.data.id, day) : Promise.resolve({ data: { data: null } } as never)), [day, data.data?.id]);
  const [slot, setSlot] = useState<string | null>(null);
  const [mode, setMode] = useState('TELEHEALTH');
  const [reason, setReason] = useState('');
  const [share, setShare] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const p = data.data;

  const moderate = async (id: string, isHidden: boolean) => {
    try { await wellnessApi.moderateReview(id, isHidden); toast.success(isHidden ? 'Taken out of the average' : 'Back in the average'); data.reload(); } catch (err) { toast.error(wellnessError(err, 'That could not be changed.')); }
  };

  const book = async () => {
    if (!p || !slot) return;
    setBusy(true);
    try {
      await wellnessApi.book(p.id, { scheduledAt: slot, mode, reason: reason || undefined, shareScope: share.length ? share : undefined });
      toast.success('Requested. You will hear when it is confirmed.');
      router.push('/dashboard/wellness/bookings');
    } catch (err) { toast.error(wellnessError(err, 'That could not be booked.')); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <WellnessNav current="/dashboard/wellness/practitioners" />
      {data.loading && <Loading />}
      <ErrorBox error={data.error} />
      {p && (
        <>
          <PageTitle icon={Stethoscope} kicker={p.kindLabel} title={p.name} blurb={p.headline} action={p.isOwner ? <Link href="/dashboard/wellness/practice" className="btn-secondary text-sm">Edit your profile</Link> : undefined} />
          <div className="flex flex-wrap items-center gap-2">
            {p.telehealth && <Chip tone="sky"><Video className="mr-1 inline h-3 w-3" />Telehealth</Chip>}{p.inPerson && <Chip>In person{p.city ? `, ${[p.suburb, p.city].filter(Boolean).join(' ')}` : ''}</Chip>}{p.bulkBilling && <Chip tone="emerald">Bulk billing</Chip>}{p.medicareRebate && <Chip tone="emerald">Medicare rebate</Chip>}{p.privateHealth && <Chip>Private health</Chip>}{p.isVerified && <Chip tone="amber">Verified</Chip>}
            {p.ratingCount > 0 && <span className="inline-flex items-center gap-1 text-sm text-amber-600"><Star className="h-4 w-4 fill-current" /> {p.ratingAvg} from {p.ratingCount} visit{p.ratingCount === 1 ? '' : 's'}</span>}
          </div>
          <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
            <div className="space-y-4">
              <Panel title="About">
                <p className="whitespace-pre-line text-sm leading-7 text-slate-800 dark:text-slate-200">{p.bio}</p>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  {p.qualifications.length > 0 && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Qualifications</dt><dd className="text-slate-800 dark:text-slate-200">{p.qualifications.join(', ')}</dd></div>}
                  {p.specialties.length > 0 && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Specialties</dt><dd className="text-slate-800 dark:text-slate-200">{p.specialties.join(', ')}</dd></div>}
                  {p.modalities.length > 0 && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Approach</dt><dd className="text-slate-800 dark:text-slate-200">{p.modalities.join(', ')}</dd></div>}
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Languages</dt><dd className="text-slate-800 dark:text-slate-200">{p.languages.join(', ')}</dd></div>
                  <div><dt className="text-xs uppercase tracking-wide text-slate-500">Fees</dt><dd className="text-slate-800 dark:text-slate-200">{p.feeNote || (p.feeFrom !== null ? `From $${p.feeFrom}` : 'Ask when booking')}</dd></div>
                  {p.ahpraNumber && <div><dt className="text-xs uppercase tracking-wide text-slate-500">AHPRA</dt><dd className="text-slate-800 dark:text-slate-200">{p.ahpraNumber}</dd></div>}
                </dl>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">{p.phone && <a href={`tel:${p.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 text-rose-600"><Phone className="h-4 w-4" /> {p.phone}</a>}{p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-rose-600"><Globe className="h-4 w-4" /> Website</a>}{!p.acceptsBookings && p.bookingUrl && <a href={p.bookingUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">Contact or book on their site</a>}</div>
              </Panel>
              {p.reviews.length > 0 && <Panel title="From women who went" intro="Only a completed visit can leave one of these.">
                <ul className="space-y-3">{p.reviews.map((r) => <li key={r.id} className={cn('text-sm', r.isHidden && 'opacity-60')}><p className="inline-flex flex-wrap items-center gap-1 text-amber-600">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}<span className="ml-2 text-xs text-slate-500">{r.by} · {new Date(r.createdAt).toLocaleDateString('en-AU')}</span>{r.isHidden && <Chip tone="rose">Hidden</Chip>}{p.canModerate && <button type="button" onClick={() => moderate(r.id, !r.isHidden)} className="ml-2 text-xs text-slate-500 underline-offset-2 hover:underline">{r.isHidden ? 'Show it' : 'Hide it'}</button>}</p>{r.comment && <p className="mt-1 text-slate-700 dark:text-slate-300">{r.comment}</p>}</li>)}</ul>
              </Panel>}
            </div>
            <div>
              {p.acceptsBookings && !p.isOwner ? (
                <Panel icon={CalendarCheck} title="Book" intro={`${p.slotMinutes}-minute appointments, times in ${p.timezone.replace('_', ' ')}. Requested first; confirmed by the practitioner.`}>
                  {p.nextAvailable.length === 0 ? <p className="text-sm text-slate-500">Nothing free in the next two weeks. Try the phone or their site.</p> : (
                    <div className="space-y-4">
                      <div><span className="text-xs font-medium uppercase tracking-wide text-slate-500">A day</span><div className="mt-1.5 flex flex-wrap gap-1.5">{p.nextAvailable.map((d) => <button key={d.day} type="button" onClick={() => { setDay(d.day); setSlot(null); }} className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium', day === d.day ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300')}>{fmtDay(d.day)} <span className="opacity-70">({d.slots})</span></button>)}</div></div>
                      {day && <div><span className="text-xs font-medium uppercase tracking-wide text-slate-500">A time</span>{slots.loading ? <Loading label="Finding the free times" /> : <div className="mt-1.5 flex flex-wrap gap-1.5">{(slots.data?.slots ?? []).map((s) => <button key={s.start} type="button" onClick={() => setSlot(s.start)} className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium', slot === s.start ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300')}>{s.label}</button>)}</div>}</div>}
                      {slot && (
                        <>
                          <Field label="How"><SelectInput value={mode} onChange={setMode} options={[...(p.telehealth ? [{ value: 'TELEHEALTH', label: 'Video or phone' }] : []), ...(p.inPerson ? [{ value: 'IN_PERSON', label: 'In person' }] : [])]} /></Field>
                          <Field label="What it is about" hint="Encrypted; read by you and this practitioner only."><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} className={inputClass} /></Field>
                          <div><span className="text-xs font-medium uppercase tracking-wide text-slate-500">Share ahead of the visit</span><p className="text-xs text-slate-500">A link to your summary that expires a week after the appointment.</p><div className="mt-2 space-y-1.5">{(ref.data?.shareScopes ?? []).map((s) => <Check key={s.key} label={s.label} checked={share.includes(s.key)} onChange={(v) => setShare((x) => (v ? [...x, s.key] : x.filter((k) => k !== s.key)))} />)}</div></div>
                          <button type="button" onClick={book} disabled={busy} className="btn-primary w-full text-sm disabled:opacity-50">Request this appointment</button>
                        </>
                      )}
                    </div>
                  )}
                </Panel>
              ) : (
                <Panel title={p.isOwner ? 'This is you' : 'Reach them directly'} intro={p.isOwner ? 'Members see the booking panel here.' : 'This entry takes bookings by phone or on its own site.'}>
                  {p.phone && <a href={`tel:${p.phone.replace(/\s+/g, '')}`} className="btn-primary inline-flex items-center gap-2 text-sm"><Phone className="h-4 w-4" /> Call {p.phone}</a>}
                  {p.bookingUrl && <div className="mt-2"><a href={p.bookingUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">Open their site</a></div>}
                </Panel>
              )}
            </div>
          </div>
          <HealthDisclaimer />
        </>
      )}
    </div>
  );
}
