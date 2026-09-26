'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ExternalLink, GraduationCap } from 'lucide-react';
import { useCreateEducationApplication } from '@/lib/hooks';
import { api } from '@/lib/api';
import { CardSkeleton } from '@/components/ui/loading';
import { safeHref } from '@/lib/safe-href';

type Provider = {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

type ProviderCourse = { id: string; title: string; type: string | null };

type ProviderPayload = { provider: Provider; courses: ProviderCourse[]; coursesTotal?: number };

const PAGE_SIZE = 50;

export default function EducationProviderDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const [page, setPage] = useState(1);

  // Paged here rather than through the shared hook, because the provider route
  // now pages its courses and says how many there are. It used to hand back the
  // newest fifty and stop, and this page printed "50 available" for a provider
  // with sixty.
  const query = useQuery({
    queryKey: ['education-provider', slug, page],
    queryFn: () => api.get(`/education/providers/${encodeURIComponent(slug!)}`, { params: { page, limit: PAGE_SIZE } }),
    enabled: !!slug,
    placeholderData: keepPreviousData,
    select: (response) => response.data.data as ProviderPayload,
  });
  const createApplication = useCreateEducationApplication();

  const provider = query.data?.provider;
  const courses = query.data?.courses ?? [];
  const total = query.data?.coursesTotal ?? courses.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (query.isLoading) {
    return (
      <div className="p-6">
        <CardSkeleton />
      </div>
    );
  }

  // A 404 is "not found"; anything else is a failed load, and saying the
  // provider does not exist because the network dropped would be untrue.
  const status =
    typeof query.error === 'object' && query.error !== null && 'response' in query.error
      ? (query.error as { response?: { status?: number } }).response?.status
      : undefined;

  if (query.isError && status !== 404) {
    return (
      <div className="p-6">
        <div className="card p-10 text-center" role="alert">
          <p className="text-slate-900 dark:text-white font-medium">We could not load this provider</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Try again in a moment.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={() => query.refetch()} className="btn-outline px-6 py-2.5">
              Try again
            </button>
            <Link href="/dashboard/learn/providers" className="btn-outline px-6 py-2.5">
              Back to Providers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="p-6">
        <div className="card p-10 text-center">
          <p className="text-slate-900 dark:text-white font-medium">Provider not found</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Try another provider.</p>
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
          <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
            {provider.logo ? (
              <img src={provider.logo} alt={provider.name} className="w-full h-full object-cover" />
            ) : (
              <GraduationCap className="w-7 h-7 text-slate-600 dark:text-slate-300" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{provider.name}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">{location || 'Australia'}</p>
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
              <p className="text-slate-700 dark:text-slate-300">{provider.description}</p>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">No description available.</p>
            )}
          </div>
          {provider.website ? (
            <a
              href={safeHref(provider.website)}
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
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Courses</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {total} available{pages > 1 ? ` · page ${page} of ${pages}` : ''}
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
          <div className="mt-6 text-sm text-slate-500 dark:text-slate-400">No courses listed.</div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((c) => (
              <div key={c.id} className="card border border-slate-200 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{c.title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
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

        {pages > 1 ? (
          <div className="mt-6 flex items-center justify-between gap-2">
            <button
              type="button"
              className="btn-outline px-4 py-2"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-outline px-4 py-2"
              disabled={page >= pages || query.isFetching}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
