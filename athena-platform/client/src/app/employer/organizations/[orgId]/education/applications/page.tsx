'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { educationApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

export default function ProviderEducationApplicationsPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['provider-education-applications', orgId],
    queryFn: async () => {
      const response = await educationApi.getProviderApplications(orgId);
      return response.data.data;
    },
  });

  const applications = (data as any[]) || [];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/employer/organizations/${orgId}`}
          className="inline-flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>
        <Link
          href={`/employer/organizations/${orgId}/education/outcomes`}
          className="btn-outline px-6 py-2.5 text-center"
        >
          View Outcomes
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Education Applications</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Applications submitted to this provider</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-gray-900 dark:text-white font-medium">Unable to load applications</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            You may not have permission to view analytics for this organization.
          </p>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
            <ClipboardList className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </div>
          <p className="text-gray-900 dark:text-white font-medium">No education applications yet</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Check back later.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/30">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                    Applicant
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                    Course / Program
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                    Submitted
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {applications.map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                          {a.user?.avatar ? (
                            <img src={a.user.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-200">
                              {(a.user?.firstName?.[0] || 'U') + (a.user?.lastName?.[0] || '')}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {a.user ? `${a.user.firstName} ${a.user.lastName}` : 'Unknown'}
                          </p>
                          {a.user?.headline ? (
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{a.user.headline}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900 dark:text-white">
                        {a.course?.title || a.programName || '—'}
                      </p>
                      {a.course?.type ? (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{a.course.type}</p>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary">{a.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
