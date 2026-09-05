'use client';

/**
 * A mentor's profile, with booking. The mentors list has linked "View
 * Profile" and "Book Session" here since it was built; the page did not
 * exist, so both buttons ended on a 404.
 *
 * Booking asks for a time, a length and a note, and requests the session.
 * The mentor confirms or declines from their sessions page. A mentor who has
 * not set a rate or enabled payments cannot be booked yet, and the page says
 * so instead of failing on submit.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Award, CalendarDays, Clock, Loader2, Star, Users } from 'lucide-react';
import { useAuthStore, useBookMentor, useMentor } from '@/lib/hooks';
import { formatCurrency } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { PaymentIntentForm } from '@/components/payments/PaymentIntentForm';

const DURATIONS = [30, 60, 90] as const;

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Half-hour slots from 07:00 to 20:30, the hours a session is realistically held. */
const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => {
  const hour = 7 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minute}`;
});

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function MentorProfilePage() {
  const params = useParams<{ id: string }>();
  const mentorId = params?.id ?? '';
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: mentor, isLoading, isError } = useMentor(mentorId);
  const book = useBookMentor();

  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(60);
  const [note, setNote] = useState('');
  // After booking: the payment to authorise, held until the session completes.
  const [payment, setPayment] = useState<{ clientSecret: string; amount: number } | null>(null);

  const hourlyRate = mentor?.hourlyRate !== null && mentor?.hourlyRate !== undefined ? Number(mentor.hourlyRate) : null;
  const rating = mentor?.rating !== null && mentor?.rating !== undefined ? Number(mentor.rating) : null;
  const specializations = useMemo(() => toStringArray(mentor?.specializations), [mentor?.specializations]);
  const name = mentor?.user?.displayName || 'ATHENA Mentor';
  const isOwnProfile = Boolean(user && mentor?.userId === user.id);
  const acceptsBookings = Boolean(mentor?.isAvailable && hourlyRate && hourlyRate > 0 && mentor?.stripeAccountId);
  const estimate = hourlyRate ? (hourlyRate * duration) / 60 : null;

  const scheduledAt = useMemo(() => {
    const value = new Date(`${date}T${time}:00`);
    return Number.isNaN(value.getTime()) ? null : value;
  }, [date, time]);
  const inPast = scheduledAt ? scheduledAt.getTime() < Date.now() : true;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!scheduledAt || inPast || !mentor) return;
    book.mutate(
      { mentorId: mentor.id, scheduledAt: scheduledAt.toISOString(), durationMinutes: duration, note: note.trim() || undefined },
      {
        onSuccess: (response) => {
          const secret: string | undefined = response.data?.paymentIntentClientSecret;
          const amount = Number(response.data?.session?.sessionAmount ?? estimate ?? 0);
          if (secret) setPayment({ clientSecret: secret, amount });
          else router.push('/dashboard/mentors/sessions');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isError || !mentor) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Link href="/dashboard/mentors" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> All mentors
        </Link>
        <div className="card mt-4 p-8 text-center text-slate-500">This mentor profile could not be found.</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Link href="/dashboard/mentors" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400">
        <ArrowLeft className="h-4 w-4" /> All mentors
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card space-y-5">
          <div className="flex items-start gap-4">
            <Avatar src={mentor.user?.avatar || undefined} alt={name} fallback={name.slice(0, 2).toUpperCase()} className="h-20 w-20" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{name}</h1>
              <p className="text-slate-500 dark:text-slate-400">{mentor.user?.headline || 'Career mentor'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center text-yellow-500">
                  <Star className="mr-1 h-4 w-4 fill-current" />
                  <span className="font-medium">{rating ? rating.toFixed(1) : 'New'}</span>
                  <span className="ml-1 text-slate-400">({mentor.reviewCount || 0})</span>
                </span>
                <span className="flex items-center text-slate-500 dark:text-slate-400">
                  <Users className="mr-1 h-4 w-4" /> {mentor.sessionCount || 0} sessions
                </span>
                {mentor.yearsExperience ? (
                  <span className="flex items-center text-slate-500 dark:text-slate-400">
                    <Award className="mr-1 h-4 w-4" /> {mentor.yearsExperience}+ years
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {specializations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {specializations.map((item) => (
                <span key={item} className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                  {item}
                </span>
              ))}
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">About</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {mentor.user?.bio || 'This mentor has not added a public bio yet.'}
            </p>
          </div>

          {mentor.user?.id && (
            <Link href={`/profile/${mentor.user.id}`} className="text-sm text-primary-600 hover:underline">
              View full profile
            </Link>
          )}
        </section>

        <aside className="card space-y-4 self-start">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Book a session</h2>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {hourlyRate ? `${formatCurrency(hourlyRate)}/hour` : 'Rate on request'}
            </span>
          </div>

          {payment ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Session requested. Authorise the payment now so the mentor can confirm; it is only charged once the session is completed.
              </p>
              <PaymentIntentForm
                clientSecret={payment.clientSecret}
                amountLabel={formatCurrency(payment.amount)}
                onAuthorised={() => router.push('/dashboard/mentors/sessions?paid=1')}
                onSkip={() => router.push('/dashboard/mentors/sessions')}
              />
            </div>
          ) : isOwnProfile ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This is your mentor profile. Requests from mentees appear on{' '}
              <Link href="/dashboard/mentors/sessions" className="text-primary-600 hover:underline">
                your sessions page
              </Link>
              .
            </p>
          ) : !user ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <Link href="/login" className="text-primary-600 hover:underline">
                Sign in
              </Link>{' '}
              to book a session.
            </p>
          ) : !acceptsBookings ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {mentor.isAvailable
                ? 'This mentor has not finished setting up bookings yet. Check back soon, or send them a message from their profile.'
                : 'This mentor is not taking new sessions right now.'}
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
                  <CalendarDays className="h-4 w-4" /> Date
                </span>
                <input type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} required className="input w-full" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
                  <Clock className="h-4 w-4" /> Time
                </span>
                <select value={time} onChange={(e) => setTime(e.target.value)} className="input w-full">
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="text-sm">
                <legend className="mb-1 font-medium text-slate-700 dark:text-slate-200">Length</legend>
                <div className="grid grid-cols-3 gap-2">
                  {DURATIONS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setDuration(minutes)}
                      aria-pressed={duration === minutes}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                        duration === minutes
                          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block text-sm">
                <span className="mb-1 font-medium text-slate-700 dark:text-slate-200">What would you like to cover?</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="A sentence or two helps the mentor prepare."
                  className="input w-full"
                />
              </label>

              {estimate !== null && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Estimated cost <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(estimate)}</span>. You
                  are charged only after the session is completed.
                </p>
              )}
              {inPast && <p className="text-xs text-red-600">Choose a time in the future.</p>}

              <button type="submit" disabled={book.isPending || inPast} className="btn-primary w-full py-2.5">
                {book.isPending ? 'Requesting…' : 'Request session'}
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                The mentor confirms or declines. You can follow it on{' '}
                <Link href="/dashboard/mentors/sessions" className="text-primary-600 hover:underline">
                  your sessions page
                </Link>
                .
              </p>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
