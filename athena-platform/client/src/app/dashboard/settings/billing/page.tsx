'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Check,
  Crown,
  Sparkles,
  Zap,
  Calendar,
  Download,
  ExternalLink,
} from 'lucide-react';
import { useAuth, useSubscription, useCancelSubscription, useManageBilling, useCreateCheckout } from '@/lib/hooks';
import { formatCurrency, formatDate, cn, getStoredPreference } from '@/lib/utils';
import { Skeleton } from '@/components/ui/loading';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    description: 'Get started with basic features',
    features: [
      '5 job applications/month',
      'Basic job search',
      'Community access',
      'Limited AI tools',
    ],
    current: true,
  },
  {
    id: 'pro',
    name: 'ATHENA Pro',
    price: 29,
    interval: 'month',
    description: 'For serious career growth',
    features: [
      'Unlimited job applications',
      'AI-powered resume optimizer',
      'Interview preparation coach',
      'Career path insights',
      'Priority support',
      'Exclusive events access',
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    interval: 'month',
    description: 'For teams and organizations',
    features: [
      'Everything in Pro',
      'Team management',
      'Custom integrations',
      'Dedicated account manager',
      'SLA & premium support',
      'Analytics dashboard',
    ],
  },
];

export default function BillingSettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { data: subscription, isLoading } = useSubscription();
  const cancelSubscription = useCancelSubscription();
  const manageBilling = useManageBilling();
  const createCheckout = useCreateCheckout();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [region, setRegion] = useState(
    user?.region || getStoredPreference('athena.region', 'ANZ')
  );

  // Auto-trigger checkout if upgrade param is present
  useEffect(() => {
    const upgradeTier = searchParams.get('upgrade');
    if (upgradeTier && !createCheckout.isPending && !createCheckout.isSuccess) {
      // Map 'pro' to actual tier enum if needed, or pass 'pro' if backend handles it
      const tierMap: Record<string, string> = {
        'pro': 'PREMIUM_CAREER', // Default pro tier
        // Add others if needed
      };
      const tier = tierMap[upgradeTier] || upgradeTier;
      
      createCheckout.mutate(tier);
    }
  }, [searchParams, createCheckout]);

  useEffect(() => {
    setRegion(user?.region || getStoredPreference('athena.region', 'ANZ'));
  }, [user]);

  const currentPlan = user?.subscriptionTier || 'FREE';
  const isPremium = currentPlan !== 'FREE';
  const paymentMethodsByRegion: Record<string, { name: string; description: string }[]> = {
    JP: [{ name: 'PayPay', description: 'Fast mobile wallet payments in Japan.' }],
    KR: [{ name: 'KakaoPay', description: 'Local wallet for South Korea.' }],
    IN: [{ name: 'UPI', description: 'Unified Payments Interface support.' }],
    BR: [{ name: 'Pix', description: 'Instant bank transfer for Brazil.' }],
    MX: [{ name: 'OXXO', description: 'Cash payments at OXXO stores.' }],
    LATAM: [{ name: 'Mercado Pago', description: 'Regional payment gateway for LatAm.' }],
  };

  const handleManageBilling = async () => {
    manageBilling.mutate(undefined, {
      onSuccess: (data) => {
        if (data?.url) {
          window.location.href = data.url;
        }
      },
    });
  };

  const handleCancelSubscription = async () => {
    cancelSubscription.mutate(undefined, {
      onSuccess: () => {
        setShowCancelModal(false);
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Billing & Subscription
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your subscription and billing information
        </p>
      </div>

      {/* Current Subscription */}
      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className={cn(
              'p-3 rounded-xl',
              isPremium 
                ? 'bg-gradient-to-br from-primary-500 to-secondary-500' 
                : 'bg-gray-100 dark:bg-gray-800'
            )}>
              {isPremium ? (
                <Crown className="w-6 h-6 text-white" />
              ) : (
                <Sparkles className="w-6 h-6 text-gray-500" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isPremium ? 'ATHENA Pro' : 'Free Plan'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isPremium 
                  ? 'You have access to all premium features' 
                  : 'Upgrade to unlock all features'}
              </p>
            </div>
          </div>
          {isPremium && (
            <button
              onClick={handleManageBilling}
              disabled={manageBilling.isPending}
              className="btn-outline px-4 py-2 text-sm"
            >
              {manageBilling.isPending ? 'Loading...' : 'Manage Billing'}
            </button>
          )}
        </div>

        {isPremium && subscription && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Plan</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {subscription.plan || 'Pro Monthly'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Price</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(subscription.amount || 29)}/month
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                <p className="font-medium text-green-600 dark:text-green-400">
                  {subscription.status || 'Active'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Next billing</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatDate(subscription.currentPeriodEnd) || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Local Payment Methods */}
      {(paymentMethodsByRegion[region] || []).length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Local payment methods
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Available in your region (integration in progress).
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {paymentMethodsByRegion[region].map((method) => (
              <div
                key={method.name}
                className="flex items-start justify-between rounded-lg border border-dashed border-gray-200 dark:border-gray-800 p-4"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{method.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{method.description}</p>
                </div>
                <span className="text-xs text-gray-400">Placeholder</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Plans */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Available Plans
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = 
              (plan.id === 'free' && currentPlan === 'FREE') ||
              (plan.id === 'pro' && currentPlan.startsWith('PREMIUM')) ||
              (plan.id === 'enterprise' && currentPlan === 'ENTERPRISE');

            return (
              <div
                key={plan.id}
                className={cn(
                  'card relative overflow-hidden',
                  plan.popular && 'border-2 border-primary-500',
                  isCurrentPlan && 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900'
                )}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary-500 text-white text-xs font-medium px-3 py-1 rounded-bl-lg">
                    Most Popular
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {plan.description}
                  </p>
                </div>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {plan.price === 0 ? 'Free' : formatCurrency(plan.price)}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-gray-500 dark:text-gray-400">
                      /{plan.interval}
                    </span>
                  )}
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                {isCurrentPlan ? (
                  <button
                    disabled
                    className="w-full btn-outline py-2.5 cursor-default"
                  >
                    Current Plan
                  </button>
                ) : plan.id === 'free' ? (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    disabled={currentPlan === 'FREE'}
                    className="w-full btn-outline py-2.5 text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Downgrade
                  </button>
                ) : (
                  <Link
                    href={`/api/subscription/checkout?plan=${plan.id}`}
                    className={cn(
                      'w-full py-2.5 text-center block',
                      plan.popular ? 'btn-primary' : 'btn-outline'
                    )}
                  >
                    Upgrade
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Method */}
      {isPremium && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Payment Method
          </h2>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                <CreditCard className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  •••• •••• •••• {subscription?.cardLast4 || '4242'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Expires {subscription?.cardExpiry || '12/25'}
                </p>
              </div>
            </div>
            <button
              onClick={handleManageBilling}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Update
            </button>
          </div>
        </div>
      )}

      {/* Regional Payment Options (Phase 6 placeholders) */}
      {region === 'MEA' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Regional payment options (coming soon)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            We’re preparing local payment methods to improve access across MEA markets.
          </p>
          <div className="space-y-3">
            {[
              {
                name: 'M-Pesa',
                availability: 'Kenya, Tanzania',
                status: 'Coming soon',
              },
              {
                name: 'Paystack',
                availability: 'Nigeria, Ghana',
                status: 'Coming soon',
              },
              {
                name: 'Bank transfer',
                availability: 'UAE, Saudi Arabia, Egypt',
                status: 'Planned',
              },
            ].map((option) => (
              <div
                key={option.name}
                className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {option.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {option.availability}
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {option.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEA Payment Options (Phase 5 placeholders) */}
      {region === 'SEA' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Regional payment options (coming soon)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            We’re preparing local payment methods to improve access across SEA markets.
          </p>
          <div className="space-y-3">
            {[
              {
                name: 'GCash',
                availability: 'Philippines',
                status: 'Coming soon',
              },
              {
                name: 'GrabPay',
                availability: 'Singapore, Malaysia, Philippines',
                status: 'Coming soon',
              },
              {
                name: 'OVO',
                availability: 'Indonesia',
                status: 'Planned',
              },
            ].map((option) => (
              <div
                key={option.name}
                className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {option.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {option.availability}
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {option.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rest of World Payment Options (Phase 7 placeholders) */}
      {region === 'ROW' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Regional payment options (coming soon)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            We’re preparing local payment methods for Phase 7 markets.
          </p>
          <div className="space-y-3">
            {[
              {
                name: 'PayPay',
                availability: 'Japan',
                status: 'Planned',
              },
              {
                name: 'KakaoPay',
                availability: 'South Korea',
                status: 'Planned',
              },
              {
                name: 'UPI',
                availability: 'India',
                status: 'Planned',
              },
              {
                name: 'Pix',
                availability: 'Brazil',
                status: 'Planned',
              },
              {
                name: 'OXXO',
                availability: 'Mexico',
                status: 'Planned',
              },
              {
                name: 'Mercado Pago',
                availability: 'Latin America',
                status: 'Planned',
              },
            ].map((option) => (
              <div
                key={option.name}
                className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-3"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {option.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {option.availability}
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {option.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Billing History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Billing History
          </h2>
          {isPremium && (
            <button
              onClick={handleManageBilling}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center space-x-1"
            >
              <span>View All</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
        {isPremium && subscription?.invoices?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Date
                  </th>
                  <th className="text-left py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Description
                  </th>
                  <th className="text-left py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Amount
                  </th>
                  <th className="text-left py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="text-right py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Invoice
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscription.invoices.map((invoice: any) => (
                  <tr key={invoice.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 text-sm text-gray-900 dark:text-white">
                      {formatDate(invoice.date)}
                    </td>
                    <td className="py-3 text-sm text-gray-600 dark:text-gray-300">
                      {invoice.description || 'ATHENA Pro - Monthly'}
                    </td>
                    <td className="py-3 text-sm text-gray-900 dark:text-white">
                      {formatCurrency(invoice.amount)}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                        Paid
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <a
                        href={invoice.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No billing history available
          </p>
        )}
      </div>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Cancel Subscription
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to cancel your subscription? You'll lose access to
              premium features at the end of your current billing period.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="btn-outline px-4 py-2"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelSubscription.isPending}
                className="btn bg-red-600 text-white hover:bg-red-700 px-4 py-2"
              >
                {cancelSubscription.isPending ? 'Canceling...' : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
