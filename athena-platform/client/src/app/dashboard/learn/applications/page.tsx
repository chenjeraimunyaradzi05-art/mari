'use client';

import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { useMyEducationApplications } from '@/lib/hooks';
import { CardSkeleton } from '@/components/ui/loading';

export default function MyEducationApplicationsPage() {
  const { data, isLoading } = useMyEducationApplications();

  const applications = data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Education Applications</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track your submitted applications</p>
        </div>
        <Link href="/dashboard/learn/providers" className="btn-outline px-6 py-2.5 text-center">
          Browse Providers
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
            <ClipboardList className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </div>
          <p className="text-gray-900 dark:text-white font-medium">No applications yet</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Apply to a provider or course to start tracking.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((a: any) => (
            <div key={a.id} className="card">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">
                    {a.course?.title || a.programName || 'Application'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {a.organization?.name || 'Provider'}
                    {a.submittedAt ? ` • Submitted ${new Date(a.submittedAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {a.status}
                  </span>
                  {a.organization?.slug ? (
                    <Link
                      href={`/dashboard/learn/providers/${a.organization.slug}`}
                      className="btn-outline px-4 py-2"
                    >
                      View Provider
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
