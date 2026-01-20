'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { educationApi } from '@/lib/api';

type OutcomesData = {
  applications: {
    total: number;
    byStatus: Record<string, number>;
  };
  enrollments: {
    total: number;
    completed: number;
    completionRate: number;
    avgProgress: number;
  };
  courses: {
    total: number;
  };
};

export default function ProviderEducationOutcomesPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const { data, isLoading, error } = useQuery<OutcomesData>({
    queryKey: ['provider-education-outcomes', orgId],
    queryFn: async () => {
      const response = await educationApi.getProviderOutcomes(orgId);
      return response.data.data;
    },
  });

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
          href={`/employer/organizations/${orgId}/education/applications`}
          className="btn-outline px-6 py-2.5 text-center"
        >
          View Applications
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Education Outcomes</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Basic application + enrollment metrics</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error || !data ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <p className="text-gray-900 dark:text-white font-medium">Unable to load outcomes</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            You may not have permission to view analytics for this organization.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.applications.total}</p>
                  <p className="text-sm text-gray-500">Applications</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.enrollments.total}</p>
                  <p className="text-sm text-gray-500">Enrollments</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.courses.total}</p>
                  <p className="text-sm text-gray-500">Courses</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Applications by Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(data.applications.byStatus || {}).length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">No application data yet.</p>
              ) : (
                Object.entries(data.applications.byStatus as Record<string, number>).map(([status, count]) => (
                  <div
                    key={status}
                    className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700"
                  >
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{status}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{count}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Enrollment Progress</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.enrollments.completed}</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.enrollments.completionRate}%</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">Average Progress</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.enrollments.avgProgress}%</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
