'use client';

/**
 * Apprenticeships, from the provider's side.
 *
 * The server has taken listings, edits, publishing and applications all
 * along and none of it had a screen, so an RTO or a host employer could not
 * put an apprenticeship on the platform at all. A listing starts as a draft,
 * which is why it is only visible to the organizations named on it until it
 * is published.
 *
 * A listing can be published only while the organisation it is placed with is
 * verified and holds an approved host safety attestation (HostSafetyPanel).
 * The server says which on each listing (hostMayPlace) and refuses otherwise;
 * Publish is switched off here, with the reason, so nobody finds out by being
 * refused.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, ExternalLink, GraduationCap, Globe, Loader2, Mail, Plus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { apprenticeshipApi } from '@/lib/api-extensions';
import { downloadPrivateUpload } from '@/lib/private-files';
import { safeHref } from '@/lib/safe-href';
import { apiMessage } from '@/lib/strategy-api';
import { Button } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';
import { HostSafetyPanel } from './HostSafetyPanel';

type Apprenticeship = {
  id: string;
  title: string;
  framework: string;
  level: string;
  status: string;
  durationMonths: number;
  positions?: number | null;
  city?: string | null;
  state?: string | null;
  isRemote?: boolean;
  publishedAt?: string | null;
  createdAt: string;
  rto?: { id: string; name: string } | null;
  hostEmployer?: { id: string; name: string } | null;
  _count?: { applications: number };
  /** The organisation it is placed with is verified and holds an approved safety attestation. */
  hostMayPlace?: boolean;
};

const NEEDS_HOST_CHECK = 'Needs a verified organisation and an approved host safety attestation before it can be published.';

const LEVELS = [
  ['CERTIFICATE_I', 'Certificate I'],
  ['CERTIFICATE_II', 'Certificate II'],
  ['CERTIFICATE_III', 'Certificate III'],
  ['CERTIFICATE_IV', 'Certificate IV'],
  ['DIPLOMA', 'Diploma'],
  ['ADVANCED_DIPLOMA', 'Advanced diploma'],
] as const;

const TONE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  OPEN: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CLOSED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  FILLED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const EMPTY = { title: '', description: '', framework: '', level: 'CERTIFICATE_III', durationMonths: '24', positions: '1', city: '', state: '', wageMin: '', wageMax: '' };

type ApplicationRow = {
  id: string;
  status: string;
  submittedAt: string;
  coverLetter?: string | null;
  resumeUrl?: string | null;
  answers?: unknown;
  user?: { id: string; displayName?: string | null; email?: string | null } | null;
};

/**
 * The start date and portfolio link from an application's answers, where the
 * apply route stores them. Read defensively: rows written before it did have
 * whatever the form of the day sent, or nothing.
 */
function applicationDetails(application: ApplicationRow): { startDate: string | null; portfolioUrl: string | null } {
  const answers =
    application.answers && typeof application.answers === 'object' && !Array.isArray(application.answers)
      ? (application.answers as Record<string, unknown>)
      : {};
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  return { startDate: text(answers.availableStartDate), portfolioUrl: text(answers.portfolioUrl) };
}

function formatStartDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-AU', { dateStyle: 'long', timeZone: 'UTC' });
}

/**
 * What she sent, for the people deciding on it.
 *
 * The list showed a name, a date and a decision menu, and nothing else: the
 * cover letter the form made her write at a hundred characters or more, her
 * résumé and her start date were all saved and none of them were ever shown to
 * the provider, who was deciding on applications she could not read.
 */
function ApplicationDetails({ application }: { application: ApplicationRow }) {
  const [fetchingResume, setFetchingResume] = useState(false);
  const { startDate, portfolioUrl } = applicationDetails(application);
  const portfolioHref = safeHref(portfolioUrl);
  const name = applicantName(application);

  const openResume = async () => {
    if (!application.resumeUrl) return;
    setFetchingResume(true);
    try {
      await downloadPrivateUpload(application.resumeUrl, `${name.replace(/\s+/g, '-')}-resume`);
    } catch (error) {
      toast.error(apiMessage(error, 'The résumé could not be fetched. It may have been removed.'));
    } finally {
      setFetchingResume(false);
    }
  };

  return (
    <div className="mt-2 space-y-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900/40">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        {application.user?.email && (
          <a href={`mailto:${application.user.email}`} className="inline-flex items-center gap-1 hover:underline">
            <Mail className="h-3.5 w-3.5" /> {application.user.email}
          </a>
        )}
        <span>Can start: {startDate ? formatStartDate(startDate) : 'not given'}</span>
        {portfolioHref && (
          <a href={portfolioHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> Portfolio
          </a>
        )}
        {application.resumeUrl && (
          <button type="button" onClick={openResume} disabled={fetchingResume} className="inline-flex items-center gap-1 hover:underline disabled:opacity-60">
            {fetchingResume ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Résumé
          </button>
        )}
      </div>
      {application.coverLetter?.trim() ? (
        <p className="whitespace-pre-line text-slate-700 dark:text-slate-200">{application.coverLetter}</p>
      ) : (
        <p className="text-slate-500 dark:text-slate-400">No cover letter was sent with this application.</p>
      )}
    </div>
  );
}

/**
 * What a provider may set. WITHDRAWN is missing on purpose: that is the
 * candidate's own word about her application and only she can say it, so an
 * application she withdrew is shown as settled rather than as a menu.
 */
const DECISIONS = [
  ['SCREENING', 'Reviewing'],
  ['INTERVIEW', 'Interviewing'],
  ['OFFERED', 'Offered'],
  ['ACCEPTED', 'Accepted'],
  ['REJECTED', 'Not successful'],
] as const;

type Decision = (typeof DECISIONS)[number][0];

const DECIDED: Record<Decision, string> = {
  SCREENING: 'Moved to review. She has been told.',
  INTERVIEW: 'Shortlisted for interview. She has been told.',
  OFFERED: 'Offer sent. She has been told.',
  ACCEPTED: 'Placement confirmed. She can start tracking her competencies.',
  REJECTED: 'Marked unsuccessful. She has been told.',
};

const applicantName = (application: ApplicationRow) =>
  application.user?.displayName || application.user?.email || 'An applicant';

export default function ProviderApprenticeshipsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [showApplications, setShowApplications] = useState<string | null>(null);

  const listings = useQuery({
    queryKey: ['provider-apprenticeships', orgId],
    queryFn: apprenticeshipApi.getMine,
    select: (r) => (r.data?.data ?? []) as Apprenticeship[],
  });

  // The route pages its answer now — it used to return every applicant a
  // listing had ever had, emails and cover letters included, in one response —
  // so this asks for its largest page and says below when there are more.
  const applicationsQuery = useQuery({
    queryKey: ['apprenticeship-applications', showApplications],
    queryFn: () =>
      api.get(`/apprenticeships/${showApplications}/applications`, { params: { limit: 100 } }),
    // The route selects `user` and orders by `submittedAt`; this used to read
    // `applicant` and `createdAt`, neither of which is in the payload, so every
    // applicant showed as "An applicant" with an unreadable date.
    select: (r) => ({
      rows: (r.data?.data ?? []) as ApplicationRow[],
      total: typeof r.data?.pagination?.total === 'number' ? (r.data.pagination.total as number) : null,
    }),
    enabled: Boolean(showApplications),
  });
  const applications = {
    ...applicationsQuery,
    data: applicationsQuery.data?.rows,
  };
  const applicantsNotShown =
    applicationsQuery.data?.total != null ? applicationsQuery.data.total - applicationsQuery.data.rows.length : 0;

  // Moving an application along. There was no endpoint for this at all, so an
  // applicant sat at "submitted" for ever and the milestone, evidence and
  // certificate screens behind an accepted placement were unreachable for
  // everybody. `api.patch` inline rather than a new helper, because this is the
  // one screen that decides an apprenticeship application.
  const decide = useMutation({
    mutationFn: ({ applicationId, status }: { applicationId: string; status: Decision }) =>
      api.patch(`/apprenticeships/applications/${applicationId}`, { status }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['apprenticeship-applications', showApplications] });
      queryClient.invalidateQueries({ queryKey: ['provider-apprenticeships', orgId] });
      toast.success(DECIDED[variables.status]);
    },
    onError: (err) => toast.error(apiMessage(err, 'That application could not be updated.')),
  });

  const create = useMutation({
    mutationFn: () =>
      apprenticeshipApi.create({
        title: form.title.trim(),
        description: form.description.trim(),
        framework: form.framework.trim(),
        level: form.level,
        durationMonths: Number(form.durationMonths) || 12,
        positions: Number(form.positions) || 1,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        wageMin: form.wageMin ? Number(form.wageMin) : undefined,
        wageMax: form.wageMax ? Number(form.wageMax) : undefined,
        rtoId: orgId,
      }),
    onSuccess: () => {
      setForm(EMPTY);
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ['provider-apprenticeships', orgId] });
      toast.success('Draft created. Publish it when it is ready.');
    },
    onError: (err) => toast.error(apiMessage(err, 'That could not be created.')),
  });

  const publish = useMutation({
    mutationFn: (id: string) => apprenticeshipApi.publish(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-apprenticeships', orgId] });
      toast.success('Published. It is now on the public listings.');
    },
    onError: (err) => toast.error(apiMessage(err, 'That could not be published.')),
  });

  const rows = listings.data ?? [];
  const canCreate = form.title.trim() && form.description.trim() && form.framework.trim();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Link href={`/employer/organizations/${orgId}`} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:underline dark:text-slate-300">
        <ArrowLeft className="h-4 w-4" /> Back to the organisation
      </Link>

      <HostSafetyPanel organizationId={orgId} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <GraduationCap className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Apprenticeships</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">What you are offering</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A listing stays a draft, visible only to you, until you publish it.</p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" /> {creating ? 'Cancel' : 'New apprenticeship'}
        </Button>
      </div>

      {creating && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Title</span>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} placeholder="Carpentry apprenticeship" className="input w-full text-sm" />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">What it involves</span>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} maxLength={10000} placeholder="Four years on site with a qualified carpenter, one day a week at the training centre." className="input w-full text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Training package or framework</span>
              <input value={form.framework} onChange={(e) => setForm({ ...form, framework: e.target.value })} maxLength={100} placeholder="CPC30220" className="input w-full text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Level</span>
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="input w-full text-sm">
                {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Months</span>
              <input type="number" min={1} value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} className="input w-full text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Positions</span>
              <input type="number" min={1} value={form.positions} onChange={(e) => setForm({ ...form, positions: e.target.value })} className="input w-full text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">City</span>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input w-full text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">State</span>
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="QLD" className="input w-full text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Wage from, a year</span>
              <input type="number" min={0} value={form.wageMin} onChange={(e) => setForm({ ...form, wageMin: e.target.value })} className="input w-full text-sm" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Wage to</span>
              <input type="number" min={0} value={form.wageMax} onChange={(e) => setForm({ ...form, wageMax: e.target.value })} className="input w-full text-sm" />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={() => create.mutate()} disabled={!canCreate || create.isPending}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save as draft
            </Button>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pay must meet the award for the trade and the year of the apprenticeship.</p>
          </div>
        </div>
      )}

      {listings.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : listings.isError ? (
        <p className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-700">
          These could not be loaded. Only staff of the organisations named on a listing can see it.
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-8 text-center dark:border-slate-700">
          <GraduationCap className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 font-semibold text-slate-900 dark:text-white">Nothing listed yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create one as a draft, then publish it when the details are settled.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/apprenticeships/${item.id}`} className="font-semibold text-slate-900 hover:underline dark:text-white">{item.title}</Link>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {item.framework} · {LEVELS.find(([v]) => v === item.level)?.[1] ?? item.level} · {item.durationMonths} months
                    {item.city ? ` · ${[item.city, item.state].filter(Boolean).join(', ')}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.publishedAt ? `Published ${formatDate(item.publishedAt)}` : `Created ${formatDate(item.createdAt)}`}
                    {item._count ? ` · ${item._count.applications} application${item._count.applications === 1 ? '' : 's'}` : ''}
                  </p>
                  {item.status === 'DRAFT' && item.hostMayPlace === false && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{NEEDS_HOST_CHECK}</p>}
                  {item.status === 'OPEN' && item.hostMayPlace === false && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      This listing is on the public list but is not taking applications, and cannot offer or confirm a placement, until the host check above is complete.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', TONE[item.status] ?? TONE.DRAFT)}>{item.status.toLowerCase()}</span>
                  {item.status === 'DRAFT' && (
                    <Button
                      size="sm"
                      onClick={() => publish.mutate(item.id)}
                      disabled={publish.isPending || item.hostMayPlace === false}
                      title={item.hostMayPlace === false ? NEEDS_HOST_CHECK : undefined}
                    >
                      <Globe className="mr-2 h-4 w-4" /> Publish
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setShowApplications(showApplications === item.id ? null : item.id)}>
                    <Users className="mr-2 h-4 w-4" /> Applicants
                  </Button>
                </div>
              </div>

              {showApplications === item.id && (
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                  {applications.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : applications.isError ? (
                    // A refusal or a failed request used to fall through to
                    // "Nobody has applied yet". Applicants are shown only to
                    // this organisation's hiring team, so a member without a
                    // hiring role is told that rather than told there are none.
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {apiMessage(applications.error, 'We could not load the applicants.') === 'Apprenticeship not found'
                        ? 'Applicants are shown to owners, admins and recruiters of this organisation, and to anyone given posting rights.'
                        : apiMessage(applications.error, 'We could not load the applicants. Try again in a moment.')}
                    </p>
                  ) : (applications.data?.length ?? 0) === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Nobody has applied yet.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {applications.data!.map((application) => (
                        <li key={application.id} className="rounded-lg border border-slate-100 p-2 dark:border-slate-700">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="min-w-0">
                              <span className="text-slate-800 dark:text-slate-200">{applicantName(application)}</span>
                              <span className="ml-2 text-xs text-slate-500">applied {formatDate(application.submittedAt)}</span>
                            </span>
                            {application.status === 'WITHDRAWN' ? (
                              <span className="text-xs text-slate-500">withdrawn</span>
                            ) : (
                              <label className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="sr-only">Decision for {applicantName(application)}</span>
                                <select
                                  value={application.status}
                                  disabled={decide.isPending}
                                  onChange={(e) =>
                                    decide.mutate({ applicationId: application.id, status: e.target.value as Decision })
                                  }
                                  className="input py-1 text-xs"
                                >
                                  {/* A freshly submitted application has no decision on it yet,
                                      so its own status has to be selectable or the control would
                                      open showing somebody else's. */}
                                  {application.status === 'SUBMITTED' && <option value="SUBMITTED">Submitted</option>}
                                  {DECISIONS.map(([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                          </div>
                          {application.status !== 'WITHDRAWN' && <ApplicationDetails application={application} />}
                        </li>
                      ))}
                      {applicantsNotShown > 0 && (
                        <li className="pt-2 text-xs text-slate-500">
                          Showing the newest {applications.data!.length}. {applicantsNotShown} earlier{' '}
                          {applicantsNotShown === 1 ? 'applicant is' : 'applicants are'} not listed here.
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
