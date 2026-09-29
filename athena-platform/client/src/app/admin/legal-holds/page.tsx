'use client';

/**
 * Legal holds. A hold stops data being deleted while a court, a regulator or
 * a preservation notice needs it kept: a member's own request to be erased is
 * refused while a hold names her, and the nightly purges skip every member and
 * every kind of record a hold names. A hold stands until somebody releases it;
 * its review date is when somebody should decide whether it still has to.
 *
 * Holds could only be placed with curl. The operations page counted them and
 * linked to the compliance screen, which does not list them, so a lawyer asked
 * to preserve a member's messages had no way to do it from the console, and a
 * hold placed late is a hold placed after the purge has run.
 *
 * Members are named by the email address staff actually have, or by account
 * id; the server refuses any it cannot match, because a hold on nobody looks
 * like protection and is not.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Gavel, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type DataTypeOption = { value: string; label: string; purge: string };

type Hold = {
  id: string;
  name: string;
  reason: string;
  caseReference: string | null;
  affectedUserIds: string[];
  affectedDataTypes: string[];
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  authorizedBy: string;
  authorizedAt: string;
  releasedBy: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
  /** Still standing, and past the date it was to be reviewed by. */
  expired: boolean;
  authorizedByName: string | null;
  releasedByName: string | null;
  unrecognisedDataTypes: string[];
};

type HoldDetail = Hold & {
  affectedUsers: Array<{ id: string; name: string | null; email: string | null }>;
  affectedUserCount: number;
};

type HoldList = {
  holds: Hold[];
  activeCount: number;
  dataTypes: DataTypeOption[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type Filter = 'true' | 'false' | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'true', label: 'Standing' },
  { value: 'false', label: 'Released' },
  { value: 'all', label: 'All' },
];

/** What the server stores for "every purge", and how it is shown. */
const HOLD_EVERYTHING = 'all';

const errorMessage = (e: unknown) =>
  (e as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error;

const longDate = (value: string) => new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

/** Emails and ids pasted together, one per line or separated by commas or spaces. */
function splitMembers(text: string): { emails: string[]; ids: string[] } {
  const entries = Array.from(new Set(text.split(/[\s,;]+/).map((entry) => entry.trim()).filter(Boolean)));
  return {
    emails: entries.filter((entry) => entry.includes('@')),
    ids: entries.filter((entry) => !entry.includes('@')),
  };
}

/** A date input's value as the end of that day, in the admin's own time zone. */
function endOfDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59).toISOString();
}

/** Tomorrow as a date input wants it: a review date has to lie ahead. */
function tomorrowInput(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
}

function dataTypeLabel(value: string, catalogue: DataTypeOption[]): string {
  if (value === HOLD_EVERYTHING || value === '*') return 'Everything the purges delete';
  return catalogue.find((type) => type.value === value)?.label ?? value.replace(/_/g, ' ');
}

export default function LegalHoldsPage() {
  const [filter, setFilter] = useState<Filter>('true');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  const list = useQuery({
    queryKey: ['admin-legal-holds', filter, page],
    queryFn: async () => {
      const response = await api.get('/admin/legal-holds', {
        params: { page, limit: 25, ...(filter === 'all' ? {} : { active: filter }) },
      });
      return response.data as HoldList;
    },
  });

  const catalogue = list.data?.dataTypes ?? [];
  const holds = list.data?.holds ?? [];
  const totalPages = list.data?.pagination.totalPages ?? 1;
  const pastReview = holds.filter((hold) => hold.expired).length;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Gavel className="h-7 w-7 text-indigo-600" /> Legal holds
          </h1>
          <p className="mt-1 max-w-3xl text-slate-600 dark:text-slate-400">
            A hold keeps data from being deleted. While one names a member, her request to be erased is refused; while one names a kind of
            record, the nightly purge leaves it alone. A hold stands until it is released, whatever its review date says.
          </p>
        </div>
        {!placing && (
          <button type="button" onClick={() => setPlacing(true)} className="btn-primary inline-flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> Place a hold
          </button>
        )}
      </div>

      {list.data && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="card">
            <p className="text-xs uppercase tracking-wide text-slate-500">Standing holds</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{list.data.activeCount}</p>
          </div>
          <div className="card">
            <p className="text-xs uppercase tracking-wide text-slate-500">Past their review date, on this page</p>
            <p className={cn('text-2xl font-bold text-slate-900 dark:text-white', pastReview > 0 && 'text-amber-700 dark:text-amber-300')}>{pastReview}</p>
          </div>
        </div>
      )}

      {placing && (
        <PlaceHoldForm
          catalogue={catalogue}
          catalogueReady={Boolean(list.data)}
          onCancel={() => setPlacing(false)}
          onPlaced={(id) => {
            setPlacing(false);
            setFilter('true');
            setPage(1);
            setSelectedId(id);
          }}
        />
      )}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Which holds">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            onClick={() => {
              setFilter(option.value);
              setPage(1);
              setSelectedId(null);
            }}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm',
              filter === option.value
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={cn('grid gap-6', selectedId ? 'lg:grid-cols-[minmax(0,1fr)_460px]' : 'grid-cols-1')}>
        <div>
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Loading holds" />
            </div>
          ) : list.isError ? (
            <div className="card flex flex-col items-start gap-3 border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-900/20" role="alert">
              <p className="font-medium text-red-800 dark:text-red-200">The legal holds could not be loaded.</p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {errorMessage(list.error) ?? 'The server did not answer.'} Until they load, do not assume nothing is held.
              </p>
              <button type="button" onClick={() => list.refetch()} className="btn-outline inline-flex items-center gap-2 text-sm">
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : holds.length === 0 ? (
            <div className="card p-10 text-center text-slate-500">
              {filter === 'true' ? 'No hold is standing. Nothing is being kept back from deletion.' : 'No holds here.'}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
                {holds.map((hold) => (
                  <li key={hold.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(hold.id)}
                      className={cn(
                        'flex w-full flex-col gap-1 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800',
                        selectedId === hold.id && 'bg-indigo-50 dark:bg-indigo-900/10'
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">{hold.name}</span>
                        {hold.caseReference && <code className="text-xs text-slate-500">{hold.caseReference}</code>}
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-medium',
                            hold.isActive
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          )}
                        >
                          {hold.isActive ? 'Standing' : 'Released'}
                        </span>
                        {hold.expired && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                            Past its review date
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-slate-500">
                        {hold.affectedUserIds.length} {hold.affectedUserIds.length === 1 ? 'member' : 'members'}
                        {hold.affectedDataTypes.length > 0 ? ` · ${hold.affectedDataTypes.map((type) => dataTypeLabel(type, catalogue)).join(', ')}` : ''}
                        {' · '}placed {formatDistanceToNow(new Date(hold.authorizedAt), { addSuffix: true })}
                        {hold.authorizedByName ? ` by ${hold.authorizedByName}` : ''}
                        {hold.isActive && hold.endDate ? ` · review by ${longDate(hold.endDate)}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <button type="button" className="btn-outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </button>
                  <span className="text-slate-500">
                    Page {page} of {totalPages}
                  </span>
                  <button type="button" className="btn-outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {selectedId && <HoldPanel key={selectedId} id={selectedId} catalogue={catalogue} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}

/** The data-type checkboxes, shared by placing a hold and widening one. */
function DataTypeChoices({
  catalogue,
  chosen,
  onChange,
  disabledValues = [],
  idPrefix,
}: {
  catalogue: DataTypeOption[];
  chosen: string[];
  onChange: (next: string[]) => void;
  disabledValues?: string[];
  idPrefix: string;
}) {
  const toggle = (value: string, on: boolean) => onChange(on ? [...chosen, value] : chosen.filter((entry) => entry !== value));
  const alreadyEverything = disabledValues.includes(HOLD_EVERYTHING) || disabledValues.includes('*');
  const everything = chosen.includes(HOLD_EVERYTHING);

  if (alreadyEverything) {
    return <p className="text-sm text-slate-500">This hold already keeps everything the purges delete.</p>;
  }

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          id={`${idPrefix}-everything`}
          type="checkbox"
          checked={everything}
          onChange={(e) => toggle(HOLD_EVERYTHING, e.target.checked)}
          className="mt-0.5 rounded border-slate-300"
        />
        <span>
          <span className="font-medium">Everything the purges delete</span>
          <span className="block text-xs text-slate-500">Every nightly purge stops, for every member, until this hold is released.</span>
        </span>
      </label>
      {catalogue.map((type) => (
        <label key={type.value} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={everything || chosen.includes(type.value) || disabledValues.includes(type.value)}
            disabled={everything || disabledValues.includes(type.value)}
            onChange={(e) => toggle(type.value, e.target.checked)}
            className="mt-0.5 rounded border-slate-300"
          />
          <span>
            <span className="font-medium">{type.label}</span>
            <span className="block text-xs text-slate-500">{type.purge}. A hold stops that for everybody.</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function PlaceHoldForm({
  catalogue,
  catalogueReady,
  onCancel,
  onPlaced,
}: {
  catalogue: DataTypeOption[];
  catalogueReady: boolean;
  onCancel: () => void;
  onPlaced: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', caseReference: '', reason: '', members: '', endDate: '' });
  const [dataTypes, setDataTypes] = useState<string[]>([]);
  const members = useMemo(() => splitMembers(form.members), [form.members]);

  const problems: string[] = [];
  if (!form.name.trim()) problems.push('Give the hold a name.');
  if (!form.reason.trim()) problems.push('Say why the data must be kept, and on whose authority.');
  if (members.emails.length + members.ids.length === 0 && dataTypes.length === 0) {
    problems.push('Name at least one member or one kind of record.');
  }

  const place = useMutation({
    mutationFn: () =>
      api.post('/admin/legal-holds', {
        name: form.name.trim(),
        reason: form.reason.trim(),
        ...(form.caseReference.trim() ? { caseReference: form.caseReference.trim() } : {}),
        ...(members.emails.length ? { affectedUserEmails: members.emails } : {}),
        ...(members.ids.length ? { affectedUserIds: members.ids } : {}),
        ...(dataTypes.length ? { affectedDataTypes: dataTypes } : {}),
        ...(form.endDate ? { endDate: endOfDay(form.endDate) } : {}),
      }),
    onSuccess: (response) => {
      const placed = response.data as Hold;
      queryClient.invalidateQueries({ queryKey: ['admin-legal-holds'] });
      queryClient.invalidateQueries({ queryKey: ['admin-ops-summary'] });
      if (placed.unrecognisedDataTypes?.length) {
        toast.error(`Hold placed, but nothing the platform deletes is called: ${placed.unrecognisedDataTypes.join(', ')}`);
      } else {
        toast.success('Hold placed. Nothing it names will be deleted until it is released.');
      }
      onPlaced(placed.id);
    },
    onError: (e: unknown) => toast.error(errorMessage(e) || 'The hold was not placed.'),
  });

  const field = (name: string) => `place-hold-${name}`;

  return (
    <div className="card mb-6 space-y-3">
      <h2 className="font-semibold text-slate-900 dark:text-white">Place a hold</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={field('name')} className="block text-xs text-slate-500">
            Name
          </label>
          <input id={field('name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="The matter or notice, in a line" className="input w-full text-sm" />
        </div>
        <div>
          <label htmlFor={field('reference')} className="block text-xs text-slate-500">
            Case or notice reference (optional)
          </label>
          <input id={field('reference')} value={form.caseReference} onChange={(e) => setForm({ ...form, caseReference: e.target.value })} className="input w-full text-sm" />
        </div>
      </div>
      <div>
        <label htmlFor={field('reason')} className="block text-xs text-slate-500">
          Why it must be kept, and on whose authority
        </label>
        <textarea id={field('reason')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} className="input w-full text-sm" />
      </div>
      <div>
        <label htmlFor={field('members')} className="block text-xs text-slate-500">
          Members, by email address or account id: one per line, or separated by commas
        </label>
        <textarea id={field('members')} value={form.members} onChange={(e) => setForm({ ...form, members: e.target.value })} rows={3} className="input w-full font-mono text-xs" />
        {members.emails.length + members.ids.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            {members.emails.length + members.ids.length} {members.emails.length + members.ids.length === 1 ? 'member' : 'members'}. Each must match an account, or nothing is placed.
          </p>
        )}
      </div>
      <fieldset>
        <legend className="text-xs uppercase tracking-wide text-slate-500">Kinds of record</legend>
        {catalogueReady ? (
          <DataTypeChoices catalogue={catalogue} chosen={dataTypes} onChange={setDataTypes} idPrefix="place" />
        ) : (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            The kinds of record could not be loaded, so this hold can name members only until the list loads.
          </p>
        )}
      </fieldset>
      <div className="max-w-xs">
        <label htmlFor={field('review')} className="block text-xs text-slate-500">
          Review by (optional)
        </label>
        <input id={field('review')} type="date" min={tomorrowInput()} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input w-full text-sm" />
        <p className="mt-1 text-xs text-slate-500">The hold does not end on this date. It is when somebody should decide whether it still has to stand.</p>
      </div>
      {problems.length > 0 && (form.name || form.reason || form.members || dataTypes.length > 0) && (
        <ul className="list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => place.mutate()} disabled={place.isPending || problems.length > 0} className="btn-primary text-sm">
          {place.isPending ? 'Placing…' : 'Place the hold'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

function HoldPanel({ id, catalogue, onClose }: { id: string; catalogue: DataTypeOption[]; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['admin-legal-hold', id],
    queryFn: async () => (await api.get(`/admin/legal-holds/${id}`)).data as HoldDetail,
  });

  return (
    <aside className="card relative h-fit space-y-4 lg:sticky lg:top-6" aria-label="Legal hold">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
        <X className="h-5 w-5" />
      </button>
      {detail.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Loading hold" />
        </div>
      ) : detail.isError || !detail.data ? (
        <div className="space-y-3 pr-8" role="alert">
          <p className="font-medium text-red-800 dark:text-red-200">This hold could not be loaded.</p>
          <p className="text-sm text-red-700 dark:text-red-300">{errorMessage(detail.error) ?? 'The server did not answer.'}</p>
          <button type="button" onClick={() => detail.refetch()} className="btn-outline inline-flex items-center gap-2 text-sm">
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      ) : (
        <HoldBody hold={detail.data} catalogue={catalogue} />
      )}
    </aside>
  );
}

function HoldBody({ hold, catalogue }: { hold: HoldDetail; catalogue: DataTypeOption[] }) {
  const queryClient = useQueryClient();
  const [reviewDate, setReviewDate] = useState('');
  const [addMembers, setAddMembers] = useState('');
  const [addTypes, setAddTypes] = useState<string[]>([]);
  const [releaseReason, setReleaseReason] = useState('');
  const added = useMemo(() => splitMembers(addMembers), [addMembers]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-legal-holds'] });
    queryClient.invalidateQueries({ queryKey: ['admin-legal-hold', hold.id] });
    queryClient.invalidateQueries({ queryKey: ['admin-ops-summary'] });
  };

  const change = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/admin/legal-holds/${hold.id}`, body),
    onSuccess: (response) => {
      refresh();
      setReviewDate('');
      setAddMembers('');
      setAddTypes([]);
      const updated = response.data as Hold;
      if (updated.unrecognisedDataTypes?.length) {
        toast.error(`Saved, but nothing the platform deletes is called: ${updated.unrecognisedDataTypes.join(', ')}`);
      } else {
        toast.success('Hold updated.');
      }
    },
    onError: (e: unknown) => toast.error(errorMessage(e) || 'That was not saved. The hold is as it was.'),
  });

  const release = useMutation({
    mutationFn: () => api.post(`/admin/legal-holds/${hold.id}/release`, { releaseReason: releaseReason.trim() }),
    onSuccess: () => {
      refresh();
      setReleaseReason('');
      toast.success('Hold released. Deletion resumes for what it covered.');
    },
    onError: (e: unknown) => toast.error(errorMessage(e) || 'The hold was not released.'),
  });

  const field = (name: string) => `hold-${name}-${hold.id}`;
  const heldTypes = hold.affectedDataTypes;

  return (
    <>
      <div className="pr-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{hold.name}</h2>
        {hold.caseReference && <p className="text-xs text-slate-500">Reference {hold.caseReference}</p>}
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{hold.reason}</p>
      </div>

      {hold.expired && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200" role="status">
          This hold was to be reviewed by {longDate(hold.endDate!)}. It is still standing and still keeps everything it names. Decide whether it
          has to: set a new review date, or release it.
        </p>
      )}

      <dl className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Placed</dt>
          <dd className="text-slate-700 dark:text-slate-300">
            {longDate(hold.authorizedAt)} by {hold.authorizedByName ?? 'a staff account that no longer exists'}
          </dd>
        </div>
        {hold.isActive ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Review by</dt>
            <dd className="text-slate-700 dark:text-slate-300">{hold.endDate ? longDate(hold.endDate) : 'No date set: it stands until released'}</dd>
          </div>
        ) : (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Released</dt>
            <dd className="text-slate-700 dark:text-slate-300">
              {hold.releasedAt ? longDate(hold.releasedAt) : 'Date not recorded'} by {hold.releasedByName ?? 'a staff account that no longer exists'}
              {hold.releaseReason && <span className="mt-1 block whitespace-pre-wrap text-xs text-slate-500">{hold.releaseReason}</span>}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Kinds of record</dt>
          <dd className="text-slate-700 dark:text-slate-300">
            {heldTypes.length === 0 ? 'None: only the members below' : heldTypes.map((type) => dataTypeLabel(type, catalogue)).join(', ')}
            {hold.unrecognisedDataTypes.length > 0 && (
              <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                Nothing the platform deletes is called {hold.unrecognisedDataTypes.join(', ')}, so that part of the hold keeps nothing.
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Members ({hold.affectedUserCount})
          </dt>
          <dd className="text-slate-700 dark:text-slate-300">
            {hold.affectedUserCount === 0 ? (
              'None'
            ) : (
              <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto text-xs">
                {hold.affectedUsers.map((person) => (
                  <li key={person.id}>
                    {person.name ? (
                      <>
                        <span className="font-medium">{person.name}</span>
                        {person.email && person.email !== person.name ? ` · ${person.email}` : ''}
                      </>
                    ) : (
                      <span className="text-slate-500">No account any more</span>
                    )}{' '}
                    <code className="text-[10px] text-slate-400">{person.id}</code>
                  </li>
                ))}
                {hold.affectedUserCount > hold.affectedUsers.length && (
                  <li className="text-slate-500">and {hold.affectedUserCount - hold.affectedUsers.length} more</li>
                )}
              </ul>
            )}
          </dd>
        </div>
      </dl>

      {hold.isActive && (
        <>
          <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review date</p>
            <label htmlFor={field('review')} className="sr-only">
              New review date
            </label>
            <div className="flex flex-wrap gap-2">
              <input id={field('review')} type="date" min={tomorrowInput()} value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="input text-sm" />
              <button type="button" disabled={change.isPending || !reviewDate} onClick={() => change.mutate({ endDate: endOfDay(reviewDate) })} className="btn-outline text-sm">
                Set review date
              </button>
              {hold.endDate && (
                <button type="button" disabled={change.isPending} onClick={() => change.mutate({ endDate: null })} className="text-sm text-slate-500 hover:underline">
                  Remove the date
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Widen the hold</p>
            <label htmlFor={field('members')} className="block text-xs text-slate-500">
              More members, by email address or account id
            </label>
            <textarea id={field('members')} value={addMembers} onChange={(e) => setAddMembers(e.target.value)} rows={2} className="input w-full font-mono text-xs" />
            {catalogue.length > 0 && (
              <DataTypeChoices catalogue={catalogue} chosen={addTypes} onChange={setAddTypes} disabledValues={heldTypes} idPrefix={field('types')} />
            )}
            <button
              type="button"
              disabled={change.isPending || (added.emails.length + added.ids.length === 0 && addTypes.length === 0)}
              onClick={() =>
                change.mutate({
                  ...(added.emails.length ? { addUserEmails: added.emails } : {}),
                  ...(added.ids.length ? { addUserIds: added.ids } : {}),
                  ...(addTypes.length ? { addDataTypes: addTypes } : {}),
                })
              }
              className="btn-outline text-sm"
            >
              Add to the hold
            </button>
            <p className="text-xs text-slate-500">Nothing can be taken out of a hold here. Narrowing one makes deletion possible again, so it is a release.</p>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Release</p>
            <label htmlFor={field('release')} className="block text-xs text-slate-500">
              Why it no longer has to stand, and on whose authority
            </label>
            <textarea id={field('release')} value={releaseReason} onChange={(e) => setReleaseReason(e.target.value)} rows={2} className="input w-full text-sm" />
            <button
              type="button"
              disabled={release.isPending || !releaseReason.trim()}
              onClick={() => {
                if (window.confirm('Release this hold? Erasure requests and the nightly purges resume for everything it covered, and a release cannot be undone.')) {
                  release.mutate();
                }
              }}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300"
            >
              {release.isPending ? 'Releasing…' : 'Release the hold'}
            </button>
          </div>
        </>
      )}
    </>
  );
}
