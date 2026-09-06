'use client';

/**
 * A course, in public.
 *
 * The catalogue used to send every visitor into the signed-in dashboard,
 * which meant a login wall before anyone could read what a course was.
 * This page shows what the provider listed (the description, the facts,
 * the outline of modules and lessons with the previews marked) to anyone,
 * and offers enrolment: straight in for a signed-in member, via sign-in
 * for a visitor. An enrolled learner is sent on to the classroom.
 */

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Calendar, CheckCircle, Clock, GraduationCap, Loader2, Lock, PlayCircle, Wallet } from 'lucide-react';
import { useCourse, useEnrollCourse } from '@/lib/hooks';
import { useAuthStore } from '@/lib/store';
import { EmptyState, PageShell, Section } from '@/components/layout/PageShell';

type Lesson = { id: string; title: string; type: string; durationMinutes?: number | null; isPreview: boolean; locked?: boolean };
type Course = {
  id: string;
  slug: string;
  title: string;
  description: string;
  providerName?: string | null;
  organization?: { id?: string; name?: string | null; slug?: string | null; logo?: string | null; website?: string | null } | null;
  type?: string | null;
  durationMonths?: number | null;
  studyMode?: unknown;
  cost?: number | null;
  fundingOptions?: unknown;
  employmentRate?: number | null;
  avgStartingSalary?: number | null;
  intakeDates?: unknown;
  isActive?: boolean;
  enrollment?: { id?: string; progress?: number | null } | null;
  progress?: { total: number; completed: number; percent: number; certificate?: { code: string } | null } | null;
  modules?: Array<{ id: string; title: string; description?: string | null; lessons: Lesson[] }>;
};

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [value];
    } catch {
      return [value];
    }
  }
  return [];
}
const label = (v: string) => v.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const money = (n: number) => `$${new Intl.NumberFormat('en-AU').format(n)}`;
function duration(months?: number | null): string | null {
  if (!months || months <= 0) return null;
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y} year${y === 1 ? '' : 's'}` : `${y}y ${m}m`;
}
const dates = (value: unknown) =>
  list(value).map((d) => {
    const t = new Date(d);
    return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  });

export default function PublicCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data, isLoading, isError } = useCourse(slug);
  const course = data as Course | undefined;
  const enrol = useEnrollCourse();

  const onEnrol = () => {
    if (!course) return;
    enrol.mutate(course.id, { onSuccess: () => router.push(`/dashboard/learn/${course.id}`) });
  };

  if (isLoading) {
    return (
      <PageShell width="default" backTo={{ href: '/courses', label: 'All courses' }}>
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      </PageShell>
    );
  }
  if (isError || !course) {
    return (
      <PageShell width="default" backTo={{ href: '/courses', label: 'All courses' }}>
        <EmptyState icon={BookOpen} reason="empty" title="No course at this address" description="It may have been taken down by its provider, or the link is wrong." primaryAction={{ label: 'Browse the catalogue', href: '/courses' }} />
      </PageShell>
    );
  }

  const provider = course.providerName || course.organization?.name || 'Provider not stated';
  const studyModes = list(course.studyMode);
  const funding = list(course.fundingOptions);
  const intakes = dates(course.intakeDates);
  const modules = course.modules ?? [];
  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0);
  const enrolled = Boolean(course.enrollment);
  const facts: Array<[typeof Clock, string, string]> = [];
  if (duration(course.durationMonths)) facts.push([Clock, 'Duration', duration(course.durationMonths)!]);
  if (studyModes.length) facts.push([GraduationCap, 'Study mode', studyModes.map(label).join(', ')]);
  facts.push([Wallet, 'Cost', course.cost == null ? 'On enquiry' : course.cost === 0 ? 'Fee-free' : money(course.cost)]);
  if (funding.length) facts.push([Wallet, 'Funding', funding.join(', ')]);
  if (intakes.length) facts.push([Calendar, 'Intakes', intakes.join(', ')]);
  if (course.employmentRate != null) facts.push([CheckCircle, 'In work after', `${course.employmentRate}% of graduates, as the provider reports`]);
  if (course.avgStartingSalary != null) facts.push([Wallet, 'Starting salary', `${money(course.avgStartingSalary)}, as the provider reports`]);

  return (
    <PageShell width="default" backTo={{ href: '/courses', label: 'All courses' }}>
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{course.type ? label(course.type) : 'Course'}</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-900 dark:text-white sm:text-4xl" style={{ textWrap: 'balance' }}>
          {course.title}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          {provider}
          {course.organization?.website && (
            <>
              {' · '}
              <a href={course.organization.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                provider site
              </a>
            </>
          )}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <p className="whitespace-pre-line text-slate-700 dark:text-slate-200">{course.description}</p>

          {facts.length > 0 && (
            <dl className="grid gap-3 sm:grid-cols-2">
              {facts.map(([Icon, k, v]) => (
                <div key={k} className="surface flex items-start gap-3 p-4">
                  <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
                    <dd className="text-sm text-slate-800 dark:text-slate-200">{v}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}

          {modules.length > 0 && (
            <Section icon={BookOpen} title="What is in it" description={`${modules.length} ${modules.length === 1 ? 'module' : 'modules'}, ${lessonCount} ${lessonCount === 1 ? 'lesson' : 'lessons'}. Previews are open to everyone; the rest opens on enrolment.`}>
              <ol className="space-y-3">
                {modules.map((m, i) => (
                  <li key={m.id} className="surface p-4">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {i + 1}. {m.title}
                    </p>
                    {m.description && <p className="mt-1 text-sm text-slate-500">{m.description}</p>}
                    <ul className="mt-2 space-y-1">
                      {m.lessons.map((l) => (
                        <li key={l.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          {l.locked ? <Lock className="h-3.5 w-3.5 text-slate-400" /> : <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />}
                          <span className="flex-1">{l.title}</span>
                          {l.isPreview && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">preview</span>}
                          {l.durationMinutes ? <span className="text-xs text-slate-400">{l.durationMinutes} min</span> : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </div>

        <aside className="surface h-fit space-y-3 p-5 lg:sticky lg:top-6">
          {enrolled ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                You are enrolled
                {course.progress ? ` · ${course.progress.percent}% through` : ''}.
              </p>
              <Link href={`/dashboard/learn/${course.id}`} className="btn-primary flex items-center justify-center gap-2">
                Continue in the classroom <ArrowRight className="h-4 w-4" />
              </Link>
              {course.progress?.certificate && (
                <Link href={`/certificates/${course.progress.certificate.code}`} className="block text-center text-sm text-primary-600 hover:underline">
                  Your certificate
                </Link>
              )}
            </>
          ) : isAuthenticated ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">{course.isActive === false ? 'This course is not taking enrolments at the moment.' : 'Enrol to open every lesson and track your progress. A certificate is issued when all of them are done.'}</p>
              <button type="button" onClick={onEnrol} disabled={enrol.isPending || course.isActive === false} className="btn-primary flex w-full items-center justify-center gap-2">
                {enrol.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />} Enrol
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">Sign in to enrol. Previews on this page are open without an account.</p>
              <Link href={`/login?redirect=${encodeURIComponent(`/courses/${course.slug}`)}`} className="btn-primary flex items-center justify-center gap-2">
                Sign in to enrol <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/register" className="block text-center text-sm text-primary-600 hover:underline">
                New here? Create an account
              </Link>
            </>
          )}
          <p className="text-xs text-slate-500">Listed by {provider}. Facts on this page are as the provider gave them.</p>
        </aside>
      </div>
    </PageShell>
  );
}
