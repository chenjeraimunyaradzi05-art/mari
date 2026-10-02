'use client';

/**
 * Mentoring sessions and marketplace orders a buyer says were not delivered, for
 * ATHENA's team to decide.
 *
 * The buyer's money is held on her card (or, for a session charged before she
 * objected, taken but not paid on) while a dispute is open. The provider may have
 * answered once. Two decisions, each written to the audit log against who made
 * it: release the payment to the provider, or give it back to the buyer. A card
 * only holds money for about a week, so the list shows when each hold runs out
 * and puts the oldest first. A payment the buyer's bank is also disputing is
 * never given back from here, because that could return the money twice. Both
 * people are told what was decided. Nothing here is invented: the figures are
 * the session's or the order's, and what each person said is what they typed.
 * Hourly bookings in dispute have their own page.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Scale } from 'lucide-react';
import { adminPaymentsApi, type AdminServiceDispute } from '@/lib/admin-payments-api';
import { cn } from '@/lib/utils';

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short' });
const time = (iso: string) =>
  new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

/** A session is priced to the cent and an order in whole dollars; each is shown as it is. */
function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Whether the buyer's money is still held and can be moved either way. */
const holdIsLive = (d: AdminServiceDispute) => Boolean(d.hold && d.hold.lapsesAt);

/**
 * The payment has already gone to the provider (the mentee's confirmation window
 * ran out before she objected, or an admin released it). Releasing closes the
 * dispute as paid; giving it back refunds the buyer and reverses the provider's
 * share through the escrow service.
 */
const alreadyReleased = (d: AdminServiceDispute) => d.hold?.status === 'CAPTURED';

function HoldNote({ dispute }: { dispute: AdminServiceDispute }) {
  if (!dispute.hold) {
    return (
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {dispute.kind === 'session'
          ? 'No hold record is on file for this session: it was booked before holds were recorded. The payment is moved by its card authorisation when you decide.'
          : 'Nothing is held for this order, so there is nothing to release or give back.'}
      </p>
    );
  }
  if (alreadyReleased(dispute)) {
    return (
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        The payment has already been released to the provider. Closing it as paid leaves it there; refunding the buyer takes the
        provider’s share back.
      </p>
    );
  }
  if (!dispute.hold.lapsesAt) {
    return (
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        The hold on the buyer’s card has ended ({dispute.hold.status.toLowerCase()}), so there is no money left to release. Giving it
        back closes the dispute.
      </p>
    );
  }
  const days = daysUntil(dispute.hold.lapsesAt);
  return (
    <p className={cn('mt-2 text-sm', days <= 2 ? 'font-medium text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400')}>
      {days < 0
        ? 'The hold on the buyer’s card is past its date and may already have ended.'
        : days === 0
          ? 'The hold on the buyer’s card runs out today.'
          : `The hold on the buyer’s card runs out on ${day(dispute.hold.lapsesAt)}, in ${days} day${days === 1 ? '' : 's'}.`}{' '}
      Decide before then, or there is nothing left to release.
    </p>
  );
}

function CardDisputeNote({ dispute }: { dispute: AdminServiceDispute }) {
  if (!dispute.cardDispute) return null;
  return (
    <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200">
      The buyer’s bank has also disputed this payment ({dispute.cardDispute.stripeDisputeId}). It cannot be given back from here while
      that is open, or the money could go back twice. Settle it in Stripe first
      {dispute.cardDispute.evidenceDueBy ? `; evidence is due ${day(dispute.cardDispute.evidenceDueBy)}` : ''}.
    </p>
  );
}

export default function AdminServiceDisputesPage() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<Record<string, string>>({});

  const disputes = useQuery({
    queryKey: ['admin-service-disputes'],
    queryFn: async () => (await adminPaymentsApi.serviceDisputes()).data.data.disputes,
  });

  const decide = useMutation({
    mutationFn: ({ dispute, outcome }: { dispute: AdminServiceDispute; outcome: 'release' | 'refund' }) =>
      adminPaymentsApi.resolveServiceDispute(dispute.kind, dispute.id, outcome, note[dispute.id]?.trim() || undefined),
    onSuccess: (_res, { outcome }) => {
      toast.success(outcome === 'release' ? 'Released to the provider. Both people have been told.' : 'Given back to the buyer. Both people have been told.');
      queryClient.invalidateQueries({ queryKey: ['admin-service-disputes'] });
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message ?? 'That did not go through. Nothing was changed.');
    },
  });

  const rows = disputes.data ?? [];

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
            <Scale className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Sessions and orders in dispute</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">Paid work a buyer says was not delivered</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            The buyer’s money stays held while a dispute is decided, and neither person can change the session or the order. Releasing
            the payment pays the provider; giving it back releases the hold, or refunds a payment already taken and reverses the
            provider’s share. Both people are told what you decided, and it is written to the audit log.
          </p>
        </header>

        {disputes.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="Loading disputes" />
        ) : disputes.isError ? (
          <p className="surface p-6 text-sm text-slate-600 dark:text-slate-300">The disputes could not be loaded. Try again in a moment.</p>
        ) : rows.length === 0 ? (
          <p className="surface p-6 text-sm text-slate-600 dark:text-slate-300">
            No session or order is in dispute. When a buyer says one was not delivered it will appear here.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((dispute) => {
              const live = holdIsLive(dispute);
              const released = alreadyReleased(dispute);
              const busy = decide.isPending && decide.variables?.dispute.id === dispute.id;
              const canRelease = live || released || (dispute.kind === 'session' && !dispute.hold);
              const canRefund = !dispute.cardDispute;
              const amount = money(dispute.amount, dispute.currency);
              return (
                <li key={`${dispute.kind}-${dispute.id}`} className="surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {dispute.kind === 'session' ? 'Mentoring session' : 'Marketplace order'}
                      </p>
                      <p className="text-lg font-semibold">{dispute.title}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {dispute.kind === 'session' && dispute.scheduledAt
                          ? `${dispute.buyer.name} booked ${dispute.provider.name} for ${time(dispute.scheduledAt)}`
                          : `${dispute.buyer.name} ordered from ${dispute.provider.name}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{amount}</p>
                      <p className="text-xs text-slate-500">{money(dispute.providerPayout, dispute.currency)} to the provider</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      What the buyer said{dispute.disputedAt ? ` on ${day(dispute.disputedAt)}` : ''}
                    </p>
                    <p className="mt-1 text-slate-700 dark:text-slate-300">{dispute.reason ?? 'The buyer did not say why.'}</p>
                  </div>

                  <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      The provider’s answer{dispute.respondedAt ? ` on ${day(dispute.respondedAt)}` : ''}
                    </p>
                    <p className="mt-1 text-slate-700 dark:text-slate-300">{dispute.response ?? 'The provider has not answered yet.'}</p>
                  </div>

                  <HoldNote dispute={dispute} />
                  <CardDisputeNote dispute={dispute} />

                  <label className="mt-3 block text-sm text-slate-700 dark:text-slate-300">
                    <span className="mb-1 block font-medium">A note, if you want one on the record (optional)</span>
                    <textarea
                      value={note[dispute.id] ?? ''}
                      onChange={(e) => setNote({ ...note, [dispute.id]: e.target.value })}
                      rows={2}
                      maxLength={2000}
                      className="input w-full text-sm"
                    />
                  </label>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || !canRelease}
                      title={canRelease ? undefined : 'The hold has ended, so there is nothing to release.'}
                      onClick={() => {
                        const question = released
                          ? `Close this as paid to ${dispute.provider.name}? The payment has already been released.`
                          : `Release ${amount} to ${dispute.provider.name}? The buyer’s card is charged.`;
                        if (window.confirm(question)) decide.mutate({ dispute, outcome: 'release' });
                      }}
                      className="btn-primary min-h-[44px] px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {released ? 'Close it as paid' : 'Release to the provider'}
                    </button>
                    <button
                      type="button"
                      disabled={busy || !canRefund}
                      title={canRefund ? undefined : 'The buyer’s bank is disputing this payment. Settle that in Stripe first.'}
                      onClick={() => {
                        const question = released
                          ? `Refund ${amount} to ${dispute.buyer.name}? ${dispute.provider.name}’s share is taken back.`
                          : `Give the ${amount} back to ${dispute.buyer.name}? ${dispute.provider.name} is not paid.`;
                        if (window.confirm(question)) decide.mutate({ dispute, outcome: 'refund' });
                      }}
                      className="btn-secondary min-h-[44px] px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {released ? 'Refund the buyer' : live || !dispute.hold ? 'Give it back to the buyer' : 'Close the dispute'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
