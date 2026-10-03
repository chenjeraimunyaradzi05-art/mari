'use client';

/**
 * Consultations booked by the hour, from both sides.
 *
 * A buyer sees what was asked for, whether the card is held for it, and says when
 * the time was given, which is what pays the seller. A seller sees what has been
 * asked and confirms it, once the buyer's money is really held, then starts
 * it. Neither side can write the other's step: the server refuses it. Once a
 * booking is complete the buyer can rate it, and that is the only way a rating
 * reaches a listing: the server refuses a review from anyone who has not
 * completed a booking or an order with that seller.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { CalendarClock, Check, Loader2, Star, X } from 'lucide-react';
import { skillsMarketplaceApi } from '@/lib/api-extensions';
import { apiMessage } from '@/lib/strategy-api';
import { BackToHome, EmptyState, PageShell } from '@/components/layout/PageShell';
import { Modal } from '@/components/ui/modal';
import { PaymentIntentForm } from '@/components/payments/PaymentIntentForm';
import { cn } from '@/lib/utils';
import { formatAud } from '@/components/skills-marketplace/types';

type Escrow = { status: string; amount: number; currency: string; paymentIntentId?: string | null };

type Booking = {
  id: string;
  serviceId: string;
  clientId: string;
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  scheduledAt: string;
  durationMinutes: number;
  totalAmount: number;
  platformFee: number;
  providerPayout: number;
  clientNotes?: string | null;
  completedAt?: string | null;
  /** The buyer's money. Null for a booking made before bookings were paid. */
  escrow?: Escrow | null;
  service?: { id: string; title: string; hourlyRate?: number; provider?: { id: string; displayName?: string | null } | null } | null;
};

const TONE: Record<Booking['status'], string> = {
  PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  IN_PROGRESS: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  DISPUTED: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200',
};

const when = (iso: string) => new Date(iso).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const length = (mins: number) => (mins < 60 ? `${mins} min` : `${mins / 60} hr`);

/**
 * A thread about this booking, opened with a line that names the listing and the
 * time, so neither side has to work out which booking it is. The line lands in the
 * composer to be read, changed and sent; nothing is sent for the member.
 */
function messageHref(booking: Booking, role: 'client' | 'provider'): string | null {
  const otherId = role === 'client' ? booking.service?.provider?.id : booking.clientId;
  if (!otherId) return null;
  const opener = `Hi, about the booking for "${booking.service?.title ?? 'your service'}" on ${when(booking.scheduledAt)}: `;
  return `/dashboard/messages?user=${encodeURIComponent(otherId)}&text=${encodeURIComponent(opener)}`;
}

/**
 * The buyer's money is really held, or already taken. A deployment with no Stripe
 * key (never production) hands out mock holds that no webhook ever authorises, and
 * the server counts those as held, so this does too.
 */
const isMockHold = (escrow: Escrow | null | undefined) =>
  escrow?.status === 'PENDING' && Boolean(escrow.paymentIntentId?.startsWith('pi_mock_'));
const isHeld = (escrow: Escrow | null | undefined) =>
  escrow?.status === 'AUTHORIZED' || escrow?.status === 'CAPTURED' || isMockHold(escrow);

/**
 * What to say about the money, in words each side can act on. Never a figure for
 * money that is not there: a provider is shown what will be paid only once the
 * buyer's card is held.
 */
function moneyNote(booking: Booking, role: 'client' | 'provider'): string | null {
  const escrow = booking.escrow;
  if (!escrow) {
    return role === 'client'
      ? 'This booking was made before bookings were paid through ATHENA, so nothing was held. It can only be cancelled.'
      : 'This booking was made before bookings were paid through ATHENA, so there is nothing to pay you from. It can only be cancelled.';
  }
  switch (escrow.status) {
    case 'PENDING':
      return role === 'client' ? 'Waiting for your card to be held.' : 'Waiting for the buyer’s card to be held.';
    case 'AUTHORIZED':
      return role === 'client'
        ? 'Held on your card. It is taken only when you say the session was given.'
        : `${formatAud(booking.providerPayout)} to you once the session is given.`;
    case 'CAPTURED':
      return role === 'client' ? 'Paid.' : `${formatAud(booking.providerPayout)} paid to you.`;
    case 'CANCELED':
      return 'The hold on the card was released. Nothing was taken.';
    case 'FAILED':
      return 'The card payment did not go through. Nothing was taken.';
    case 'REFUNDED':
      return 'Refunded to the buyer.';
    default:
      return null;
  }
}

export default function BookingsPage() {
  const [role, setRole] = useState<'client' | 'provider'>('client');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [disputing, setDisputing] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [paying, setPaying] = useState<{ bookingId: string; clientSecret: string; amount: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await skillsMarketplaceApi.getMyBookings(role);
      setBookings(res.data?.data ?? []);
      setError(null);
    } catch (err) {
      setError(apiMessage(err, 'Your bookings could not be loaded.'));
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { load(); }, [load]);

  const move = async (booking: Booking, status: 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED', said: string, reason?: string) => {
    setBusyId(booking.id);
    try {
      await skillsMarketplaceApi.updateBooking(booking.id, status, reason);
      await load();
      toast.success(said);
    } catch (err) {
      toast.error(apiMessage(err, 'That could not be changed.'));
    } finally {
      setBusyId(null);
    }
  };

  // The card step for a booking whose hold was never completed: the time was asked
  // for, the window was closed, and the provider cannot confirm until it is.
  const finishPayment = async (booking: Booking) => {
    setBusyId(booking.id);
    try {
      const res = await skillsMarketplaceApi.getBookingPayment(booking.id);
      const data = res.data?.data as { clientSecret: string | null; amount: number } | undefined;
      if (!data?.clientSecret) {
        await load();
        toast('That payment has already been dealt with.');
        return;
      }
      setPaying({ bookingId: booking.id, clientSecret: data.clientSecret, amount: data.amount });
    } catch (err) {
      toast.error(apiMessage(err, 'The payment step could not be opened.'));
    } finally {
      setBusyId(null);
    }
  };

  const review = async (booking: Booking) => {
    setBusyId(booking.id);
    try {
      await skillsMarketplaceApi.reviewService(booking.serviceId, { rating, content: content.trim() || undefined, bookingId: booking.id });
      setReviewing(null);
      setContent('');
      setRating(5);
      toast.success('Thank you. Your rating is on the listing.');
    } catch (err) {
      toast.error(apiMessage(err, 'That review could not be left.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageShell width="default" showBack={false}>
      <BackToHome href="/skills-marketplace" label="Back to the marketplace" />

      <header className="mb-6">
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <CalendarClock className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Bookings</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">Time booked by the hour</h1>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Consultations, as distinct from fixed-price work, which lives under <Link href="/skills-marketplace/orders" className="font-medium text-rose-600 hover:underline dark:text-rose-400">orders</Link>.
          The buyer’s card is held when a time is asked for and only charged when the buyer says it was given.
        </p>
      </header>

      <div className="mb-5 flex w-fit gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
        {([['client', 'Booked by me'], ['provider', 'Booked with me']] as Array<[typeof role, string]>).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={role === v} onClick={() => setRole(v)} className={cn('min-h-[44px] rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500', role === v ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300')}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : error ? (
        <p className="surface p-6 text-sm text-slate-600 dark:text-slate-300">{error}</p>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          reason="empty"
          title={role === 'client' ? 'You have not booked anyone yet' : 'Nobody has booked you yet'}
          description={role === 'client' ? 'Find someone who sells time by the hour and pick a slot that suits you.' : 'Listings with an hourly rate can be booked directly. Make sure yours has one and is taking work.'}
          primaryAction={role === 'client' ? { label: 'Browse the marketplace', href: '/skills-marketplace' } : { label: 'Your listings', href: '/skills-marketplace/sell' }}
        />
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => {
            const isReviewing = reviewing === booking.id;
            const isDisputing = disputing === booking.id;
            const held = isHeld(booking.escrow);
            const note = moneyNote(booking, role);
            const started = new Date(booking.scheduledAt).getTime() <= Date.now();
            const busy = busyId === booking.id;
            const canCancel = booking.status === 'PENDING' || booking.status === 'CONFIRMED';
            const waitingOnCard = booking.escrow?.status === 'PENDING' && !isMockHold(booking.escrow) && booking.status === 'PENDING';
            const giveable = booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS';
            return (
              <li key={booking.id} className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/skills-marketplace/${booking.serviceId}`} className="font-semibold text-slate-900 hover:underline dark:text-white">
                      {booking.service?.title ?? 'A service'}
                    </Link>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {when(booking.scheduledAt)} · {length(booking.durationMinutes)}
                      {role === 'client' && booking.service?.provider?.displayName ? ` · with ${booking.service.provider.displayName}` : ''}
                    </p>
                    {booking.clientNotes && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">{booking.clientNotes}</p>}
                  </div>
                  <div className="text-right">
                    <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-semibold', TONE[booking.status])}>{booking.status.replace('_', ' ').toLowerCase()}</span>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">{formatAud(booking.totalAmount)}</p>
                  </div>
                </div>

                {note && <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{note}</p>}

                {booking.status === 'DISPUTED' && (
                  <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                    ATHENA’s team is looking at this booking. The payment stays held until it is settled.
                  </p>
                )}

                {(canCancel || giveable) && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {role === 'client' && waitingOnCard && (
                      <button type="button" onClick={() => finishPayment(booking)} disabled={busy} className="btn-primary inline-flex min-h-[44px] items-center gap-1.5 px-3 py-1.5 text-sm">
                        Finish the payment
                      </button>
                    )}
                    {role === 'provider' && booking.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => move(booking, 'CONFIRMED', 'Confirmed.')}
                        disabled={busy || !held}
                        title={held ? undefined : 'You can confirm once the buyer’s card is held.'}
                        className="btn-primary inline-flex min-h-[44px] items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> Confirm the time
                      </button>
                    )}
                    {role === 'provider' && booking.status === 'CONFIRMED' && (
                      <button type="button" onClick={() => move(booking, 'IN_PROGRESS', 'Marked as under way.')} disabled={busy} className="btn-secondary min-h-[44px] px-3 py-1.5 text-sm">
                        It is under way
                      </button>
                    )}
                    {role === 'client' && giveable && (
                      <>
                        <button
                          type="button"
                          onClick={() => move(booking, 'COMPLETED', 'Thank you. The payment has been released.')}
                          disabled={busy || !started}
                          title={started ? undefined : 'You can say it was given once the session has started.'}
                          className="btn-primary inline-flex min-h-[44px] items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" /> The session was given
                        </button>
                        {started && (
                          <button type="button" onClick={() => { setDisputing(booking.id); setDisputeReason(''); }} disabled={busy} className="btn-ghost min-h-[44px] px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
                            Something went wrong
                          </button>
                        )}
                      </>
                    )}
                    {canCancel && (
                      <button type="button" onClick={() => move(booking, 'CANCELLED', 'Cancelled. Nothing has been taken from the card.')} disabled={busy} className="btn-ghost inline-flex min-h-[44px] items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
                        <X className="h-4 w-4" /> Cancel
                      </button>
                    )}
                  </div>
                )}

                {role === 'client' && giveable && !started && (
                  <p className="mt-2 text-xs text-slate-500">You can say the session was given once it has started. Until then, nothing is taken.</p>
                )}

                {messageHref(booking, role) && booking.status !== 'CANCELLED' && (
                  <p className="mt-3">
                    <Link href={messageHref(booking, role)!} className="inline-flex min-h-[44px] items-center text-sm font-medium text-rose-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-rose-400">
                      {role === 'client' ? 'Message the provider about this booking' : 'Message the buyer about this booking'}
                    </Link>
                  </p>
                )}

                {isDisputing && (
                  <div className="mt-4 space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <label className="block text-sm text-slate-700 dark:text-slate-300">
                      <span className="mb-1 block font-medium">What went wrong?</span>
                      <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} rows={3} maxLength={2000} className="input w-full text-sm" placeholder="The provider did not turn up, or the session was not what was agreed." />
                    </label>
                    <p className="text-xs text-slate-500">The payment stays held, and nothing is taken, while ATHENA’s team looks at it.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => { await move(booking, 'DISPUTED', 'Sent to ATHENA’s team. The payment stays held.', disputeReason.trim() || undefined); setDisputing(null); }}
                        disabled={busy}
                        className="btn-primary min-h-[44px] px-3 py-1.5 text-sm"
                      >
                        Send it to ATHENA
                      </button>
                      <button type="button" onClick={() => setDisputing(null)} className="btn-ghost min-h-[44px] px-3 py-1.5 text-sm">Not now</button>
                    </div>
                  </div>
                )}

                {role === 'client' && booking.status === 'COMPLETED' && (
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    {isReviewing ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => setRating(n)} className="min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                              <Star className={cn('mx-auto h-6 w-6', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600')} />
                            </button>
                          ))}
                        </div>
                        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="What was it like to work with them?" className="input w-full text-sm" />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => review(booking)} disabled={busyId === booking.id} className="btn-primary min-h-[44px] px-3 py-1.5 text-sm">
                            {busyId === booking.id ? 'Sending…' : 'Leave the review'}
                          </button>
                          <button type="button" onClick={() => setReviewing(null)} className="btn-ghost min-h-[44px] px-3 py-1.5 text-sm">Not now</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setReviewing(booking.id); setRating(5); setContent(''); }} className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">
                        <Star className="h-4 w-4" /> Rate this session
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {paying && (
        <Modal isOpen onClose={() => setPaying(null)} title="Hold the payment">
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {formatAud(paying.amount / 100)} is held on your card now and only taken when you say the session was given.
              Cancel before it starts and the hold is released.
            </p>
            <PaymentIntentForm
              clientSecret={paying.clientSecret}
              amountLabel={formatAud(paying.amount / 100)}
              onAuthorised={() => { setPaying(null); load(); toast.success('Your card is held. The provider can confirm the time now.'); }}
              onSkip={() => setPaying(null)}
              skipLabel="Not now"
            />
          </div>
        </Modal>
      )}
    </PageShell>
  );
}
