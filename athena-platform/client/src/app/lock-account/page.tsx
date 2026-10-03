'use client';

/**
 * Where the "this was not me" link in a new-device sign-in email lands.
 *
 * The link locks the account without a session, because the woman reading the
 * email may already be shut out of her own account. It asks first, and only a
 * press of the button sends the request: mail scanners open every link in a
 * message, and a page that locked on load would lock a member out of her own
 * account because her inbox was checked for viruses.
 *
 * What locking does is said plainly before she presses it, and what to do next
 * after: the unlock link is in a new email, and a password she thinks someone
 * knows is worth changing.
 */

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function LockAccountPage() {
  return (
    <Suspense fallback={null}>
      <LockAccountContent />
    </Suspense>
  );
}

type Step = 'ask' | 'sending' | 'done' | 'failed';

function LockAccountContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [step, setStep] = useState<Step>('ask');
  const [message, setMessage] = useState('');

  const lock = async () => {
    if (!token || step === 'sending') return;
    setStep('sending');
    try {
      const response = await api.post('/auth/lock-by-token', { token });
      // If this browser was signed in, the server has ended that session; this
      // clears what the page itself holds so it does not look signed in.
      useAuthStore.getState().logout();
      setMessage(response.data?.message || 'Your account is locked and every device is signed out.');
      setStep('done');
    } catch (error: unknown) {
      const reason = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage(reason || 'We could not lock your account just now. Please try again.');
      setStep('failed');
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
          {!token ? (
            <>
              <XCircle className="mx-auto mb-4 h-14 w-14 text-red-600 dark:text-red-400" aria-hidden="true" />
              <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">This link is not complete</h1>
              <p className="mb-6 text-slate-600 dark:text-slate-400">
                Open the link from the email again, or sign in and lock your account from Settings, then Security.
              </p>
              <Link href="/login" className="btn-primary block w-full text-center">
                Go to sign in
              </Link>
            </>
          ) : step === 'done' ? (
            <>
              <CheckCircle className="mx-auto mb-4 h-14 w-14 text-green-600 dark:text-green-400" aria-hidden="true" />
              <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">Your account is locked</h1>
              <p className="mb-4 text-slate-600 dark:text-slate-400" role="status">
                {message}
              </p>
              <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                If you think someone knows your password, choose a new one. When you are ready to use ATHENA again,
                open the unlock link in your email. If it is not there, the sign-in page can send a new one.
              </p>
              <Link href="/forgot-password" className="btn-primary block w-full text-center">
                Choose a new password
              </Link>
            </>
          ) : step === 'failed' ? (
            <>
              <XCircle className="mx-auto mb-4 h-14 w-14 text-red-600 dark:text-red-400" aria-hidden="true" />
              <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">We could not lock it</h1>
              <p className="mb-6 text-slate-600 dark:text-slate-400" role="alert">
                {message}
              </p>
              <div className="space-y-3">
                <button type="button" onClick={() => setStep('ask')} className="btn-primary min-h-[44px] w-full">
                  Try again
                </button>
                <Link href="/forgot-password" className="btn-outline flex min-h-[44px] w-full items-center justify-center">
                  Choose a new password instead
                </Link>
                <Link
                  href="/login"
                  className="flex min-h-[44px] items-center justify-center text-sm font-medium text-primary-600 dark:text-primary-400"
                >
                  Sign in and lock it from Settings
                </Link>
              </div>
            </>
          ) : (
            <>
              <ShieldAlert className="mx-auto mb-4 h-14 w-14 text-primary-600 dark:text-primary-400" aria-hidden="true" />
              <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">Lock your account?</h1>
              <p className="mb-2 text-slate-600 dark:text-slate-400">
                This is for when a sign-in to your account was not you. Locking signs every device out and stops anyone
                signing in, with your password or with Google or Facebook, until you unlock it.
              </p>
              <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                We email you a link to unlock it. If the sign-in was you, you do not need to do anything.
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={lock}
                  disabled={step === 'sending'}
                  className="btn min-h-[44px] w-full bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {step === 'sending' ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                      Locking...
                    </>
                  ) : (
                    'Yes, lock my account'
                  )}
                </button>
                <Link href="/login" className="btn-outline flex min-h-[44px] w-full items-center justify-center">
                  No, that was me
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
