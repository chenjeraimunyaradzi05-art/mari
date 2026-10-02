'use client';

/**
 * Hourly bookings a buyer says were not given, for ATHENA's team to settle.
 *
 * A booking holds its price on the buyer's card and takes it only when the buyer
 * says the time was given. When the buyer says it was not, the money stays held and the
 * booking waits here. A card only holds money for about a week, so the list shows
 * when each hold runs out and puts the oldest first: after that date there is
 * nothing left to release, and the booking can only be closed.
 *
 * Two decisions, each written to the audit log against who made it: release the
 * payment to the provider, or give it back to the buyer's card. Both people are
 * told. Nothing here is invented: the figures are the booking's, and what the
 * buyer said is what was typed.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, CalendarX2, Loader2 } from 'lucide-react';
import { adminPaymentsApi, type DisputedBooking } from '@/lib/admin-payments-api';
import { formatAud } from '@/components/skills-marketplace/types';
import { cn } from '@/lib/utils';

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short' });
const time = (iso: string) =>
  new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const length = (mins: number) => (mins < 60 ? `${mins} min` : `${mins / 60} hr`);
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

/** Whether the buyer's money can still be moved. */
const holdIsLive = (booking: DisputedBooking) => Boolean(booking.hold && booking.hold.lapsesAt);

/**
 * The payment has already gone to the provider (the expiry sweep or an admin took it
 * before the buyer disputed). There is no hold to release or give back: the server
 * refuses to give it back from here, so the one thing left is to close the booking
 * as paid, and a refund, if one is due, is made in Stripe.
 */
const alreadyReleased = (booking: DisputedBooking) => booking.hold?.status === 'CAPTURED';

function HoldNote({ booking }: { booking: DisputedBooking }) {
  if (!booking.hold) {
    return <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Nothing was ever held for this booking, so it can only be closed.</p>;
  }
  if (alreadyReleased(booking)) {
    return (
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        The payment has already been released to the provider, so it cannot be given back from here. Closing the booking records it as paid;
        if the buyer is owed a refund, make it in Stripe.
      </p>
    );
  }
  if (!booking.hold.lapsesAt) {
    return (
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        The hold on the buyer’s card has ended ({booking.hold.status.toLowerCase()}), so there is no money left to release. Closing the booking gives it back.
      </p>
    );
  }
  const days = daysUntil(booking.hold.lapsesAt);
  return (
    <p className={cn('mt-2 text-sm', days <= 2 ? 'font-medium text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400')}>
      {days < 0
        ? 'The hold on the buyer’s card is past its date and may already have ended.'
        : days === 0
          ? 'The hold on the buyer’s card runs out today.'
          : `The hold on the buyer’s card runs out on ${day(booking.hold.lapsesAt)}, in ${days} day${days === 1 ? '' : 's'}.`}{' '}
      Decide before then, or there is nothing left to release.
    </p>
  );
}

export default function AdminBookingDisputesPage() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<Record<string, string>>({});

  const bookings = useQuery({
    queryKey: ['admin-booking-disputes'],
    queryFn: async () => (await adminPaymentsApi.disputedBookings()).data.data,
  });

  const settle = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: 'release' | 'return' }) =>
      adminPaymentsApi.settleBooking(id, outcome, note[id]?.trim() || undefined),
    onSuccess: (_res, { outcome }) => {
      toast.success(outcome === 'release' ? 'Released to the provider. Both people have been told.' : 'Given back to the buyer’s card. Both people have been told.');
      queryClient.invalidateQueries({ queryKey: ['admin-booking-disputes'] });
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message ?? 'That did not go through. Nothing was changed.');
    },
  });

  const rows = bookings.data ?? [];

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
            <CalendarX2 className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Bookings in dispute</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">Hourly bookings a buyer says were not given</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            The buyer’s card is held, not charged, while a booking is decided. Releasing the payment pays the provider; giving it back
            releases the hold and takes nothing from the buyer. Both people are told what you decided, and it is written to the audit log.
          </p>
        </header>

        {bookings.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="Loading bookings" />
        ) : bookings.isError ? (
          <p className="surface p-6 text-sm text-slate-600 dark:text-slate-300">The bookings could not be loaded. Try again in a moment.</p>
        ) : rows.length === 0 ? (
          <p className="surface p-6 text-sm text-slate-600 dark:text-slate-300">No bookings are in dispute. If a buyer says one was not given it will appear here.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((booking) => {
              const live = holdIsLive(booking);
              const released = alreadyReleased(booking);
              const busy = settle.isPending && settle.variables?.id === booking.id;
              const provider = booking.service.provider?.displayName ?? 'the provider';
              const buyer = booking.client.displayName ?? 'the buyer';
              return (
                <li key={booking.id} className="surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold">{booking.service.title}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {buyer} booked {provider} for {time(booking.scheduledAt)} · {length(booking.durationMinutes)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatAud(booking.totalAmount)}</p>
                      <p className="text-xs text-slate-500">{formatAud(booking.providerPayout)} to the provider</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      What the buyer said{booking.disputedAt ? ` on ${day(booking.disputedAt)}` : ''}
                    </p>
                    <p className="mt-1 text-slate-700 dark:text-slate-300">{booking.disputeReason ?? 'The buyer did not say why.'}</p>
                  </div>

                  <HoldNote booking={booking} />

                  <label className="mt-3 block text-sm text-slate-700 dark:text-slate-300">
                    <span className="mb-1 block font-medium">A note, if you want one on the record (optional)</span>
                    <textarea
                      value={note[booking.id] ?? ''}
                      onChange={(e) => setNote({ ...note, [booking.id]: e.target.value })}
                      rows={2}
                      maxLength={2000}
                      className="input w-full text-sm"
                    />
                  </label>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || !(live || released)}
                      title={live || released ? undefined : 'The hold has ended, so there is nothing to release.'}
                      onClick={() => {
                        const question = released
                          ? `Close this booking as paid to ${provider}? The payment has already been released.`
                          : `Release ${formatAud(booking.totalAmount)} to ${provider}? The buyer’s card is charged.`;
                        if (window.confirm(question)) {
                          settle.mutate({ id: booking.id, outcome: 'release' });
                        }
                      }}
                      className="btn-primary min-h-[44px] px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {released ? 'Close it as paid' : 'Release to the provider'}
                    </button>
                    {!released && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Give the hold back to ${buyer}'s card? ${provider} is not paid.`)) {
                            settle.mutate({ id: booking.id, outcome: 'return' });
                          }
                        }}
                        className="btn-secondary min-h-[44px] px-3 py-1.5 text-sm"
                      >
                        {live ? 'Give it back to the buyer' : 'Close the booking'}
                      </button>
                    )}
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
