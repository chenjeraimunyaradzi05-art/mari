'use client';

/**
 * The course catalogue, from the platform's side.
 *
 * A provider's listing prints its fee and, where she gives them, an employment
 * rate and a starting salary, on a page with ATHENA's name on it. Staff had no
 * way to see those listings as a whole: the public catalogue shows only what is
 * published and the provider's own list needs her organisation's id, so the
 * only way to look at a listing was to already know it was there. The route
 * behind this page lists every course, drafts included, with the figures a
 * reviewer needs to decide whether a listing stays up.
 *
 * Taking one down is an unpublish, never a delete. A course that has issued
 * certificates cannot be deleted — the certificates point at it, and an
 * employer checking a woman's code has to find it — so unpublishing is how a
 * course is retired. Learners already enrolled keep their access, every
 * certificate still checks out, and the provider's team is told.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, BadgeCheck, BookOpen, Loader2, Search } from 'lucide-react';
import {
  adminApiMessage,
  adminCatalogueApi,
  type AdminCourse,
  type CourseListStatus,
} from '@/lib/admin-catalogue-api';
import { cn } from '@/lib/utils';

type CoursePage = { courses: AdminCourse[]; page: number; pages: number; total: number };

const STATUSES: Array<[CourseListStatus, string]> = [
  ['all', 'Every course'],
  ['live', 'Published'],
  ['draft', 'Drafts and retired'],
];

const aud = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
const day = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

function provider(course: AdminCourse): string {
  return course.providerName?.trim() || course.organization?.name || 'No provider named';
}

export default function AdminCoursesPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CourseListStatus>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['admin-courses', status, search, page],
    queryFn: () => adminCatalogueApi.courses.list({ status, search: search || undefined, page, limit: 50 }),
    select: (r): CoursePage => ({
      courses: Array.isArray(r.data?.data) ? (r.data.data as AdminCourse[]) : [],
      page: r.data?.pagination?.page ?? page,
      pages: r.data?.pagination?.pages ?? 1,
      total: r.data?.pagination?.total ?? 0,
    }),
  });

  const unpublish = useMutation({
    mutationFn: (course: AdminCourse) => adminCatalogueApi.courses.unpublish(course.id),
    onSuccess: (_response, course) => {
      setConfirming(null);
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success(`Unpublished: ${course.title}.`);
    },
    onError: (e) => toast.error(adminApiMessage(e) || 'The course could not be unpublished. It is still listed.'),
  });

  const filtered = status !== 'all' || search.length > 0;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <Link href="/admin" className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700">
        <ArrowLeft className="mr-2 h-4 w-4" /> Admin
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <BookOpen className="h-7 w-7 text-primary-600" /> Courses
          </h1>
          <p className="mt-1 max-w-2xl text-slate-600 dark:text-slate-400">
            Every course on the platform, drafts included, with the figures each listing prints. A course is retired by
            unpublishing it; one that has issued certificates can never be deleted.
          </p>
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
            setPage(1);
          }}
        >
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as CourseListStatus);
              setPage(1);
            }}
            className="input py-1.5 text-sm"
            aria-label="Which courses"
          >
            {STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Title or provider"
            aria-label="Search courses"
            className="input py-1.5 text-sm"
          />
          <button type="submit" className="btn-secondary inline-flex items-center gap-1 py-1.5 text-sm">
            <Search className="h-4 w-4" /> Search
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {list.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : list.isError || !list.data ? (
          // A failed load is not an empty catalogue.
          <div className="p-10 text-center" role="alert">
            <p className="font-medium text-slate-900 dark:text-white">The courses did not load.</p>
            <button type="button" onClick={() => list.refetch()} className="btn-secondary mt-3 py-1.5 text-sm">
              Try again
            </button>
          </div>
        ) : list.data.courses.length === 0 ? (
          <p className="p-10 text-center text-slate-500">
            {filtered ? 'No course matches that.' : 'No provider has created a course yet.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2">Course</th>
                <th className="px-4 py-2">Provider</th>
                <th className="px-4 py-2">Fee</th>
                <th className="px-4 py-2">Outcomes claimed</th>
                <th className="px-4 py-2">Learners</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.data.courses.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="px-4 py-3">
                    {c.isActive ? (
                      <Link href={`/courses/${c.slug}`} className="font-medium text-slate-900 hover:underline dark:text-white">
                        {c.title}
                      </Link>
                    ) : (
                      <span className="font-medium text-slate-900 dark:text-white">{c.title}</span>
                    )}
                    <span className="block text-xs text-slate-500">
                      {c.type ? c.type.replace(/_/g, ' ') : 'No type'} · {c._count.modules} {c._count.modules === 1 ? 'module' : 'modules'} · updated {day(c.updatedAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {provider(c)}
                    {c.organization && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        {c.organization.isVerified ? (
                          <>
                            <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> {c.organization.name}, verified
                          </>
                        ) : (
                          <>{c.organization.name}, not verified</>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {c.cost == null ? 'Not stated' : c.cost === 0 ? 'Fee-free' : aud(c.cost)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                    {c.employmentRate == null && c.avgStartingSalary == null ? (
                      <span className="text-slate-400">None</span>
                    ) : (
                      <>
                        {c.employmentRate != null && <span className="block">{c.employmentRate}% employed</span>}
                        {c.avgStartingSalary != null && <span className="block">{aud(c.avgStartingSalary)} starting</span>}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                    <span className="block">{c._count.enrollments} enrolled</span>
                    <span className="block">{c._count.certificates} certificates</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      )}
                    >
                      {c.isActive ? 'Published' : 'Not published'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.isActive &&
                      (confirming === c.id ? (
                        <div className="ml-auto max-w-xs space-y-2 text-left">
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            It leaves the catalogue at once. {c._count.enrollments > 0 ? 'Learners already enrolled keep their access. ' : ''}
                            {c._count.certificates > 0 ? 'Every certificate issued still checks out. ' : ''}
                            {c.organization
                              ? 'Everyone on the provider’s team who manages its listings is told in the app, and they can publish it again.'
                              : 'It can be published again later.'}
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => unpublish.mutate(c)}
                              disabled={unpublish.isPending}
                              className="btn-primary bg-rose-600 py-1 text-xs hover:bg-rose-700"
                            >
                              {unpublish.isPending ? 'Unpublishing…' : 'Unpublish'}
                            </button>
                            <button type="button" onClick={() => setConfirming(null)} disabled={unpublish.isPending} className="btn-secondary py-1 text-xs">
                              Keep it up
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirming(c.id)} className="btn-secondary py-1 text-xs text-red-700">
                          Unpublish
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {list.data && list.data.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {list.data.page} of {list.data.pages} · {list.data.total} courses
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-secondary py-1 text-sm">
              Previous
            </button>
            <button type="button" disabled={page >= list.data.pages} onClick={() => setPage(page + 1)} className="btn-secondary py-1 text-sm">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
