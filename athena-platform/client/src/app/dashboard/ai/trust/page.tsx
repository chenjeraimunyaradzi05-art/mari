'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, Flag, Shield } from 'lucide-react';
import { aiAlgorithmsApi } from '@/lib/api';
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
 * it. The report form still posts to /ai-algorithms/report.
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

const fieldClass =
  'focusable w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500';
const labelClass = 'mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300';

function levelOf(score: number) {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Growing';
  return 'Just started';
}

const EMPTY_REPORT = {
  contentType: 'PROFILE',
  contentId: '',
  reportedUserId: '',
  reason: '',
  description: '',
};

export default function TrustScorePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['trust-score'],
    queryFn: trustApi.mine,
    select: (response) => response.data.data,
  });

  const [showReport, setShowReport] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportForm, setReportForm] = useState(EMPTY_REPORT);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);

  const earned = data?.factors ?? [];
  const earnedLabels = new Set(earned.map((factor) => factor.label));
  const positive = earned.filter((factor) => factor.points > 0);
  const suspended = earned.some((factor) => factor.label === SUSPENSION_LABEL);
  const toEarn = FACTOR_GUIDE.filter((guide) => !earnedLabels.has(guide.label));

  const handleReport = async () => {
    if (!reportForm.contentId || !reportForm.reportedUserId || !reportForm.reason) {
      setReportError('The content ID, the user ID and a reason are needed before this can be sent.');
      return;
    }

    setReporting(true);
    setReportError(null);
    try {
      await aiAlgorithmsApi.reportContent({
        contentType: reportForm.contentType,
        contentId: reportForm.contentId,
        reportedUserId: reportForm.reportedUserId,
        reason: reportForm.reason,
        description: reportForm.description,
      });
      setShowReport(false);
      setReportForm(EMPTY_REPORT);
      setReportSent(true);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; message?: string } } };
      setReportError(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          'That did not send. Please try again in a moment.'
      );
    } finally {
      setReporting(false);
    }
  };

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
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Help keep ATHENA safe for everyone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowReport((open) => !open)}
            aria-expanded={showReport}
            className="focusable inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <Flag className="h-4 w-4" aria-hidden="true" />
            {showReport ? 'Close' : 'Report'}
          </button>
        </div>

        {reportSent && !showReport && (
          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Thank you. The report is with our safety team.
          </p>
        )}

        {showReport && (
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="report-type">
                  What kind of content
                </label>
                <select
                  id="report-type"
                  value={reportForm.contentType}
                  onChange={(e) => setReportForm((prev) => ({ ...prev, contentType: e.target.value }))}
                  className={fieldClass}
                >
                  <option value="PROFILE">Profile</option>
                  <option value="MESSAGE">Message</option>
                  <option value="VIDEO">Video</option>
                  <option value="COMMENT">Comment</option>
                  <option value="STATUS">Status</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="report-reason">
                  Reason
                </label>
                <select
                  id="report-reason"
                  value={reportForm.reason}
                  onChange={(e) => setReportForm((prev) => ({ ...prev, reason: e.target.value }))}
                  className={fieldClass}
                  required
                >
                  <option value="">Choose a reason</option>
                  <option value="HARASSMENT">Harassment</option>
                  <option value="HATE_SPEECH">Hate speech</option>
                  <option value="SPAM">Spam</option>
                  <option value="MISINFORMATION">Misinformation</option>
                  <option value="INAPPROPRIATE">Inappropriate content</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="report-content-id">
                  Content ID
                </label>
                <input
                  id="report-content-id"
                  type="text"
                  value={reportForm.contentId}
                  onChange={(e) => setReportForm((prev) => ({ ...prev, contentId: e.target.value }))}
                  className={fieldClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="report-user-id">
                  User ID
                </label>
                <input
                  id="report-user-id"
                  type="text"
                  value={reportForm.reportedUserId}
                  onChange={(e) => setReportForm((prev) => ({ ...prev, reportedUserId: e.target.value }))}
                  className={fieldClass}
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="report-details">
                Anything else (optional)
              </label>
              <textarea
                id="report-details"
                value={reportForm.description}
                onChange={(e) => setReportForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                className={fieldClass}
              />
            </div>

            {reportError && (
              <p className="text-sm leading-6 text-rose-600 dark:text-rose-400">{reportError}</p>
            )}

            <button
              type="button"
              onClick={handleReport}
              disabled={reporting}
              className="focusable rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reporting ? 'Sending' : 'Send report'}
            </button>
          </div>
        )}
      </section>

      <div className="text-center">
        <Link href="/dashboard/ai" className="text-sm text-rose-600 hover:underline dark:text-rose-400">
          ← Back to AI Tools
        </Link>
      </div>
    </div>
  );
}
