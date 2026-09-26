'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  MapPin,
  Clock,
  ChevronRight,
  FileText,
  CheckCircle2,
  XCircle,
  Clock4,
  MessageSquare,
  Calendar,
  Filter,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useUpdateMyApplication } from '@/lib/hooks';
import { api } from '@/lib/api';
import { ReferencesPanel } from '@/components/jobs/ReferencesPanel';
import { downloadPrivateUpload } from '@/lib/private-files';
import { formatRelativeTime, JOB_TYPE_LABELS } from '@/lib/utils';

const statusConfig = {
  PENDING: {
    label: 'Pending Review',
    icon: Clock4,
    color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
    description: 'Your application is being reviewed',
  },
  // The ApplicationStatus enum is REVIEWED, not REVIEWING. The old key never
  // matched a real status, so these applications fell through to `undefined`
  // and crashed the row on `status.icon`.
  REVIEWED: {
    label: 'Under Review',
    icon: FileText,
    color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    description: 'The hiring team is reviewing your application',
  },
  SHORTLISTED: {
    label: 'Shortlisted',
    icon: CheckCircle2,
    color: 'text-teal-600 bg-teal-100 dark:bg-teal-900/30',
    description: 'You have been shortlisted for this role',
  },
  // ATHENA has no interview behind this stage: no time, place or link is
  // recorded, and nothing here lets her accept or propose one. So this says
  // what the stage is and who acts next, rather than "you have been selected
  // for an interview", which left her waiting for something to appear here.
  INTERVIEW: {
    label: 'Interview Stage',
    icon: Calendar,
    color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
    description:
      'The employer has moved you to their interview stage. They arrange interviews directly with you, so look out for their email or call.',
  },
  OFFERED: {
    label: 'Offer Extended',
    icon: CheckCircle2,
    color: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    description: 'Congratulations! You received an offer',
  },
  // "The position has been filled" was a claim about the job that nothing
  // recorded: an employer declining one candidate says nothing about whether
  // anyone else was hired.
  REJECTED: {
    label: 'Not Selected',
    icon: XCircle,
    color: 'text-red-600 bg-red-100 dark:bg-red-900/30',
    description: 'The employer did not take your application further.',
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    icon: XCircle,
    color: 'text-slate-600 bg-slate-100 dark:bg-slate-900/30',
    description: 'You withdrew this application',
  },
  ACCEPTED: {
    label: 'Offer Accepted',
    icon: CheckCircle2,
    color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
    description: 'You accepted this offer',
  },
};

type ApplicationStatus = keyof typeof statusConfig;

/** One page of GET /jobs/me/applications. */
interface MyApplicationsPage {
  data: any[];
  pagination?: { page: number; limit: number; total: number; pages: number };
  summary?: { byStatus: Record<string, number> };
}

const PAGE_SIZE = 50;

/**
 * Where the job is. Job has city, state, country and isRemote; this page used
 * to print `job.location`, which is not a column, so every row showed an empty
 * place beside a map pin.
 */
function jobPlace(job: { city?: string | null; state?: string | null; country?: string | null; isRemote?: boolean }): string {
  const place = [job.city, job.state].filter(Boolean).join(', ') || job.country || '';
  if (job.isRemote) return place ? `${place} · Remote` : 'Remote';
  return place;
}

// A status this page does not know about should degrade to a plain row, not
// take the whole list down with it.
const FALLBACK_STATUS = {
  label: 'Application',
  icon: FileText,
  color: 'text-slate-600 bg-slate-100 dark:bg-slate-900/30',
  description: '',
};

export default function ApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchingResumeFor, setFetchingResumeFor] = useState<string | null>(null);
  // Paged, with the totals from the server. The list used to arrive whole
  // and the counts were its length; the route pages it now, and a count taken
  // from one page would be a count of that page. The key sits under
  // 'my-applications' so withdrawing or accepting refreshes it.
  const applicationsQuery = useInfiniteQuery({
    queryKey: ['my-applications', 'tracker'],
    queryFn: async ({ pageParam }) =>
      (await api.get('/jobs/me/applications', { params: { page: pageParam, limit: PAGE_SIZE } })).data as MyApplicationsPage,
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination && last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined,
  });
  const { isLoading, isError, refetch } = applicationsQuery;
  const applications = useMemo(
    () => (applicationsQuery.data?.pages ?? []).flatMap((page) => (Array.isArray(page.data) ? page.data : [])),
    [applicationsQuery.data]
  );
  const firstPage = applicationsQuery.data?.pages[0];
  const totalApplications = firstPage?.pagination?.total ?? applications.length;
  const updateApplication = useUpdateMyApplication();

  // Her résumé is a private upload, so the link on the application never
  // opened on its own; access is minted for her, then the file handed over.
  const downloadResume = async (application: { id: string; resumeUrl?: string | null }) => {
    if (!application.resumeUrl) return;
    setFetchingResumeFor(application.id);
    try {
      await downloadPrivateUpload(application.resumeUrl, 'resume');
    } catch {
      toast.error('Your résumé could not be fetched just now.');
    } finally {
      setFetchingResumeFor(null);
    }
  };

  // A job posted outside any organisation has none, and reading `.name` off
  // it threw, taking the search box and the whole list down with it.
  const filteredApplications = applications.filter((app: any) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      app.job.title.toLowerCase().includes(q) ||
      (app.job.organization?.name ?? '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const statusCounts: Record<string, number> =
    firstPage?.summary?.byStatus ??
    applications.reduce((acc: Record<string, number>, app: any) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {});

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            My Applications
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Track and manage your job applications
          </p>
        </div>
        <Link
          href="/dashboard/jobs"
          className="btn-primary inline-flex items-center space-x-2"
        >
          <Briefcase className="w-4 h-4" />
          <span>Browse Jobs</span>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {totalApplications}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Total Applications
          </div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-blue-600">
            {statusCounts['REVIEWED'] || 0}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Under Review
          </div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-purple-600">
            {statusCounts['INTERVIEW'] || 0}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Interviews
          </div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-green-600">
            {statusCounts['OFFERED'] || 0}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Offers
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by job title or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Status</option>
              {Object.entries(statusConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Applications List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        // A failed request used to fall through to "You haven't applied to any
        // jobs yet", which is a claim about her, not about the connection.
        <div className="card text-center py-12">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            We could not load your applications
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            This is a problem on our side or with the connection. Your applications are not lost.
          </p>
          <button type="button" onClick={() => refetch()} className="btn-outline inline-block px-4 py-2">
            Try again
          </button>
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="card text-center py-12">
          <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No applications found
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {statusFilter !== 'all' || searchQuery
              ? 'No applications match the selected filter'
              : "You haven't applied to any jobs yet"}
          </p>
          <Link href="/dashboard/jobs" className="btn-primary inline-block">
            Browse Jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((application: any) => {
            const status =
              statusConfig[application.status as ApplicationStatus] ?? FALLBACK_STATUS;
            const StatusIcon = status.icon;
            const organization = application.job.organization as
              | { name: string; logo: string | null; slug?: string }
              | null
              | undefined;
            const place = jobPlace(application.job);

            return (
              <div
                key={application.id}
                className="card hover:border-primary-200 dark:hover:border-primary-800 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Company Logo & Job Info */}
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                      {organization?.logo ? (
                        <img
                          src={organization.logo}
                          alt={organization.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/dashboard/jobs/${application.job.id}`}
                        className="font-semibold text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        {application.job.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {organization?.slug ? (
                          <Link
                            href={`/dashboard/organizations/${organization.slug}`}
                            className="hover:text-primary-600 dark:hover:text-primary-400"
                          >
                            {organization.name}
                          </Link>
                        ) : organization ? (
                          <span>{organization.name}</span>
                        ) : null}
                        {organization && place && <span>•</span>}
                        {place && (
                          <span className="flex items-center">
                            <MapPin className="w-3.5 h-3.5 mr-1" />
                            {place}
                          </span>
                        )}
                        {(organization || place) && <span>•</span>}
                        <span>{JOB_TYPE_LABELS[application.job.type] || application.job.type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center justify-between lg:justify-end gap-4">
                    <div
                      className={`flex items-center space-x-2 px-3 py-1.5 rounded-full ${status.color}`}
                    >
                      <StatusIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">{status.label}</span>
                    </div>

                    {/* Applied Date */}
                    <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                      <Clock className="w-4 h-4 mr-1" />
                      {/* JobApplication has appliedAt and no createdAt, so
                          this read "Applied Invalid Date" on every row. */}
                      Applied {formatRelativeTime(application.appliedAt)}
                    </div>
                  </div>
                </div>

                {/* Status Description & Actions */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {status.description}
                  </p>
                  <div className="flex items-center space-x-3">
                    {/* A "Schedule" button sat here doing nothing. There is no
                        interview-scheduling capability: no endpoint under
                        /jobs or /employer creates an interview, and the
                        Application model carries no interview time to show or
                        change. The employer arranges the time off-platform, so
                        the status description is the whole truth here. */}
                    {application.status === 'OFFERED' && (
                      <button
                        className="btn-primary text-sm py-1.5 disabled:opacity-60"
                        disabled={updateApplication.isPending}
                        onClick={() =>
                          updateApplication.mutate({
                            applicationId: application.id,
                            status: 'ACCEPTED',
                          })
                        }
                      >
                        Accept Offer
                      </button>
                    )}
                    {/* Withdrawable until a decision is recorded either way, which
                        is what the server allows — not just while PENDING. */}
                    {['PENDING', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED'].includes(
                      application.status
                    ) && (
                      <button
                        className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-60"
                        disabled={updateApplication.isPending}
                        onClick={() => {
                          if (!window.confirm('Withdraw this application? The employer will be told. You can apply again while the job is still open.')) {
                            return;
                          }
                          updateApplication.mutate({
                            applicationId: application.id,
                            status: 'WITHDRAWN',
                          });
                        }}
                      >
                        Withdraw
                      </button>
                    )}
                    {application.resumeUrl && (
                      <button
                        type="button"
                        onClick={() => downloadResume(application)}
                        disabled={fetchingResumeFor === application.id}
                        className="flex items-center text-sm text-slate-600 dark:text-slate-300 hover:underline disabled:opacity-60"
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        {fetchingResumeFor === application.id ? 'Fetching…' : 'Your résumé'}
                      </button>
                    )}
                    <Link
                      href={`/dashboard/jobs/${application.job.id}`}
                      className="flex items-center text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      View Job
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Cover Letter Preview */}
                {application.coverLetter && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center space-x-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>View Cover Letter</span>
                    </summary>
                    <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {application.coverLetter}
                    </div>
                  </details>
                )}

                {/* Referees for this application, while it is still live. */}
                {!['REJECTED', 'WITHDRAWN'].includes(application.status) && <ReferencesPanel applicationId={application.id} />}
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !isError && applicationsQuery.hasNextPage && (
        <div className="flex flex-col items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <p>
            Showing your newest {applications.length} of {totalApplications} applications.
          </p>
          <button
            type="button"
            onClick={() => applicationsQuery.fetchNextPage()}
            disabled={applicationsQuery.isFetchingNextPage}
            className="btn-outline px-4 py-2 disabled:opacity-60"
          >
            {applicationsQuery.isFetchingNextPage ? 'Loading…' : 'Show older applications'}
          </button>
        </div>
      )}

      {/* Tips Card */}
      <div className="card bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 border-primary-200 dark:border-primary-800">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
          💡 Application Tips
        </h3>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
            <span>
              Customize your cover letter for each application to stand out
            </span>
          </li>
          <li className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
            <span>
              Use the Resume Optimizer AI tool to tailor your resume for each job
            </span>
          </li>
          <li className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
            <span>
              Follow up professionally if you haven't heard back after a week
            </span>
          </li>
          <li className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
            <span>
              Prepare for interviews using our Interview Coach AI tool
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
