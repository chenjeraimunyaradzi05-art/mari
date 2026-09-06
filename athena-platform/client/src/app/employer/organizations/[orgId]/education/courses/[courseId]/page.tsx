'use client';

/**
 * The course editor. Details at the top, then modules of lessons: video,
 * article or resource, with a preview flag for what people see before they
 * enrol. Publishing puts the course in the catalogue; unpublishing hides it
 * without touching anyone's progress.
 */

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowLeft, ArrowUp, Eye, FileText, Loader2, PlayCircle, Plus, Trash2, ExternalLink } from 'lucide-react';
import { courseApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type LessonType = 'VIDEO' | 'ARTICLE' | 'RESOURCE';
type Lesson = { id: string; title: string; type: LessonType; content: string | null; videoUrl: string | null; resourceUrl: string | null; durationMinutes: number | null; isPreview: boolean; position: number };
type Module = { id: string; title: string; description: string | null; position: number; lessons: Lesson[] };
type Course = {
  id: string;
  title: string;
  slug: string;
  description: string;
  type: string | null;
  durationMonths: number | null;
  cost: number | null;
  isActive: boolean;
  modules: Module[];
  organization: { id: string; name: string } | null;
  _count: { enrollments: number; certificates: number };
};

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
const inputClass = 'input w-full text-sm';
const LESSON_ICON: Record<LessonType, typeof FileText> = { VIDEO: PlayCircle, ARTICLE: FileText, RESOURCE: ExternalLink };

const emptyLesson = { title: '', type: 'ARTICLE' as LessonType, content: '', videoUrl: '', resourceUrl: '', durationMinutes: '', isPreview: false };

export default function CourseEditorPage({ params }: { params: Promise<{ orgId: string; courseId: string }> }) {
  const { orgId, courseId } = use(params);
  const queryClient = useQueryClient();

  const course = useQuery({
    queryKey: ['course-builder', courseId],
    queryFn: () => courseApi.builder(courseId),
    select: (r) => r.data?.data as Course,
  });

  const [details, setDetails] = useState({ title: '', description: '', type: '', durationMonths: '', cost: '' });
  useEffect(() => {
    if (course.data) {
      setDetails({
        title: course.data.title,
        description: course.data.description,
        type: course.data.type ?? '',
        durationMonths: course.data.durationMonths?.toString() ?? '',
        cost: course.data.cost?.toString() ?? '',
      });
    }
  }, [course.data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['course-builder', courseId] });
    queryClient.invalidateQueries({ queryKey: ['org-courses', orgId] });
  };
  const onError = (e: unknown) => toast.error(errorMessage(e) || 'That did not save');

  const saveDetails = useMutation({
    mutationFn: () =>
      courseApi.update(courseId, {
        title: details.title,
        description: details.description,
        type: details.type || undefined,
        durationMonths: details.durationMonths === '' ? null : Number(details.durationMonths),
        cost: details.cost === '' ? null : Number(details.cost),
      }),
    onSuccess: () => {
      refresh();
      toast.success('Saved');
    },
    onError,
  });
  const publish = useMutation({
    mutationFn: (isActive: boolean) => courseApi.update(courseId, { isActive }),
    onSuccess: (_r, isActive) => {
      refresh();
      toast.success(isActive ? 'Published. It is in the catalogue now.' : 'Unpublished. Enrolled learners keep their access.');
    },
    onError,
  });

  const [newModule, setNewModule] = useState('');
  const addModule = useMutation({
    mutationFn: () => courseApi.addModule(courseId, { title: newModule.trim() }),
    onSuccess: () => {
      setNewModule('');
      refresh();
    },
    onError,
  });
  const patchModule = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => courseApi.updateModule(courseId, id, data),
    onSuccess: refresh,
    onError,
  });
  const removeModule = useMutation({
    mutationFn: (id: string) => courseApi.deleteModule(courseId, id),
    onSuccess: () => {
      refresh();
      toast.success('Module removed');
    },
    onError,
  });

  const [lessonFormFor, setLessonFormFor] = useState<{ moduleId: string; lessonId?: string } | null>(null);
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const lessonPayload = () => ({
    title: lessonForm.title.trim(),
    type: lessonForm.type,
    content: lessonForm.content,
    videoUrl: lessonForm.videoUrl,
    resourceUrl: lessonForm.resourceUrl,
    durationMinutes: lessonForm.durationMinutes === '' ? null : Number(lessonForm.durationMinutes),
    isPreview: lessonForm.isPreview,
  });
  const saveLesson = useMutation({
    mutationFn: () =>
      lessonFormFor?.lessonId ? courseApi.updateLesson(courseId, lessonFormFor.lessonId, lessonPayload()) : courseApi.addLesson(courseId, lessonFormFor!.moduleId, lessonPayload()),
    onSuccess: () => {
      setLessonFormFor(null);
      setLessonForm(emptyLesson);
      refresh();
    },
    onError,
  });
  const patchLesson = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => courseApi.updateLesson(courseId, id, data),
    onSuccess: refresh,
    onError,
  });
  const removeLesson = useMutation({
    mutationFn: (id: string) => courseApi.deleteLesson(courseId, id),
    onSuccess: refresh,
    onError,
  });

  const startEditLesson = (moduleId: string, lesson: Lesson) => {
    setLessonFormFor({ moduleId, lessonId: lesson.id });
    setLessonForm({
      title: lesson.title,
      type: lesson.type,
      content: lesson.content ?? '',
      videoUrl: lesson.videoUrl ?? '',
      resourceUrl: lesson.resourceUrl ?? '',
      durationMinutes: lesson.durationMinutes?.toString() ?? '',
      isPreview: lesson.isPreview,
    });
  };

  // Swapping positions with a neighbour is two saves; the list re-sorts on refetch.
  const move = async (kind: 'module' | 'lesson', items: Array<{ id: string; position: number }>, index: number, direction: -1 | 1) => {
    const a = items[index];
    const b = items[index + direction];
    if (!a || !b) return;
    const mutate = kind === 'module' ? patchModule.mutateAsync : patchLesson.mutateAsync;
    await mutate({ id: a.id, data: { position: b.position } });
    await mutate({ id: b.id, data: { position: a.position } });
  };

  if (course.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }
  if (course.isError || !course.data) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center text-slate-500">
        This course is not yours to edit.{' '}
        <Link href={`/employer/organizations/${orgId}/education/courses`} className="text-primary-600 hover:underline">
          Back to courses
        </Link>
      </div>
    );
  }

  const c = course.data;
  const busy = saveDetails.isPending || publish.isPending || addModule.isPending || patchModule.isPending || removeModule.isPending || saveLesson.isPending || patchLesson.isPending || removeLesson.isPending;
  const lessonCount = c.modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link href={`/employer/organizations/${orgId}/education/courses`} className="mb-6 inline-flex items-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
        <ArrowLeft className="mr-2 h-4 w-4" /> Courses
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{c.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {c.modules.length} {c.modules.length === 1 ? 'module' : 'modules'} · {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'} · {c._count.enrollments} enrolled · {c._count.certificates} finished
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/learn/${c.id}`} className="btn-outline inline-flex items-center gap-1 text-sm">
            <Eye className="h-4 w-4" /> View as a learner
          </Link>
          <button
            type="button"
            disabled={busy || (!c.isActive && lessonCount === 0)}
            title={!c.isActive && lessonCount === 0 ? 'Add at least one lesson before publishing' : undefined}
            onClick={() => publish.mutate(!c.isActive)}
            className={cn('text-sm', c.isActive ? 'btn-outline' : 'btn-primary')}
          >
            {c.isActive ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      <section className="card mb-6 space-y-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">Details</h2>
        <input value={details.title} onChange={(e) => setDetails({ ...details, title: e.target.value })} aria-label="Title" className={inputClass} />
        <textarea value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} rows={3} aria-label="Description" className={inputClass} />
        <div className="grid gap-3 sm:grid-cols-3">
          <input value={details.type} onChange={(e) => setDetails({ ...details, type: e.target.value })} placeholder="Type, e.g. short_course" aria-label="Type" className={inputClass} />
          <input value={details.durationMonths} onChange={(e) => setDetails({ ...details, durationMonths: e.target.value })} type="number" min={0} placeholder="Duration (months)" aria-label="Duration in months" className={inputClass} />
          <input value={details.cost} onChange={(e) => setDetails({ ...details, cost: e.target.value })} type="number" min={0} placeholder="Cost (AUD)" aria-label="Cost" className={inputClass} />
        </div>
        <button type="button" onClick={() => saveDetails.mutate()} disabled={busy || !details.title.trim()} className="btn-primary text-sm">
          Save details
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-slate-900 dark:text-white">Curriculum</h2>
        {c.modules.map((m, mi) => (
          <div key={m.id} className="card space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Module {mi + 1}</span>
              <input
                defaultValue={m.title}
                aria-label="Module title"
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value.trim() !== m.title) patchModule.mutate({ id: m.id, data: { title: e.target.value.trim() } });
                }}
                className="input min-w-[200px] flex-1 text-sm font-medium"
              />
              <button type="button" disabled={busy || mi === 0} onClick={() => move('module', c.modules, mi, -1)} aria-label="Move module up" className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" disabled={busy || mi === c.modules.length - 1} onClick={() => move('module', c.modules, mi, 1)} aria-label="Move module down" className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Remove "${m.title}" and its ${m.lessons.length} lessons?`)) removeModule.mutate(m.id);
                }}
                aria-label="Remove module"
                className="p-1 text-slate-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {m.lessons.length === 0 && <li className="p-3 text-sm text-slate-500">No lessons yet.</li>}
              {m.lessons.map((l, li) => {
                const Icon = LESSON_ICON[l.type] ?? FileText;
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                    <Icon className="h-4 w-4 text-slate-400" />
                    <button type="button" onClick={() => startEditLesson(m.id, l)} className="min-w-0 flex-1 truncate text-left font-medium text-slate-900 hover:underline dark:text-white">
                      {l.title}
                    </button>
                    {l.durationMinutes ? <span className="text-xs text-slate-500">{l.durationMinutes} min</span> : null}
                    {l.isPreview && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700">preview</span>}
                    <button type="button" disabled={busy || li === 0} onClick={() => move('lesson', m.lessons, li, -1)} aria-label="Move lesson up" className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={busy || li === m.lessons.length - 1} onClick={() => move('lesson', m.lessons, li, 1)} aria-label="Move lesson down" className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Remove "${l.title}"?`)) removeLesson.mutate(l.id);
                      }}
                      aria-label="Remove lesson"
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>

            {lessonFormFor?.moduleId === m.id ? (
              <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900/40 dark:bg-blue-900/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{lessonFormFor.lessonId ? 'Edit lesson' : 'New lesson'}</p>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_120px]">
                  <input value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} placeholder="Lesson title" aria-label="Lesson title" className={inputClass} />
                  <select value={lessonForm.type} onChange={(e) => setLessonForm({ ...lessonForm, type: e.target.value as LessonType })} aria-label="Lesson type" className={inputClass}>
                    <option value="ARTICLE">Article</option>
                    <option value="VIDEO">Video</option>
                    <option value="RESOURCE">Resource</option>
                  </select>
                  <input value={lessonForm.durationMinutes} onChange={(e) => setLessonForm({ ...lessonForm, durationMinutes: e.target.value })} type="number" min={0} placeholder="Minutes" aria-label="Duration in minutes" className={inputClass} />
                </div>
                {lessonForm.type === 'VIDEO' && <input value={lessonForm.videoUrl} onChange={(e) => setLessonForm({ ...lessonForm, videoUrl: e.target.value })} placeholder="Video URL (YouTube, Vimeo, or a file)" aria-label="Video URL" className={inputClass} />}
                {lessonForm.type === 'RESOURCE' && <input value={lessonForm.resourceUrl} onChange={(e) => setLessonForm({ ...lessonForm, resourceUrl: e.target.value })} placeholder="Link to the resource" aria-label="Resource URL" className={inputClass} />}
                <textarea value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} rows={lessonForm.type === 'ARTICLE' ? 8 : 3} placeholder={lessonForm.type === 'ARTICLE' ? 'The lesson text' : 'Notes shown under the video or link (optional)'} aria-label="Lesson content" className={inputClass} />
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={lessonForm.isPreview} onChange={(e) => setLessonForm({ ...lessonForm, isPreview: e.target.checked })} className="rounded border-slate-300" />
                  Free preview: anyone can open this lesson before enrolling
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => saveLesson.mutate()} disabled={busy || !lessonForm.title.trim()} className="btn-primary text-sm">
                    {lessonFormFor.lessonId ? 'Save lesson' : 'Add lesson'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLessonFormFor(null);
                      setLessonForm(emptyLesson);
                    }}
                    className="text-sm text-slate-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setLessonFormFor({ moduleId: m.id });
                  setLessonForm(emptyLesson);
                }}
                className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
              >
                <Plus className="h-4 w-4" /> Add a lesson
              </button>
            )}
          </div>
        ))}

        <div className="card flex flex-wrap items-center gap-2">
          <input value={newModule} onChange={(e) => setNewModule(e.target.value)} placeholder="New module title, e.g. Week 1: Finding your customer" aria-label="New module title" className="input min-w-[240px] flex-1 text-sm" />
          <button type="button" onClick={() => addModule.mutate()} disabled={busy || !newModule.trim()} className="btn-primary inline-flex items-center gap-1 text-sm">
            <Plus className="h-4 w-4" /> Add module
          </button>
        </div>
      </section>
    </div>
  );
}
