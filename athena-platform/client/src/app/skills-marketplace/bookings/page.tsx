'use client';

/**
 * Consultations booked by the hour, from both sides.
 *
 * A buyer sees what she asked for and whether it was confirmed; a seller sees
 * what has been asked of her and confirms, starts or completes it. Once a
 * booking is complete the buyer can rate it, and that is the only way a
 * rating reaches a listing: the server refuses a review from anyone who has
 * not completed a booking or an order with that seller.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { CalendarClock, Check, Loader2, Star, X } from 'lucide-react';
import { skillsMarketplaceApi } from '@/lib/api-extensions';
import { apiMessage } from '@/lib/strategy-api';
import { BackToHome, EmptyState, PageShell } from '@/components/layout/PageShell';
import { cn, formatCurrency } from '@/lib/utils';

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

export default function BookingsPage() {
  const [role, setRole] = useState<'client' | 'provider'>('client');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');

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

  const move = async (booking: Booking, status: Booking['status'], said: string) => {
    setBusyId(booking.id);
    try {
      await skillsMarketplaceApi.updateBooking(booking.id, status);
      await load();
      toast.success(said);
    } catch (err) {
      toast.error(apiMessage(err, 'That could not be changed.'));
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
        </p>
      </header>

      <div className="mb-5 flex w-fit gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
        {([['client', 'Booked by me'], ['provider', 'Booked with me']] as Array<[typeof role, string]>).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={role === v} onClick={() => setRole(v)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium', role === v ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300')}>
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
            const open = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(booking.status);
            const isReviewing = reviewing === booking.id;
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
                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">{formatCurrency(booking.totalAmount)}</p>
                    {role === 'provider' && <p className="text-xs text-slate-500">{formatCurrency(booking.providerPayout)} to you</p>}
                  </div>
                </div>

                {open && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {role === 'provider' && booking.status === 'PENDING' && (
                      <button type="button" onClick={() => move(booking, 'CONFIRMED', 'Confirmed.')} disabled={busyId === booking.id} className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm">
                        <Check className="h-4 w-4" /> Confirm the time
                      </button>
                    )}
                    {role === 'provider' && booking.status === 'CONFIRMED' && (
                      <button type="button" onClick={() => move(booking, 'IN_PROGRESS', 'Marked as under way.')} disabled={busyId === booking.id} className="btn-secondary px-3 py-1.5 text-sm">
                        It is under way
                      </button>
                    )}
                    {booking.status === 'IN_PROGRESS' && (
                      <button type="button" onClick={() => move(booking, 'COMPLETED', 'Marked complete.')} disabled={busyId === booking.id} className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm">
                        <Check className="h-4 w-4" /> It is done
                      </button>
                    )}
                    <button type="button" onClick={() => move(booking, 'CANCELLED', 'Cancelled.')} disabled={busyId === booking.id} className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
                      <X className="h-4 w-4" /> Cancel
                    </button>
                  </div>
                )}

                {role === 'client' && booking.status === 'COMPLETED' && (
                  <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                    {isReviewing ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => setRating(n)}>
                              <Star className={cn('h-6 w-6', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600')} />
                            </button>
                          ))}
                        </div>
                        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="What was it like to work with her?" className="input w-full text-sm" />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => review(booking)} disabled={busyId === booking.id} className="btn-primary px-3 py-1.5 text-sm">
                            {busyId === booking.id ? 'Sending…' : 'Leave the review'}
                          </button>
                          <button type="button" onClick={() => setReviewing(null)} className="btn-ghost px-3 py-1.5 text-sm">Not now</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setReviewing(booking.id); setRating(5); setContent(''); }} className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:underline dark:text-rose-400">
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
    </PageShell>
  );
}
