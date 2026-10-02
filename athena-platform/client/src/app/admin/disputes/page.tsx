'use client';

/**
 * Card disputes, for ATHENA's team.
 *
 * When a cardholder disputes a payment, Stripe takes the money out of ATHENA's
 * balance, asks for evidence by a deadline, and decides. Each dispute is recorded
 * here as the Stripe events arrive, with what it was for, who paid, when the
 * evidence is due and what ATHENA did when one was lost. Nothing here is
 * invented: the figures are Stripe's, and "what was done" is the list the server
 * wrote down when it did it.
 *
 * The one action is to end a pause on a creator's withdrawals. A dispute over
 * gift points can leave creators whose balances came from points that were
 * charged back; their withdrawals are paused while it is decided, and after a lost
 * dispute they stay paused until somebody here has decided what to do about them.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import { adminPaymentsApi, type AdminDispute, type DisputeOutcome } from '@/lib/admin-payments-api';
import { cn } from '@/lib/utils';

const FILTERS: Array<{ value: DisputeOutcome | 'ALL'; label: string }> = [
  { value: 'OPEN', label: 'Open' },
  { value: 'LOST', label: 'Lost' },
  { value: 'WON', label: 'Won' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ALL', label: 'All' },
];

const TONE: Record<DisputeOutcome, string> = {
  OPEN: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  LOST: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200',
  WON: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

/** Stripe's amounts are in minor units; a zero-decimal currency has none. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX', 'XAF', 'XOF', 'XPF']);

function formatMoney(amount: number, currency: string): string {
  const major = ZERO_DECIMAL.has(currency) ? amount : amount / 100;
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Whole days until a deadline, negative once it has passed. */
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

function DeadlineNote({ dispute }: { dispute: AdminDispute }) {
  if (!dispute.evidenceDueBy || dispute.outcome !== 'OPEN') return null;
  const days = daysUntil(dispute.evidenceDueBy);
  const urgent = days <= 3;
  return (
    <p className={cn('mt-2 text-sm', urgent ? 'font-medium text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400')}>
      {days < 0
        ? `Evidence was due ${day(dispute.evidenceDueBy)}. If it was not sent, Stripe has decided without it.`
        : days === 0
          ? 'Evidence is due today.'
          : `Evidence is due ${day(dispute.evidenceDueBy)}, in ${days} day${days === 1 ? '' : 's'}.`}{' '}
      Send it from the Stripe dashboard.
    </p>
  );
}

export default function AdminDisputesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<DisputeOutcome | 'ALL'>('OPEN');

  const disputes = useInfiniteQuery({
    queryKey: ['admin-disputes', filter],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await adminPaymentsApi.disputes({
        outcome: filter === 'ALL' ? undefined : filter,
        cursor: pageParam,
        limit: 25,
      });
      return res.data.data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const release = useMutation({
    mutationFn: (id: string) => adminPaymentsApi.releaseDisputeHolds(id),
    onSuccess: (res) => {
      const released = res.data.data.released;
      toast.success(
        released > 0
          ? `Withdrawals are open again for ${released} creator${released === 1 ? '' : 's'}.`
          : 'Nobody was released: another dispute still holds them, or this one is still open.'
      );
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
    },
    onError: () => toast.error('That did not go through. Nothing was changed.'),
  });

  const rows = disputes.data?.pages.flatMap((page) => page.disputes) ?? [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          href="/admin"
          className="mb-5 inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-600 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" /> Admin
        </Link>

        <header className="mb-6">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Card disputes</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">Payments a cardholder has disputed</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Stripe takes the money out of ATHENA’s balance while a dispute is decided and gives a deadline for evidence.
            Each one is listed here as Stripe reports it, with what ATHENA did when one was lost. A lost membership payment ends
            the membership; lost gift points are taken back from the member. Nothing is taken from a seller or a creator
            without somebody here deciding.
          </p>
        </header>

        <div className="mb-5 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Show disputes that are">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                'min-h-[44px] rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500',
                filter === value ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {disputes.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="Loading disputes" />
        ) : disputes.isError ? (
          <p className="surface p-6 text-sm text-slate-600 dark:text-slate-300">The disputes could not be loaded. Try again in a moment.</p>
        ) : rows.length === 0 ? (
          <p className="surface p-6 text-sm text-slate-600 dark:text-slate-300">
            {filter === 'OPEN' ? 'No disputes are open. When Stripe reports one it will appear here.' : 'No disputes match.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((dispute) => (
              <li key={dispute.id} className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">
                      {formatMoney(dispute.amount, dispute.currency)}{' '}
                      <span className="text-sm font-normal text-slate-600 dark:text-slate-400">for {dispute.kindLabel}</span>
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {dispute.member ? `Paid by ${dispute.member.name}. ` : ''}
                      Opened {day(dispute.openedAt)}
                      {dispute.reason ? ` · reason: ${dispute.reason.replace(/_/g, ' ')}` : ''}
                    </p>
                  </div>
                  <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', TONE[dispute.outcome])}>
                    {dispute.outcome.toLowerCase()}
                  </span>
                </div>

                <DeadlineNote dispute={dispute} />

                {dispute.fundsWithdrawn && dispute.outcome === 'OPEN' && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">The money is out of ATHENA’s Stripe balance until this is decided.</p>
                )}

                {dispute.applied.length > 0 && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What was done</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
                      {dispute.applied.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {dispute.creatorsHeld > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                    <p className="min-w-0 flex-1 text-sm text-amber-900 dark:text-amber-100">
                      Withdrawals are paused for {dispute.creatorsHeld} creator{dispute.creatorsHeld === 1 ? '' : 's'} because of this dispute.
                      {dispute.outcome === 'OPEN' ? ' The pause ends by itself if it is won.' : ''}
                    </p>
                    {dispute.outcome !== 'OPEN' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('End the pause on these creators’ withdrawals? Do this once you have decided what happens to their balances.')) {
                            release.mutate(dispute.id);
                          }
                        }}
                        disabled={release.isPending}
                        className="btn-secondary min-h-[44px] px-3 py-1.5 text-sm"
                      >
                        End the pause
                      </button>
                    )}
                  </div>
                )}

                <p className="mt-3 text-xs text-slate-500">
                  <a
                    href={`https://dashboard.stripe.com/disputes/${dispute.stripeDisputeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-rose-600 hover:underline dark:text-rose-400"
                  >
                    Open {dispute.stripeDisputeId} in Stripe
                  </a>
                </p>
              </li>
            ))}
          </ul>
        )}

        {disputes.hasNextPage && (
          <div className="mt-5">
            <button type="button" onClick={() => disputes.fetchNextPage()} disabled={disputes.isFetchingNextPage} className="btn-outline min-h-[44px] px-4 py-2 text-sm">
              {disputes.isFetchingNextPage ? 'Loading…' : 'Show more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
