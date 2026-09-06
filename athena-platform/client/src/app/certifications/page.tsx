'use client';

/**
 * Certificates.
 *
 * This page used to be a brochure: six invented certification categories and
 * three "ATHENA Academy" programmes with enrolment counts and star ratings
 * nobody had ever measured. It now shows two real things: the certificates
 * the signed-in learner has earned (each with the code an employer can check
 * at /certificates/:code), and the courses in the catalogue that issue one.
 * Where there is nothing yet, it says so.
 */

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, Clock, Search, ShieldCheck } from 'lucide-react';
import { courseApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { EmptyState, PageHero, PageShell, Section, TileSkeleton } from '@/components/layout/PageShell';

type Certificate = {
  id: string;
  code: string;
  issuedAt: string;
  course: { id: string; title: string; slug: string; providerName: string | null; type: string | null; durationMonths: number | null };
};

type Course = {
  id: string;
  title: string;
  slug: string;
  description: string;
  providerName?: string | null;
  type?: string | null;
  durationMonths?: number | null;
  cost?: number | null;
  organization?: { name: string } | null;
};

const money = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${new Intl.NumberFormat('en-AU').format(n)}`);

function duration(months?: number | null): string | null {
  if (!months) return null;
  if (months < 12) return `${months} mo`;
  const years = months / 12;
  return Number.isInteger(years) ? `${years} yr` : `${years.toFixed(1)} yr`;
}

const issued = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

export default function CertificationsPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [code, setCode] = useState('');

  const mine = useQuery({
    queryKey: ['my-certificates'],
    queryFn: () => courseApi.myCertificates(),
    enabled: isAuthenticated,
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Certificate[]) : []),
  });

  const courses = useQuery({
    queryKey: ['courses', { type: 'certificate', limit: 12 }],
    queryFn: () => courseApi.getAll({ type: 'certificate', limit: 12 }),
    select: (r) => (Array.isArray(r.data?.data) ? (r.data.data as Course[]) : []),
  });

  const check = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed) router.push(`/certificates/${encodeURIComponent(trimmed)}`);
  };

  return (
    <PageShell width="wide">
      <PageHero
        kicker="Learning"
        title="Certificates"
        description="A certificate on ATHENA is issued when every lesson of a course is complete. Each one carries a ten-character code anyone can check, so an employer can see it is real without asking you."
        primaryAction={isAuthenticated ? { label: 'Courses you have started', href: '/dashboard/learn/my-courses' } : { label: 'Sign in to see yours', href: '/login?next=/certifications' }}
        secondaryAction={{ label: 'Browse all courses', href: '/courses' }}
      />

      {isAuthenticated && (
        <Section icon={Award} title="Your certificates" description="Newest first. Share the link; the code is checkable by anyone.">
          {mine.isLoading ? (
            <TileSkeleton count={2} />
          ) : (mine.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Award}
              reason="empty"
              title="No certificates yet"
              description="Finish every lesson of a course and its certificate appears here with a code you can share."
              primaryAction={{ label: 'Courses you have started', href: '/dashboard/learn/my-courses' }}
              secondaryAction={{ label: 'Find a course', href: '/courses' }}
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {mine.data!.map((c) => (
                <li key={c.id} className="surface p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/20">
                      <Award className="h-5 w-5 text-primary-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white">{c.course.title}</h3>
                      <p className="text-sm text-slate-500">
                        {c.course.providerName || 'ATHENA'} · issued {issued(c.issuedAt)}
                      </p>
                      <p className="mt-2 font-mono text-sm tracking-widest text-slate-700 dark:text-slate-300">{c.code}</p>
                      <Link href={`/certificates/${c.code}`} className="mt-2 inline-block text-sm text-primary-600 hover:underline">
                        Open the checkable certificate
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section icon={BookOpen} title="Courses that issue a certificate" description="From the catalogue, as providers list them." action={{ label: 'All courses', href: '/courses' }}>
        {courses.isLoading ? (
          <TileSkeleton count={3} />
        ) : (courses.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={BookOpen}
            reason="empty"
            title="No certificate courses listed yet"
            description="Providers list their courses themselves. The full catalogue may still have short courses and diplomas worth a look."
            primaryAction={{ label: 'Browse all courses', href: '/courses' }}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.data!.map((course) => (
              <li key={course.id}>
                <Link href={`/dashboard/learn/${course.id}`} className="surface block h-full p-5 transition hover:shadow-md">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{course.title}</h3>
                  <p className="text-sm text-slate-500">{course.providerName || course.organization?.name || 'Provider not stated'}</p>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{course.description}</p>
                  <p className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    {duration(course.durationMonths) && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {duration(course.durationMonths)}
                      </span>
                    )}
                    <span>{course.cost == null ? 'Cost on enquiry' : course.cost === 0 ? 'Fee-free' : money(course.cost)}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={ShieldCheck} title="Check a certificate" description="Given a code by a candidate? See who earned it, for which course, and when.">
        <form onSubmit={check} className="flex max-w-md flex-wrap gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ten-character code"
            aria-label="Certificate code"
            maxLength={12}
            className="input min-w-[200px] flex-1 font-mono uppercase tracking-widest"
          />
          <button type="submit" disabled={!code.trim()} className="btn-primary inline-flex items-center gap-2">
            <Search className="h-4 w-4" /> Check
          </button>
        </form>
      </Section>
    </PageShell>
  );
}
