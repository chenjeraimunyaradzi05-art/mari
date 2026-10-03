'use client';

/**
 * Where a creator accepts the Creator Terms Addendum.
 *
 * Two people arrive here. A member turning on creator mode for the first time:
 * the server refuses POST /creator/enable without her acceptance of the current
 * version, so the box and the button are here, under the text. And a creator from
 * before the addendum existed, or before it was last rewritten, whose next
 * withdrawal was refused with CREATOR_TERMS_REQUIRED and sent her here: she
 * accepts the current version and her earnings, untouched meanwhile, are hers to
 * withdraw again. A creator already on the current version is told so and asked
 * nothing.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { creatorApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';
import { CREATOR_TERMS_VERSION } from '@/lib/creator-terms';

type CreatorProfile = { creatorTermsVersion?: string | null; creatorTermsAcceptedAt?: string | null } | null;

/** What the server said when it refused: its words, and where it sends her to put it right. */
type Refusal = { error?: string; message?: string; code?: string; setup?: string };

const refusalOf = (error: unknown): Refusal => (error as { response?: { data?: Refusal } })?.response?.data ?? {};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'long', year: 'numeric' });

export function CreatorTermsAcceptance() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const queryClient = useQueryClient();
  const [ticked, setTicked] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  const profile = useQuery({
    queryKey: ['creator-profile', user?.id],
    queryFn: () => creatorApi.getProfile(),
    enabled: isAuthenticated && Boolean(user?.id),
    retry: false,
    // The server answers a member with no creator profile with `data: null`, not a 404.
    select: (response) => (response.data?.data ?? null) as CreatorProfile,
  });

  const done = () => {
    setRefusal(null);
    setTicked(false);
    queryClient.invalidateQueries({ queryKey: ['creator-profile'] });
  };

  const enable = useMutation({
    mutationFn: () => creatorApi.enable({ acceptCreatorTerms: true, termsVersion: CREATOR_TERMS_VERSION }),
    onSuccess: () => {
      toast.success('Creator mode is on. Thank you for accepting the addendum.');
      done();
    },
    onError: (error) => setRefusal(refusalOf(error)),
  });

  const accept = useMutation({
    mutationFn: () => creatorApi.acceptTerms(CREATOR_TERMS_VERSION),
    onSuccess: () => {
      toast.success('Thank you. You have accepted the Creator Terms Addendum.');
      done();
    },
    onError: (error) => setRefusal(refusalOf(error)),
  });

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
        To accept the addendum and turn on creator mode,{' '}
        <Link href="/login" className="font-medium text-rose-600 hover:underline dark:text-rose-400">
          sign in
        </Link>{' '}
        first.
      </section>
    );
  }

  if (profile.isLoading) {
    return (
      <div className="mt-10 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="Checking your creator profile" />
      </div>
    );
  }

  if (profile.isError) {
    return (
      <section
        role="alert"
        className="mt-10 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100"
      >
        <p>We could not check whether you have accepted this version yet. Nothing has been changed.</p>
        <button type="button" onClick={() => profile.refetch()} className="btn-outline min-h-[44px] px-4 py-2 text-sm">
          Try again
        </button>
      </section>
    );
  }

  const current = profile.data?.creatorTermsVersion === CREATOR_TERMS_VERSION;
  if (current) {
    const when = profile.data?.creatorTermsAcceptedAt;
    return (
      <section className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm leading-6 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100">
        You accepted this version{when ? ` on ${day(when)}` : ''}. There is nothing more to do here.
      </section>
    );
  }

  const noProfile = profile.data === null;
  const busy = enable.isPending || accept.isPending;

  return (
    <section className="mt-10 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        {noProfile ? 'Accept the addendum and turn on creator mode' : 'Accept the current version'}
      </h2>
      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
        {noProfile
          ? 'Turning on creator mode sets up a Stripe account for your payouts. Nothing is paid to it until Stripe has verified it, and nothing is charged to you.'
          : 'You accepted an earlier version. Your earnings are safe and still yours; your next withdrawal needs this one.'}
      </p>

      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={ticked}
          onChange={(event) => setTicked(event.target.checked)}
          disabled={busy}
          className="mt-1 h-5 w-5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
        />
        <span>
          I have read the Creator Terms Addendum (version {CREATOR_TERMS_VERSION}) and I accept it.
        </span>
      </label>

      {refusal && (
        <p role="alert" className="text-sm leading-6 text-red-700 dark:text-red-300">
          {refusal.error ?? refusal.message ?? 'That did not go through. Nothing was changed.'}
          {refusal.setup && refusal.setup !== '/creator-terms' && (
            <>
              {' '}
              <Link href={refusal.setup} className="font-medium underline">
                Go there
              </Link>
            </>
          )}
        </p>
      )}

      <button
        type="button"
        disabled={!ticked || busy}
        onClick={() => (noProfile ? enable.mutate() : accept.mutate())}
        className="btn-primary inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {noProfile ? 'Accept and turn on creator mode' : 'Accept the current version'}
      </button>

      {noProfile && (
        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
          Your creator dashboard is at{' '}
          <Link href="/dashboard/creator" className="font-medium text-rose-600 hover:underline dark:text-rose-400">
            Creator
          </Link>{' '}
          once it is on.
        </p>
      )}
    </section>
  );
}
