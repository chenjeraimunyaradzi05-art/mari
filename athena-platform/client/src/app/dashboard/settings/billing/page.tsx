'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Check,
  Crown,
  Sparkles,
  ExternalLink,
  FileText,
  Building2,
} from 'lucide-react';
import {
  useAuth,
  useSubscription,
  useCancelSubscription,
  useManageBilling,
  useCreateCheckout,
  usePaymentMethods,
} from '@/lib/hooks';
import { formatDate, cn, getStoredPreference, getPreferredLocale } from '@/lib/utils';
import {
  PRO_TIER,
  formatPlanAmount,
  formatPlanInterval,
  usePlanPrices,
} from '@/app/pricing/plan-prices';

/**
 * The plans a member can move between here.
 *
 * This used to be a literal array — Free, ATHENA Pro at A$29 and Enterprise at
 * A$99 — whose prices matched neither Stripe nor the server's own table. The Pro
 * button checked out PREMIUM_CAREER at its real Stripe price, whatever that was,
 * under a card promising A$29, and the Enterprise button sent 'ENTERPRISE', a
 * tier checkout does not sell, so it failed with a 400 every time. Prices now
 * come from the server, which reads them from the Stripe price checkout
 * charges, and Enterprise is a conversation rather than a button that cannot
 * work.
 */
const FREE_FEATURES = [
  '5 job applications/month',
  'Basic job search',
  'Community access',
  'Limited AI tools',
];

const PRO_FEATURES = [
  'Unlimited job applications',
  'AI-powered resume optimizer',
  'Interview preparation coach',
  'Career path insights',
  'Priority support',
  'Exclusive events access',
];

const TIER_NAMES: Record<string, string> = {
  FREE: 'Free',
  PREMIUM_CAREER: 'ATHENA Pro',
  PREMIUM_PROFESSIONAL: 'ATHENA Professional',
  PREMIUM_ENTREPRENEUR: 'ATHENA Entrepreneur',
  PREMIUM_CREATOR: 'ATHENA Creator',
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

/** The subscription row as GET /api/subscriptions/me returns it. */
type SubscriptionRow = {
  tier?: string;
  status?: string;
  amount?: string | number | null;
  currency?: string | null;
  interval?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
};

/** What she pays, from the row the Stripe webhook keeps, or null when it has not been told. */
function formatSubscriptionPrice(subscription: SubscriptionRow | undefined): string | null {
  if (!subscription || subscription.amount == null || !subscription.currency) return null;
  const amount = Number(subscription.amount);
  if (!Number.isFinite(amount)) return null;
  try {
    const price = new Intl.NumberFormat(getPreferredLocale(), {
      style: 'currency',
      currency: subscription.currency,
    }).format(amount);
    return subscription.interval ? `${price}/${subscription.interval}` : price;
  } catch {
    return null;
  }
}

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
  const queryClient = useQueryClient();
  const { data: subscription } = useSubscription() as { data: SubscriptionRow | undefined };
  const cancelSubscription = useCancelSubscription();
  const manageBilling = useManageBilling();
  const createCheckout = useCreateCheckout();
  const planPrices = usePlanPrices();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [region, setRegion] = useState<string>(user?.region || 'ANZ');

  const checkoutOutcome = searchParams.get('checkout');

  // Auto-trigger checkout if upgrade param is present. 'pro' is what the
  // pricing page and the paywall send; anything else is passed through and the
  // server decides whether it is a tier it sells.
  useEffect(() => {
    const upgradeTier = searchParams.get('upgrade');
    if (upgradeTier && !createCheckout.isPending && !createCheckout.isSuccess) {
      createCheckout.mutate(upgradeTier === 'pro' ? PRO_TIER : upgradeTier);
    }
  }, [searchParams, createCheckout]);

  // Back from Stripe Checkout. The tier changes when Stripe's webhook arrives,
  // which is usually within seconds of the redirect but not always before it,
  // so the membership is read again rather than assumed.
  useEffect(() => {
    if (checkoutOutcome === 'success') {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    }
  }, [checkoutOutcome, queryClient]);

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
  const currentPlanName = TIER_NAMES[currentPlan] ?? 'Paid membership';
  const currentPrice = formatSubscriptionPrice(subscription);

  const proPlan = planPrices.data?.plans.find((plan) => plan.tier === PRO_TIER);
  const proAmount = proPlan ? formatPlanAmount(proPlan) : null;
  const proInterval = proPlan ? formatPlanInterval(proPlan) : null;

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

      {checkoutOutcome === 'success' && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300"
        >
          Stripe has taken your details. Your membership changes here as soon as Stripe confirms
          it, which is usually within a minute. If it has not changed after that, refresh this page.
        </div>
      )}
      {checkoutOutcome === 'cancelled' && (
        <div
          role="status"
          className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
        >
          Checkout was cancelled. Nothing was charged.
        </div>
      )}

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
                {isPremium ? currentPlanName : 'Free Plan'}
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
                  {TIER_NAMES[subscription.tier ?? currentPlan] ?? currentPlanName}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Price</p>
                {/* The figure Stripe last reported for her subscription. There
                    used to be a fallback of A$29 here for when none had been
                    recorded, which was every member, because nothing wrote it. */}
                <p className="font-medium text-slate-900 dark:text-white">
                  {currentPrice ?? 'Shown in the billing portal'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
                <p className="font-medium text-slate-900 dark:text-white">
                  {subscription.status
                    ? subscription.status.charAt(0) + subscription.status.slice(1).toLowerCase().replace(/_/g, ' ')
                    : 'Not recorded'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {subscription.cancelAtPeriodEnd ? 'Ends' : 'Next billing'}
                </p>
                <p className="font-medium text-slate-900 dark:text-white">
                  {subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : 'Not recorded'}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free */}
          <div
            className={cn(
              'card relative overflow-hidden',
              !isPremium && 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-slate-900'
            )}
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Free</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Get started with basic features
              </p>
            </div>
            <div className="mb-6">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">Free</span>
            </div>
            <PlanFeatures features={FREE_FEATURES} />
            {!isPremium ? (
              <button disabled className="w-full btn-outline py-2.5 cursor-default">
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => setShowCancelModal(true)}
                className="w-full btn-outline py-2.5 text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Downgrade
              </button>
            )}
          </div>

          {/* Pro */}
          <div
            className={cn(
              'card relative overflow-hidden border-2 border-primary-500',
              isPremium && 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-slate-900'
            )}
          >
            <div className="absolute top-0 right-0 bg-primary-500 text-white text-xs font-medium px-3 py-1 rounded-bl-lg">
              Most Popular
            </div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">ATHENA Pro</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">For serious career growth</p>
            </div>
            <div className="mb-6 min-h-[2.5rem]">
              {planPrices.isLoading ? (
                <span className="inline-block h-9 w-28 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ) : proAmount ? (
                <>
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">{proAmount}</span>
                  {proInterval && (
                    <span className="text-slate-500 dark:text-slate-400">/{proInterval}</span>
                  )}
                </>
              ) : (
                // Not a number: either the price could not be read or it is not
                // set up on this deployment. Stripe Checkout shows the price
                // before anything is charged, so she is not asked to pay blind.
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {planPrices.isError
                    ? 'We could not load the price just now. Stripe shows it before you pay.'
                    : 'The price is not available right now. Stripe shows it before you pay.'}
                </p>
              )}
            </div>
            <PlanFeatures features={PRO_FEATURES} />
            {isPremium ? (
              <button disabled className="w-full btn-outline py-2.5 cursor-default">
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => createCheckout.mutate(PRO_TIER)}
                disabled={createCheckout.isPending}
                className="w-full py-2.5 text-center disabled:opacity-50 btn-primary"
              >
                {createCheckout.isPending ? 'Opening checkout...' : 'Upgrade'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-lg border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
          <Building2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
          <p>
            Buying for a team or an organisation? That is arranged with us directly rather than
            through checkout.{' '}
            <Link href="/contact-sales" className="font-medium text-primary-600 hover:text-primary-700">
              Talk to us
            </Link>
          </p>
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
              {/* ATHENA does not hold card details; Stripe does. This used to
                  read a cardLast4 field nothing ever returned, and so told every
                  paying member she had no saved payment method. */}
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Held securely by Stripe</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  See or change the card you pay with in the billing portal
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
              <span>Stripe receipts</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* The history table here read an `invoices` list that the subscription
            endpoint never returns, so every paying member was told she had no
            billing history. The tax invoices ATHENA issues are listed on their
            own page, and Stripe keeps the receipts. */}
        <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
          <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />
          <p>
            Your tax invoices are on the{' '}
            <Link
              href="/dashboard/finance/invoices"
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              Invoices page
            </Link>
            {isPremium
              ? ', and every payment receipt is in the Stripe billing portal.'
              : '.'}
          </p>
        </div>
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

function PlanFeatures({ features }: { features: string[] }) {
  return (
    <ul className="space-y-3 mb-6">
      {features.map((feature) => (
        <li key={feature} className="flex items-start space-x-2">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-slate-600 dark:text-slate-300">{feature}</span>
        </li>
      ))}
    </ul>
  );
}
