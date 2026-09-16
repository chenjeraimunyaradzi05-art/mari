'use client';

/**
 * The appeals a member has lodged, and what came of them.
 *
 * Appealing a moderation decision worked: the form posted one and handed back
 * a ticket number on screen. After that the member had nowhere to look. An
 * appeal she cannot follow is not really an appeal, and the platform's own
 * transparency commitments promise a decision she can see. This lists each
 * one with its status and, once a reviewer has written one, the reason for
 * the decision.
 */

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Clock, FileQuestion, Loader2, Scale, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { BackToHome, EmptyState, PageShell } from '@/components/layout/PageShell';
import { cn, formatDate } from '@/lib/utils';

type Appeal = {
  id: string;
  type: 'CONTENT_MODERATION' | 'ACCOUNT_SUSPENSION' | 'VERIFICATION_DECISION' | 'OTHER';
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  reason: string;
  decisionNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
};

const TYPE_LABEL: Record<Appeal['type'], string> = {
  CONTENT_MODERATION: 'Something of mine was removed or hidden',
  ACCOUNT_SUSPENSION: 'My account was suspended',
  VERIFICATION_DECISION: 'A verification decision',
  OTHER: 'Something else',
};

const STATUS: Record<Appeal['status'], { label: string; tone: string; icon: typeof Clock; says: string }> = {
  PENDING: { label: 'Waiting to be picked up', tone: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200', icon: Clock, says: 'Nobody has started on this yet. You will see it change here.' },
  UNDER_REVIEW: { label: 'Being looked at', tone: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200', icon: Loader2, says: 'Someone is reviewing it now.' },
  APPROVED: { label: 'Upheld', tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200', icon: CheckCircle2, says: 'The original decision was overturned.' },
  REJECTED: { label: 'Not upheld', tone: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200', icon: XCircle, says: 'The original decision stands.' },
};

export default function MyAppealsPage() {
  // Someone checking an appeal is often the person an enforcement action was
  // taken against, and the shared client sends an unrecoverable 401 to the
  // login page. The appeal form reads the status itself for the same reason;
  // this does too, so a locked-out member gets told what is going on instead
  // of being bounced to a sign-in she may not be able to complete.
  const appeals = useQuery({
    queryKey: ['my-appeals'],
    queryFn: () => api.get('/appeals/me', { validateStatus: () => true }),
    select: (r) => ({ status: r.status, rows: (r.data?.data ?? []) as Appeal[] }),
    retry: false,
  });

  const needsSignIn = appeals.data?.status === 401;
  const failed = appeals.isError || (appeals.data ? appeals.data.status >= 400 && !needsSignIn : false);
  const rows = needsSignIn || failed ? [] : appeals.data?.rows ?? [];

  return (
    <PageShell width="default" showBack={false}>
      <BackToHome href="/help" label="Back to help" />

      <header className="mb-6">
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <Scale className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Appeals</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">What you have appealed</h1>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Every appeal you have lodged, where it has got to, and the reason given once it has been decided.
        </p>
      </header>

      {appeals.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : needsSignIn ? (
        <div className="surface p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            An appeal is attached to your account, so you need to be signed in to see it. If your account is suspended and
            you cannot sign in, quote your appeal reference and{' '}
            <Link href="/contact" className="font-medium text-rose-600 hover:underline dark:text-rose-400">write to us</Link> instead.
          </p>
          <Link href="/login?redirect=/help/appeals" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:underline dark:text-rose-400">
            Sign in <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : failed ? (
        <div className="surface p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Your appeals could not be loaded just now. Nothing has happened to them; try again shortly.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          reason="empty"
          title="You have not appealed anything"
          description="If something of yours was removed, or a decision went against you and you think it was wrong, you can ask for it to be looked at again."
          primaryAction={{ label: 'Lodge an appeal', href: '/help/appeal' }}
          secondaryAction={{ label: 'How moderation works', href: '/help/transparency-report' }}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((appeal) => {
            const state = STATUS[appeal.status];
            const Icon = state.icon;
            const decided = appeal.status === 'APPROVED' || appeal.status === 'REJECTED';
            return (
              <li key={appeal.id} className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{TYPE_LABEL[appeal.type]}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Lodged {formatDate(appeal.createdAt)}
                      {appeal.reviewedAt ? ` · decided ${formatDate(appeal.reviewedAt)}` : ''} · reference{' '}
                      <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">{appeal.id.slice(0, 8)}</code>
                    </p>
                  </div>
                  <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', state.tone)}>
                    <Icon className={cn('h-3.5 w-3.5', appeal.status === 'UNDER_REVIEW' && 'animate-spin')} />
                    {state.label}
                  </span>
                </div>

                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  {appeal.reason}
                </p>

                <div className="mt-3 text-sm">
                  <p className="text-slate-600 dark:text-slate-400">{state.says}</p>
                  {decided && appeal.decisionNote && (
                    <p className="mt-2 border-l-2 border-rose-300 pl-3 leading-6 text-slate-800 dark:border-rose-700 dark:text-slate-200">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Why</span>
                      {appeal.decisionNote}
                    </p>
                  )}
                  {decided && !appeal.decisionNote && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No reason was recorded with this decision.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-slate-500 dark:text-slate-400">
        An appeal is read by someone who did not make the original decision. If you disagree with the outcome you can{' '}
        <Link href="/contact" className="font-medium text-rose-600 hover:underline dark:text-rose-400">write to us</Link>, and in Australia you can also raise a complaint with the eSafety Commissioner.
      </p>
    </PageShell>
  );
}
