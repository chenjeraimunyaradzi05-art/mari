'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, CheckCircle, Check } from 'lucide-react';
import Image from 'next/image';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const password = watch('password');

  const passwordRequirements = [
    { label: 'At least 8 characters', met: password?.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(password || '') },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(password || '') },
    { label: 'Contains a number', met: /[0-9]/.test(password || '') },
    { label: 'Contains a special character', met: /[^A-Za-z0-9]/.test(password || '') },
  ];

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      toast.error('Invalid reset link');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        password: data.password,
      });
      setIsSuccess(true);
    } catch (error: unknown) {
      const responseMessage = (
        error as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      toast.error(responseMessage || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-aurora px-4">
        <div aria-hidden="true" className="cyber-grid pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative w-full max-w-md text-center">
          <div className="glass-card rounded-2xl p-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              Invalid Reset Link
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
              This password reset link is invalid or has expired.
            </p>
            <Link href="/forgot-password" className="block w-full rounded-xl bg-[linear-gradient(135deg,#f43f5e,#a855f7,#06b6d4)] py-3 text-sm font-semibold text-white shadow-blossom transition hover:-translate-y-0.5">
              Request New Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-aurora px-4">
        <div aria-hidden="true" className="cyber-grid pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative w-full max-w-md">
          <div className="glass-card overflow-hidden rounded-2xl p-8 text-center">
            <div className="h-1 w-full mb-8" style={{background:'linear-gradient(90deg,#f43f5e,#a855f7,#06b6d4)',backgroundSize:'200% 100%'}} />
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100/80 dark:bg-emerald-900/30">
              <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Password Reset Successfully!
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm leading-6">
              Your password has been updated. You can now log in with your new password.
            </p>
            <Link href="/login" className="block w-full rounded-xl bg-[linear-gradient(135deg,#f43f5e,#a855f7,#06b6d4)] py-3 text-sm font-semibold text-white shadow-blossom transition hover:-translate-y-0.5">
              Continue to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-aurora px-4">
      <div aria-hidden="true" className="cyber-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 shadow-lg ring-4 ring-primary-100/60 dark:ring-primary-900/40">
            <Image src="/logo.svg" alt="ATHENA" width={28} height={28} className="rounded" />
          </div>
          <span className="mt-3 block text-xl font-bold gradient-text-cyber">ATHENA</span>
        </div>

        <div className="overflow-hidden rounded-2xl">
          <div className="h-1 w-full progress-athena-fill" />
          <div className="glass-panel px-8 py-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Reset your password
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
              Enter your new password below.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  New Password
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    className="w-full rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 pr-10 text-slate-800 backdrop-blur placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-white/10 dark:bg-slate-800/60 dark:text-white"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.password.message}</p>
                )}
                <div className="mt-3 space-y-1.5">
                  {passwordRequirements.map((req) => (
                    <div key={req.label} className="flex items-center gap-2 text-xs">
                      <div className={`flex h-4 w-4 items-center justify-center rounded-full ${
                        req.met ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                      }`}>
                        {req.met && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <span className={req.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    {...register('confirmPassword')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    className="w-full rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 pr-10 text-slate-800 backdrop-blur placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-white/10 dark:bg-slate-800/60 dark:text-white"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.confirmPassword.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#f43f5e,#a855f7,#06b6d4)] py-3 text-sm font-semibold text-white shadow-blossom transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
