'use client';

/**
 * A mentor's profile, with booking. The mentors list has linked "View
 * Profile" and "Book Session" here since it was built; the page did not
 * exist, so both buttons ended on a 404.
 *
 * Booking offers ATHENA's standard hours — 9 to 5, Monday to Friday, in the
 * mentor's own time zone — minus the sessions already booked with her,
 * converted into the viewer's time zone. Mentors do not set their own hours:
 * there is no availability model yet, only that fixed grid and the pause
 * switch. This page used to call the grid "her free hours", which told a
 * mentee she was booking time the mentor had chosen to offer; she is asking
 * for an hour inside the standard day, which the mentor then accepts or
 * declines from her sessions page. A length and a note go with it. A mentor
 * who has not set a rate or enabled payments cannot be booked yet, and the
 * page says so instead of failing on submit.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Award, CalendarDays, Clock, Loader2, Users } from 'lucide-react';
import { useAuthStore, useBookMentor, useMentor } from '@/lib/hooks';
import { mentorApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { SESSION_CONFIRMATION_HOURS } from '@/lib/pricing';
import { Avatar } from '@/components/ui/avatar';
import { VerifiedMark } from '@/components/ui/VerifiedMark';
import { PaymentIntentForm } from '@/components/payments/PaymentIntentForm';

const DURATIONS = [30, 60, 90] as const;

type Slot = { start: string; end: string; displayTime: string };

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function todayIso(daysAhead = 0): string {
  const day = new Date();
  day.setDate(day.getDate() + daysAhead);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

/** The viewer's own timezone, so the offered times are the times she keeps. */
function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export default function MentorProfilePage() {
  const params = useParams<{ id: string }>();
  const mentorId = params?.id ?? '';
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: mentor, isLoading, isError } = useMentor(mentorId);
  const book = useBookMentor();

  const [date, setDate] = useState(todayIso());
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(60);
  const [note, setNote] = useState('');
  // After booking: the payment to authorise, held until the session completes.
  const [payment, setPayment] = useState<{ clientSecret: string; amount: number } | null>(null);

  const hourlyRate = mentor?.hourlyRate !== null && mentor?.hourlyRate !== undefined ? Number(mentor.hourlyRate) : null;
  const specializations = useMemo(() => toStringArray(mentor?.specializations), [mentor?.specializations]);
  const name = mentor?.user?.displayName || 'ATHENA Mentor';
  const isOwnProfile = Boolean(user && mentor?.userId === user.id);
  // `acceptsBookings` is the answer the server gives, and it is the whole
  // answer. This used to be re-derived here from `isAvailable`, a positive
  // hourly rate and a raw Stripe account id — and the day the account id came
  // off the public payload, which it should never have been on, the expression
  // fell to `undefined` for every mentor and this page told every visitor that
  // every mentor had not finished setting up bookings. It also hard-coded the
  // assumption that a mentor charges: a rate of zero, which is a woman
  // choosing to mentor for nothing, read as unbookable.
  const acceptsBookings = Boolean(mentor?.acceptsBookings);
  const isFree = hourlyRate === 0;
  const estimate = hourlyRate !== null ? (hourlyRate * duration) / 60 : null;

  // The standard hours on this day that nobody has booked with her yet. See
  // the note at the top: not hours she chose.
  const {
    data: availability,
    isLoading: slotsLoading,
    isError: slotsError,
  } = useQuery({
    queryKey: ['mentor-slots', mentorId, date],
    queryFn: () => mentorApi.slots(mentorId, date, browserTimezone()),
    enabled: Boolean(mentorId) && acceptsBookings,
  });

  const slots: Slot[] = useMemo(() => availability?.data?.slots ?? [], [availability]);
  const slotTimezone: string | undefined = availability?.data?.timezone;
  // A paid session is held on her card from the moment it is requested, and a
  // card hold lasts about a week, so the server only books a paid session a few
  // days ahead and says how many. A mentor who charges nothing has no limit. The
  // page follows the server's number rather than keeping a copy of it.
  const paidDaysAhead: number | null =
    !isFree && typeof availability?.data?.paidSessionsDaysAhead === 'number' ? availability.data.paidSessionsDaysAhead : null;
  const latestDate = paidDaysAhead !== null ? todayIso(paidDaysAhead) : undefined;
  const beyondLimit = latestDate !== undefined && date > latestDate;

  // A day change invalidates whatever was picked on the previous one.
  useEffect(() => {
    setSelectedStart(null);
  }, [date]);

  const scheduledAt = useMemo(() => {
    if (!selectedStart) return null;
    const value = new Date(selectedStart);
    return Number.isNaN(value.getTime()) ? null : value;
  }, [selectedStart]);
  const inPast = scheduledAt ? scheduledAt.getTime() < Date.now() : false;

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
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                {name}
                {mentor.user?.isVerified === true && <VerifiedMark />}
              </h1>
              <p className="text-slate-500 dark:text-slate-400">{mentor.user?.headline || 'Career mentor'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                {/* No star rating: nothing on the platform writes one, so every
                    profile showed "New (0)" beside a filled star. */}
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
            {/* The rate is typed and charged in Australian dollars, whatever currency
                the viewer prefers, so it is shown as AUD and not relabelled. */}
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {hourlyRate ? `${formatCurrency(hourlyRate, 'AUD')}/hour` : 'Rate on request'}
            </span>
          </div>

          {payment ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Session requested. Authorise the payment now so the mentor can confirm; it is only charged once the session
                has happened: when you confirm it, or {SESSION_CONFIRMATION_HOURS} hours after your mentor marks it complete
                unless you say it did not take place. The mentor sees your request once the payment is authorised, and a
                request that is not paid for within a few hours is cancelled.
              </p>
              <PaymentIntentForm
                clientSecret={payment.clientSecret}
                amountLabel={formatCurrency(payment.amount, 'AUD')}
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
                <input type="date" value={date} min={todayIso()} max={latestDate} onChange={(e) => setDate(e.target.value)} required className="input w-full" />
              </label>
              <fieldset className="text-sm">
                <legend className="mb-1 flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
                  <Clock className="h-4 w-4" /> When suits you?
                </legend>

                {slotsLoading ? (
                  <div className="flex items-center gap-2 py-3 text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Checking which hours are still open…
                  </div>
                ) : slotsError ? (
                  <p className="py-3 text-slate-500 dark:text-slate-400">
                    We could not load her availability just now, so no hours are shown. Try another day, or
                    refresh.
                  </p>
                ) : slots.length === 0 && beyondLimit ? (
                  <p className="py-3 text-slate-500 dark:text-slate-400">
                    Paid sessions can be booked up to {paidDaysAhead} days ahead, because the hold on your card lasts about
                    a week and your mentor is paid once the hour has been given. Pick a nearer date.
                  </p>
                ) : slots.length === 0 ? (
                  <p className="py-3 text-slate-500 dark:text-slate-400">
                    Nothing free on this day within ATHENA&apos;s standard hours, 9 to 5 on weekdays in her time
                    zone: those hours are already booked or have passed. Try another date, or message her from
                    her profile to ask for a time that works.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map((slot) => (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => setSelectedStart(slot.start)}
                          aria-pressed={selectedStart === slot.start}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                            selectedStart === slot.start
                              ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {slot.displayTime}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      These are ATHENA&apos;s standard hours, 9 to 5 in her time zone, minus sessions already
                      booked. They are not hours she has chosen, so she may decline one that does not suit her.
                      {slotTimezone ? ` Times shown in ${slotTimezone.replace(/_/g, ' ')}.` : ''}
                    </p>
                  </>
                )}
              </fieldset>
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
                  Estimated cost <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(estimate, 'AUD')}</span>.
                  Your card is held now and charged only once the session has happened.
                </p>
              )}
              {inPast && <p className="text-xs text-red-600">That time has just passed. Pick another.</p>}

              <button
                type="submit"
                disabled={book.isPending || inPast || !selectedStart}
                className="btn-primary w-full py-2.5"
              >
                {book.isPending ? 'Requesting…' : selectedStart ? 'Request session' : 'Pick a time'}
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
