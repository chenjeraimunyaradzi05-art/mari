'use client';

/**
 * Payments on hold: the money ATHENA is holding on her card until she says
 * what she paid for arrived.
 *
 * Most holds belong to something with a page of its own — a marketplace
 * order, a car purchase, a workshop job, a mentor session — and are released
 * or cancelled there, where that flow can check its own state first. Those are
 * listed with a link to that page. A hold made through the generic payment
 * route had no page at all: nobody could ask her to release it before the hold
 * on her card ran out, and only an admin could move it. Those she releases or
 * cancels here.
 *
 * Nothing here is shown as settled when it is not. A failed read says so and
 * offers a retry rather than an empty list, and each hold's status is the
 * row's own.
 */

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2, ShieldCheck, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { apiMessage } from '@/lib/strategy-api';
import { cn, getPreferredLocale } from '@/lib/utils';
import { formatMoney, fromMinorUnits } from '@/components/studios/mentor/EarningsDashboard';

type HoldOwner =
  | { kind: 'flow'; flow: string; href: string; label: string }
  | { kind: 'generic' }
  | { kind: 'orphaned' };

type Hold = {
  id: string;
  paymentIntentId: string | null;
  description: string;
  kind: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  lapsesAt: string | null;
  payee: string;
  owner: HoldOwner;
  canRelease: boolean;
  canCancel: boolean;
};

const STATUS: Record<string, { label: string; tone: string }> = {
  AUTHORIZED: { label: 'Held on your card', tone: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' },
  PENDING: { label: 'Payment not finished', tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  CAPTURED: { label: 'Released', tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' },
  CANCELED: { label: 'Cancelled, not charged', tone: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  REFUNDED: { label: 'Refunded', tone: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  FAILED: { label: 'Card declined', tone: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' },
};

const describeStatus = (status: string) =>
  STATUS[status] ?? { label: status.toLowerCase(), tone: STATUS.PENDING.tone };

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(getPreferredLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Australia/Brisbane',
  });

export default function HoldsPage() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<{ id: string; action: 'release' | 'cancel' } | null>(null);

  const holds = useQuery({
    queryKey: ['connect', 'holds'],
    queryFn: async () => {
      const { data } = await api.get('/connect/holds');
      return data.data as Hold[];
    },
  });

  const move = useMutation({
    mutationFn: async ({ hold, action }: { hold: Hold; action: 'release' | 'cancel' }) => {
      if (!hold.paymentIntentId) throw new Error('This payment has nothing to move');
      if (action === 'release') {
        await api.post(`/connect/escrow/${hold.paymentIntentId}/capture`);
      } else {
        await api.post(`/connect/escrow/${hold.paymentIntentId}/cancel`, { reason: 'Cancelled by the buyer' });
      }
      return action;
    },
    onSuccess: (action) => {
      toast.success(
        action === 'release'
          ? 'Released. The money is on its way to the person you paid.'
          : 'Cancelled. The hold on your card is being removed.'
      );
      setConfirming(null);
      queryClient.invalidateQueries({ queryKey: ['connect', 'holds'] });
    },
    onError: (error) => {
      toast.error(apiMessage(error, 'That did not go through. Nothing has been moved.'));
    },
  });

  const rows = holds.data ?? [];
  const held = rows.filter((h) => h.status === 'AUTHORIZED' || h.status === 'PENDING');
  const settled = rows.filter((h) => h.status !== 'AUTHORIZED' && h.status !== 'PENDING');

  const renderHold = (hold: Hold) => {
    const status = describeStatus(hold.status);
    const pending = confirming?.id === hold.id ? confirming.action : null;

    return (
      <li key={hold.id} className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white">{hold.description}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {hold.kind} · to {hold.payee}
            </p>
          </div>
          <div className="text-right">
            <p className="tabular-nums text-lg font-semibold text-slate-900 dark:text-white">
              {formatMoney(fromMinorUnits(hold.amount, hold.currency), hold.currency)}
            </p>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', status.tone)}>{status.label}</span>
          </div>
        </div>

        {hold.lapsesAt && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            The hold on your card lasts until about {day(hold.lapsesAt)}. If it is not released by then it
            expires: you are not charged, and the person you paid is not paid.
          </p>
        )}

        {hold.owner.kind === 'flow' && (hold.status === 'AUTHORIZED' || hold.status === 'PENDING') && (
          <Link
            href={hold.owner.href}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:underline dark:text-rose-400"
          >
            {hold.owner.label} to release or cancel it <ArrowRight className="h-4 w-4" />
          </Link>
        )}

        {hold.owner.kind === 'orphaned' && hold.canCancel && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Nothing is attached to this payment any more, so it cannot be released to anyone. Cancel it to
            have the hold on your card removed.
          </p>
        )}

        {(hold.canRelease || hold.canCancel) && (
          pending ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900 dark:bg-rose-950/30">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {pending === 'release'
                  ? `Release ${formatMoney(fromMinorUnits(hold.amount, hold.currency), hold.currency)} to ${hold.payee}? Only do this if you have received what you paid for. It cannot be undone here.`
                  : 'Cancel this payment? The hold on your card is removed and you are not charged.'}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => move.mutate({ hold, action: pending })}
                  disabled={move.isPending}
                  className="btn-primary inline-flex items-center gap-1.5"
                >
                  {move.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pending === 'release' ? 'Yes, release it' : 'Yes, cancel it'}
                </button>
                <button type="button" onClick={() => setConfirming(null)} disabled={move.isPending} className="btn-secondary">
                  Not now
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {hold.canRelease && (
                <button
                  type="button"
                  onClick={() => setConfirming({ id: hold.id, action: 'release' })}
                  className="btn-primary"
                >
                  I received it, release the payment
                </button>
              )}
              {hold.canCancel && (
                <button
                  type="button"
                  onClick={() => setConfirming({ id: hold.id, action: 'cancel' })}
                  className="btn-secondary"
                >
                  Cancel the payment
                </button>
              )}
            </div>
          )
        )}
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Wallet className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Payments on hold</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">
            Money held until you say so
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            When you pay someone through ATHENA, the money is held on your card and only goes to them once you
            confirm you received what you paid for.
          </p>
        </div>
        <Link href="/dashboard/finance" className="btn-secondary">Finance hub</Link>
      </div>

      {holds.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : holds.isError ? (
        <div className="rounded-2xl border border-slate-200 p-6 text-sm dark:border-slate-800">
          <p className="font-medium text-slate-900 dark:text-white">Your payments could not be loaded just now.</p>
          <button type="button" onClick={() => holds.refetch()} className="btn-secondary mt-3">
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 p-8 text-center dark:border-slate-800">
          <ShieldCheck className="mx-auto h-10 w-10 text-emerald-400" />
          <p className="mt-3 font-semibold text-slate-900 dark:text-white">Nothing is held on your card</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            When you pay for something through ATHENA, it appears here until it is released.
          </p>
        </div>
      ) : (
        <>
          {held.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Held now</h2>
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {held.map(renderHold)}
              </ul>
            </section>
          )}
          {settled.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Settled in the last 90 days
              </h2>
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {settled.map(renderHold)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
