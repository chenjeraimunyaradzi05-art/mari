'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Zap, Check } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { SubscriptionTier } from '@/lib/types';

interface PaywallGateProps {
  children: React.ReactNode;
  featureName?: string;
  minTier?: SubscriptionTier;
}

export default function PaywallGate({ 
  children, 
  featureName = 'Premium Feature',
  minTier = 'PREMIUM_CAREER' 
}: PaywallGateProps) {
  const { user } = useAuthStore();
  const router = useRouter();

  // If loading or no user, usually handled by auth guard, but safe to return null or spinner
  if (!user) return null;

  const isPro = user.subscriptionTier && user.subscriptionTier !== 'FREE';

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
        <div className="bg-primary-100 dark:bg-primary-900/30 p-4 rounded-full mb-6 relative">
          <Zap className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          <div className="absolute -top-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-1 shadow-sm">
            <Lock className="w-4 h-4 text-gray-500" />
          </div>
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Unlock {featureName}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-300 max-w-md mb-8">
          Upgrade to ATHENA Pro to access AI-powered tools like the {featureName}, unlimited job applications, and more.
        </p>

        <ul className="text-left space-y-3 mb-8 mx-auto max-w-xs">
           <li className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Check className="w-4 h-4 mr-2 text-green-500" />
              AI Resume Optimization
           </li>
           <li className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Check className="w-4 h-4 mr-2 text-green-500" />
              Interview Coach
           </li>
           <li className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Check className="w-4 h-4 mr-2 text-green-500" />
              Unlimited Applications
           </li>
        </ul>

        <button 
          onClick={() => router.push('/dashboard/settings/billing?upgrade=pro')}
          className="btn-primary px-8 py-3 rounded-full font-medium"
        >
          Upgrade to Pro
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
