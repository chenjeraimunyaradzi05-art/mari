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
  CheckCircle2,
  Briefcase,
  Users,
  ShieldCheck,
} from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/lib/hooks';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

const inviteCodePattern = /^[A-Za-z0-9-]{4,32}$/;

const personaOptions = [
  { value: 'EARLY_CAREER', label: 'Early Career' },
  { value: 'MID_CAREER', label: 'Mid Career' },
  { value: 'CREATOR', label: 'Creator' },
  { value: 'MENTOR', label: 'Mentor' },
  { value: 'ENTREPRENEUR', label: 'Entrepreneur' },
  { value: 'EMPLOYER', label: 'Employer' },
];

const registerSchema = z
  .object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email'),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, 
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
    womanSelfAttested: z
      .boolean()
      .refine((value) => value === true, 'You must confirm you are a woman to join'),
    persona: z.string().optional(),
    inviteCode: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || inviteCodePattern.test(value),
        'Invite codes can only include letters, numbers, and dashes'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

const DEFAULT_POST_REGISTER_PATH = '/onboarding?entry=register';

function buildCompatibilityUsername(email: string, firstName: string, lastName: string) {
  const emailBase = email.split('@')[0] || `${firstName}.${lastName}`;
  const normalized = emailBase
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '');

  if (normalized) {
    return normalized;
  }

  const nameBase = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  return nameBase || `athenauser${Date.now()}`;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const responseData = (
    error as {
      response?: {
        data?: {
          message?: string;
          error?: { message?: string };
        };
      };
    }
  )?.response?.data;

  return responseData?.message || responseData?.error?.message || fallback;
}

function getSafeRedirectPath(redirect: string | null | undefined, fallback: string) {
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }

  return fallback;
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register: registerUser, isRegisterPending, isAuthenticated, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace(
        getSafeRedirectPath(searchParams?.get('redirect'), DEFAULT_POST_REGISTER_PATH)
      );
    }
  }, [isAuthenticated, isLoading, router, searchParams]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password');
  const personaValue = watch('persona');
  const inviteCodeValue = watch('inviteCode');
  const womanSelfAttestedValue = watch('womanSelfAttested');
  const passwordRequirements = [
    { label: 'At least 12 characters', met: (password?.length || 0) >= 12 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(password || '') },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(password || '') },
    { label: 'Contains a number', met: /\d/.test(password || '') },
    { label: 'Contains a special character', met: /[^A-Za-z0-9]/.test(password || '') },
  ];

  const onSubmit = (data: RegisterForm) => {
    setServerError(null);
    const { confirmPassword: _confirmPassword, inviteCode, persona, ...registerData } = data;
    void _confirmPassword;
    const normalizedInviteCode = inviteCode?.trim();
    registerUser(
      {
        ...registerData,
        username: buildCompatibilityUsername(data.email, data.firstName, data.lastName),
        ...(persona ? { persona } : {}),
        ...(normalizedInviteCode ? { inviteCode: normalizedInviteCode } : {}),
      },
      {
        onSuccess: () => {
          router.replace(
            getSafeRedirectPath(searchParams?.get('redirect'), DEFAULT_POST_REGISTER_PATH)
          );
        },
        onError: (error: unknown) => {
          setServerError(getApiErrorMessage(error, 'Registration failed. Please review your details and try again.'));
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 lg:grid lg:grid-cols-2">
      {/* Left side - Form */}
      <div className="flex flex-col justify-center px-4 py-10 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-xl lg:max-w-lg">
          <div className="flex items-center space-x-3 mb-8">
            <Image
              src="/athena-logo.png"
              alt="ATHENA"
              width={48}
              height={48}
              className="rounded-lg"
              priority
            />
            <span className="text-2xl font-bold gradient-text">ATHENA</span>
          </div>

          <div className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:border-primary-900/40 dark:bg-primary-900/20 dark:text-primary-300">
            Career growth, community, and trusted mentoring in one place
          </div>

          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-8 shadow-xl shadow-primary-100/40 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none sm:p-10">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Create an account
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Join ATHENA to access jobs, mentors, learning paths, and a professional community built for women.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
              {serverError && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-700 dark:text-red-300">{serverError}</p>
                </div>
              )}
            <div className="flex gap-4">
              <div className="flex-1">
                <label htmlFor="firstName" className="label">
                  First Name
                </label>
                <input
                  {...register('firstName')}
                  type="text"
                  id="firstName"
                  className="input"
                  placeholder="Jane"
                  autoComplete="given-name"
                  aria-invalid={errors.firstName ? 'true' : 'false'}
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                )}
              </div>
              <div className="flex-1">
                <label htmlFor="lastName" className="label">
                  Last Name
                </label>
                <input
                  {...register('lastName')}
                  type="text"
                  id="lastName"
                  className="input"
                  placeholder="Doe"
                  autoComplete="family-name"
                  aria-invalid={errors.lastName ? 'true' : 'false'}
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                )}
              </div>
            </div>

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
                  autoComplete="new-password"
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
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {passwordRequirements.map((requirement) => (
                  <div key={requirement.label} className="flex items-center gap-2 text-sm">
                    <CheckCircle2
                      className={`h-4 w-4 ${
                        requirement.met
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    />
                    <span
                      className={
                        requirement.met
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-gray-500 dark:text-gray-400'
                      }
                    >
                      {requirement.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  className="input pr-10"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="persona" className="label">
                I&apos;m joining as
              </label>
              <select
                {...register('persona')}
                id="persona"
                className="input"
                defaultValue=""
              >
                <option value="">Select your focus area</option>
                {personaOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="inviteCode" className="label">
                Invite Code (optional)
              </label>
              <input
                {...register('inviteCode')}
                type="text"
                id="inviteCode"
                className="input"
                placeholder="Leave blank if you don't have one"
                autoComplete="off"
              />
              {errors.inviteCode && (
                <p className="mt-1 text-sm text-red-600">{errors.inviteCode.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Invite codes use letters, numbers, and dashes only.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
              <div className="flex items-start gap-3">
                <input
                  {...register('womanSelfAttested')}
                  type="checkbox"
                  id="womanSelfAttested"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <label htmlFor="womanSelfAttested" className="text-sm font-medium text-gray-900 dark:text-white">
                    I confirm that I am a woman (self-attestation)
                  </label>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    This helps ATHENA maintain the trust and safety standards of the community.
                  </p>
                </div>
              </div>
            </div>
            {errors.womanSelfAttested && (
              <p className="mt-1 text-sm text-red-600">{errors.womanSelfAttested.message}</p>
            )}

            <button
              type="submit"
              disabled={isRegisterPending}
              className="btn-primary w-full py-3 text-base"
            >
              {isRegisterPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
            <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="font-medium text-primary-600 hover:text-primary-500">
                Terms
              </Link>{' '}
              and acknowledge our{' '}
              <Link href="/privacy-center" className="font-medium text-primary-600 hover:text-primary-500">
                Privacy Center
              </Link>{' '}
              and{' '}
              <Link href="/help/community-guidelines" className="font-medium text-primary-600 hover:text-primary-500">
                Community Guidelines
              </Link>
              .
            </p>
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

            <div className="mt-6 grid grid-cols-2 gap-4">
              <GoogleSignInButton
                mode="register"
                persona={personaValue || undefined}
                womanSelfAttested={womanSelfAttestedValue}
                inviteCode={inviteCodeValue?.trim() || undefined}
                onError={(message) => setServerError(message)}
                onSuccess={() => {
                  router.replace(
                    getSafeRedirectPath(searchParams?.get('redirect'), DEFAULT_POST_REGISTER_PATH)
                  );
                }}
              />
              <button type="button" disabled className="btn-outline py-2.5 opacity-60 cursor-not-allowed">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.675 0h-21.35C.593 0 0 .593 0 1.326v21.348C0 23.407.593 24 1.326 24h11.495v-9.294H9.692v-3.622h3.129V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.794.715-1.794 1.763v2.312h3.587l-.467 3.622h-3.12V24h6.116C23.407 24 24 23.407 24 22.674V1.326C24 .593 23.407 0 22.675 0z" />
                </svg>
                Facebook Soon
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
              Google sign-in is live. Facebook sign-in is still being finalized for launch.
            </p>
          </div>

          <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-primary-600 hover:text-primary-500 font-medium">
              Sign in
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
            Trusted community access
          </div>
          <h2 className="mt-8 text-4xl font-bold leading-tight xl:text-5xl">Join a launch-ready professional network designed for women.</h2>
          <p className="mt-5 max-w-lg text-lg text-white/90">
            ATHENA blends community, jobs, AI guidance, and mentorship so you can build momentum from your first day on the platform.
          </p>
          <div className="mt-10 grid gap-4">
            <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
              <Briefcase className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Career opportunities</p>
                <p className="text-sm text-white/80">AI-matched roles, applications, and learning paths tailored to your growth stage.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
              <Users className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Real community</p>
                <p className="text-sm text-white/80">Find peers, mentors, and conversations that help you move faster with more confidence.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur">
              <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Trust and security</p>
                <p className="text-sm text-white/80">Email verification, secure sessions, privacy controls, and safer community access patterns.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
