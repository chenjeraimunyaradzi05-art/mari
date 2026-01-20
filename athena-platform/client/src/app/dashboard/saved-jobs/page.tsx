'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  Building2,
  MapPin,
  Clock,
  DollarSign,
  Trash2,
  ExternalLink,
  Search,
  Filter,
  SortAsc,
} from 'lucide-react';
import { useSavedJobs, useUnsaveJob } from '@/lib/hooks';
import { formatRelativeTime, formatSalary, JOB_TYPE_LABELS } from '@/lib/utils';

export default function SavedJobsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'salary' | 'company'>('recent');
  const { data: savedJobs, isLoading } = useSavedJobs();
  const { mutate: unsaveJob, isPending: isUnsaving } = useUnsaveJob();

  const filteredJobs = savedJobs
    ?.filter((job: any) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        job.title.toLowerCase().includes(query) ||
        job.organization?.name.toLowerCase().includes(query) ||
        job.location?.toLowerCase().includes(query)
      );
    })
    .sort((a: any, b: any) => {
      switch (sortBy) {
        case 'salary':
          return (b.salaryMax || 0) - (a.salaryMax || 0);
        case 'company':
          return (a.organization?.name || '').localeCompare(b.organization?.name || '');
        default:
          return new Date(b.savedAt || b.createdAt).getTime() - new Date(a.savedAt || a.createdAt).getTime();
      }
    });

  const handleUnsave = (jobId: string) => {
    if (confirm('Remove this job from your saved list?')) {
      unsaveJob(jobId);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Bookmark className="w-6 h-6 text-primary-500" />
            <span>Saved Jobs</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Jobs you've bookmarked for later
          </p>
        </div>
        <Link href="/dashboard/jobs" className="btn-primary">
          Browse More Jobs
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {savedJobs?.length || 0}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Saved Jobs
          </div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">
            {savedJobs?.filter((j: any) => j.status === 'OPEN').length || 0}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Still Open
          </div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {savedJobs?.filter((j: any) => {
              const savedDate = new Date(j.savedAt || j.createdAt);
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              return savedDate > weekAgo;
            }).length || 0}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Saved This Week
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search saved jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center space-x-2">
            <SortAsc className="w-5 h-5 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'salary' | 'company')}
              className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary-500"
            >
              <option value="recent">Recently Saved</option>
              <option value="salary">Highest Salary</option>
              <option value="company">Company Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredJobs?.length === 0 ? (
        <div className="card text-center py-12">
          <Bookmark className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchQuery ? 'No matching jobs found' : 'No saved jobs yet'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchQuery
              ? 'Try adjusting your search'
              : 'Start exploring jobs and save ones that interest you'}
          </p>
          <Link href="/dashboard/jobs" className="btn-primary inline-block">
            Browse Jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs?.map((job: any) => (
            <div
              key={job.id}
              className="card hover:border-primary-200 dark:hover:border-primary-800 transition"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Company Logo & Job Info */}
                <div className="flex items-start space-x-4 flex-1">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {job.organization?.logo ? (
                      <img
                        src={job.organization.logo}
                        alt={job.organization.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/dashboard/jobs/${job.id}`}
                      className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 text-lg"
                    >
                      {job.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <Link
                        href={`/dashboard/organizations/${job.organization?.slug}`}
                        className="hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        {job.organization?.name}
                      </Link>
                      <span>•</span>
                      <span className="flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-1" />
                        {job.location}
                      </span>
                      <span>•</span>
                      <span>{JOB_TYPE_LABELS[job.type] || job.type}</span>
                    </div>
                    {(job.salaryMin || job.salaryMax) && (
                      <div className="flex items-center text-sm text-green-600 dark:text-green-400 mt-2">
                        <DollarSign className="w-4 h-4 mr-1" />
                        {job.salaryMin && job.salaryMax
                          ? `${formatSalary(job.salaryMin)} - ${formatSalary(job.salaryMax)}`
                          : job.salaryMax
                          ? `Up to ${formatSalary(job.salaryMax)}`
                          : `From ${formatSalary(job.salaryMin)}`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    Saved {formatRelativeTime(job.savedAt || job.createdAt)}
                  </div>
                  <button
                    onClick={() => handleUnsave(job.id)}
                    disabled={isUnsaving}
                    className="p-2 text-gray-400 hover:text-red-500 transition"
                    title="Remove from saved"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <Link
                    href={`/dashboard/jobs/${job.id}`}
                    className="btn-primary text-sm flex items-center space-x-1"
                  >
                    <span>View</span>
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Skills Tags */}
              {job.skills && job.skills.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex flex-wrap gap-2">
                    {job.skills.slice(0, 5).map((skill: string, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                    {job.skills.length > 5 && (
                      <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                        +{job.skills.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      {savedJobs?.length > 0 && (
        <div className="card bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            💡 Pro Tip
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Don't wait too long to apply! Jobs with high match scores tend to fill quickly.
            Use the Resume Optimizer to tailor your application for each role.
          </p>
        </div>
      )}
    </div>
  );
}
