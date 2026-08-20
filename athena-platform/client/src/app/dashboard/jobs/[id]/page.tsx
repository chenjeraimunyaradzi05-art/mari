'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  MapPin,
  Briefcase,
  Clock,
  DollarSign,
  Building,
  Users,
  Bookmark,
  Share2,
  ArrowLeft,
  Check,
  ExternalLink,
  Globe,
  Heart,
} from 'lucide-react';
import {
  useJob,
  useApplyToJob,
  useSavedJobs,
  useSaveJob,
  useUnsaveJob,
  useJobRecommendations,
} from '@/lib/hooks';
import {
  formatRelativeTime,
  formatDate,
  formatSalaryRange,
  JOB_TYPE_LABELS,
  cn,
} from '@/lib/utils';
import { Loading } from '@/components/ui/loading';
import { Badge } from '@/components/ui/badge';
import { sanitizeHtml } from '@/lib/utils/sanitize';

type JobLike = Record<string, any>;

function getOrganizationLogo(job: JobLike): string | null {
  return job.organization?.logo || job.organization?.logoUrl || null;
}

function getJobLocation(job: JobLike): string {
  const parts = [job.city, job.state, job.country].filter(Boolean);
  const location = parts.join(', ') || job.location || '';

  if (job.isRemote || job.remote) {
    return location ? `Remote (${location})` : 'Remote';
  }

  return location || 'Location not specified';
}

function getExperienceLabel(job: JobLike): string {
  const min = typeof job.experienceMin === 'number' ? job.experienceMin : null;
  const max = typeof job.experienceMax === 'number' ? job.experienceMax : null;

  if (min !== null && max !== null) return `${min}-${max} years`;
  if (min !== null) return `${min}+ years`;
  if (max !== null) return `Up to ${max} years`;

  return job.experienceLevel || 'Not specified';
}

function getSkillName(skill: any): string {
  if (typeof skill === 'string') return skill;
  return skill?.skill?.name || skill?.name || '';
}

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;
  const { data: job, isLoading, error } = useJob(jobId);
  const { data: savedJobs } = useSavedJobs();
  const {
    data: recommendedJobs,
    isLoading: isLoadingRecommendations,
    isError: recommendationsError,
  } = useJobRecommendations();
  const applyToJob = useApplyToJob();
  const saveJob = useSaveJob();
  const unsaveJob = useUnsaveJob();
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');

  const savedJobIds = useMemo(
    () => new Set((savedJobs || []).map((savedJob: { id: string }) => savedJob.id)),
    [savedJobs]
  );
  const isSaved = savedJobIds.has(jobId) || Boolean(job?.isSaved);
  const isSaving = saveJob.isPending || unsaveJob.isPending;
  const skillNames = useMemo(
    () => (job?.skills || []).map(getSkillName).filter(Boolean),
    [job?.skills]
  );
  const relatedJobs = useMemo(
    () => (recommendedJobs || []).filter((recommendation: JobLike) => recommendation.id !== jobId).slice(0, 3),
    [jobId, recommendedJobs]
  );

  const handleApply = () => {
    applyToJob.mutate(
      { jobId, data: { coverLetter } },
      {
        onSuccess: () => {
          setShowApplyModal(false);
          setCoverLetter('');
        },
      }
    );
  };

  const handleSaveToggle = () => {
    if (isSaving) return;
    if (isSaved) {
      unsaveJob.mutate(jobId);
      return;
    }
    saveJob.mutate(jobId);
  };

  const handleShare = async () => {
    if (!job || typeof window === 'undefined') return;

    const url = `${window.location.origin}/dashboard/jobs/${jobId}`;
    const title = `${job.title}${job.organization?.name ? ` at ${job.organization.name}` : ''}`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      toast.success('Job link copied');
    } catch (shareError: any) {
      if (shareError?.name !== 'AbortError') {
        toast.error('Unable to share job');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loading />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Job Not Found
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          The job you're looking for doesn't exist or has been removed.
        </p>
        <Link href="/dashboard/jobs" className="btn-primary px-4 py-2">
          Browse Jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Back Button */}
      <Link
        href="/dashboard/jobs"
        className="inline-flex items-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Jobs
      </Link>

      {/* Header */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
              {getOrganizationLogo(job) ? (
                <img
                  src={getOrganizationLogo(job)!}
                  alt={job.organization?.name || 'Company logo'}
                  className="w-12 h-12 rounded-lg object-contain"
                />
              ) : (
                <Building className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {job.title}
              </h1>
              {job.organization?.slug ? (
                <Link
                  href={`/dashboard/organizations/${job.organization.slug}`}
                  className="text-lg text-primary-600 hover:underline"
                >
                  {job.organization?.name || 'Company not listed'}
                </Link>
              ) : (
                <p className="text-lg text-slate-600 dark:text-slate-400">
                  {job.organization?.name || 'Company not listed'}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  {getJobLocation(job)}
                </span>
                <span className="flex items-center">
                  <Briefcase className="w-4 h-4 mr-1" />
                  {JOB_TYPE_LABELS[job.type] || job.type}
                </span>
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {formatRelativeTime(job.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSaveToggle}
              disabled={isSaving}
              aria-label={isSaved ? 'Remove from saved jobs' : 'Save job'}
              className={cn(
                'p-2.5 rounded-lg transition disabled:opacity-50',
                isSaved
                  ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
              )}
            >
              <Bookmark className={cn('w-5 h-5', isSaved && 'fill-current')} />
            </button>
            <button
              onClick={handleShare}
              aria-label="Share job"
              className="p-2.5 bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowApplyModal(true)}
              disabled={job.hasApplied}
              className="btn-primary px-6 py-2.5"
            >
              {job.hasApplied ? 'Applied' : 'Apply Now'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Description */}
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Job Description
            </h2>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description || '') }}
                className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap"
              />
            </div>
          </div>

          {/* Requirements */}
          {job.requirements && (
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Requirements
              </h2>
              <ul className="space-y-2">
                {(typeof job.requirements === 'string'
                  ? job.requirements.split('\n')
                  : job.requirements
                ).map((req: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 dark:text-slate-300">{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills */}
          {skillNames.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Required Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {skillNames.map((skill: string) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Benefits */}
          {job.benefits?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Benefits
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {job.benefits.map((benefit: string, index: number) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 text-slate-600 dark:text-slate-300"
                  >
                    <Heart className="w-4 h-4 text-red-400" />
                    <span className="text-sm">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Job Details */}
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Job Details
            </h2>
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Salary</dt>
                <dd className="font-medium text-slate-900 dark:text-white">
                  {job.showSalary === false
                    ? 'Not disclosed'
                    : formatSalaryRange(job.salaryMin ?? undefined, job.salaryMax ?? undefined)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Job Type</dt>
                <dd className="font-medium text-slate-900 dark:text-white">
                  {JOB_TYPE_LABELS[job.type] || job.type}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Experience</dt>
                <dd className="font-medium text-slate-900 dark:text-white">
                  {getExperienceLabel(job)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Remote</dt>
                <dd className="font-medium text-slate-900 dark:text-white">
                  {job.isRemote || job.remote ? 'Yes' : 'No'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Posted</dt>
                <dd className="font-medium text-slate-900 dark:text-white">
                  {formatDate(job.createdAt)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Applicants</dt>
                <dd className="font-medium text-slate-900 dark:text-white">
                  {job._count?.applications || 0}
                </dd>
              </div>
            </dl>
          </div>

          {/* Company Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              About {job.organization?.name}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {job.organization?.description || 'Company description not available.'}
            </p>
            <div className="space-y-2 text-sm">
              {job.organization?.industry && (
                <div className="flex items-center text-slate-500 dark:text-slate-400">
                  <Briefcase className="w-4 h-4 mr-2" />
                  {job.organization.industry}
                </div>
              )}
              {job.organization?.size && (
                <div className="flex items-center text-slate-500 dark:text-slate-400">
                  <Users className="w-4 h-4 mr-2" />
                  {job.organization.size} employees
                </div>
              )}
              {job.organization?.website && (
                <a
                  href={job.organization.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-primary-600 hover:underline"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Visit Website
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              )}
            </div>
            {job.organization?.slug && (
              <Link
                href={`/dashboard/organizations/${job.organization.slug}`}
                className="btn-outline w-full mt-4 text-center"
              >
                View Company Profile
              </Link>
            )}
          </div>

          {/* Recommended Jobs */}
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Recommended Jobs
            </h2>
            {isLoadingRecommendations ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-20 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ))}
              </div>
            ) : recommendationsError ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                Recommendations could not be loaded.
              </p>
            ) : relatedJobs.length > 0 ? (
              <div className="space-y-3">
                {relatedJobs.map((recommendation: JobLike) => (
                  <Link
                    key={recommendation.id}
                    href={`/dashboard/jobs/${recommendation.id}`}
                    className="block rounded-lg border border-slate-200 p-3 transition hover:border-primary-300 hover:bg-primary-50/60 dark:border-slate-800 dark:hover:border-primary-800 dark:hover:bg-primary-950/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {recommendation.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {recommendation.organization?.name || 'Company not listed'}
                        </p>
                      </div>
                      {typeof recommendation.matchScore === 'number' && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          {recommendation.matchScore}%
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center">
                        <MapPin className="mr-1 h-3 w-3" />
                        {getJobLocation(recommendation)}
                      </span>
                      <span className="flex items-center">
                        <DollarSign className="mr-1 h-3 w-3" />
                        {recommendation.showSalary === false
                          ? 'Not disclosed'
                          : formatSalaryRange(
                              recommendation.salaryMin ?? undefined,
                              recommendation.salaryMax ?? undefined
                            )}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                No live recommendations available for this profile yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Apply to {job.title}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
              at {job.organization?.name}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cover Letter (Optional)
                </label>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={6}
                  placeholder="Introduce yourself and explain why you're a great fit for this role..."
                  className="input w-full resize-none"
                />
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <strong>Your resume</strong> and <strong>profile</strong> will be shared
                  with the employer.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowApplyModal(false)}
                className="btn-outline px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={applyToJob.isPending}
                className="btn-primary px-6 py-2"
              >
                {applyToJob.isPending ? 'Applying...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
