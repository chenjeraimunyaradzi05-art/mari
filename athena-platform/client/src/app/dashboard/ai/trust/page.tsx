'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, Flag, Shield } from 'lucide-react';
import { trustApi } from '@/lib/algorithm-api';

/**
 * Trust score.
 *
 * This page used to show userTrustScore.trustScore from
 * /api/ai-algorithms/trust-score: a row that starts at 50 with no badges and
 * only ever moves when someone is reported or blocked. It could tell a member
 * a number and nothing about why.
 *
 * It now reads /api/trust-score, which computes the score from things she can
 * act on (email verified, LinkedIn, website, verification badges, completed
 * referrals, contributions, suspension) and returns each factor with its
 * points. Every factor she has not earned yet is shown with the page that earns
 * it.
 *
 * It also had a report form that asked a member to type a content ID and a user
 * ID, and posted them to a route that wrote the report row as sent: no check
 * that the user named was the author of the content, no reference, no review
 * deadline, no alert and no safety-score update. Nobody can report from a form
 * that asks for database IDs, and a report that is filed that way is handled
 * worse than one filed from the report button. It is gone; the section below
 * points at the real report page.
 *
 * Two stores still exist server-side: trust.service calculateTrustScore writes
 * user.trustScore, while reports and blocks move userTrustScore.trustScore
 * through applyTrustDelta. They need reconciling in a later server pass; this
 * page shows the computed one because it is the one with reasons.
 */

type Guide = {
  label: string;
  /** What she can do about it, in one line. */
  todo: string;
  action: { label: string; href: string };
};

/** The positive factors calculateTrustScore can award, and where each is earned. */
const FACTOR_GUIDE: Guide[] = [
  {
    label: 'Email verified',
    todo: 'Confirm the address on your account.',
    action: { label: 'Send a fresh link', href: '/verify-email' },
  },
  {
    label: 'LinkedIn connected',
    todo: 'Add your LinkedIn profile so people can see your work history.',
    action: { label: 'Edit profile', href: '/dashboard/settings/profile' },
  },
  {
    label: 'Website connected',
    todo: 'Add a website or portfolio to your profile.',
    action: { label: 'Edit profile', href: '/dashboard/settings/profile' },
  },
  {
    label: 'Content contributions',
    todo: 'Share something with the community; three posts earn the first point.',
    action: { label: 'Go to the feed', href: '/feed' },
  },
  {
    label: 'Referrals',
    todo: 'Invite someone who goes on to join.',
    action: { label: 'Your referral link', href: '/dashboard/referrals' },
  },
  {
    label: 'Verification badges',
    todo: 'Earn a verification badge for your identity, employer or mentoring.',
    action: { label: 'Verification', href: '/dashboard/settings/verification' },
  },
];

const SUSPENSION_LABEL = 'Account suspension';

function levelOf(score: number) {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Growing';
  return 'Just started';
}

export default function TrustScorePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['trust-score'],
    queryFn: trustApi.mine,
    select: (response) => response.data.data,
  });

  const earned = data?.factors ?? [];
  const earnedLabels = new Set(earned.map((factor) => factor.label));
  const positive = earned.filter((factor) => factor.points > 0);
  const suspended = earned.some((factor) => factor.label === SUSPENSION_LABEL);
  const toEarn = FACTOR_GUIDE.filter((guide) => !earnedLabels.has(guide.label));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <Shield className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Trust</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white md:text-3xl">
          Your trust score, and what is behind it
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
          Every point comes from something you did on ATHENA. Nothing here is guessed, and each
          thing you have not done yet comes with the page that does it.
        </p>
      </div>

      {isLoading && (
        <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800" aria-busy="true" />
      )}

      {isError && (
        <div className="surface p-6">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
            We could not work out your score just now. Nothing has changed on your account; please
            try again shortly.
          </p>
        </div>
      )}

      {data && (
        <>
          <section className="surface p-6">
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
              <div className="relative h-32 w-32 shrink-0" role="img" aria-label={`Trust score ${data.score} out of 100`}>
                <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128" aria-hidden="true">
                  <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="10" fill="none" className="text-slate-100 dark:text-slate-800" />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={352}
                    strokeDashoffset={352 - (352 * Math.max(0, Math.min(100, data.score))) / 100}
                    strokeLinecap="round"
                    className="text-rose-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-semibold text-slate-900 dark:text-white">{data.score}</span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{levelOf(data.score)}</span>
                </div>
              </div>

              <div className="w-full flex-1">
                <h2 className="rail-title">What is counting for you</h2>
                {positive.length === 0 ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    Everyone starts at 50. The steps below are how it grows from here.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {positive.map((factor) => (
                      <li key={factor.label} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                          {factor.label}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">+{factor.points}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {suspended && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Your account is suspended
              </h2>
              <p className="mt-1 text-sm leading-6 text-amber-800/90 dark:text-amber-100/90">
                A suspension takes 40 points off until it is lifted. If you think this is a
                mistake, our team will look at it.{' '}
                <Link href="/dashboard/settings/help" className="font-semibold underline">
                  Get in touch
                </Link>
              </p>
            </div>
          )}

          {toEarn.length > 0 && (
            <section className="surface p-5">
              <h2 className="rail-title">Ways to build it</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Each of these adds points once it is done.
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {toEarn.map((guide) => (
                  <li key={guide.label} className="tile-soft p-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{guide.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{guide.todo}</p>
                    <Link
                      href={guide.action.href}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:underline dark:text-rose-400"
                    >
                      {guide.action.label} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="rail-title">Report something</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              If someone or something on ATHENA is not safe, tell us. You can report from the
              report button beside a post, message or profile, or use the report page, which also
              tells you where else to turn.
            </p>
          </div>
          <Link
            href="/report"
            className="focusable inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <Flag className="h-4 w-4" aria-hidden="true" />
            Report something
          </Link>
        </div>
      </section>

      <div className="text-center">
        <Link href="/dashboard/ai" className="text-sm text-rose-600 hover:underline dark:text-rose-400">
          ← Back to AI Tools
        </Link>
      </div>
    </div>
  );
}
