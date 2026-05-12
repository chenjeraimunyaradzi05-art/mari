'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import Image from 'next/image';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsSubmitting(true);
    try {
      await api.post('/auth/forgot-password', data);
      setIsSubmitted(true);
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
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

          <div className="glass-card overflow-hidden rounded-2xl p-8 text-center">
            <div className="h-1 w-full" style={{background:'linear-gradient(90deg,#f43f5e,#a855f7,#06b6d4)',backgroundSize:'200% 100%'}} />
            <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100/80 mx-auto mb-4 dark:bg-emerald-900/30">
              <Mail className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Check your email
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm leading-6">
              If an account exists with that email, we&apos;ve sent you instructions to reset your password.
            </p>
            <Link href="/login" className="block w-full rounded-xl bg-[linear-gradient(135deg,#f43f5e,#a855f7,#06b6d4)] py-3 text-center text-sm font-semibold text-white shadow-blossom transition hover:-translate-y-0.5">
              Back to Login
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
            <Link href="/login" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Forgot your password?
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm leading-6">
              No worries! Enter your email and we&apos;ll send you reset instructions.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email Address
                </label>
                <input
                  {...register('email')}
                  type="email"
                  id="email"
                  className="w-full rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 text-slate-800 backdrop-blur placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-white/10 dark:bg-slate-800/60 dark:text-white dark:placeholder-slate-500"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.email.message}</p>
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
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
