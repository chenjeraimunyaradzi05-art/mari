'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import { useMyApplications } from '@/lib/hooks';
import { formatRelativeTime, JOB_TYPE_LABELS } from '@/lib/utils';

const statusConfig = {
  PENDING: {
    label: 'Pending Review',
    icon: Clock4,
    color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
    description: 'Your application is being reviewed',
  },
  REVIEWING: {
    label: 'Under Review',
    icon: FileText,
    color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    description: 'The hiring team is reviewing your application',
  },
  INTERVIEW: {
    label: 'Interview Stage',
    icon: Calendar,
    color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
    description: 'You have been selected for an interview',
  },
  OFFERED: {
    label: 'Offer Extended',
    icon: CheckCircle2,
    color: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    description: 'Congratulations! You received an offer',
  },
  REJECTED: {
    label: 'Not Selected',
    icon: XCircle,
    color: 'text-red-600 bg-red-100 dark:bg-red-900/30',
    description: 'The position has been filled',
  },
  WITHDRAWN: {
    label: 'Withdrawn',
    icon: XCircle,
    color: 'text-gray-600 bg-gray-100 dark:bg-gray-900/30',
    description: 'You withdrew this application',
  },
};

type ApplicationStatus = keyof typeof statusConfig;

export default function ApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { data: applications, isLoading } = useMyApplications();

  const filteredApplications = applications?.filter((app: any) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      app.job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.job.organization.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusCounts = applications?.reduce((acc: any, app: any) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {}) || {};

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Applications
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
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
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {applications?.length || 0}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Total Applications
          </div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-blue-600">
            {statusCounts['REVIEWING'] || 0}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Under Review
          </div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-purple-600">
            {statusCounts['INTERVIEW'] || 0}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Interviews
          </div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-green-600">
            {statusCounts['OFFERED'] || 0}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Offers
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
              placeholder="Search by job title or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-primary-500"
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
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredApplications?.length === 0 ? (
        <div className="card text-center py-12">
          <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No applications found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {statusFilter !== 'all'
              ? 'No applications match the selected filter'
              : "You haven't applied to any jobs yet"}
          </p>
          <Link href="/dashboard/jobs" className="btn-primary inline-block">
            Browse Jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApplications?.map((application: any) => {
            const status = statusConfig[application.status as ApplicationStatus];
            const StatusIcon = status.icon;

            return (
              <div
                key={application.id}
                className="card hover:border-primary-200 dark:hover:border-primary-800 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Company Logo & Job Info */}
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                      {application.job.organization.logo ? (
                        <img
                          src={application.job.organization.logo}
                          alt={application.job.organization.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/dashboard/jobs/${application.job.id}`}
                        className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        {application.job.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <Link
                          href={`/dashboard/organizations/${application.job.organization.slug}`}
                          className="hover:text-primary-600 dark:hover:text-primary-400"
                        >
                          {application.job.organization.name}
                        </Link>
                        <span>•</span>
                        <span className="flex items-center">
                          <MapPin className="w-3.5 h-3.5 mr-1" />
                          {application.job.location}
                        </span>
                        <span>•</span>
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
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="w-4 h-4 mr-1" />
                      Applied {formatRelativeTime(application.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Status Description & Actions */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {status.description}
                  </p>
                  <div className="flex items-center space-x-3">
                    {application.status === 'INTERVIEW' && (
                      <button className="btn-outline text-sm py-1.5 flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Schedule</span>
                      </button>
                    )}
                    {application.status === 'OFFERED' && (
                      <>
                        <button className="btn-outline text-sm py-1.5">
                          View Offer
                        </button>
                        <button className="btn-primary text-sm py-1.5">
                          Accept Offer
                        </button>
                      </>
                    )}
                    {['PENDING', 'REVIEWING'].includes(application.status) && (
                      <button className="text-red-600 hover:text-red-700 text-sm font-medium">
                        Withdraw
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
                    <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center space-x-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>View Cover Letter</span>
                    </summary>
                    <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                      {application.coverLetter}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tips Card */}
      <div className="card bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 border-primary-200 dark:border-primary-800">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
          💡 Application Tips
        </h3>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
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
