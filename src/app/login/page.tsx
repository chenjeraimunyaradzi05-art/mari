"use client";

import React, { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const registered = searchParams.get('registered');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
      callbackUrl,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid email or password');
      return;
    }

    if (result?.url) {
      router.push(result.url);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans">
      {/* Left Side - Hero Content */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-50 border-r border-slate-200 p-12 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-12">
          <div>
            <span className="text-rose-600 font-bold tracking-wider uppercase text-xs mb-4 block">Member access</span>
            <h1 className="text-4xl font-extrabold text-slate-900 mb-6">Welcome back to your Athena dashboard</h1>
            <p className="text-lg text-slate-600 leading-relaxed">
              Keep every job lead, financial insight, housing path and wellbeing ritual in one calm surface. Athena remembers your
              progress, honours your boundaries, and keeps AI Concierge tuned to your goals.
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl shrink-0">⚡</div>
              <div>
                <strong className="block text-slate-900 text-lg mb-1">Unified updates</strong>
                <p className="text-slate-600">Latest status across jobs, grants, safe housing and AI Concierge briefs.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-2xl shrink-0">🔐</div>
              <div>
                <strong className="block text-slate-900 text-lg mb-1">Respectful security</strong>
                <p className="text-slate-600">Session health, device alerts and multi-factor ready when you are.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-2xl shrink-0">🤝</div>
              <div>
                <strong className="block text-slate-900 text-lg mb-1">Athena Lounge</strong>
                <p className="text-slate-600">Drop back into moderated discussions, referrals and AI co-drafts.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 lg:p-16 bg-white">
        <div className="w-full max-w-md mx-auto space-y-8">
          <div>
            <span className="text-rose-600 font-bold tracking-wider uppercase text-xs mb-2 block">Sign in</span>
            <h2 className="text-3xl font-bold text-slate-900">Continue with your member credentials</h2>
            <p className="mt-2 text-slate-600">
              Grounded, distraction-free login that mirrors the dashboard surface.
            </p>
          </div>

          {registered && (
            <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Account created successfully. Please sign in.
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-slate-700">Password</label>
                <Link href="/forgot-password" className="text-sm text-rose-600 font-bold hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-slate-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-700">
                Remember this device
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in to Athena'
              )}
            </button>

            <p className="text-center text-slate-600">
              New to Athena?{' '}
              <Link href="/register" className="text-rose-600 font-bold hover:underline">
                Create your membership
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-rose-600" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
