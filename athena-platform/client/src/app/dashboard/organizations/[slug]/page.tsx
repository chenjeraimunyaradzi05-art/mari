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
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Company Not Found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
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
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Suggested organizations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((item: any) => (
                <Link
                  key={item.id}
                  href={`/dashboard/organizations/${item.slug}`}
                  className="flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-primary-500 transition"
                >
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{item.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
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

  const jobs = jobsData?.jobs || [];

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
      <div className="card overflow-hidden">
        {/* Cover */}
        <div className="h-32 md:h-48 -mx-6 -mt-6 mb-4 bg-gradient-to-r from-primary-500 to-secondary-500 relative">
          {org.coverUrl && (
            <img
              src={org.coverUrl}
              alt={`${org.name} cover`}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Logo and Info */}
        <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-16 md:-mt-20 relative z-10 px-4">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-white dark:bg-gray-800 rounded-xl border-4 border-white dark:border-gray-900 shadow-lg flex items-center justify-center overflow-hidden">
            {org.logoUrl ? (
              <img
                src={org.logoUrl}
                alt={org.name}
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <Building className="w-12 h-12 text-gray-400" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {org.name}
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
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
        <div className="flex flex-wrap items-center gap-6 mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400">
          {org.location && (
            <span className="flex items-center">
              <MapPin className="w-4 h-4 mr-1" />
              {org.location}
            </span>
          )}
          {org.size && (
            <span className="flex items-center">
              <Users className="w-4 h-4 mr-1" />
              {org.size} employees
            </span>
          )}
          {org.founded && (
            <span className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              Founded {org.founded}
            </span>
          )}
          <span className="flex items-center">
            <Briefcase className="w-4 h-4 mr-1" />
            {jobs.length} open positions
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              About {org.name}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {org.description || 'No description available.'}
            </p>
          </div>

          {/* Culture & Benefits */}
          {org.benefits?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Benefits & Perks
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {org.benefits.map((benefit: string, index: number) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 text-gray-600 dark:text-gray-300"
                  >
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Open Positions */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
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
                    className="block p-4 border border-gray-100 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {job.title}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <span>{job.location}</span>
                          <span>•</span>
                          <span>{job.type}</span>
                        </div>
                      </div>
                      <Badge variant={job.remote ? 'success' : 'secondary'}>
                        {job.remote ? 'Remote' : 'On-site'}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No open positions at the moment
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Company Info
            </h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Industry</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {org.industry || 'Not specified'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Company Size</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {org.size || 'Not specified'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Headquarters</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {org.location || 'Not specified'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Founded</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {org.founded || 'Not specified'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Social Links */}
          {(org.linkedinUrl || org.twitterUrl) && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Connect
              </h2>
              <div className="space-y-2">
                {org.linkedinUrl && (
                  <a
                    href={org.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-gray-600 dark:text-gray-300 hover:text-primary-600 transition"
                  >
                    <span>LinkedIn</span>
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}
                {org.twitterUrl && (
                  <a
                    href={org.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-gray-600 dark:text-gray-300 hover:text-primary-600 transition"
                  >
                    <span>Twitter</span>
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
