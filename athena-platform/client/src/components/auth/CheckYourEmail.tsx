'use client';

/**
 * What a new member sees once the sign-up form has been accepted.
 *
 * Registration opens no session: the link that finishes it is in an email. The
 * server also answers a taken address in exactly the same way as a free one, so
 * that the form cannot be used to ask whether somebody has an account. This
 * panel is written to be true for both. It says an email is on its way if the
 * address can be used, it does not say an account was created, and a woman who
 * already had one is told in the email itself, where only she can read it.
 *
 * Resend goes to the same route the "link expired" form uses, which answers the
 * same way whether or not there is an unconfirmed account to send to.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, Mail } from 'lucide-react';
import { api } from '@/lib/api';

/** Long enough that the button is not a way to flood an inbox, short enough to be bearable. */
export const RESEND_COOLDOWN_SECONDS = 30;

type ResendState = 'idle' | 'sending' | 'sent' | 'failed';

export function CheckYourEmail({
  email,
  signInHref = '/login',
  onStartAgain,
  sendFailed = false,
}: {
  email: string;
  /**
   * The server saved her details and could not send the email
   * (VERIFICATION_EMAIL_FAILED). The panel then says so and the button is the
   * way forward, instead of claiming an email is on its way.
   */
  sendFailed?: boolean;
  /** Where "Sign in" goes; carries her redirect through when the page had one. */
  signInHref?: string;
  /** Back to the form, for an address typed wrongly. */
  onStartAgain: () => void;
}) {
  const [resendState, setResendState] = useState<ResendState>('idle');
  const [cooldown, setCooldown] = useState(0);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  // Moves a screen reader to the news instead of leaving it on a form that has gone.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    if (resendState === 'sending' || cooldown > 0) return;
    setResendState('sending');
    try {
      await api.post('/auth/resend-verification', { email });
      setResendState('sent');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      // The route answers the same way for every address, so a failure here is
      // the network or the hourly sending limit, never "no such account", and
      // saying so is honest: nothing was sent.
      setResendState('failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center space-x-2">
            <Image src="/athena-logo.png" alt="ATHENA" width={40} height={40} className="rounded-lg" />
            <span className="gradient-text text-2xl font-bold">ATHENA</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
            <Mail className="h-9 w-9 text-primary-600 dark:text-primary-400" aria-hidden="true" />
          </div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mb-2 text-2xl font-bold text-slate-900 focus:outline-none dark:text-white"
          >
            {sendFailed ? 'We could not send your email' : 'Check your email'}
          </h1>
          {sendFailed ? (
            <>
              <p className="mb-2 text-slate-600 dark:text-slate-400">
                Your details are saved, but the email to{' '}
                <span className="break-all font-medium text-slate-900 dark:text-white">{email}</span> did not go
                through just now. There is no need to fill the form in again.
              </p>
              <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                Press the button below to try again. If it keeps failing, check the address is spelled correctly.
              </p>
            </>
          ) : (
            <>
              <p className="mb-2 text-slate-600 dark:text-slate-400">
                If <span className="break-all font-medium text-slate-900 dark:text-white">{email}</span> can be used
                for a new account, we have sent a link to confirm it. The link works for 24 hours.
              </p>
              <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                Nothing there? Look in your junk folder. If you already have an ATHENA account with this address, the
                email says so and tells you how to sign in.
              </p>
            </>
          )}

          <div role="status" aria-live="polite" className="min-h-[1.5rem] text-sm">
            {resendState === 'sent' && (
              <p className="text-emerald-700 dark:text-emerald-300">
                If this address can be used, a new link is on its way.
              </p>
            )}
            {resendState === 'failed' && (
              <p className="text-red-700 dark:text-red-300">
                We could not send another just now. Please wait a little and try again.
              </p>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={resend}
              disabled={resendState === 'sending' || cooldown > 0}
              className="btn-primary min-h-[44px] w-full"
            >
              {resendState === 'sending' ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                  Sending...
                </>
              ) : cooldown > 0 ? (
                `Send it again in ${cooldown}s`
              ) : (
                'Send it again'
              )}
            </button>
            <Link href={signInHref} className="btn-outline flex min-h-[44px] w-full items-center justify-center">
              Go to sign in
            </Link>
            <button
              type="button"
              onClick={onStartAgain}
              className="min-h-[44px] w-full text-sm font-medium text-primary-600 hover:text-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400"
            >
              Typed the wrong address? Start again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
