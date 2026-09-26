'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Crown, Loader2, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

/**
 * Whether her plan opens the premium AI tools, as the server decides it.
 *
 * The gate these pages used before read `user.subscriptionTier`, a field no
 * server response has ever set: /auth/me sends `subscription: { tier, status }`
 * and login, register and refresh send no tier at all. So it saw undefined for
 * everyone, and every member — paying ones included — was shown "Upgrade to
 * Pro" where the tool should have been. The AI hub read the same undefined the
 * other way round and let free members straight through. Neither looked at
 * whether the subscription was active, which the server's own gate does.
 *
 * GET /api/ai/access answers with the rule the premium routes apply, so the
 * page and the route cannot disagree about who has paid.
 */
export type AiAccess = { premium: boolean; tier: string; status: string | null };

export function usePremiumAccess() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  return useQuery({
    queryKey: ['ai-access', user?.id ?? null],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: AiAccess }>('/ai/access');
      return response.data.data;
    },
    enabled: isAuthenticated && !isLoading,
    staleTime: 60 * 1000,
  });
}

/** "PAST_DUE" as a member would say it. */
const describeStatus = (status: string) => status.toLowerCase().replace(/_/g, ' ');

export default function PremiumGate({ featureName, children }: { featureName: string; children: ReactNode }) {
  const access = usePremiumAccess();

  if (access.isPending) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking your plan…
      </div>
    );
  }

  // A failed check is not a refusal. Showing the upgrade card here would tell
  // a paying member she has not paid, which is the mistake this replaced.
  if (access.isError) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 p-10 text-center dark:border-slate-700">
        <AlertCircle className="h-8 w-8 text-amber-500" />
        <p className="font-medium text-slate-900 dark:text-white">We could not check your plan just now.</p>
        <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
          This is a problem reaching ATHENA, not a problem with your subscription.
        </p>
        <button type="button" onClick={() => access.refetch()} className="btn-secondary px-4 py-2 text-sm">
          Try again
        </button>
      </div>
    );
  }

  if (access.data.premium) {
    return <>{children}</>;
  }

  const lapsed = access.data.tier !== 'FREE' && access.data.status !== null;

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center dark:border-slate-700 dark:bg-slate-800/50">
      <div className="relative mb-6 rounded-full bg-primary-100 p-4 dark:bg-primary-900/30">
        <Crown className="h-8 w-8 text-primary-600 dark:text-primary-400" />
        <div className="absolute -right-1 -top-1 rounded-full bg-white p-1 shadow-sm dark:bg-slate-800">
          <Lock className="h-4 w-4 text-slate-500" />
        </div>
      </div>

      {lapsed ? (
        <>
          <h3 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">{featureName} is paused</h3>
          <p className="mb-8 max-w-md text-slate-600 dark:text-slate-300">
            Your ATHENA Pro subscription is {describeStatus(access.data.status ?? '')}. Update your billing
            details and {featureName} opens again straight away.
          </p>
          <Link href="/dashboard/settings/billing" className="btn-primary rounded-full px-8 py-3 font-medium">
            Go to billing
          </Link>
        </>
      ) : (
        <>
          <h3 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">{featureName} is part of ATHENA Pro</h3>
          <p className="mb-8 max-w-md text-slate-600 dark:text-slate-300">
            ATHENA Pro opens the Resume Optimizer, Interview Coach, Career Path Analyzer, Opportunity Radar,
            Content Generator and Business Idea Validator, and raises your daily ATHENA chat limit.
          </p>
          <Link href="/dashboard/settings/billing" className="btn-primary rounded-full px-8 py-3 font-medium">
            See ATHENA Pro
          </Link>
        </>
      )}
    </div>
  );
}
