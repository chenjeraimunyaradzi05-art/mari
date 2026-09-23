'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search,
  MapPin,
  Briefcase,
  Building2,
  Clock,
  DollarSign,
  Filter,
  X,
  Bookmark,
} from 'lucide-react';
import { useJobs, useSavedJobs, useSaveJob, useUnsaveJob } from '@/lib/hooks';
import type { JobSearchResult } from '@/lib/hooks';
import { formatRelativeTime, formatSalaryRange, cn } from '@/lib/utils';

// These are the six values the JobType enum actually holds. The list used to
// offer "Freelance", which is not one of them, so ticking it asked Prisma for
// an enum member that does not exist and the search came back as a 500.
const jobTypes = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'CASUAL', label: 'Casual' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'APPRENTICESHIP', label: 'Apprenticeship' },
];

const jobTypeLabels: Record<string, string> = Object.fromEntries(
  jobTypes.map((type) => [type.value, type.label])
);

// The bands the jobs route reads; a posting matches one when the years of
// experience it asks for overlap the band.
const experienceLevels = [
  { value: 'entry', label: 'Entry Level' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'senior', label: 'Senior Level' },
  { value: 'lead', label: 'Lead / Manager' },
  { value: 'executive', label: 'Executive' },
];

const sortOptions = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'recent', label: 'Most Recent' },
  { value: 'salary_high', label: 'Highest Salary' },
  { value: 'salary_low', label: 'Lowest Salary' },
];

const salaryRanges: { value: string; label: string; min?: number; max?: number }[] = [
  { value: '', label: 'Any' },
  { value: '0-50000', label: 'Under $50,000', max: 50000 },
  { value: '50000-80000', label: '$50,000 - $80,000', min: 50000, max: 80000 },
  { value: '80000-120000', label: '$80,000 - $120,000', min: 80000, max: 120000 },
  { value: '120000-150000', label: '$120,000 - $150,000', min: 120000, max: 150000 },
  { value: '150000+', label: '$150,000+', min: 150000 },
];

const PAGE_SIZE = 20;

export default function JobsPage() {
  return (
    <Suspense fallback={null}>
      <JobsContent />
    </Suspense>
  );
}

function JobsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // What she has actually searched for lives in the URL, so a page of results
  // can be shared or reloaded, and typing in the box does not fire a request
  // per keystroke. The inputs below start from it and catch up on submit.
  const appliedQuery = searchParams.get('q') || '';
  const appliedLocation = searchParams.get('location') || '';

  const [searchQuery, setSearchQuery] = useState(appliedQuery);
  const [location, setLocation] = useState(appliedLocation);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [salaryRange, setSalaryRange] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');
  const [page, setPage] = useState(1);

  const selectedSalary = salaryRanges.find((range) => range.value === salaryRange);

  const { data, isLoading } = useJobs({
    search: appliedQuery || undefined,
    city: appliedLocation || undefined,
    type: selectedTypes.length ? selectedTypes.join(',') : undefined,
    experience: selectedLevels.length ? selectedLevels.join(',') : undefined,
    sort: sortBy,
    salaryMin: selectedSalary?.min,
    salaryMax: selectedSalary?.max,
    page,
    limit: PAGE_SIZE,
  });

  const { data: savedJobs } = useSavedJobs();
  const saveJobMutation = useSaveJob();
  const unsaveJobMutation = useUnsaveJob();
  const savedJobIds = new Set((savedJobs || []).map((job: { id: string }) => job.id));

  const jobs = data?.jobs ?? [];
  const pagination = data?.pagination;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (location) params.set('location', location);
    const queryString = params.toString();
    setPage(1);
    router.push(queryString ? `/dashboard/jobs?${queryString}` : '/dashboard/jobs');
  };

  // Every filter change puts her back on the first page: page four of the old
  // result set is rarely page four of the new one, and is often past its end.
  const toggleType = (type: string) => {
    setPage(1);
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleLevel = (level: string) => {
    setPage(1);
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const changeSalaryRange = (value: string) => {
    setPage(1);
    setSalaryRange(value);
  };

  const changeSort = (value: string) => {
    setPage(1);
    setSortBy(value);
  };

  const clearFilters = () => {
    setSelectedTypes([]);
    setSelectedLevels([]);
    setSalaryRange('');
    setSearchQuery('');
    setLocation('');
    setPage(1);
    router.push('/dashboard/jobs');
  };

  const hasFilters =
    selectedTypes.length > 0 ||
    selectedLevels.length > 0 ||
    Boolean(salaryRange) ||
    Boolean(appliedQuery) ||
    Boolean(appliedLocation);

  const activeFilterCount =
    selectedTypes.length + selectedLevels.length + (salaryRange ? 1 : 0);

  const describeLocation = (job: JobSearchResult) => {
    if (job.isRemote) return 'Remote';
    const parts = [job.city, job.state].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Location not stated';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Find Your Dream Job</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Discover opportunities matched to your skills and goals
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Job title, skills, or company"
              className="input pl-10 w-full"
            />
          </div>
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or suburb"
              className="input pl-10 w-full"
            />
          </div>
          <button type="submit" className="btn-primary px-8">
            Search
          </button>
        </div>
      </form>

      {/* Filters Bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'btn-outline flex items-center space-x-2',
              showFilters && 'bg-primary-50 border-primary-500'
            )}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Quick filter chips */}
          <div className="hidden sm:flex items-center space-x-2">
            {jobTypes.slice(0, 3).map((type) => (
              <button
                key={type.value}
                onClick={() => toggleType(type.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition',
                  selectedTypes.includes(type.value)
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                )}
              >
                {type.label}
              </button>
            ))}
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center space-x-1"
            >
              <X className="w-4 h-4" />
              <span>Clear all</span>
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => changeSort(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="card mb-6">
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {/* Job Type */}
            <div>
              <label className="text-sm font-medium text-slate-900 dark:text-white mb-2 block">
                Job Type
              </label>
              <div className="space-y-2">
                {jobTypes.map((type) => (
                  <label key={type.value} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type.value)}
                      onChange={() => toggleType(type.value)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Experience Level */}
            <div>
              <label className="text-sm font-medium text-slate-900 dark:text-white mb-2 block">
                Experience Level
              </label>
              <div className="space-y-2">
                {experienceLevels.map((level) => (
                  <label key={level.value} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLevels.includes(level.value)}
                      onChange={() => toggleLevel(level.value)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{level.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Salary Range */}
            <div>
              <label
                htmlFor="salary-range"
                className="text-sm font-medium text-slate-900 dark:text-white mb-2 block"
              >
                Salary Range
              </label>
              <div className="space-y-2">
                <select
                  id="salary-range"
                  value={salaryRange}
                  onChange={(e) => changeSalaryRange(e.target.value)}
                  className="input text-sm"
                >
                  {salaryRanges.map((range) => (
                    <option key={range.value} value={range.value}>
                      {range.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  Only listings that publish a salary can be filtered this way.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="space-y-4">
        {/* Results count */}
        {data && (
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Showing {jobs.length} of {data.total} jobs
          </div>
        )}

        {isLoading ? (
          // Loading skeleton
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : jobs.length > 0 ? (
          <div className="space-y-4">
            {jobs.map((job) => {
              const skillNames = (job.skills ?? []).map((entry) => entry.skill.name);

              return (
                <Link
                  key={job.id}
                  href={`/dashboard/jobs/${job.id}`}
                  className="card hover:shadow-md transition group block"
                >
                  <div className="flex items-start space-x-4">
                    {/* Company logo */}
                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      {job.organization?.logo ? (
                        <Image
                          src={job.organization.logo}
                          alt={job.organization.name || 'Company logo'}
                          width={40}
                          height={40}
                          unoptimized
                          className="w-10 h-10 object-contain"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    {/* Job details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-primary-600 transition">
                            {job.title}
                          </h3>
                          <p className="text-slate-600 dark:text-slate-400">
                            {job.organization?.name}
                          </p>
                        </div>

                        {job.hasApplied && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                            Applied
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                        <span className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {describeLocation(job)}
                        </span>
                        <span className="flex items-center">
                          <Briefcase className="w-4 h-4 mr-1" />
                          {jobTypeLabels[job.type] || job.type}
                        </span>
                        {(job.salaryMin || job.salaryMax) && (
                          <span className="flex items-center">
                            <DollarSign className="w-4 h-4 mr-1" />
                            {formatSalaryRange(job.salaryMin ?? undefined, job.salaryMax ?? undefined)}
                          </span>
                        )}
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatRelativeTime(job.createdAt)}
                        </span>
                      </div>

                      {/* Skills */}
                      {skillNames.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {skillNames.slice(0, 5).map((skill) => (
                            <span
                              key={skill}
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs"
                            >
                              {skill}
                            </span>
                          ))}
                          {skillNames.length > 5 && (
                            <span className="px-2 py-1 text-slate-500 text-xs">
                              +{skillNames.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          const isSaved = savedJobIds.has(job.id);
                          if (isSaved) {
                            unsaveJobMutation.mutate(job.id);
                          } else {
                            saveJobMutation.mutate(job.id);
                          }
                        }}
                        disabled={saveJobMutation.isPending || unsaveJobMutation.isPending}
                        aria-label={savedJobIds.has(job.id) ? 'Remove from saved jobs' : 'Save job'}
                        className={cn(
                          'p-2 transition disabled:opacity-50',
                          savedJobIds.has(job.id)
                            ? 'text-primary-600 hover:text-primary-700'
                            : 'text-slate-400 hover:text-primary-600'
                        )}
                      >
                        <Bookmark className={cn('w-5 h-5', savedJobIds.has(job.id) && 'fill-current')} />
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card text-center py-12">
            <Briefcase className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No jobs found
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Try adjusting your search or filters
            </p>
            <button onClick={clearFilters} className="btn-primary">
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="mt-8 flex items-center justify-center space-x-2">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={pagination.page === 1}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}
            disabled={pagination.page === pagination.pages}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
