'use client';

/**
 * Where the unlock link in the "your account is locked" email lands.
 *
 * Like the lock page it asks first and only a press of the button sends the
 * request, so a mail scanner opening the link cannot unlock an account its
 * owner locked on purpose. Unlocking is not signing in: it opens no session,
 * and the next step is the sign-in page, where her password (and her second
 * factor, if she has one) is asked for as always.
 */

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, Loader2, LockKeyhole, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

export default function UnlockAccountPage() {
  return (
    <Suspense fallback={null}>
      <UnlockAccountContent />
    </Suspense>
  );
}

type Step = 'ask' | 'sending' | 'done' | 'failed';

function UnlockAccountContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [step, setStep] = useState<Step>('ask');
  const [message, setMessage] = useState('');

  const unlock = async () => {
    if (!token || step === 'sending') return;
    setStep('sending');
    try {
      const response = await api.post('/auth/unlock', { token });
      setMessage(response.data?.message || 'Your account is unlocked. Sign in again to continue.');
      setStep('done');
    } catch (error: unknown) {
      const reason = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage(reason || 'We could not unlock your account just now. Please try again.');
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
                Open the link from the email again. If you cannot find it, the sign-in page can send a new one.
              </p>
              <Link href="/login" className="btn-primary block w-full text-center">
                Go to sign in
              </Link>
            </>
          ) : step === 'done' ? (
            <>
              <CheckCircle className="mx-auto mb-4 h-14 w-14 text-green-600 dark:text-green-400" aria-hidden="true" />
              <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">Your account is unlocked</h1>
              <p className="mb-2 text-slate-600 dark:text-slate-400" role="status">
                {message}
              </p>
              <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                If you think someone else knows your password, choose a new one before you sign in.
              </p>
              <div className="space-y-3">
                <Link href="/login" className="btn-primary block w-full text-center">
                  Go to sign in
                </Link>
                <Link href="/forgot-password" className="btn-outline flex min-h-[44px] w-full items-center justify-center">
                  Choose a new password
                </Link>
              </div>
            </>
          ) : step === 'failed' ? (
            <>
              <XCircle className="mx-auto mb-4 h-14 w-14 text-red-600 dark:text-red-400" aria-hidden="true" />
              <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">We could not unlock it</h1>
              <p className="mb-6 text-slate-600 dark:text-slate-400" role="alert">
                {message}
              </p>
              <div className="space-y-3">
                <Link href="/login" className="btn-primary block w-full text-center">
                  Go to sign in for a new link
                </Link>
                <button type="button" onClick={() => setStep('ask')} className="btn-outline min-h-[44px] w-full">
                  Try again
                </button>
              </div>
            </>
          ) : (
            <>
              <LockKeyhole className="mx-auto mb-4 h-14 w-14 text-primary-600 dark:text-primary-400" aria-hidden="true" />
              <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">Unlock your account?</h1>
              <p className="mb-6 text-slate-600 dark:text-slate-400">
                Unlocking lets you sign in again. It does not sign you in: you will use your password as usual.
              </p>
              <button
                type="button"
                onClick={unlock}
                disabled={step === 'sending'}
                className="btn-primary min-h-[44px] w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {step === 'sending' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                    Unlocking...
                  </>
                ) : (
                  'Unlock my account'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
