'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/lib/hooks';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { FacebookSignInButton } from '@/components/auth/FacebookSignInButton';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

function getSafeRedirectPath(redirect: string | null | undefined, fallback: string) {
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }

  return fallback;
}

function buildVerificationRecoveryPath(email: string, redirect: string | null | undefined) {
  const params = new URLSearchParams({ registered: '1', email });
  const safeRedirect = getSafeRedirectPath(redirect, '');

  if (safeRedirect) {
    params.set('redirect', safeRedirect);
  }

  return `/verify-email?${params.toString()}`;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoginPending, isAuthenticated, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const redirect = searchParams?.get('redirect');
  const safeRedirect = getSafeRedirectPath(redirect, '/dashboard');
  const isRegistrationRecovery =
    searchParams?.get('mode') === 'register' ||
    safeRedirect.includes('/onboarding') ||
    safeRedirect.includes('entry=register') ||
    safeRedirect.includes('welcome=new');

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;

    router.replace(safeRedirect);
  }, [isAuthenticated, isLoading, router, safeRedirect]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginForm) => {
    setServerError(null);
    login(data, {
      onSuccess: () => {
        router.replace(safeRedirect);
      },
      onError: (error: unknown) => {
        const responseMessage = (
          error as { response?: { data?: { message?: string } } }
        )?.response?.data?.message;

        if (responseMessage?.toLowerCase().includes('verify your email')) {
          router.replace(buildVerificationRecoveryPath(data.email, redirect));
          return;
        }

        setServerError(
          responseMessage || 'Login failed. Please check your credentials and try again.'
        );
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 lg:grid lg:grid-cols-2">
      {/* Left side - Form */}
      <div className="flex flex-col justify-center px-4 py-10 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-xl lg:max-w-lg">
          <div className="flex items-center space-x-3 mb-8">
            <Image
              src="/logo.svg"
              alt="ATHENA"
              width={48}
              height={48}
              className="rounded-lg"
              priority
            />
            <span className="text-2xl font-bold gradient-text">ATHENA</span>
          </div>

          <div className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:border-primary-900/40 dark:bg-primary-900/20 dark:text-primary-300">
            Secure access to your career community
          </div>

          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-8 shadow-xl shadow-primary-100/40 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none sm:p-10">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {isRegistrationRecovery ? 'Welcome to ATHENA' : 'Welcome back'}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {isRegistrationRecovery
                ? 'Finish signing in to start your onboarding, workspace, mentors, and community.'
                : 'Sign in to access your jobs, mentors, saved opportunities, and community.'}
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
            {serverError && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                <p className="text-sm text-red-700 dark:text-red-300">{serverError}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                {...register('email')}
                type="email"
                id="email"
                className="input"
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={errors.email ? 'true' : 'false'}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className="input pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={errors.password ? 'true' : 'false'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Remember me
                </span>
              </label>
              <Link
                href="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-500"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoginPending}
              className="btn-primary w-full py-3 text-base"
            >
              {isLoginPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
            </form>

            <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-950 text-gray-500">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <GoogleSignInButton
                mode="login"
                onError={(message) => setServerError(message)}
                onSuccess={() => {
                  router.replace(safeRedirect);
                }}
              />
              <FacebookSignInButton
                mode="login"
                onError={(message) => setServerError(message)}
                onSuccess={() => {
                  router.replace(safeRedirect);
                }}
              />
            </div>
            <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
              We only ever request the minimum: your name, email, and avatar.
            </p>
          </div>

          <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary-600 hover:text-primary-500 font-medium">
              Create one free
            </Link>
          </p>
          </div>
        </div>
      </div>

      {/* Right side - Image/Pattern */}
      <div className="relative hidden overflow-hidden bg-athena-gradient lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 max-w-xl text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur">
            <ShieldCheck className="h-4 w-4" />
            Protected sessions and trusted access
          </div>
          <h2 className="mt-8 text-4xl font-bold leading-tight xl:text-5xl">Return to your momentum.</h2>
          <p className="mt-5 max-w-lg text-lg text-white/90">
            Pick up where you left off with your dashboard, mentors, saved roles, and community conversations.
          </p>
          <div className="mt-10 grid gap-4">
            <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
              <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">AI-guided growth</p>
                <p className="text-sm text-white/80">Continue using resume, interview, and opportunity tools from your personalized workspace.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
              <Users className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Community continuity</p>
                <p className="text-sm text-white/80">Rejoin your conversations, events, and groups without losing context.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Security-first auth</p>
                <p className="text-sm text-white/80">Session rotation, HttpOnly refresh cookies, and safer route handling protect access.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
