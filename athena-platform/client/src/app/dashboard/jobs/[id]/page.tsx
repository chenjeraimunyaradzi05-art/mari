'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  Briefcase,
  Clock,
  DollarSign,
  Building,
  Calendar,
  Users,
  Bookmark,
  Share2,
  ArrowLeft,
  Check,
  ExternalLink,
  Globe,
  Heart,
} from 'lucide-react';
import { useJob, useApplyToJob, useAuth } from '@/lib/hooks';
import { formatCurrency, formatRelativeTime, formatDate, cn } from '@/lib/utils';
import { Loading } from '@/components/ui/loading';
import { Badge } from '@/components/ui/badge';
import { sanitizeHtml } from '@/lib/utils/sanitize';

export default function JobDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const jobId = params.id as string;
  const { data: job, isLoading, error } = useJob(jobId);
  const applyToJob = useApplyToJob();
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [isSaved, setIsSaved] = useState(false);

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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Job Not Found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
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
        className="inline-flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Jobs
      </Link>

      {/* Header */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
              {job.organization?.logoUrl ? (
                <img
                  src={job.organization.logoUrl}
                  alt={job.organization.name}
                  className="w-12 h-12 rounded-lg object-contain"
                />
              ) : (
                <Building className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {job.title}
              </h1>
              <Link
                href={`/dashboard/organizations/${job.organization?.slug}`}
                className="text-lg text-primary-600 hover:underline"
              >
                {job.organization?.name || 'Unknown Company'}
              </Link>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  {job.location}
                </span>
                <span className="flex items-center">
                  <Briefcase className="w-4 h-4 mr-1" />
                  {job.type}
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
              onClick={() => setIsSaved(!isSaved)}
              className={cn(
                'p-2.5 rounded-lg transition',
                isSaved
                  ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
              )}
            >
              <Bookmark className={cn('w-5 h-5', isSaved && 'fill-current')} />
            </button>
            <button className="p-2.5 bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition">
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Job Description
            </h2>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description || '') }}
                className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap"
              />
            </div>
          </div>

          {/* Requirements */}
          {job.requirements && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Requirements
              </h2>
              <ul className="space-y-2">
                {(typeof job.requirements === 'string'
                  ? job.requirements.split('\n')
                  : job.requirements
                ).map((req: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600 dark:text-gray-300">{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills */}
          {job.skills?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Required Skills
              </h2>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill: string, index: number) => (
                  <Badge key={index} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Benefits */}
          {job.benefits?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Benefits
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {job.benefits.map((benefit: string, index: number) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 text-gray-600 dark:text-gray-300"
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Job Details
            </h2>
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Salary</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {job.salaryMin && job.salaryMax
                    ? `${formatCurrency(job.salaryMin)} - ${formatCurrency(job.salaryMax)}`
                    : job.salary || 'Not disclosed'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Job Type</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{job.type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Experience</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {job.experienceLevel || 'Not specified'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Remote</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {job.remote ? 'Yes' : 'No'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Posted</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {formatDate(job.createdAt)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Applicants</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {job._count?.applications || 0}
                </dd>
              </div>
            </dl>
          </div>

          {/* Company Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              About {job.organization?.name}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {job.organization?.description ||
                'A great place to work and grow your career.'}
            </p>
            <div className="space-y-2 text-sm">
              {job.organization?.industry && (
                <div className="flex items-center text-gray-500 dark:text-gray-400">
                  <Briefcase className="w-4 h-4 mr-2" />
                  {job.organization.industry}
                </div>
              )}
              {job.organization?.size && (
                <div className="flex items-center text-gray-500 dark:text-gray-400">
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
            <Link
              href={`/dashboard/organizations/${job.organization?.slug}`}
              className="btn-outline w-full mt-4 text-center"
            >
              View Company Profile
            </Link>
          </div>

          {/* Similar Jobs */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Similar Jobs
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              Similar job recommendations coming soon
            </p>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Apply to {job.title}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              at {job.organization?.name}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
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
