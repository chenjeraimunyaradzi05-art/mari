'use client';

/**
 * A course certificate, checkable by anyone with its code: an employer given
 * the code can see it is real, who earned it, for which course, and when.
 */

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Award, Loader2 } from 'lucide-react';
import { courseApi } from '@/lib/api';

type Certificate = {
  code: string;
  issuedAt: string;
  learner: string;
  course: { id: string; title: string; slug: string; provider: string };
};

export default function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const certificate = useQuery({
    queryKey: ['certificate', code],
    queryFn: () => courseApi.certificate(code),
    select: (r) => r.data?.data as Certificate,
    retry: false,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      {certificate.isLoading ? (
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : certificate.isError || !certificate.data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">No certificate with that code</p>
          <p className="mt-1 text-sm text-slate-500">Check the code and try again. Codes are ten characters.</p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-primary-200 bg-white p-10 text-center shadow-sm dark:border-primary-900/50 dark:bg-slate-900">
          <Award className="mx-auto h-14 w-14 text-primary-500" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Certificate of completion</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">{certificate.data.learner}</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">completed every lesson of</p>
          <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{certificate.data.course.title}</p>
          <p className="text-sm text-slate-500">offered by {certificate.data.course.provider} on ATHENA</p>
          <p className="mt-6 text-sm text-slate-500">
            Issued {new Date(certificate.data.issuedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} · code{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{certificate.data.code}</code>
          </p>
          <p className="mt-6 text-xs text-slate-400">
            Anyone can confirm this certificate at this address. Course details:{' '}
            <Link href={`/dashboard/learn/${certificate.data.course.id}`} className="text-primary-600 hover:underline">
              {certificate.data.course.slug}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
