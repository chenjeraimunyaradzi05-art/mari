'use client';

/**
 * The applicant pipeline for an organisation's jobs.
 *
 * This page read a field the route never returned, so employers always saw
 * "No applications", and it used stage names that are not in the enum. It now
 * reads the list the route sends, uses the real stages, and adds a board:
 * columns per stage, cards dragged between them (or moved from a menu), and a
 * candidate panel with the cover letter, the resume, and the references that
 * have come back.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Briefcase, Download, Eye, FileText, LayoutGrid, List, Loader2, Mail, Search, Star, User, UserCheck, X } from 'lucide-react';
import { api, referenceApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { downloadPrivateUpload } from '@/lib/private-files';

type Stage = 'PENDING' | 'REVIEWED' | 'SHORTLISTED' | 'INTERVIEW' | 'OFFERED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

interface Application {
  id: string;
  status: Stage;
  coverLetter: string | null;
  resumeUrl: string | null;
  referenceStatus: string | null;
  referencesReceived: number;
  referencesTotal: number;
  appliedAt: string;
  job: { id: string; title: string; slug?: string };
  user: { id: string; firstName: string; lastName: string; email: string; avatar: string | null; headline: string | null };
}

type Reference = {
  id: string;
  refereeName: string;
  refereeTitle?: string | null;
  refereeCompany?: string | null;
  relationship: string;
  status: string;
  completedAt?: string | null;
  responses?: { overallRating?: number; wouldRecommend?: boolean; additionalComments?: string } | null;
};

const STAGES: Record<Stage, { label: string; tone: string }> = {
  PENDING: { label: 'New', tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  REVIEWED: { label: 'Reviewed', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200' },
  SHORTLISTED: { label: 'Shortlisted', tone: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200' },
  INTERVIEW: { label: 'Interview', tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200' },
  OFFERED: { label: 'Offered', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' },
  ACCEPTED: { label: 'Accepted', tone: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100' },
  REJECTED: { label: 'Not selected', tone: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200' },
};

// The stages an employer moves a candidate through, in order. Accepted is the
// candidate's move; rejected and withdrawn close the file.
const BOARD_COLUMNS: Stage[] = ['PENDING', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED'];
const EMPLOYER_STAGES: Stage[] = ['PENDING', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED'];
const CLOSED: Stage[] = ['ACCEPTED', 'REJECTED', 'WITHDRAWN'];

/** One page of the applicant list, as the console route sends it. */
interface ApplicationsPage {
  data: Application[];
  pagination: { page: number; limit: number; total: number; pages: number };
  summary?: {
    byStatus: Partial<Record<Stage, number>>;
    jobs: { id: string; title: string; count: number }[];
  };
}

// The route's ceiling. The board loads the newest hundred first and the rest
// on request; see the load-more control under the board.
const PAGE_SIZE = 100;

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;

function fullName(app: Application): string {
  return `${app.user.firstName ?? ''} ${app.user.lastName ?? ''}`.trim() || app.user.email;
}

export default function ApplicationsPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? '';
  const queryClient = useQueryClient();

  const [view, setView] = useState<'board' | 'list'>('board');
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<Stage | null>(null);

  // This asked once for a hundred and treated the answer as everything. An
  // organisation past a hundred applicants lost its oldest ones from the board
  // without a word — newest first, so the women who had waited longest were
  // the ones who vanished — and the header, the column counts and the job
  // filter were all worked out from that cut-down list. Pages are loaded on
  // request now, the totals come from the server, and the job filter is asked
  // of the server rather than applied to whatever happened to be loaded.
  const applicationsQuery = useInfiniteQuery({
    queryKey: ['employer-applications', orgId, jobFilter],
    queryFn: async ({ pageParam }) => {
      const response = await api.get(`/employer/organizations/${orgId}/applications`, {
        params: { limit: PAGE_SIZE, page: pageParam, ...(jobFilter !== 'all' ? { jobId: jobFilter } : {}) },
      });
      return response.data as ApplicationsPage;
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination && last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined,
    enabled: Boolean(orgId),
  });
  const { isLoading, isError } = applicationsQuery;

  const applications = useMemo(
    () => (applicationsQuery.data?.pages ?? []).flatMap((page) => (Array.isArray(page.data) ? page.data : [])),
    [applicationsQuery.data]
  );
  const firstPage = applicationsQuery.data?.pages[0];
  const total = firstPage?.pagination?.total ?? applications.length;
  const summary = firstPage?.summary;

  const move = useMutation({
    mutationFn: ({ applicationId, status }: { applicationId: string; status: Stage }) =>
      api.patch(`/employer/applications/${applicationId}/status`, { status }),
    onSuccess: (_res, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['employer-applications', orgId] });
      toast.success(`Moved to ${STAGES[status].label}`);
    },
    onError: (error) => toast.error(errorMessage(error) || 'Could not move the application'),
  });

  const jobs = useMemo(
    () => summary?.jobs ?? Array.from(new Map(applications.map((a) => [a.job.id, a.job])).values()),
    [summary, applications]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      if (jobFilter !== 'all' && a.job.id !== jobFilter) return false;
      if (stageFilter !== 'all' && a.status !== stageFilter) return false;
      if (!q) return true;
      return fullName(a).toLowerCase().includes(q) || a.job.title.toLowerCase().includes(q) || (a.user.headline ?? '').toLowerCase().includes(q);
    });
  }, [applications, jobFilter, stageFilter, search]);

  const counts = useMemo(
    () =>
      summary?.byStatus ??
      applications.reduce((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {} as Partial<Record<Stage, number>>),
    [summary, applications]
  );
  const allLoaded = applications.length >= total;

  const selected = applications.find((a) => a.id === selectedId) ?? null;

  const drop = (stage: Stage) => {
    if (!dragging) return;
    const app = applications.find((a) => a.id === dragging);
    setDragging(null);
    setDropTarget(null);
    if (!app || app.status === stage) return;
    move.mutate({ applicationId: app.id, status: stage });
  };

  const Card = ({ app, compact = false }: { app: Application; compact?: boolean }) => {
    const name = fullName(app);
    const stage = STAGES[app.status] ?? STAGES.PENDING;
    return (
      <div
        role="button"
        tabIndex={0}
        draggable={!CLOSED.includes(app.status)}
        onDragStart={() => setDragging(app.id)}
        onDragEnd={() => {
          setDragging(null);
          setDropTarget(null);
        }}
        onClick={() => setSelectedId(app.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setSelectedId(app.id);
          }
        }}
        className={cn(
          'cursor-pointer rounded-lg border bg-white p-3 text-left shadow-sm transition hover:shadow-md dark:bg-slate-900',
          selectedId === app.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-700',
          dragging === app.id && 'opacity-50'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            {app.user.avatar ? <img src={app.user.avatar} alt="" className="h-10 w-10 object-cover" /> : <User className="h-5 w-5 text-slate-400" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
            <p className="truncate text-xs text-slate-500">{app.user.headline || app.user.email}</p>
            {!compact && (
              <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
                <Briefcase className="h-3 w-3" /> {app.job.title}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span>{formatDistanceToNow(new Date(app.appliedAt), { addSuffix: true })}</span>
              {app.referencesTotal > 0 && (
                <span className="inline-flex items-center gap-1">
                  <UserCheck className="h-3 w-3" /> {app.referencesReceived}/{app.referencesTotal} refs
                </span>
              )}
              {compact && <span className={cn('rounded-full px-1.5 py-0.5 font-medium', stage.tone)}>{stage.label}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href={`/employer/organizations/${orgId}`} className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <FileText className="h-7 w-7 text-blue-600" /> Applications
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            {total} {total === 1 ? 'candidate' : 'candidates'}
            {jobFilter === 'all' ? ` across ${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}` : ''}
            {!allLoaded && ` · showing the newest ${applications.length}`}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="View">
          {(
            [
              ['board', 'Board', LayoutGrid],
              ['list', 'List', List],
            ] as Array<['board' | 'list', string, typeof List]>
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium',
                view === value ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="input w-full pl-10" placeholder="Search candidates, headlines or jobs" aria-label="Search" />
        </div>
        <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className="input w-full md:w-56" aria-label="Job">
          <option value="all">All jobs</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </select>
        {view === 'list' && (
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as 'all' | Stage)} className="input w-full md:w-48" aria-label="Stage">
            <option value="all">All stages</option>
            {(Object.keys(STAGES) as Stage[]).map((s) => (
              <option key={s} value={s}>
                {STAGES[s].label} ({counts[s] ?? 0})
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800">Could not load applications.</div>
      ) : applications.length === 0 && jobFilter !== 'all' ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800">
          Nobody has applied to this job yet.
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-800">
          <FileText className="mx-auto mb-4 h-12 w-12 text-slate-400" />
          <h3 className="mb-2 text-lg font-medium text-slate-900 dark:text-white">No applications yet</h3>
          <p className="text-slate-500">When candidates apply to your jobs, they appear here.</p>
        </div>
      ) : (
        <div className={cn('grid gap-6', selected ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : 'grid-cols-1')}>
          {view === 'board' ? (
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max gap-3">
                {BOARD_COLUMNS.map((stage) => {
                  const cards = visible.filter((a) => a.status === stage);
                  return (
                    <section
                      key={stage}
                      aria-label={STAGES[stage].label}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (dropTarget !== stage) setDropTarget(stage);
                      }}
                      onDragLeave={() => dropTarget === stage && setDropTarget(null)}
                      onDrop={() => drop(stage)}
                      className={cn(
                        'w-64 flex-shrink-0 rounded-xl border-2 bg-slate-50 p-2 dark:bg-slate-900/40',
                        dropTarget === stage ? 'border-blue-500' : 'border-transparent'
                      )}
                    >
                      <header className="mb-2 flex items-center justify-between px-1">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STAGES[stage].tone)}>{STAGES[stage].label}</span>
                        <span className="text-xs text-slate-500">
                          {/* The loaded cards against the true count, so a
                              column is never read as complete when it is not. */}
                          {allLoaded || (counts[stage] ?? 0) === cards.length ? cards.length : `${cards.length} of ${counts[stage] ?? 0}`}
                        </span>
                      </header>
                      <div className="space-y-2">
                        {cards.length === 0 ? (
                          <p className="px-2 py-6 text-center text-xs text-slate-400">Drop here</p>
                        ) : (
                          cards.map((app) => <Card key={app.id} app={app} />)
                        )}
                      </div>
                    </section>
                  );
                })}
                <section aria-label="Closed" className="w-64 flex-shrink-0 rounded-xl border-2 border-transparent bg-slate-50 p-2 dark:bg-slate-900/40">
                  <header className="mb-2 flex items-center justify-between px-1">
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">Closed</span>
                    <span className="text-xs text-slate-500">{visible.filter((a) => CLOSED.includes(a.status)).length}</span>
                  </header>
                  <div className="space-y-2">
                    {visible
                      .filter((a) => CLOSED.includes(a.status))
                      .map((app) => (
                        <Card key={app.id} app={app} compact />
                      ))}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800">Nothing matches those filters.</div>
              ) : (
                visible.map((app) => (
                  <div key={app.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <Card app={app} compact />
                    </div>
                    {!CLOSED.includes(app.status) && (
                      <select
                        value={app.status}
                        onChange={(e) => move.mutate({ applicationId: app.id, status: e.target.value as Stage })}
                        disabled={move.isPending}
                        aria-label={`Stage for ${fullName(app)}`}
                        className="input w-40 py-1.5 text-sm"
                      >
                        {EMPLOYER_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {STAGES[s].label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {selected && (
            <CandidatePanel
              app={selected}
              onClose={() => setSelectedId(null)}
              onMove={(status) => move.mutate({ applicationId: selected.id, status })}
              moving={move.isPending}
            />
          )}
        </div>
      )}

      {!isLoading && !isError && applicationsQuery.hasNextPage && (
        <div className="mt-6 flex flex-col items-center gap-2 text-sm text-slate-500">
          <p>
            Showing the newest {applications.length} of {total}. Older applicants are not on the board until you load them.
          </p>
          <button
            type="button"
            onClick={() => applicationsQuery.fetchNextPage()}
            disabled={applicationsQuery.isFetchingNextPage}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {applicationsQuery.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
            Load older applicants
          </button>
        </div>
      )}
    </div>
  );
}

function CandidatePanel({ app, onClose, onMove, moving }: { app: Application; onClose: () => void; onMove: (status: Stage) => void; moving: boolean }) {
  const name = fullName(app);
  const stage = STAGES[app.status] ?? STAGES.PENDING;
  const closed = CLOSED.includes(app.status);
  const [fetchingResume, setFetchingResume] = useState(false);

  // The résumé is a private upload: a plain link to it never carried the
  // session, so it 401'd for every employer. Access is minted for a team
  // member of the organisation the application went to, then the file is
  // handed over.
  const openResume = async () => {
    if (!app.resumeUrl) return;
    setFetchingResume(true);
    try {
      await downloadPrivateUpload(app.resumeUrl, `${name.replace(/\s+/g, '-')}-resume`);
    } catch (error) {
      toast.error(errorMessage(error) || 'The résumé could not be fetched. It may have been removed.');
    } finally {
      setFetchingResume(false);
    }
  };

  const references = useQuery({
    queryKey: ['application-references', app.id],
    queryFn: () => referenceApi.forApplication(app.id),
    select: (response) => (Array.isArray(response.data?.data) ? (response.data.data as Reference[]) : []),
  });

  const nextSteps: Array<[Stage, string]> = (
    {
      PENDING: [['REVIEWED', 'Mark reviewed'], ['SHORTLISTED', 'Shortlist']],
      REVIEWED: [['SHORTLISTED', 'Shortlist'], ['INTERVIEW', 'Invite to interview']],
      SHORTLISTED: [['INTERVIEW', 'Invite to interview'], ['OFFERED', 'Make an offer']],
      INTERVIEW: [['OFFERED', 'Make an offer']],
      OFFERED: [],
      ACCEPTED: [],
      REJECTED: [],
      WITHDRAWN: [],
    } as Record<Stage, Array<[Stage, string]>>
  )[app.status];

  return (
    <aside className="h-fit rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800 lg:sticky lg:top-6">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">
        <X className="h-5 w-5" />
      </button>

      <div className="mb-5 text-center">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          {app.user.avatar ? <img src={app.user.avatar} alt="" className="h-20 w-20 object-cover" /> : <User className="h-10 w-10 text-slate-400" />}
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{name}</h2>
        {app.user.headline && <p className="text-slate-500">{app.user.headline}</p>}
        <span className={cn('mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', stage.tone)}>{stage.label}</span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href={`/profile/${app.user.id}`} className="btn-outline inline-flex flex-1 items-center justify-center gap-1 px-3 py-2 text-sm">
          <Eye className="h-4 w-4" /> Profile
        </Link>
        <a href={`mailto:${app.user.email}`} className="btn-outline inline-flex items-center justify-center gap-1 px-3 py-2 text-sm" aria-label={`Email ${name}`}>
          <Mail className="h-4 w-4" />
        </a>
        {app.resumeUrl && (
          <button type="button" onClick={openResume} disabled={fetchingResume} className="btn-outline inline-flex items-center justify-center gap-1 px-3 py-2 text-sm" aria-label={`Download ${name}'s résumé`}>
            {fetchingResume ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Résumé
          </button>
        )}
      </div>

      {!closed && (
        <div className="mb-5 flex flex-wrap gap-2">
          {nextSteps.map(([status, label]) => (
            <button key={status} type="button" onClick={() => onMove(status)} disabled={moving} className="btn-primary px-3 py-1.5 text-sm">
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Mark ${name} as not selected? They are told.`)) onMove('REJECTED');
            }}
            disabled={moving}
            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700"
          >
            Not selected
          </button>
        </div>
      )}

      <dl className="space-y-4 text-sm">
        <div>
          <dt className="font-medium text-slate-700 dark:text-slate-300">Applied for</dt>
          <dd className="text-slate-900 dark:text-white">{app.job.title}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700 dark:text-slate-300">Applied</dt>
          <dd className="text-slate-900 dark:text-white">{new Date(app.appliedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
        </div>
        {app.coverLetter && (
          <div>
            <dt className="font-medium text-slate-700 dark:text-slate-300">Cover letter</dt>
            <dd className="max-h-64 overflow-y-auto whitespace-pre-wrap text-slate-600 dark:text-slate-400">{app.coverLetter}</dd>
          </div>
        )}
        <div>
          <dt className="mb-1 flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
            <UserCheck className="h-4 w-4" /> References
          </dt>
          <dd>
            {references.isLoading ? (
              <span className="text-slate-500">Loading…</span>
            ) : (references.data?.length ?? 0) === 0 ? (
              <span className="text-slate-500">None requested yet.</span>
            ) : (
              <ul className="space-y-2">
                {references.data!.map((ref) => (
                  <li key={ref.id} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/40">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {ref.refereeName}
                      <span className="font-normal text-slate-500"> · {[ref.refereeTitle, ref.refereeCompany].filter(Boolean).join(', ') || ref.relationship}</span>
                    </p>
                    {ref.status === 'COMPLETED' && ref.responses ? (
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        {typeof ref.responses.overallRating === 'number' && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {ref.responses.overallRating}/5
                          </span>
                        )}
                        {typeof ref.responses.wouldRecommend === 'boolean' && <span>{ref.responses.wouldRecommend ? 'Would recommend' : 'Would not recommend'}</span>}
                        {ref.responses.additionalComments && <span className="block w-full text-slate-500">“{ref.responses.additionalComments}”</span>}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">{ref.status === 'DECLINED' ? 'Declined' : 'Waiting for their answer'}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
