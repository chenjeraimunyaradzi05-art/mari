'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExternalLink, GraduationCap } from 'lucide-react';
import { useCreateEducationApplication, useEducationProvider } from '@/lib/hooks';
import { CardSkeleton } from '@/components/ui/loading';

export default function EducationProviderDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const { data, isLoading } = useEducationProvider(slug);
  const createApplication = useCreateEducationApplication();

  const provider = data?.provider;
  const courses = data?.courses ?? [];

  if (isLoading) {
    return (
      <div className="p-6">
        <CardSkeleton />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="p-6">
        <div className="card p-10 text-center">
          <p className="text-gray-900 dark:text-white font-medium">Provider not found</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Try another provider.</p>
          <div className="mt-4">
            <Link href="/dashboard/learn/providers" className="btn-outline px-6 py-2.5">
              Back to Providers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const location = [provider.city, provider.state, provider.country].filter(Boolean).join(', ');

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
            {provider.logo ? (
              <img src={provider.logo} alt={provider.name} className="w-full h-full object-cover" />
            ) : (
              <GraduationCap className="w-7 h-7 text-gray-600 dark:text-gray-300" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{provider.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{location || 'Australia'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/learn/providers" className="btn-outline px-6 py-2.5">
            Providers
          </Link>
          <Link href="/dashboard/learn/applications" className="btn-outline px-6 py-2.5">
            My Applications
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {provider.description ? (
              <p className="text-gray-700 dark:text-gray-300">{provider.description}</p>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No description available.</p>
            )}
          </div>
          {provider.website ? (
            <a
              href={provider.website}
              target="_blank"
              rel="noreferrer"
              className="btn-outline px-4 py-2 flex items-center gap-2"
            >
              Website <ExternalLink className="w-4 h-4" />
            </a>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Courses</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {courses.length} available
            </p>
          </div>
          <button
            className="btn-outline px-6 py-2.5"
            onClick={() =>
              createApplication.mutate({
                organizationId: provider.id,
                courseId: null,
                programName: null,
                intakeDate: null,
                notes: null,
              })
            }
            disabled={createApplication.isPending}
          >
            {createApplication.isPending ? 'Creating…' : 'Apply to Provider'}
          </button>
        </div>

        {courses.length === 0 ? (
          <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">No courses listed.</div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((c: any) => (
              <div key={c.id} className="card border border-gray-200 dark:border-gray-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{c.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {c.type || 'Course'}
                    </p>
                  </div>
                  <button
                    className="btn-outline px-4 py-2"
                    onClick={() =>
                      createApplication.mutate({
                        organizationId: provider.id,
                        courseId: c.id,
                        programName: null,
                        intakeDate: null,
                        notes: null,
                      })
                    }
                    disabled={createApplication.isPending}
                  >
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
