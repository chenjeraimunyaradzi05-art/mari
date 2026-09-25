'use client';

/**
 * An accelerator completion certificate, checkable by anyone with its
 * address: an investor or an employer can see the founder finished the
 * programme, in which cohort, how long it ran and when.
 *
 * The length is whatever that cohort actually was. The server used to floor it
 * at twelve, which was true of the default curriculum and a false claim on this
 * public page the moment staff ran a shorter pilot intake.
 *
 * The page also says who checked what. Completion here is the founder's own
 * record: she marks each week done in her dashboard, and the enrolment becomes
 * COMPLETED once there is a record for every week of the cohort and the cohort
 * has reached its end date. There is no mentor sign-off, no attendance register
 * and no review of the deliverables — so a page an investor is invited to rely
 * on has to say so. Printing "completed the programme" and stopping there
 * invited a reader to assume a verification that nobody performed.
 */

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Award, Loader2 } from 'lucide-react';
import { strategyApi } from '@/lib/strategy-api';

type Certificate = { code: string; holder: string; cohort: { name: string; startDate: string; endDate: string }; completedAt: string; weeks: number };

export default function AcceleratorCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const certificate = useQuery({
    queryKey: ['accelerator-certificate', id],
    queryFn: () => strategyApi.business.acceleratorCertificate(id),
    select: (r) => r.data?.data as Certificate,
    retry: false,
  });
  const date = (s: string) => new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      {certificate.isLoading ? (
        <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-rose-500" /></div>
      ) : certificate.isError || !certificate.data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">No certificate at this address</p>
          <p className="mt-1 text-sm text-slate-500">A certificate is issued when a founder completes every week of a cohort.</p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-rose-200 bg-white p-10 text-center shadow-sm dark:border-rose-900/50 dark:bg-slate-900">
          <Award className="mx-auto h-14 w-14 text-rose-500" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Certificate of completion</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">{certificate.data.holder}</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">completed the {certificate.data.weeks}-week ATHENA Business Growth Accelerator</p>
          <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{certificate.data.cohort.name}</p>
          <p className="text-sm text-slate-500">{date(certificate.data.cohort.startDate)} to {date(certificate.data.cohort.endDate)}</p>
          <p className="mt-6 text-sm text-slate-500">
            Completed {date(certificate.data.completedAt)} · code <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{certificate.data.code}</code>
          </p>
          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left text-xs leading-5 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <p className="font-semibold text-slate-600 dark:text-slate-300">What ATHENA checked</p>
            <p className="mt-1">
              {certificate.data.holder} held a place in this cohort, the cohort ran to {date(certificate.data.cohort.endDate)},
              and she recorded her work for each of its {certificate.data.weeks} weeks. Those weekly records are her own.
              ATHENA does not take an attendance register and does not assess the deliverables.
            </p>
          </div>
          <p className="mt-4 text-xs text-slate-400">Anyone can confirm this certificate at this address. <Link href="/accelerator" className="text-rose-600 hover:underline">About the accelerator</Link></p>
        </div>
      )}
    </div>
  );
}
