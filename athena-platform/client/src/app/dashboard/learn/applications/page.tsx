'use client';

import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMyEducationApplications } from '@/lib/hooks';
import { educationApi } from '@/lib/api';
import { CardSkeleton } from '@/components/ui/loading';

type Application = {
  id: string;
  status: 'SUBMITTED' | 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  programName: string | null;
  submittedAt: string | null;
  organization: { name: string; slug: string } | null;
  course: { title: string } | null;
};

const STATUS_LABEL: Record<Application['status'], string> = {
  SUBMITTED: 'Submitted',
  IN_REVIEW: 'In review',
  ACCEPTED: 'Accepted',
  REJECTED: 'Not offered a place',
  WITHDRAWN: 'Withdrawn',
};

// The server has let an applicant withdraw since the status rules were
// tightened, and the route is tested — but nothing on this page called it, so
// the only way to take an application back was to ask the provider. An
// accepted place is still a conversation with the provider rather than a
// button here, which is the rule the server holds too.
const WITHDRAWABLE: Application['status'][] = ['SUBMITTED', 'IN_REVIEW'];

export default function MyEducationApplicationsPage() {
  const { data, isLoading, isError, refetch } = useMyEducationApplications();
  const queryClient = useQueryClient();

  const withdraw = useMutation({
    mutationFn: (id: string) => educationApi.updateApplication(id, { status: 'WITHDRAWN' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-education-applications'] });
      toast.success('Application withdrawn');
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(message || 'We could not withdraw that application. Try again in a moment.');
    },
  });

  const applications: Application[] = Array.isArray(data) ? data : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Education Applications</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track your submitted applications</p>
        </div>
        <Link href="/dashboard/learn/providers" className="btn-outline px-6 py-2.5 text-center">
          Browse Providers
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        // A failed load is not "no applications yet". Saying so would tell a
        // woman who has applied that her application is gone.
        <div className="card p-10 text-center" role="alert">
          <p className="text-slate-900 dark:text-white font-medium">We could not load your applications</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Nothing has changed on your applications. Try again in a moment.
          </p>
          <button type="button" onClick={() => refetch()} className="btn-outline mt-4 px-6 py-2.5">
            Try again
          </button>
        </div>
      ) : applications.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <ClipboardList className="w-6 h-6 text-slate-600 dark:text-slate-300" />
          </div>
          <p className="text-slate-900 dark:text-white font-medium">No applications yet</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Apply to a provider or course to start tracking.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((a) => {
            const withdrawing = withdraw.isPending && withdraw.variables === a.id;
            return (
              <div key={a.id} className="card">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {a.course?.title || a.programName || 'Application'}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {a.organization?.name || 'Provider'}
                      {a.submittedAt ? ` • Submitted ${new Date(a.submittedAt).toLocaleDateString('en-AU')}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    {a.organization?.slug ? (
                      <Link
                        href={`/dashboard/learn/providers/${a.organization.slug}`}
                        className="btn-outline px-4 py-2"
                      >
                        View Provider
                      </Link>
                    ) : null}
                    {WITHDRAWABLE.includes(a.status) ? (
                      <button
                        type="button"
                        className="btn-outline px-4 py-2"
                        disabled={withdraw.isPending}
                        onClick={() => {
                          const name = a.course?.title || a.programName || 'this application';
                          if (window.confirm(`Withdraw your application for ${name}? The provider will stop considering it.`)) {
                            withdraw.mutate(a.id);
                          }
                        }}
                      >
                        {withdrawing ? 'Withdrawing…' : 'Withdraw'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
