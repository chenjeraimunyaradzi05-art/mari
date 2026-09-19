'use client';

/**
 * Accelerator cohorts, from the platform's side. Until this page existed a
 * cohort could only be created with SQL, so /dashboard/accelerator was always
 * empty. Staff create a cohort here, start from the blueprint's twelve weeks
 * or from nothing, then put the dates and meeting links on each session.
 * Founders see a cohort the moment it is saved.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Plus, Rocket, Trash2, X } from 'lucide-react';
import {
  adminApiMessage,
  adminCatalogueApi,
  fromDateTimeLocal,
  listFromText,
  toDateTimeLocal,
  type CohortStatus,
} from '@/lib/admin-catalogue-api';
import { cn } from '@/lib/utils';

type Session = {
  id: string;
  weekNumber: number;
  title: string;
  description: string | null;
  scheduledAt: string;
  durationMins: number;
  meetingUrl: string | null;
  recordingUrl: string | null;
};
type Cohort = {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  maxParticipants: number;
  priceAud: string | number | null;
  status: CohortStatus;
  mentorIds: string[];
  enrollmentCount: number;
  sessionCount: number;
  sessions?: Session[];
};

const STATUSES: Array<[CohortStatus, string]> = [
  ['UPCOMING', 'Upcoming'],
  ['ENROLLING', 'Enrolling'],
  ['IN_PROGRESS', 'In progress'],
  ['COMPLETED', 'Completed'],
  ['CANCELLED', 'Cancelled'],
];
const TONE: Record<CohortStatus, string> = {
  UPCOMING: 'bg-slate-100 text-slate-700',
  ENROLLING: 'bg-emerald-100 text-emerald-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-purple-100 text-purple-800',
  CANCELLED: 'bg-red-100 text-red-700',
};

const aud = (v: unknown) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(v));
const day = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
const when = (iso: string) => new Date(iso).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

type CohortForm = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  maxParticipants: string;
  priceAud: string;
  status: CohortStatus;
  mentorIds: string;
  useDefaultCurriculum: boolean;
};
const emptyCohort: CohortForm = { name: '', description: '', startDate: '', endDate: '', maxParticipants: '30', priceAud: '2500', status: 'UPCOMING', mentorIds: '', useDefaultCurriculum: true };
const toForm = (c: Cohort): CohortForm => ({
  name: c.name,
  description: c.description ?? '',
  startDate: toDateTimeLocal(c.startDate),
  endDate: c.endDate.slice(0, 10),
  maxParticipants: String(c.maxParticipants),
  priceAud: c.priceAud === null || c.priceAud === undefined ? '' : String(c.priceAud),
  status: c.status,
  mentorIds: (c.mentorIds ?? []).join(', '),
  useDefaultCurriculum: true,
});

export default function AdminAcceleratorPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'all' | CohortStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CohortForm>(emptyCohort);

  const list = useQuery({
    queryKey: ['admin-cohorts', status],
    queryFn: () => adminCatalogueApi.cohorts.list(status === 'all' ? undefined : { status }),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Cohort[]) : []),
  });
  const detail = useQuery({
    queryKey: ['admin-cohort', selectedId],
    queryFn: () => adminCatalogueApi.cohorts.get(selectedId!),
    enabled: !!selectedId,
    select: (r) => r.data?.data as Cohort,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-cohorts'] });
    queryClient.invalidateQueries({ queryKey: ['admin-cohort'] });
  };
  const payload = () => ({
    name: form.name.trim(),
    description: form.description.trim() || null,
    startDate: fromDateTimeLocal(form.startDate),
    endDate: form.endDate,
    ...(form.maxParticipants ? { maxParticipants: Number(form.maxParticipants) } : {}),
    ...(form.priceAud !== '' ? { priceAud: Number(form.priceAud) } : {}),
    status: form.status,
    mentorIds: listFromText(form.mentorIds),
  });

  const create = useMutation({
    mutationFn: () => adminCatalogueApi.cohorts.create({ ...payload(), useDefaultCurriculum: form.useDefaultCurriculum }),
    onSuccess: (r) => {
      refresh();
      toast.success(form.useDefaultCurriculum ? 'Cohort created with its twelve weeks.' : 'Cohort created.');
      setCreating(false);
      setSelectedId(r.data?.data?.id ?? null);
    },
    onError: (e) => toast.error(adminApiMessage(e) || 'Could not create that cohort'),
  });
  const update = useMutation({
    mutationFn: (id: string) => adminCatalogueApi.cohorts.update(id, payload()),
    onSuccess: () => {
      refresh();
      toast.success('Saved.');
    },
    onError: (e) => toast.error(adminApiMessage(e) || 'Could not save that'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminCatalogueApi.cohorts.remove(id),
    onSuccess: () => {
      refresh();
      toast.success('Cohort deleted.');
      setSelectedId(null);
    },
    onError: (e) => toast.error(adminApiMessage(e) || 'Could not delete that'),
  });
  const seed = useMutation({
    mutationFn: (id: string) => adminCatalogueApi.cohorts.addDefaultSessions(id),
    onSuccess: () => {
      refresh();
      toast.success('The twelve weeks are on the cohort.');
    },
    onError: (e) => toast.error(adminApiMessage(e) || 'Could not add the sessions'),
  });

  const open = (c: Cohort) => {
    setCreating(false);
    setSelectedId(c.id);
    setForm(toForm(c));
  };
  const startNew = () => {
    setSelectedId(null);
    setForm(emptyCohort);
    setCreating(true);
  };
  const current = creating ? null : (detail.data ?? list.data?.find((c) => c.id === selectedId) ?? null);
  const panelOpen = creating || !!current;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Rocket className="h-7 w-7 text-primary-600" /> Accelerator cohorts
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">Create a cohort, schedule its weeks and add the meeting links. Founders see it as soon as it is saved.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="input py-1.5 text-sm" aria-label="Status">
            <option value="all">All cohorts</option>
            {STATUSES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <button type="button" onClick={startNew} className="btn-primary inline-flex items-center gap-1 py-1.5 text-sm">
            <Plus className="h-4 w-4" /> New cohort
          </button>
        </div>
      </div>

      <div className={cn('grid gap-6', panelOpen ? 'lg:grid-cols-[minmax(0,1fr)_440px]' : 'grid-cols-1')}>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (list.data?.length ?? 0) === 0 ? (
            <p className="p-10 text-center text-slate-500">No cohorts yet. Create the first one and founders will see it.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2">Cohort</th>
                  <th className="px-4 py-2">Runs</th>
                  <th className="px-4 py-2">Enrolled</th>
                  <th className="px-4 py-2">Sessions</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.data!.map((c) => (
                  <tr key={c.id} onClick={() => open(c)} className={cn('cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800', selectedId === c.id && 'bg-primary-50 dark:bg-primary-900/20')}>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{c.name}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      {day(c.startDate)} – {day(c.endDate)}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      {c.enrollmentCount} of {c.maxParticipants}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{c.sessionCount}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{c.priceAud === null ? '–' : aud(c.priceAud)}</td>
                    <td className="px-4 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TONE[c.status])}>{c.status.replace('_', ' ').toLowerCase()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {panelOpen && (
          <aside className="card relative h-fit space-y-5 lg:sticky lg:top-6">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setSelectedId(null);
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{creating ? 'New cohort' : current?.name}</h2>

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (creating) create.mutate();
                else if (current) update.mutate(current.id);
              }}
            >
              <div>
                <label htmlFor="cohort-name" className="text-xs font-medium text-slate-600 dark:text-slate-300">Name</label>
                <input id="cohort-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={120} className="input mt-1 w-full text-sm" />
              </div>
              <div>
                <label htmlFor="cohort-description" className="text-xs font-medium text-slate-600 dark:text-slate-300">Description</label>
                <textarea id="cohort-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={2000} className="input mt-1 w-full text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="cohort-start" className="text-xs font-medium text-slate-600 dark:text-slate-300">First session</label>
                  <input id="cohort-start" type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required className="input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="cohort-end" className="text-xs font-medium text-slate-600 dark:text-slate-300">Ends</label>
                  <input id="cohort-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required className="input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="cohort-max" className="text-xs font-medium text-slate-600 dark:text-slate-300">Places</label>
                  <input id="cohort-max" type="number" min={1} max={500} value={form.maxParticipants} onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })} className="input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="cohort-price" className="text-xs font-medium text-slate-600 dark:text-slate-300">Price (AUD)</label>
                  <input id="cohort-price" type="number" min={0} step="0.01" value={form.priceAud} onChange={(e) => setForm({ ...form, priceAud: e.target.value })} className="input mt-1 w-full text-sm" />
                </div>
                <div>
                  <label htmlFor="cohort-status" className="text-xs font-medium text-slate-600 dark:text-slate-300">Status</label>
                  <select id="cohort-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CohortStatus })} className="input mt-1 w-full text-sm">
                    {STATUSES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cohort-mentors" className="text-xs font-medium text-slate-600 dark:text-slate-300">Mentor user ids</label>
                  <input id="cohort-mentors" value={form.mentorIds} onChange={(e) => setForm({ ...form, mentorIds: e.target.value })} placeholder="comma separated" className="input mt-1 w-full text-sm" />
                </div>
              </div>
              {creating && (
                <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={form.useDefaultCurriculum} onChange={(e) => setForm({ ...form, useDefaultCurriculum: e.target.checked })} className="mt-0.5 rounded border-slate-300" />
                  <span>
                    Start from the twelve-week curriculum
                    <span className="block text-xs text-slate-500">One session a week from the first session, at the same time. You add the meeting links after.</span>
                  </span>
                </label>
              )}
              <div className="flex gap-2">
                <button type="submit" disabled={create.isPending || update.isPending} className="btn-primary flex-1 py-2 text-sm">
                  {creating ? 'Create cohort' : 'Save changes'}
                </button>
                {current && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete this cohort? Only possible while nobody has enrolled.')) remove.mutate(current.id);
                    }}
                    disabled={remove.isPending}
                    className="btn-secondary inline-flex items-center gap-1 py-2 text-sm text-red-700"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                )}
              </div>
            </form>

            {current && (
              <SessionsPanel
                cohortId={current.id}
                sessions={detail.data?.sessions ?? []}
                loading={detail.isLoading}
                onSeed={() => seed.mutate(current.id)}
                seeding={seed.isPending}
                onChanged={refresh}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- sessions

type SessionForm = { weekNumber: string; title: string; scheduledAt: string; durationMins: string; meetingUrl: string; recordingUrl: string };
const sessionForm = (s?: Session): SessionForm => ({
  weekNumber: s ? String(s.weekNumber) : '',
  title: s?.title ?? '',
  scheduledAt: toDateTimeLocal(s?.scheduledAt),
  durationMins: s ? String(s.durationMins) : '120',
  meetingUrl: s?.meetingUrl ?? '',
  recordingUrl: s?.recordingUrl ?? '',
});

function SessionsPanel({ cohortId, sessions, loading, onSeed, seeding, onChanged }: { cohortId: string; sessions: Session[]; loading: boolean; onSeed: () => void; seeding: boolean; onChanged: () => void }) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<SessionForm>(sessionForm());

  const body = () => ({
    weekNumber: Number(form.weekNumber),
    title: form.title.trim(),
    scheduledAt: fromDateTimeLocal(form.scheduledAt),
    ...(form.durationMins ? { durationMins: Number(form.durationMins) } : {}),
    meetingUrl: form.meetingUrl.trim() || null,
    recordingUrl: form.recordingUrl.trim() || null,
  });
  const save = useMutation({
    mutationFn: () => (editingId === 'new' ? adminCatalogueApi.cohorts.addSession(cohortId, body()) : adminCatalogueApi.cohorts.updateSession(cohortId, editingId!, body())),
    onSuccess: () => {
      onChanged();
      toast.success('Session saved.');
      setEditingId(null);
    },
    onError: (e) => toast.error(adminApiMessage(e) || 'Could not save that session'),
  });
  const remove = useMutation({
    mutationFn: (sessionId: string) => adminCatalogueApi.cohorts.removeSession(cohortId, sessionId),
    onSuccess: () => {
      onChanged();
      toast.success('Session removed.');
      if (editingId !== 'new') setEditingId(null);
    },
    onError: (e) => toast.error(adminApiMessage(e) || 'Could not remove that session'),
  });

  const edit = (s?: Session) => {
    setForm(sessionForm(s));
    setEditingId(s ? s.id : 'new');
  };

  return (
    <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sessions</h3>
        <button type="button" onClick={() => edit()} className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline">
          <Plus className="h-4 w-4" /> Add a session
        </button>
      </div>

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : sessions.length === 0 && editingId !== 'new' ? (
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <p>No sessions yet, so founders cannot see a week-by-week plan.</p>
          <button type="button" onClick={onSeed} disabled={seeding} className="btn-secondary mt-2 py-1.5 text-sm">
            {seeding ? 'Adding…' : 'Add the twelve default weeks'}
          </button>
        </div>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
          {sessions.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => edit(s)} className={cn('w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800', editingId === s.id && 'bg-primary-50 dark:bg-primary-900/20')}>
                <span className="font-medium text-slate-900 dark:text-white">
                  Week {s.weekNumber}: {s.title}
                </span>
                <span className="block text-xs text-slate-500">
                  {when(s.scheduledAt)} · {s.durationMins} min{s.meetingUrl ? ' · link set' : ' · no meeting link yet'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editingId && (
        <form
          className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{editingId === 'new' ? 'New session' : 'Edit session'}</p>
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <div>
              <label htmlFor="session-week" className="text-xs font-medium text-slate-600 dark:text-slate-300">Week</label>
              <input id="session-week" type="number" min={1} max={52} value={form.weekNumber} onChange={(e) => setForm({ ...form, weekNumber: e.target.value })} required className="input mt-1 w-full text-sm" />
            </div>
            <div>
              <label htmlFor="session-title" className="text-xs font-medium text-slate-600 dark:text-slate-300">Title</label>
              <input id="session-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={2} maxLength={160} className="input mt-1 w-full text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_90px] gap-2">
            <div>
              <label htmlFor="session-when" className="text-xs font-medium text-slate-600 dark:text-slate-300">When</label>
              <input id="session-when" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} required className="input mt-1 w-full text-sm" />
            </div>
            <div>
              <label htmlFor="session-mins" className="text-xs font-medium text-slate-600 dark:text-slate-300">Minutes</label>
              <input id="session-mins" type="number" min={15} max={480} value={form.durationMins} onChange={(e) => setForm({ ...form, durationMins: e.target.value })} className="input mt-1 w-full text-sm" />
            </div>
          </div>
          <div>
            <label htmlFor="session-meeting" className="text-xs font-medium text-slate-600 dark:text-slate-300">Meeting link</label>
            <input id="session-meeting" type="url" value={form.meetingUrl} onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })} placeholder="https://" className="input mt-1 w-full text-sm" />
          </div>
          <div>
            <label htmlFor="session-recording" className="text-xs font-medium text-slate-600 dark:text-slate-300">Recording link</label>
            <input id="session-recording" type="url" value={form.recordingUrl} onChange={(e) => setForm({ ...form, recordingUrl: e.target.value })} placeholder="https://" className="input mt-1 w-full text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 py-1.5 text-sm">
              {editingId === 'new' ? 'Add session' : 'Save session'}
            </button>
            <button type="button" onClick={() => setEditingId(null)} className="btn-secondary py-1.5 text-sm">
              Cancel
            </button>
            {editingId !== 'new' && (
              <button type="button" onClick={() => remove.mutate(editingId)} disabled={remove.isPending} className="btn-secondary py-1.5 text-sm text-red-700" aria-label="Remove session">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
