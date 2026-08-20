'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { authApi, api } from '@/lib/api';

function getSafeRedirectPath(redirect: string | null | undefined, fallback: string) {
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }

  return fallback;
}

function buildLoginPath(redirect: string | null | undefined, mode?: 'register') {
  const params = new URLSearchParams();
  const safeRedirect = getSafeRedirectPath(redirect, '');

  if (mode) {
    params.set('mode', mode);
  }

  if (safeRedirect) {
    params.set('redirect', safeRedirect);
  }

  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}

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
  const registered = searchParams.get('registered') === '1';
  const email = searchParams.get('email');
  const redirect = searchParams.get('redirect');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('loading');
  const [message, setMessage] = useState('');
  const [resendState, setResendState] = useState<'idle' | 'success' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');

  const loginHref = buildLoginPath(redirect, registered ? 'register' : undefined);

  useEffect(() => {
    if (!token) {
      if (registered) {
        setStatus('pending');
        setMessage(
          email
            ? `We have sent a verification link to ${email}. Please verify your email before signing in.`
            : 'We have sent a verification link to your email address. Please verify your email before signing in.'
        );
        return;
      }

      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        setStatus('success');
        setMessage(response.data.message || 'Email verified successfully!');
      } catch (error: any) {
        setStatus('error');
        setMessage(error.response?.data?.message || 'Verification failed. The link may have expired.');
      }
    };

    verifyEmail();
  }, [email, registered, token]);

  const handleResendVerification = async () => {
    if (!email) {
      return;
    }

    try {
      setResendState('idle');
      setResendMessage('');
      const response = await authApi.resendVerification(email);
      setResendState('success');
      setResendMessage(
        response.data.message ||
          'If your account is still awaiting verification, a new email is on the way.'
      );
    } catch (error: any) {
      setResendState('error');
      setResendMessage(
        error.response?.data?.message || 'We could not resend the verification email right now.'
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Image src="/logo.svg" alt="ATHENA" width={40} height={40} className="rounded-lg" />
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

          {status === 'pending' && (
            <>
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Check your inbox
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {message}
              </p>
              <div className="space-y-3">
                <Link href={loginHref} className="btn-primary w-full block text-center">
                  Go to Login
                </Link>
                <Link href="/register" className="btn-outline w-full block text-center">
                  Use a different email
                </Link>
              </div>
              {email && (
                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => void handleResendVerification()}
                    className="btn-outline w-full justify-center"
                  >
                    Resend verification email
                  </button>
                  {resendMessage && (
                    <p
                      className={`text-sm ${
                        resendState === 'error'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {resendMessage}
                    </p>
                  )}
                </div>
              )}
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
              <Link href={loginHref} className="btn-primary w-full block text-center">
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
                <Link href={loginHref} className="btn-primary w-full block text-center">
                  Go to Login
                </Link>
                <Link href="/register" className="btn-outline w-full block text-center">
                  Create New Account
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
