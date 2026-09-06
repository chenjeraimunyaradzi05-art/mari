'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  // An expired link is the common failure; a new one is a form away.
  const [resendEmail, setResendEmail] = useState('');
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resendEmail.trim()) return;
    setResendState('sending');
    try {
      await api.post('/auth/resend-verification', { email: resendEmail.trim() });
    } catch {
      // The route answers the same way whether or not the address exists.
    }
    setResendState('sent');
  };

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await api.get(`/auth/verify-email?token=${token}`);
        setStatus('success');
        setMessage(response.data.message || 'Email verified successfully!');
      } catch (error: any) {
        setStatus('error');
        setMessage(error.response?.data?.message || 'Verification failed. The link may have expired.');
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Image src="/athena-logo.png" alt="ATHENA" width={40} height={40} className="rounded-lg" />
            <span className="text-2xl font-bold gradient-text">ATHENA</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 text-primary-500 animate-spin mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Verifying your email...
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Please wait while we verify your email address.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Email Verified! 🎉
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {message}
              </p>
              <Link href="/login" className="btn-primary w-full block text-center">
                Continue to Login
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Verification Failed
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {message}
              </p>
              <div className="space-y-3">
                <Link href="/login" className="btn-primary w-full block text-center">
                  Go to Login
                </Link>
                <Link href="/register" className="btn-outline w-full block text-center">
                  Create New Account
                </Link>
              </div>
              <form onSubmit={resend} className="mt-6 border-t border-slate-100 pt-5 text-left dark:border-slate-800">
                <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">Link expired? Get a new one.</p>
                {resendState === 'sent' ? (
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">If an unverified account exists for that address, a new link is on its way.</p>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={resendEmail}
                      onChange={(event) => setResendEmail(event.target.value)}
                      placeholder="you@example.com"
                      aria-label="Email address"
                      required
                      className="input flex-1 text-sm"
                    />
                    <button type="submit" disabled={resendState === 'sending'} className="btn-primary px-4 text-sm">
                      {resendState === 'sending' ? 'Sending…' : 'Resend'}
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
