'use client';

/**
 * /mentors — the public mentor listing.
 *
 * This page used to be a brochure listing three mentors who do not exist,
 * complete with invented 4.8-5.0 ratings. They are gone. The page now reads
 * the real mentorProfile table through GET /api/mentors, which today returns
 * an empty list — so the empty state below is what people actually see, and it
 * is written to be useful rather than apologetic.
 *
 * Note the response envelope: this endpoint returns `{ mentors, pagination }`
 * directly, not the `{ success, data }` shape most of the API uses.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  ClipboardList,
  CreditCard,
  MessageSquare,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  EmptyState,
  FilterPill,
  PageHero,
  PageShell,
  Section,
  TileSkeleton,
} from '@/components/layout/PageShell';
import { mentorApi } from '@/lib/api';

/* ----------------------------------------------------------------- types */

type MentorUser = {
  id: string;
  displayName: string | null;
  avatar: string | null;
  headline: string | null;
  bio: string | null;
};

/**
 * `specializations` is a Json column and `hourlyRate` is a Decimal, which
 * arrives over JSON as a string. Both are typed loosely here and normalised
 * before they are rendered.
 */
type Mentor = {
  id: string;
  specializations?: unknown;
  yearsExperience?: number | null;
  hourlyRate?: number | string | null;
  isAvailable?: boolean;
  user?: MentorUser | null;
};

/* ------------------------------------------------------------- formatting */

const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 2,
});

function hourlyRate(value: Mentor['hourlyRate']): string | null {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
  return aud.format(amount);
}

function specialisations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function initials(name: string | null | undefined): string {
  if (!name) return '·';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/* ------------------------------------------------------------------- page */

export default function MentorsPage() {
  const [mentors, setMentors] = useState<Mentor[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;

    mentorApi
      .getAll({ limit: 60 })
      .then((response) => {
        if (cancelled) return;
        // `{ mentors, pagination }` — not the usual `{ success, data }`.
        const list = response.data?.mentors;
        setMentors(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setMentors([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    if (!mentors) return [];
    const needle = search.trim().toLowerCase();

    return mentors.filter((mentor) => {
      if (availableOnly && mentor.isAvailable === false) return false;
      if (!needle) return true;

      const haystack = [
        mentor.user?.displayName,
        mentor.user?.headline,
        ...specialisations(mentor.specializations),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [mentors, search, availableOnly]);

  const clearFilters = () => {
    setSearch('');
    setAvailableOnly(false);
  };

  const loading = mentors === null;
  const nothingListed = !loading && mentors.length === 0;

  return (
    <PageShell width="wide">
      <div className="space-y-5">
        <PageHero
          kicker="Mentoring"
          title="Book an hour with someone who has already done the thing you are trying to do."
          description="Mentors here are paid for their time and booked by the hour. You bring the question you are stuck on, they bring what they learnt the hard way."
          primaryAction={{ label: 'Become a mentor', href: '/dashboard/mentors/become-mentor' }}
          secondaryAction={{ label: 'Create an account', href: '/register' }}
          facts={[
            'Paid by the hour',
            'Rates set by each mentor, shown in AUD',
            'Your card is only charged once the session is done',
          ]}
        />

        {/* The filter row only appears once there is something to filter. */}
        {!loading && !nothingListed && (
          <div className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Search mentors</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, role or specialisation"
                className="focusable w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
              />
            </label>
            <FilterPill active={availableOnly} onClick={() => setAvailableOnly((value) => !value)}>
              Taking bookings
            </FilterPill>
          </div>
        )}

        <Section
          icon={Users}
          title="Mentors"
          description={
            loading
              ? 'Loading mentors.'
              : nothingListed
                ? 'Nobody has listed themselves as a mentor yet.'
                : `${visible.length} ${visible.length === 1 ? 'mentor' : 'mentors'} listed.`
          }
        >
          {loading ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <TileSkeleton count={3} className="h-44" />
            </ul>
          ) : nothingListed ? (
            <EmptyState
              icon={Users}
              reason="empty"
              title={failed ? 'We could not load the mentor list' : 'No mentors have listed yet'}
              description={
                failed
                  ? 'Something went wrong reaching the mentor list. Reload the page, and if it keeps happening tell us through the help centre.'
                  : 'Mentoring on ATHENA is paid work, booked by the hour, and nobody has put their name down yet. If you have experience worth an hour of someone else’s time, you can be the first. If you are here to be mentored, make an account and we will tell you when mentors start listing.'
              }
              primaryAction={
                failed
                  ? { label: 'Go to the help centre', href: '/help' }
                  : { label: 'List yourself as a mentor', href: '/dashboard/mentors/become-mentor' }
              }
              secondaryAction={
                failed ? undefined : { label: 'Create an account', href: '/register' }
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Search}
              reason="filtered"
              title="No mentors match that"
              description="Nothing in the current list matches your search. Clear the filters to see everyone who has listed."
              onClear={clearFilters}
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((mentor) => {
                const specs = specialisations(mentor.specializations);
                const rate = hourlyRate(mentor.hourlyRate);
                const name = mentor.user?.displayName?.trim() || 'ATHENA mentor';
                const available = mentor.isAvailable !== false;

                return (
                  <li key={mentor.id} className="tile-soft flex flex-col p-4">
                    <div className="flex items-start gap-3">
                      {mentor.user?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mentor.user.avatar}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                        >
                          {initials(mentor.user?.displayName)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {name}
                        </p>
                        {mentor.user?.headline && (
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {mentor.user.headline}
                          </p>
                        )}
                      </div>
                    </div>

                    {specs.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {specs.slice(0, 3).map((spec) => (
                          <li
                            key={spec}
                            className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {spec}
                          </li>
                        ))}
                        {specs.length > 3 && (
                          <li className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            +{specs.length - 3}
                          </li>
                        )}
                      </ul>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {rate ? `${rate} an hour` : 'Rate not set'}
                      </span>
                      <span
                        className={
                          available
                            ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }
                      >
                        {available ? 'Taking bookings' : 'Not taking bookings'}
                      </span>
                    </div>

                    <Link
                      href="/dashboard/mentors"
                      className="focusable mt-3 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                    >
                      Book a session
                      <span className="sr-only"> with {name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section
            icon={CalendarClock}
            title="How booking works"
            description="Three steps, and no surprises about money."
          >
            <ol className="space-y-3">
              {[
                {
                  title: 'Pick a mentor and a time',
                  body: 'You choose how long the session runs and send a note about what you want to cover. Sessions are priced by the hour at the rate on the mentor’s profile.',
                },
                {
                  title: 'The mentor accepts',
                  body: 'Your card is authorised when you request the session, not charged. If the mentor cannot take it, or either of you cancels, the hold is released.',
                },
                {
                  title: 'You meet, then you pay',
                  body: 'Payment is taken once the session is marked complete. ATHENA keeps 20% of each session and the rest goes to the mentor.',
                },
              ].map((step, index) => (
                <li key={step.title} className="tile-soft flex gap-3 p-4">
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section
            icon={ClipboardList}
            title="What to bring"
            description="An hour goes quickly. These are worth having ready."
          >
            <ul className="space-y-2">
              {[
                'One question you actually want answered, written down.',
                'The context behind it — the role, the application, the decision you are weighing up.',
                'Anything you want looked at, like a CV, a pitch or a piece of work.',
                'What a good outcome looks like, so you both know when you have got there.',
              ].map((item) => (
                <li
                  key={item}
                  className="tile-soft flex items-start gap-3 p-3 text-sm leading-6 text-slate-600 dark:text-slate-400"
                >
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section
            icon={ShieldCheck}
            title="Staying safe"
            description="What we do, and what you can do."
            action={{ label: 'Safety centre', href: '/safety-center' }}
          >
            <ul className="space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              <li>
                Keep the conversation and the booking on ATHENA. If someone pushes you onto another
                app before you have met, that is worth being careful about.
              </li>
              <li>
                Never pay a mentor directly. Every real session is paid through the booking flow, so
                there is a record if something goes wrong.
              </li>
              <li>
                If something is wrong, you can report a mentor from their profile or through the{' '}
                <Link
                  href="/report"
                  className="focusable font-semibold text-rose-600 underline dark:text-rose-400"
                >
                  report form
                </Link>
                .
              </li>
            </ul>
          </Section>

          <Section
            icon={CreditCard}
            title="Thinking of mentoring?"
            description="You set the rate and you choose which requests to take."
            action={{ label: 'List yourself', href: '/dashboard/mentors/become-mentor' }}
          >
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              You add your specialisations, your hourly rate and whether you are currently taking
              bookings. Requests arrive with a note about what the person wants help with, and you
              can decline any of them. ATHENA keeps 20% of each completed session and the remaining
              80% is paid out to you.
            </p>
          </Section>
        </div>
      </div>
    </PageShell>
  );
}
