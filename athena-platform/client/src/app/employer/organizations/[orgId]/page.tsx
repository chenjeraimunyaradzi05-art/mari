'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Briefcase,
  Users,
  FileText,
  TrendingUp,
  Settings,
  Plus,
  Eye,
  ChevronRight,
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DashboardStats {
  activeJobs: number;
  totalJobs: number;
  teamMembers: number;
  totalApplications: number;
  recentApplications: number;
  totalViews: number;
  applicationsByStatus: Record<string, number>;
}

interface DashboardData {
  organization: any;
  stats: DashboardStats;
}

export default function OrganizationDashboardPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['employer-dashboard', orgId],
    queryFn: async () => {
      const response = await api.get(`/employer/organizations/${orgId}/dashboard`);
      return response.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) return null;

  const { organization, stats } = data;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Back Button */}
      <Link
        href="/employer"
        className="inline-flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        All Organizations
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            {organization.logo ? (
              <img src={organization.logo} alt={organization.name} className="w-full h-full rounded-xl object-cover" />
            ) : (
              <Building2 className="h-8 w-8 text-white" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {organization.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 capitalize">
              {organization.type} • {organization.city}, {organization.state}
            </p>
          </div>
        </div>
        <Link href={`/employer/organizations/${orgId}/jobs/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Post New Job
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activeJobs}</p>
              <p className="text-sm text-gray-500">Active Jobs</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalApplications}</p>
              <p className="text-sm text-gray-500">Applications</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Eye className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalViews}</p>
              <p className="text-sm text-gray-500">Job Views</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Users className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.teamMembers}</p>
              <p className="text-sm text-gray-500">Team Members</p>
            </div>
          </div>
        </div>
      </div>

      {/* Application Pipeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Application Pipeline
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { status: 'PENDING', label: 'Pending', icon: Clock, color: 'yellow' },
            { status: 'REVIEWED', label: 'Reviewed', icon: Eye, color: 'blue' },
            { status: 'SHORTLISTED', label: 'Shortlisted', icon: CheckCircle, color: 'green' },
            { status: 'INTERVIEW', label: 'Interview', icon: Users, color: 'purple' },
            { status: 'REJECTED', label: 'Rejected', icon: XCircle, color: 'red' },
          ].map(({ status, label, icon: Icon, color }) => (
            <div
              key={status}
              className={`p-4 rounded-lg bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-200 dark:border-${color}-800`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 text-${color}-600`} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.applicationsByStatus[status] || 0}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href={`/employer/organizations/${orgId}/jobs`}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900 dark:text-white">Manage Jobs</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </div>
        </Link>
        <Link
          href={`/employer/organizations/${orgId}/applications`}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-green-600" />
              <span className="font-medium text-gray-900 dark:text-white">Applications</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </div>
        </Link>
        <Link
          href={`/employer/organizations/${orgId}/team`}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-gray-900 dark:text-white">Team</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </div>
        </Link>
        <Link
          href={`/employer/organizations/${orgId}/analytics`}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              <span className="font-medium text-gray-900 dark:text-white">Analytics</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </div>
        </Link>

        {(organization.type === 'university' || organization.type === 'tafe') && (
          <>
            <Link
              href={`/employer/organizations/${orgId}/education/applications`}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-gray-900 dark:text-white">Education Apps</span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </Link>
            <Link
              href={`/employer/organizations/${orgId}/education/outcomes`}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-gray-900 dark:text-white">Education Outcomes</span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
