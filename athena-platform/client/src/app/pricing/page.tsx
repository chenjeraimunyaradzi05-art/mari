'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  X,
  Zap,
  Crown,
  Building2,
  ArrowRight,
  HelpCircle,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';
import { TRIAL_DAYS, REFUND_DAYS } from '@/lib/pricing';
import { PRO_TIER, describeChatAllowance, formatPlanAmount, formatPlanInterval, usePlanPrices } from './plan-prices';

/**
 * The three cards. None of them carries a price of its own any more.
 *
 * Pro used to say A$29 a month, or A$290 billed annually with the toggle on
 * its default of yearly, and Enterprise A$99. None of those was a price
 * anything charged: the Pro button starts a monthly PREMIUM_CAREER checkout at
 * its real Stripe price, no yearly price exists anywhere, and Enterprise is not
 * a tier checkout sells. Pro's price is now read from the server, which reads
 * it from the Stripe price checkout charges; Free is free; Enterprise is priced
 * in conversation, so it shows no number.
 *
 * The feature lists are the same kind of promise and are held to the same rule:
 * only what the server really does is listed. That is the six AI tools, which
 * the server refuses to anyone without an active Pro or trial (routes/ai.routes
 * requireAiPremium), and a larger daily allowance for the AI chat. The free plan
 * used to say "5 job applications/month" and Pro "Unlimited", when nothing caps
 * applications on either, and Pro promised "20% off all courses", "1 free
 * mentor session/month", "Interview Coach (10 sessions/mo)" and "Priority job
 * matches", none of which exist; Enterprise listed SSO/SAML, API access, a
 * dedicated account manager and custom job boards. Nothing is on a card here
 * until the server does it. An offer that is wanted later is built first, with
 * the server refusing what it does not allow, and listed after.
 */
type PlanFeature = { name: string; included: boolean; chat?: 'free' | 'paid' };

const plans = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for exploring the platform',
    icon: Zap,
    color: 'gray',
    popular: false,
    features: [
      { name: 'Job search and applications', included: true },
      { name: 'Community access', included: true },
      { name: 'Your profile', included: true },
      { name: 'ATHENA AI chat, with a daily allowance', included: true, chat: 'free' as const },
      { name: 'AI Resume Optimizer', included: false },
      { name: 'Interview Coach', included: false },
      { name: 'Opportunity Radar AI', included: false },
      { name: 'Career Path Planner', included: false },
      { name: 'AI Content Generator', included: false },
      { name: 'Business Idea Validator', included: false },
    ],
    cta: 'Current Plan',
    disabled: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For serious career growth',
    icon: Crown,
    color: 'primary',
    popular: true,
    features: [
      { name: 'Everything in Free', included: true },
      { name: 'AI Resume Optimizer', included: true },
      { name: 'Interview Coach', included: true },
      { name: 'Opportunity Radar AI', included: true },
      { name: 'Career Path Planner', included: true },
      { name: 'AI Content Generator', included: true },
      { name: 'Business Idea Validator', included: true },
      { name: 'A larger daily allowance for the ATHENA AI chat', included: true, chat: 'paid' as const },
    ],
    cta: 'Upgrade to Pro',
    disabled: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For teams and organisations',
    icon: Building2,
    color: 'purple',
    popular: false,
    // No checklist. What an organisation gets is agreed with it, in writing, so
    // a list here would be a promise nobody has been asked to keep.
    features: [] as PlanFeature[],
    note: 'Tell us what your team needs and we will say plainly what we can offer, and what it costs.',
    cta: 'Talk to us',
    disabled: false,
  },
];

const faqs = [
  {
    question: 'Can I switch plans at any time?',
    answer:
      'Yes! You can upgrade or downgrade your plan at any time. When upgrading, you\'ll be charged the prorated difference. When downgrading, you\'ll keep your current plan until the end of the billing cycle.',
  },
  {
    question: 'Is there a free trial for Pro?',
    // Stripe Checkout collects card details to start a subscription trial, so
    // "no credit card required" was never true. The trial itself is real —
    // subscription.routes.ts sets trial_period_days from the same constant.
    // Once per person, as the Terms (6.4) say and as checkout enforces: a member
    // who has had a subscription before gets no second trial and is charged when
    // she checks out, so the page does not promise her one.
    answer: `Yes — ${TRIAL_DAYS} days of Pro, free, with your first subscription. You enter card details to start it, nothing is charged during the trial, and if you cancel before it ends you pay nothing. The trial is offered once for each person: if you have subscribed before, your card is charged when you check out.`,
  },
  {
    question: 'What happens when my trial ends?',
    // The card entered to start the trial is charged on the day it ends, which is
    // what the answer above and the Terms (6.4) say. This used to promise a move
    // to the Free plan "unless you choose to subscribe", which is not what
    // happens: the card is charged unless she has cancelled.
    answer:
      'The card you entered to start the trial is charged the Pro price on the day the trial ends, unless you cancel first. We email you a few days before, with the date and the amount. To stop it, cancel from Settings, then Billing, before that day and you pay nothing. After you cancel you keep the Free plan, and your saved data and applications are kept.',
  },
  {
    question: 'Do you offer refunds?',
    // Honest about the mechanism: there is no automated refund path, so saying
    // so beats implying an instant one.
    answer: `Yes. First-time subscribers have ${REFUND_DAYS} days — contact us inside that window and we refund in full. Refunds are processed by hand, so allow a few working days for the money to reach your account.`,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const planPrices = usePlanPrices();
  const proPlan = planPrices.data?.plans.find((plan) => plan.tier === PRO_TIER);
  const proAmount = proPlan ? formatPlanAmount(proPlan) : null;
  const proInterval = proPlan ? formatPlanInterval(proPlan) : null;
  // The GST sentence comes from the server, which works it out from the same
  // registration the invoices read. Until it arrives, or on a server that does
  // not send it, nothing is printed: no guess at a tax position.
  const gstStatement = planPrices.data?.gst?.statement ?? null;
  // What the card is charged on the day the trial ends: the real price when the
  // server could give it, and the plain words when it could not.
  const firstCharge = proAmount ? `${proAmount}${proInterval ? ` a ${proInterval}` : ''}` : 'the Pro price';
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  // While an admin has paused new payments the upgrade would be refused, so the
  // button is held and the page says why, in the admin's own words. Only an
  // explicit true: a server that does not say is not guessed at.
  const paymentsPaused = planPrices.data?.paused === true;
  const pausedNote = planPrices.data?.pauseMessage || 'Memberships are paused while we finish checking payments.';
  // What the chat allowance really is, from the table the server enforces. Until
  // it arrives the line keeps its plain wording, and no number is guessed.
  const chatAllowance = {
    free: describeChatAllowance(planPrices.data?.entitlements?.free.aiChat),
    paid: describeChatAllowance(planPrices.data?.entitlements?.paid.aiChat),
  };
  const featureName = (feature: PlanFeature) =>
    feature.chat && chatAllowance[feature.chat]
      ? feature.chat === 'free'
        ? `ATHENA AI chat, ${chatAllowance.free}`
        : `A larger allowance for the ATHENA AI chat: ${chatAllowance.paid}`
      : feature.name;

  const handleSelectPlan = (planId: string) => {
    if (planId === 'enterprise') {
      router.push('/contact-sales');
    } else if (planId === 'pro') {
      router.push('/dashboard/settings/billing?upgrade=pro');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Choose Your Path to Success
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Invest in your career with the tools, connections, and support you need to thrive
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'relative bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden transition-transform hover:scale-105',
                plan.popular && 'ring-2 ring-primary-500'
              )}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-primary-500 text-white text-center py-2 text-sm font-medium flex items-center justify-center">
                  <Star className="w-4 h-4 mr-1 fill-current" />
                  Most Popular
                </div>
              )}

              <div className={cn('p-8', plan.popular && 'pt-14')}>
                {/* Plan Header */}
                <div className="flex items-center space-x-3 mb-4">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      plan.color === 'gray' && 'bg-slate-100 dark:bg-slate-700',
                      plan.color === 'primary' && 'bg-primary-100 dark:bg-primary-900/30',
                      plan.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30'
                    )}
                  >
                    <plan.icon
                      className={cn(
                        'w-6 h-6',
                        plan.color === 'gray' && 'text-slate-500',
                        plan.color === 'primary' && 'text-primary-500',
                        plan.color === 'purple' && 'text-purple-500'
                      )}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {plan.description}
                    </p>
                  </div>
                </div>

                {/* Pricing */}
                <div className="mb-6 min-h-[3rem]">
                  {plan.id === 'free' ? (
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">Free</span>
                  ) : plan.id === 'pro' ? (
                    planPrices.isLoading ? (
                      <span className="inline-block h-10 w-32 rounded bg-slate-100 dark:bg-slate-700 animate-pulse" />
                    ) : proAmount ? (
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold text-slate-900 dark:text-white">{proAmount}</span>
                        {proInterval && (
                          <span className="text-slate-500 dark:text-slate-400 ml-2">/{proInterval}</span>
                        )}
                      </div>
                    ) : (
                      // No number rather than a guessed one. Stripe Checkout
                      // shows the price before anything is charged.
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {planPrices.isError
                          ? 'We could not load the price just now. Stripe shows it before you pay.'
                          : 'The price is not available right now. Stripe shows it before you pay.'}
                      </p>
                    )
                  ) : (
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      Priced with your organisation
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={plan.disabled || (plan.id === 'pro' && paymentsPaused)}
                  aria-describedby={plan.id === 'pro' && paymentsPaused ? 'payments-paused-note' : undefined}
                  className={cn(
                    'w-full min-h-[44px] py-3 rounded-lg font-semibold transition flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                    plan.id === 'pro' && paymentsPaused && 'opacity-50 cursor-not-allowed',
                    plan.color === 'primary'
                      ? 'bg-primary-500 text-white hover:bg-primary-600'
                      : plan.color === 'purple'
                      ? 'bg-purple-500 text-white hover:bg-purple-600'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                  )}
                >
                  {plan.cta}
                  {!plan.disabled && <ArrowRight className="w-4 h-4 ml-2" />}
                </button>

                {plan.id === 'pro' && paymentsPaused && (
                  <p id="payments-paused-note" role="status" className="mt-3 text-center text-sm text-amber-800 dark:text-amber-200">
                    {pausedNote}
                  </p>
                )}

                {plan.id === 'pro' && (
                  // Said at the button, where the decision is made: a card is
                  // needed to start the trial, and it is charged when it ends.
                  <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
                    {TRIAL_DAYS}-day free trial with a first subscription. A card is needed to start it, and it is
                    charged {firstCharge} on the day the trial ends unless you cancel first. If you have subscribed
                    before, your card is charged {firstCharge} when you check out.
                  </p>
                )}

                {/* Features */}
                {'note' in plan && plan.note && (
                  <p className="mt-8 text-sm text-slate-600 dark:text-slate-300">{plan.note}</p>
                )}
                <div className="mt-8 space-y-3">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-5 h-5 text-slate-300 dark:text-slate-600 flex-shrink-0 mt-0.5" />
                      )}
                      <span
                        className={cn(
                          'text-sm',
                          feature.included
                            ? 'text-slate-700 dark:text-slate-300'
                            : 'text-slate-400 dark:text-slate-500'
                        )}
                      >
                        {featureName(feature)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {gstStatement && (
          <p className="-mt-10 mb-12 text-center text-sm text-slate-500 dark:text-slate-400">{gstStatement}</p>
        )}

        {/* Trust Badges */}
        <div className="text-center mb-16">
          <div className="flex flex-wrap items-center justify-center gap-8 text-slate-400 dark:text-slate-500">
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-500" />
              <span>{REFUND_DAYS}-day money-back guarantee</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-500" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-500" />
              <span>Secure payments via Stripe</span>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-8">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="font-medium text-slate-900 dark:text-white">
                    {faq.question}
                  </span>
                  <HelpCircle
                    className={cn(
                      'w-5 h-5 text-slate-400 transition-transform',
                      expandedFaq === index && 'rotate-180'
                    )}
                  />
                </button>
                {expandedFaq === index && (
                  <div className="px-4 pb-4 text-slate-600 dark:text-slate-300 text-sm">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-primary-500 to-purple-500 rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Ready to accelerate your career?
            </h2>
            <p className="text-white/90 mb-6 max-w-2xl mx-auto">
              Start with the free plan, or try Pro free and see whether the AI career tools
              are useful to you. Nothing here is charged until the trial ends.
            </p>
            <button
              onClick={() => handleSelectPlan('pro')}
              disabled={paymentsPaused}
              className="bg-white text-primary-600 px-8 py-3 min-h-[44px] rounded-lg font-semibold hover:bg-slate-100 transition flex items-center mx-auto disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-500"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
            <p className="text-white/70 text-sm mt-4">
              {TRIAL_DAYS}-day free trial &bull; A card is needed to start &bull; Cancel before it ends and pay nothing
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
