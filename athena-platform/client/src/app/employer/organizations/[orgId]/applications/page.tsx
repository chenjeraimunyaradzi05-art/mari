'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Search,
  Filter,
  Eye,
  MessageSquare,
  Calendar,
  ArrowLeft,
  User,
  Briefcase,
  ChevronDown,
  Star,
  Check,
  X,
  Clock,
  Download,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface Application {
  id: string;
  status: string;
  coverLetter: string;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  job: {
    id: string;
    title: string;
  };
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profile: {
      avatar: string | null;
      headline: string;
      resumeUrl: string | null;
    } | null;
  };
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Pending Review', color: 'bg-gray-100 text-gray-700', icon: Clock },
  REVIEWING: { label: 'Under Review', color: 'bg-blue-100 text-blue-700', icon: Eye },
  SHORTLISTED: { label: 'Shortlisted', color: 'bg-purple-100 text-purple-700', icon: Star },
  INTERVIEW: { label: 'Interview Stage', color: 'bg-indigo-100 text-indigo-700', icon: MessageSquare },
  OFFERED: { label: 'Offer Extended', color: 'bg-green-100 text-green-700', icon: Check },
  HIRED: { label: 'Hired', color: 'bg-emerald-100 text-emerald-700', icon: Check },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: X },
  WITHDRAWN: { label: 'Withdrawn', color: 'bg-orange-100 text-orange-700', icon: X },
};

const statusOrder = ['PENDING', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN'];

export default function ApplicationsPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const orgId = params.orgId as string;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<string | null>(null);

  const { data: applicationsData, isLoading } = useQuery({
    queryKey: ['employer-applications', orgId],
    queryFn: async () => {
      const response = await api.get(`/employer/organizations/${orgId}/applications`, {
        params: { limit: 100 },
      });
      return response.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: string; status: string }) => {
      const response = await api.patch(`/employer/applications/${applicationId}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employer-applications', orgId] });
      toast.success('Application status updated');
      setStatusDropdownOpen(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update status');
    },
  });

  const applications: Application[] = applicationsData?.data?.applications || [];

  // Get unique jobs for filter
  const uniqueJobs = Array.from(new Map(applications.map((app) => [app.job.id, app.job])).values());

  // Filter applications
  const filteredApplications = applications.filter((app) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesJob = jobFilter === 'all' || app.job.id === jobFilter;
    const matchesSearch =
      search === '' ||
      `${app.user.firstName} ${app.user.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      app.job.title.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesJob && matchesSearch;
  });

  // Status counts for pipeline view
  const statusCounts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Back Button */}
      <Link
        href={`/employer/organizations/${orgId}`}
        className="inline-flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="h-7 w-7 text-blue-600" />
          Applications
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Review and manage candidate applications
        </p>
      </div>

      {/* Pipeline Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {statusOrder.slice(0, 6).map((status) => {
            const config = statusConfig[status];
            const Icon = config.icon;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                className={`flex-1 min-w-[120px] p-3 rounded-lg border-2 transition ${
                  statusFilter === status
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-gray-500" />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {statusCounts[status] || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-500 text-center">{config.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-10"
            placeholder="Search candidates or jobs..."
          />
        </div>
        <select
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
          className="input w-full md:w-48"
        >
          <option value="all">All Jobs</option>
          {uniqueJobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-full md:w-48"
        >
          <option value="all">All Status</option>
          {statusOrder.map((status) => (
            <option key={status} value={status}>
              {statusConfig[status].label}
            </option>
          ))}
        </select>
      </div>

      {/* Applications Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List View */}
        <div className={`${selectedApp ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No applications found
              </h3>
              <p className="text-gray-500">
                {applications.length === 0
                  ? 'When candidates apply to your jobs, they will appear here'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApplications.map((app) => {
                const config = statusConfig[app.status];
                const Icon = config.icon;

                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md transition ${
                      selectedApp?.id === app.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        {app.user.profile?.avatar ? (
                          <img
                            src={app.user.profile.avatar}
                            alt=""
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-6 w-6 text-gray-400" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                            {app.user.firstName} {app.user.lastName}
                          </h3>
                          {app.rating && (
                            <div className="flex items-center gap-1 text-yellow-500">
                              <Star className="h-4 w-4 fill-current" />
                              <span className="text-sm">{app.rating}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {app.user.profile?.headline || app.user.email}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {app.job.title}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusDropdownOpen(statusDropdownOpen === app.id ? null : app.id);
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}
                        >
                          <Icon className="h-3 w-3" />
                          {config.label}
                          <ChevronDown className="h-3 w-3" />
                        </button>

                        {statusDropdownOpen === app.id && (
                          <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                            {statusOrder.map((status) => {
                              const statusCfg = statusConfig[status];
                              const StatusIcon = statusCfg.icon;
                              return (
                                <button
                                  key={status}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatusMutation.mutate({ applicationId: app.id, status });
                                  }}
                                  disabled={app.status === status}
                                  className={`flex items-center gap-2 px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                    app.status === status ? 'opacity-50' : ''
                                  }`}
                                >
                                  <StatusIcon className="h-4 w-4" />
                                  {statusCfg.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedApp && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 h-fit sticky top-6">
            <button
              onClick={() => setSelectedApp(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Candidate Info */}
            <div className="text-center mb-6">
              <div className="h-20 w-20 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
                {selectedApp.user.profile?.avatar ? (
                  <img
                    src={selectedApp.user.profile.avatar}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-gray-400" />
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedApp.user.firstName} {selectedApp.user.lastName}
              </h2>
              <p className="text-gray-500">{selectedApp.user.profile?.headline}</p>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 mb-6">
              <Link href={`/profile/${selectedApp.user.id}`} className="flex-1">
                <Button variant="outline" className="w-full">
                  <Eye className="h-4 w-4 mr-2" />
                  View Profile
                </Button>
              </Link>
              {selectedApp.user.profile?.resumeUrl && (
                <a href={selectedApp.user.profile.resumeUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
              )}
            </div>

            {/* Application Details */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Applied For
                </h4>
                <p className="text-gray-900 dark:text-white">{selectedApp.job.title}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Applied
                </h4>
                <p className="text-gray-900 dark:text-white">
                  {new Date(selectedApp.createdAt).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>

              {selectedApp.coverLetter && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cover Letter
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm whitespace-pre-wrap">
                    {selectedApp.coverLetter}
                  </p>
                </div>
              )}

              {selectedApp.notes && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm whitespace-pre-wrap">
                    {selectedApp.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
