'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Check,
  Crown,
  Sparkles,
  Download,
  ExternalLink,
} from 'lucide-react';
import {
  useAuth,
  useSubscription,
  useCancelSubscription,
  useManageBilling,
  useCreateCheckout,
  usePaymentMethods,
} from '@/lib/hooks';
import { formatCurrency, formatDate, cn, getStoredPreference } from '@/lib/utils';

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

const checkoutTierByPlan: Record<string, string> = {
  pro: 'PREMIUM_CAREER',
  enterprise: 'ENTERPRISE',
};

const paymentRegionCodes: Record<string, string> = {
  ANZ: 'AU',
  AU: 'AU',
  NZ: 'NZ',
  US: 'US',
  UK: 'UK',
  EU: 'EU',
  SEA: 'SG',
  SG: 'SG',
  PH: 'PH',
  ID: 'ID',
  MEA: 'KE',
  KE: 'KE',
  IN: 'IN',
  BR: 'BR',
};

const paymentTypeLabels: Record<string, string> = {
  card: 'Card',
  wallet: 'Wallet',
  bank: 'Bank transfer',
  mobile_money: 'Mobile money',
};

type PaymentMethod = {
  provider: string;
  type: string;
  name: string;
  icon?: string;
};

export default function BillingSettingsPage() {
  return (
    <Suspense fallback={null}>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { data: subscription } = useSubscription();
  const cancelSubscription = useCancelSubscription();
  const manageBilling = useManageBilling();
  const createCheckout = useCreateCheckout();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [region, setRegion] = useState<string>(user?.region || 'ANZ');

  // Auto-trigger checkout if upgrade param is present
  useEffect(() => {
    const upgradeTier = searchParams.get('upgrade');
    if (upgradeTier && !createCheckout.isPending && !createCheckout.isSuccess) {
      const tier = checkoutTierByPlan[upgradeTier] || upgradeTier;
      
      createCheckout.mutate(tier);
    }
  }, [searchParams, createCheckout]);

  useEffect(() => {
    setRegion(user?.region || getStoredPreference('athena.region', 'ANZ'));
  }, [user]);

  const paymentRegion = paymentRegionCodes[region] || region || 'US';
  const {
    data: paymentMethods = [],
    isLoading: paymentMethodsLoading,
    isError: paymentMethodsError,
  } = usePaymentMethods(paymentRegion);
  const currentPlan = user?.subscriptionTier || 'FREE';
  const isPremium = currentPlan !== 'FREE';

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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Billing & Subscription
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
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
                : 'bg-slate-100 dark:bg-slate-800'
            )}>
              {isPremium ? (
                <Crown className="w-6 h-6 text-white" />
              ) : (
                <Sparkles className="w-6 h-6 text-slate-500" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isPremium ? 'ATHENA Pro' : 'Free Plan'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
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
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Plan</p>
                <p className="font-medium text-slate-900 dark:text-white">
                  {subscription.plan || 'Pro Monthly'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Price</p>
                <p className="font-medium text-slate-900 dark:text-white">
                  {formatCurrency(subscription.amount || 29)}/month
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
                <p className="font-medium text-green-600 dark:text-green-400">
                  {subscription.status || 'Active'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Next billing</p>
                <p className="font-medium text-slate-900 dark:text-white">
                  {formatDate(subscription.currentPeriodEnd) || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Available Payment Methods */}
      <div className="card">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Available payment methods
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Methods currently returned by the payment routing service for {paymentRegion}.
          </p>
        </div>
        <div className="mt-4 grid gap-3">
          {paymentMethodsLoading ? (
            [1, 2].map((item) => (
              <div
                key={item}
                className="h-20 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse"
              />
            ))
          ) : paymentMethodsError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
              Payment methods could not be loaded.
            </div>
          ) : paymentMethods.length > 0 ? (
            paymentMethods.map((method: PaymentMethod) => (
              <div
                key={`${method.provider}-${method.type}`}
                className="flex items-start justify-between rounded-lg border border-slate-200 dark:border-slate-800 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                    <CreditCard className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{method.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {paymentTypeLabels[method.type] || method.type}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  Available
                </span>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              No payment methods are configured for this region.
            </div>
          )}
        </div>
      </div>

      {/* Available Plans */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
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
                  isCurrentPlan && 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-slate-900'
                )}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary-500 text-white text-xs font-medium px-3 py-1 rounded-bl-lg">
                    Most Popular
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {plan.description}
                  </p>
                </div>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">
                    {plan.price === 0 ? 'Free' : formatCurrency(plan.price)}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-slate-500 dark:text-slate-400">
                      /{plan.interval}
                    </span>
                  )}
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-600 dark:text-slate-300">
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
                  <button
                    onClick={() => createCheckout.mutate(checkoutTierByPlan[plan.id] || plan.id)}
                    disabled={createCheckout.isPending}
                    className={cn(
                      'w-full py-2.5 text-center disabled:opacity-50',
                      plan.popular ? 'btn-primary' : 'btn-outline'
                    )}
                  >
                    {createCheckout.isPending ? 'Opening checkout...' : 'Upgrade'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Method */}
      {isPremium && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Payment Method
          </h2>
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                <CreditCard className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  {subscription?.cardLast4 ? `•••• •••• •••• ${subscription.cardLast4}` : 'No saved payment method'}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {subscription?.cardExpiry ? `Expires ${subscription.cardExpiry}` : 'Use the billing portal to add or update a card'}
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

      {/* Billing History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
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
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Date
                  </th>
                  <th className="text-left py-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Description
                  </th>
                  <th className="text-left py-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Amount
                  </th>
                  <th className="text-left py-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Status
                  </th>
                  <th className="text-right py-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Invoice
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscription.invoices.map((invoice: any) => (
                  <tr key={invoice.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 text-sm text-slate-900 dark:text-white">
                      {formatDate(invoice.date)}
                    </td>
                    <td className="py-3 text-sm text-slate-600 dark:text-slate-300">
                      {invoice.description || 'ATHENA Pro - Monthly'}
                    </td>
                    <td className="py-3 text-sm text-slate-900 dark:text-white">
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
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
            No billing history available
          </p>
        )}
      </div>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Cancel Subscription
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
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
