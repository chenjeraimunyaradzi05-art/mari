'use client';

/**
 * The classroom: an enrolled learner works through a course's lessons here.
 * Modules and lessons down the side with ticks for what is done, the current
 * lesson in the middle, and the certificate once every lesson is complete.
 */

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Award, CheckCircle2, Circle, ExternalLink, FileText, Loader2, PlayCircle } from 'lucide-react';
import { courseApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type Lesson = {
  id: string;
  title: string;
  type: 'VIDEO' | 'ARTICLE' | 'RESOURCE';
  content: string | null;
  videoUrl: string | null;
  resourceUrl: string | null;
  durationMinutes: number | null;
  isPreview: boolean;
};
type Module = { id: string; title: string; description: string | null; lessons: Lesson[] };
type Classroom = {
  course: { id: string; title: string; slug: string; description: string; organization?: { name: string } | null; providerName?: string | null };
  modules: Module[];
  enrollment: { id: string; progress: number } | null;
  progress: { total: number; completed: number; percent: number; completedLessonIds: string[]; certificate: { code: string; issuedAt: string } | null };
};

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

/** YouTube and Vimeo links become embeds; anything else plays as a file. */
function videoEmbed(url: string): { kind: 'iframe' | 'file'; src: string } {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { kind: 'file', src: url };
}

export default function ClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(null);

  const classroom = useQuery({
    queryKey: ['classroom', id],
    queryFn: () => courseApi.classroom(id),
    select: (r) => r.data?.data as Classroom,
  });

  const lessons = useMemo(() => classroom.data?.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title }))) ?? [], [classroom.data]);
  const done = useMemo(() => new Set(classroom.data?.progress.completedLessonIds ?? []), [classroom.data]);

  // Open on the first lesson not yet done.
  useEffect(() => {
    if (currentId || lessons.length === 0) return;
    const next = lessons.find((l) => !done.has(l.id)) ?? lessons[0];
    setCurrentId(next.id);
  }, [lessons, done, currentId]);

  const complete = useMutation({
    mutationFn: (lessonId: string) => courseApi.completeLesson(id, lessonId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['classroom', id] });
      queryClient.invalidateQueries({ queryKey: ['course', id] });
      queryClient.invalidateQueries({ queryKey: ['my-courses'] });
      const data = res.data?.data;
      if (data?.certificate && data.percent === 100) {
        toast.success('Course complete. Your certificate is ready.');
      } else {
        const index = lessons.findIndex((l) => l.id === currentId);
        const next = lessons[index + 1];
        if (next) setCurrentId(next.id);
      }
    },
    onError: (e) => toast.error(errorMessage(e) || 'Could not save your progress'),
  });

  if (classroom.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }
  if (classroom.isError || !classroom.data) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <p className="text-lg font-medium text-slate-900 dark:text-white">Enrol in this course to open the classroom.</p>
        <Link href={`/dashboard/learn/${id}`} className="mt-3 inline-block text-primary-600 hover:underline">
          Back to the course
        </Link>
      </div>
    );
  }

  const data = classroom.data;
  const current = lessons.find((l) => l.id === currentId) ?? null;
  const provider = data.course.organization?.name || data.course.providerName;
  const finished = data.progress.total > 0 && data.progress.percent === 100;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/dashboard/learn/${id}`} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <ArrowLeft className="mr-1 h-4 w-4" /> Course
          </Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{data.course.title}</h1>
          {provider && <p className="text-xs text-slate-500">{provider}</p>}
        </div>
        <div className="min-w-[200px]">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {data.progress.completed} of {data.progress.total} lessons
            </span>
            <span>{data.progress.percent}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full bg-primary-500 transition-all" style={{ width: `${data.progress.percent}%` }} />
          </div>
        </div>
      </div>

      {lessons.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">The provider has not published any lessons yet.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <nav aria-label="Lessons" className="card h-fit max-h-[75vh] overflow-y-auto p-3 lg:sticky lg:top-6">
            {data.modules.map((m, mi) => (
              <div key={m.id} className="mb-3">
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {mi + 1}. {m.title}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {m.lessons.map((l) => {
                    const isDone = done.has(l.id);
                    const active = l.id === currentId;
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => setCurrentId(l.id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                            active ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                          )}
                        >
                          {isDone ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 flex-shrink-0 text-slate-300" />}
                          <span className="min-w-0 flex-1 truncate">{l.title}</span>
                          {l.durationMinutes ? <span className="text-xs text-slate-400">{l.durationMinutes}m</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <main className="space-y-4">
            {finished && data.progress.certificate && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                <div className="flex items-start gap-3">
                  <Award className="h-8 w-8 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-100">You finished {data.course.title}</p>
                    <p className="text-sm text-emerald-800 dark:text-emerald-200">
                      Certificate code <code className="rounded bg-white/70 px-1 dark:bg-slate-900/40">{data.progress.certificate.code}</code>, issued{' '}
                      {new Date(data.progress.certificate.issuedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}.
                    </p>
                    <Link href={`/certificates/${data.progress.certificate.code}`} className="mt-1 inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300">
                      Open the certificate page
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {current && (
              <article className="card p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{current.moduleTitle}</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{current.title}</h2>
                <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  {current.type === 'VIDEO' ? <PlayCircle className="h-4 w-4" /> : current.type === 'RESOURCE' ? <ExternalLink className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  {current.type.toLowerCase()}
                  {current.durationMinutes ? ` · ${current.durationMinutes} min` : ''}
                </p>

                {current.type === 'VIDEO' && current.videoUrl && (
                  <div className="mt-4 overflow-hidden rounded-lg bg-black">
                    {videoEmbed(current.videoUrl).kind === 'iframe' ? (
                      <iframe src={videoEmbed(current.videoUrl).src} title={current.title} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    ) : (
                      <video src={current.videoUrl} controls className="aspect-video w-full" />
                    )}
                  </div>
                )}
                {current.type === 'RESOURCE' && current.resourceUrl && (
                  <a href={current.resourceUrl} target="_blank" rel="noopener noreferrer" className="btn-outline mt-4 inline-flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" /> Open the resource
                  </a>
                )}
                {current.content && <div className="prose prose-slate mt-4 max-w-none whitespace-pre-wrap text-slate-700 dark:prose-invert dark:text-slate-300">{current.content}</div>}
                {!current.content && !current.videoUrl && !current.resourceUrl && <p className="mt-4 text-sm text-slate-500">This lesson has no content yet.</p>}

                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  {done.has(current.id) ? (
                    <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" /> Done
                    </span>
                  ) : (
                    <button type="button" onClick={() => complete.mutate(current.id)} disabled={complete.isPending || !data.enrollment} className="btn-primary" title={data.enrollment ? undefined : 'Enrol to track progress'}>
                      {complete.isPending ? 'Saving…' : 'Mark complete and continue'}
                    </button>
                  )}
                  {(() => {
                    const index = lessons.findIndex((l) => l.id === current.id);
                    const next = lessons[index + 1];
                    return next ? (
                      <button type="button" onClick={() => setCurrentId(next.id)} className="text-sm text-slate-500 hover:underline">
                        Next: {next.title}
                      </button>
                    ) : null;
                  })()}
                </div>
              </article>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
