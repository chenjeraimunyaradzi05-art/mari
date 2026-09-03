'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  Globe,
  Users,
  Building,
  Calendar,
  Briefcase,
  ExternalLink,
  ArrowLeft,
  Star,
  ArrowUpRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { organizationApi, jobApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { Loading, CardSkeleton } from '@/components/ui/loading';
import { Badge } from '@/components/ui/badge';

export default function OrganizationDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const { data: org, isLoading: loadingOrg } = useQuery({
    queryKey: ['organization', slug],
    queryFn: () => organizationApi.getBySlug(slug),
    select: (response) => response.data.data,
    enabled: !!slug,
  });

  const { data: orgListData } = useQuery({
    queryKey: ['organizations', 'fallback', slug],
    queryFn: () => organizationApi.getAll({ limit: 6 }),
    select: (response) => response.data,
    enabled: !!slug && !loadingOrg,
  });

  const { data: jobsData, isLoading: loadingJobs } = useQuery({
    queryKey: ['organization-jobs', slug],
    queryFn: () => organizationApi.getJobs(slug),
    select: (response) => response.data.data,
    enabled: !!slug,
  });

  if (loadingOrg) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loading />
      </div>
    );
  }

  if (!org) {
    const suggestions = orgListData?.data || [];
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
            Company Not Found
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            The company you're looking for doesn't exist or hasn’t been published yet.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/dashboard/companies" className="btn-primary px-4 py-2">
              Browse Companies
            </Link>
            <Link href="/dashboard/jobs" className="btn-secondary px-4 py-2">
              Browse Jobs
            </Link>
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Suggested organizations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((item: any) => (
                <Link
                  key={item.id}
                  href={`/dashboard/organizations/${item.slug}`}
                  className="flex items-center justify-between gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-primary-500 transition"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {item.industry || item.type || 'Organization'}
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-primary-600" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // `{ success, data: [...], pagination }` — after the `response.data.data`
  // select above, jobsData IS the array. Reading `.jobs` off it meant the
  // page always claimed "No open positions" however many were live.
  const jobs = Array.isArray(jobsData) ? jobsData : [];
  const courses = Array.isArray(org.courses) ? org.courses : [];

  // Organization stores the address in three columns; there is no `location`.
  const location = [org.city, org.state, org.country].filter(Boolean).join(', ');

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
      <div className="card overflow-hidden">
        {/* Cover */}
        <div className="h-32 md:h-48 -mx-6 -mt-6 mb-4 bg-gradient-to-r from-primary-500 to-secondary-500 relative">
          {org.banner && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.banner}
              alt={`${org.name} cover`}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Logo and Info */}
        <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-16 md:-mt-20 relative z-10 px-4">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-white dark:bg-slate-800 rounded-xl border-4 border-white dark:border-slate-900 shadow-lg flex items-center justify-center overflow-hidden">
            {org.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logo}
                alt={org.name}
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <Building className="w-12 h-12 text-slate-400" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {org.name}
                </h1>
                <p className="text-slate-600 dark:text-slate-300">
                  {org.industry}
                </p>
              </div>
              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline px-4 py-2 flex items-center space-x-2"
                >
                  <Globe className="w-4 h-4" />
                  <span>Visit Website</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-6 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
          {location && (
            <span className="flex items-center">
              <MapPin className="w-4 h-4 mr-1" />
              {location}
            </span>
          )}
          {org.size && (
            <span className="flex items-center">
              <Users className="w-4 h-4 mr-1" />
              {org.size} employees
            </span>
          )}
          {/* There is no `founded` column on Organization, so the date that
              used to sit here never rendered. Verification is a real field
              and worth surfacing in its place. */}
          {org.isVerified && (
            <span className="flex items-center text-emerald-600 dark:text-emerald-400">
              <Star className="w-4 h-4 mr-1" />
              Verified
            </span>
          )}
          <span className="flex items-center">
            <Briefcase className="w-4 h-4 mr-1" />
            {jobs.length} open {jobs.length === 1 ? 'position' : 'positions'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              About {org.name}
            </h2>
            <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
              {org.description || 'No description available.'}
            </p>
          </div>

          {/* Courses. The slug endpoint has always included these and nothing
              rendered them. This replaces a "Benefits & Perks" block that read
              an org.benefits column which does not exist. */}
          {courses.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Courses ({courses.length})
              </h2>
              <div className="space-y-3">
                {courses.map((course: any) => (
                  <Link
                    key={course.id}
                    href={`/dashboard/learn/${course.id}`}
                    className="block p-4 border border-slate-100 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                  >
                    <h3 className="font-medium text-slate-900 dark:text-white">{course.title}</h3>
                    {course.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                        {course.description}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Open Positions */}
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Open Positions ({jobs.length})
            </h2>
            {loadingJobs ? (
              <div className="space-y-4">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : jobs.length > 0 ? (
              <div className="space-y-4">
                {jobs.map((job: any) => (
                  <Link
                    key={job.id}
                    href={`/dashboard/jobs/${job.id}`}
                    className="block p-4 border border-slate-100 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900 dark:text-white">
                          {job.title}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {/* Job stores city/state/country and isRemote. There is
                              no `location` or `remote` field, so this line read
                              blank and labelled every role "On-site". */}
                          <span>
                            {job.isRemote
                              ? 'Remote'
                              : [job.city, job.state].filter(Boolean).join(', ') ||
                                'Location not given'}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{String(job.type || '').replace(/_/g, ' ').toLowerCase()}</span>
                        </div>
                      </div>
                      <Badge variant={job.isRemote ? 'success' : 'secondary'}>
                        {job.isRemote ? 'Remote' : 'On-site'}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                No open positions at the moment
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Company Info
            </h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-slate-500 dark:text-slate-400">Industry</dt>
                <dd className="font-medium text-slate-900 dark:text-white">
                  {org.industry || 'Not specified'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500 dark:text-slate-400">Company Size</dt>
                <dd className="font-medium text-slate-900 dark:text-white">
                  {org.size || 'Not specified'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500 dark:text-slate-400">Headquarters</dt>
                <dd className="font-medium text-slate-900 dark:text-white">
                  {location || 'Not specified'}
                </dd>
              </div>
              {org.type && (
                <div>
                  <dt className="text-sm text-slate-500 dark:text-slate-400">Type</dt>
                  <dd className="font-medium capitalize text-slate-900 dark:text-white">
                    {org.type}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* A "Connect" card used to sit here reading org.linkedinUrl and
              org.twitterUrl. Organization has neither column, so the guard was
              always false and the card never rendered. The website is the one
              external link we actually store, and it is already in the header. */}
          {org.website && (
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Connect
              </h2>
              <a
                href={org.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-slate-600 dark:text-slate-300 hover:text-primary-600 transition"
              >
                <span>{org.website.replace(/^https?:\/\//, '')}</span>
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
