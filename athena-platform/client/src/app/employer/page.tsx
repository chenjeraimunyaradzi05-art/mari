'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Briefcase,
  Users,
  Eye,
  FileText,
  TrendingUp,
  Settings,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  type: string;
  role: string;
  canPostJobs: boolean;
  jobCount: number;
  memberCount: number;
}

export default function EmployerDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: organizations, isLoading } = useQuery<Organization[]>({
    queryKey: ['employer-organizations'],
    queryFn: async () => {
      const response = await api.get('/employer/organizations');
      return response.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const hasOrgs = organizations && organizations.length > 0;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-7 w-7 text-blue-600" />
            Employer Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your organizations, job postings, and applications
          </p>
        </div>
        <Link href="/employer/organizations/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Organization
          </Button>
        </Link>
      </div>

      {!hasOrgs ? (
        /* Empty State */
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Organizations Yet
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Create your first organization to start posting jobs and managing your employer presence on ATHENA.
          </p>
          <Link href="/employer/organizations/new">
            <Button size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Organization
            </Button>
          </Link>
        </div>
      ) : (
        /* Organizations List */
        <div className="space-y-4">
          {organizations.map((org) => (
            <div
              key={org.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    {org.logo ? (
                      <img src={org.logo} alt={org.name} className="w-full h-full rounded-xl object-cover" />
                    ) : (
                      <Building2 className="h-8 w-8 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {org.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant="outline" className="capitalize">{org.type}</Badge>
                      <Badge variant="secondary">{org.role}</Badge>
                    </div>
                  </div>
                </div>
                <Link href={`/employer/organizations/${org.id}`}>
                  <Button variant="outline">
                    Manage
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                <Link
                  href={`/employer/organizations/${org.id}/jobs`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Briefcase className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{org.jobCount}</p>
                    <p className="text-sm text-gray-500">Jobs</p>
                  </div>
                </Link>
                <Link
                  href={`/employer/organizations/${org.id}/team`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Users className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{org.memberCount}</p>
                    <p className="text-sm text-gray-500">Team</p>
                  </div>
                </Link>
                <Link
                  href={`/employer/organizations/${org.id}/applications`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <FileText className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">View</p>
                    <p className="text-sm text-gray-500">Applications</p>
                  </div>
                </Link>
                <Link
                  href={`/employer/organizations/${org.id}/analytics`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">View</p>
                    <p className="text-sm text-gray-500">Analytics</p>
                  </div>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      {hasOrgs && (
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <Link
            href={`/employer/organizations/${organizations[0].id}/jobs/new`}
            className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl text-white hover:from-blue-600 hover:to-blue-700 transition-all"
          >
            <Plus className="h-8 w-8 mb-3" />
            <h3 className="font-semibold text-lg">Post a Job</h3>
            <p className="text-blue-100 text-sm mt-1">Create a new job listing</p>
          </Link>
          <Link
            href={`/employer/organizations/${organizations[0].id}/applications`}
            className="p-6 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl text-white hover:from-orange-600 hover:to-orange-700 transition-all"
          >
            <FileText className="h-8 w-8 mb-3" />
            <h3 className="font-semibold text-lg">Review Applications</h3>
            <p className="text-orange-100 text-sm mt-1">Manage candidate applications</p>
          </Link>
          <Link
            href={`/employer/organizations/${organizations[0].id}/analytics`}
            className="p-6 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl text-white hover:from-purple-600 hover:to-purple-700 transition-all"
          >
            <TrendingUp className="h-8 w-8 mb-3" />
            <h3 className="font-semibold text-lg">View Analytics</h3>
            <p className="text-purple-100 text-sm mt-1">Track job performance</p>
          </Link>
        </div>
      )}
    </div>
  );
}
