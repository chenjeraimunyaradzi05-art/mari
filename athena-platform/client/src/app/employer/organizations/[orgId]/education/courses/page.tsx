'use client';

/**
 * A provider's courses: drafts and published, with how many people are
 * enrolled and how many have finished. New courses start here as drafts and
 * are built in the editor.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, BookOpen, Loader2, Plus } from 'lucide-react';
import { courseApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  type: string | null;
  isActive: boolean;
  updatedAt: string;
  _count: { enrollments: number; modules: number; certificates: number };
};

const TYPES = [
  ['short_course', 'Short course'],
  ['certificate', 'Certificate'],
  ['diploma', 'Diploma'],
  ['bootcamp', 'Bootcamp'],
  ['degree', 'Degree'],
] as const;

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
const inputClass = 'input w-full text-sm';

export default function OrganizationCoursesPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'short_course', durationMonths: '', cost: '' });

  const courses = useQuery({
    queryKey: ['org-courses', orgId],
    queryFn: () => courseApi.byOrganization(orgId),
    enabled: Boolean(orgId),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as CourseRow[]) : []),
  });

  const create = useMutation({
    mutationFn: () =>
      courseApi.create({
        title: form.title.trim(),
        description: form.description.trim(),
        organizationId: orgId,
        type: form.type,
        durationMonths: form.durationMonths ? Number(form.durationMonths) : null,
        cost: form.cost ? Number(form.cost) : null,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['org-courses', orgId] });
      toast.success('Draft created. Add your modules and lessons.');
      router.push(`/employer/organizations/${orgId}/education/courses/${res.data?.data?.id}`);
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not create the course'),
  });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link href={`/employer/organizations/${orgId}`} className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <BookOpen className="h-7 w-7 text-blue-600" /> Courses
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">Build lessons here; learners take them in the ATHENA classroom and earn a certificate when they finish.</p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> New course
          </button>
        )}
      </div>

      {creating && (
        <div className="card mb-6 space-y-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">New course</h2>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Course title" aria-label="Title" className={inputClass} />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Who it is for and what they will be able to do afterwards" aria-label="Description" className={inputClass} />
          <div className="grid gap-3 sm:grid-cols-3">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} aria-label="Type" className={inputClass}>
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} type="number" min={0} placeholder="Duration (months)" aria-label="Duration in months" className={inputClass} />
            <input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} type="number" min={0} placeholder="Cost (AUD, 0 for free)" aria-label="Cost" className={inputClass} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => create.mutate()} disabled={create.isPending || !form.title.trim() || !form.description.trim()} className="btn-primary text-sm">
              Create draft
            </button>
            <button type="button" onClick={() => setCreating(false)} className="text-sm text-slate-500 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}

      {courses.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : courses.isError ? (
        <div className="card p-8 text-center text-slate-500">Could not load courses. You may not be on this organisation’s team.</div>
      ) : (courses.data?.length ?? 0) === 0 ? (
        <div className="card p-10 text-center text-slate-500">No courses yet. Create one to start building.</div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
          {courses.data!.map((c) => (
            <li key={c.id}>
              <Link href={`/employer/organizations/${orgId}/education/courses/${c.id}`} className="flex flex-wrap items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-white">{c.title}</p>
                  <p className="text-xs text-slate-500">
                    {c._count.modules} {c._count.modules === 1 ? 'module' : 'modules'} · {c._count.enrollments} enrolled · {c._count.certificates} finished
                  </p>
                </div>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>{c.isActive ? 'Published' : 'Draft'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
