'use client';

import { useState } from 'react';
import Link from 'next/link';
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
  ChevronDown,
  Bookmark,
  ExternalLink,
  Target,
} from 'lucide-react';
import { useJobs, useSavedJobs, useSaveJob, useUnsaveJob } from '@/lib/hooks';
import { formatRelativeTime, formatSalaryRange, JOB_TYPE_LABELS, cn } from '@/lib/utils';

const jobTypes = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'FREELANCE', label: 'Freelance' },
  { value: 'INTERNSHIP', label: 'Internship' },
];

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

export default function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');

  const { data, isLoading, error } = useJobs({
    q: searchQuery,
    location,
    type: selectedTypes.join(','),
    experience: selectedLevels.join(','),
    sort: sortBy,
    page: 1,
    limit: 20,
  });

  const { data: savedJobs } = useSavedJobs();
  const saveJobMutation = useSaveJob();
  const unsaveJobMutation = useUnsaveJob();
  const savedJobIds = new Set((savedJobs || []).map((job: any) => job.id));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Update URL params
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (location) params.set('location', location);
    router.push(`/dashboard/jobs?${params.toString()}`);
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleLevel = (level: string) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const clearFilters = () => {
    setSelectedTypes([]);
    setSelectedLevels([]);
    setSearchQuery('');
    setLocation('');
  };

  const hasFilters = selectedTypes.length > 0 || selectedLevels.length > 0 || searchQuery || location;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Find Your Dream Job</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Discover opportunities matched to your skills and goals
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Job title, skills, or company"
              className="input pl-10 w-full"
            />
          </div>
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, state, or remote"
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
            {hasFilters && (
              <span className="w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center">
                {selectedTypes.length + selectedLevels.length}
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
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                {type.label}
              </button>
            ))}
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1"
            >
              <X className="w-4 h-4" />
              <span>Clear all</span>
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900"
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
              <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                Job Type
              </label>
              <div className="space-y-2">
                {jobTypes.map((type) => (
                  <label key={type.value} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type.value)}
                      onChange={() => toggleType(type.value)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Experience Level */}
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                Experience Level
              </label>
              <div className="space-y-2">
                {experienceLevels.map((level) => (
                  <label key={level.value} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLevels.includes(level.value)}
                      onChange={() => toggleLevel(level.value)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{level.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Salary Range */}
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                Salary Range
              </label>
              <div className="space-y-2">
                <select className="input text-sm">
                  <option value="">Any</option>
                  <option value="0-50000">Under $50,000</option>
                  <option value="50000-80000">$50,000 - $80,000</option>
                  <option value="80000-120000">$80,000 - $120,000</option>
                  <option value="120000-150000">$120,000 - $150,000</option>
                  <option value="150000+">$150,000+</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="space-y-4">
        {/* Results count */}
        {data && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {data.jobs?.length || 0} of {data.total || 0} jobs
          </div>
        )}

        {isLoading ? (
          // Loading skeleton
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : data?.jobs?.length ? (
          <div className="space-y-4">
            {data.jobs.map((job: any) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}`}
                className="card hover:shadow-md transition group block"
              >
                <div className="flex items-start space-x-4">
                  {/* Company logo */}
                  <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    {job.organization?.logo ? (
                      <img
                        src={job.organization.logo}
                        alt={job.organization.name}
                        className="w-10 h-10 object-contain"
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-gray-400" />
                    )}
                  </div>

                  {/* Job details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 transition">
                          {job.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          {job.organization?.name}
                        </p>
                      </div>
                      
                      {job.matchScore && (
                        <div className="flex items-center space-x-1 text-green-600 text-sm">
                          <Target className="w-4 h-4" />
                          <span>{job.matchScore}% match</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {job.location}
                      </span>
                      <span className="flex items-center">
                        <Briefcase className="w-4 h-4 mr-1" />
                        {JOB_TYPE_LABELS[job.type] || job.type}
                      </span>
                      {(job.salaryMin || job.salaryMax) && (
                        <span className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-1" />
                          {formatSalaryRange(job.salaryMin, job.salaryMax)}
                        </span>
                      )}
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatRelativeTime(job.createdAt)}
                      </span>
                    </div>

                    {/* Skills */}
                    {job.requiredSkills?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {job.requiredSkills.slice(0, 5).map((skill: string) => (
                          <span
                            key={skill}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs"
                          >
                            {skill}
                          </span>
                        ))}
                        {job.requiredSkills.length > 5 && (
                          <span className="px-2 py-1 text-gray-500 text-xs">
                            +{job.requiredSkills.length - 5} more
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
                          : 'text-gray-400 hover:text-primary-600'
                      )}
                    >
                      <Bookmark className={cn('w-5 h-5', savedJobIds.has(job.id) && 'fill-current')} />
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <Briefcase className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No jobs found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Try adjusting your search or filters
            </p>
            <button onClick={clearFilters} className="btn-primary">
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data?.pagination && data.pagination.pages > 1 && (
        <div className="mt-8 flex items-center justify-center space-x-2">
          <button
            disabled={data.pagination.page === 1}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {data.pagination.page} of {data.pagination.pages}
          </span>
          <button
            disabled={data.pagination.page === data.pagination.pages}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
