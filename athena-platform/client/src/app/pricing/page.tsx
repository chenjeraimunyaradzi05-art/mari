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
import { cn, formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';

const plans = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for exploring the platform',
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: Zap,
    color: 'gray',
    popular: false,
    features: [
      { name: 'Basic job search', included: true },
      { name: 'Community access', included: true },
      { name: '5 job applications/month', included: true },
      { name: 'Basic profile', included: true },
      { name: 'AI Resume Optimizer', included: false },
      { name: 'Interview Coach', included: false },
      { name: 'Priority job matches', included: false },
      { name: 'Unlimited applications', included: false },
      { name: 'Course discounts', included: false },
      { name: 'Mentor booking', included: false },
      { name: 'Premium support', included: false },
    ],
    cta: 'Current Plan',
    disabled: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For serious career growth',
    monthlyPrice: 29,
    yearlyPrice: 290, // 2 months free
    icon: Crown,
    color: 'primary',
    popular: true,
    features: [
      { name: 'Everything in Free', included: true },
      { name: 'Unlimited job applications', included: true },
      { name: 'AI Resume Optimizer', included: true },
      { name: 'Interview Coach (10 sessions/mo)', included: true },
      { name: 'Opportunity Radar AI', included: true },
      { name: 'Career Path Planner', included: true },
      { name: 'Priority job matches', included: true },
      { name: '20% off all courses', included: true },
      { name: '1 free mentor session/month', included: true },
      { name: 'Email support', included: true },
      { name: 'Early access to new features', included: true },
    ],
    cta: 'Upgrade to Pro',
    disabled: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For teams and organizations',
    monthlyPrice: 99,
    yearlyPrice: 990,
    icon: Building2,
    color: 'purple',
    popular: false,
    features: [
      { name: 'Everything in Pro', included: true },
      { name: 'Unlimited team members', included: true },
      { name: 'Unlimited AI usage', included: true },
      { name: 'Custom job boards', included: true },
      { name: 'Employer branding', included: true },
      { name: 'Analytics dashboard', included: true },
      { name: 'Dedicated account manager', included: true },
      { name: 'SSO/SAML integration', included: true },
      { name: 'API access', included: true },
      { name: 'Custom contracts', included: true },
      { name: '24/7 priority support', included: true },
    ],
    cta: 'Contact Sales',
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
    answer:
      'Yes, we offer a 14-day free trial of Pro. No credit card required. You\'ll have full access to all Pro features during the trial.',
  },
  {
    question: 'What happens when my trial ends?',
    answer:
      'When your trial ends, you\'ll automatically be moved to the Free plan unless you choose to subscribe. Your saved data and applications will be preserved.',
  },
  {
    question: 'Do you offer refunds?',
    answer:
      'We offer a 30-day money-back guarantee for first-time subscribers. If you\'re not satisfied, contact us within 30 days for a full refund.',
  },
  {
    question: 'Can I get a discount for non-profits?',
    answer:
      'Yes! We offer 50% off for verified non-profit organizations and students. Contact our support team with proof of eligibility.',
  },
];

export default function PricingPage() {
  const router = useRouter();
  useAuthStore();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleSelectPlan = (planId: string) => {
    if (planId === 'enterprise') {
      router.push('/contact-sales');
    } else if (planId === 'pro') {
      router.push('/dashboard/settings/billing?upgrade=pro');
    }
  };

  return (
    <div className="relative min-h-screen bg-aurora">
      <div aria-hidden="true" className="cyber-grid pointer-events-none absolute inset-0 opacity-15" />
      <div className="relative mx-auto max-w-7xl px-4 py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary-200/70 bg-primary-50/80 px-3 py-1 text-xs font-semibold text-primary-700 backdrop-blur dark:border-primary-900/40 dark:bg-primary-900/20 dark:text-primary-300">
            <span className="status-dot status-dot-online h-1.5 w-1.5" />
            Simple, transparent pricing
          </div>
          <h1 className="text-4xl font-bold text-slate-950 dark:text-white mb-4">
            Choose Your <span className="gradient-text-cyber">Path to Success</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            Invest in your career with the tools, connections, and support you need to thrive
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="mb-12 flex items-center justify-center">
          <div className="flex items-center rounded-full border border-slate-200/60 bg-white/70 p-1 backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={cn(
                'rounded-full px-6 py-2 text-sm font-medium transition',
                billingPeriod === 'monthly'
                  ? 'bg-[linear-gradient(135deg,#f43f5e,#a855f7)] text-white shadow'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={cn(
                'flex items-center rounded-full px-6 py-2 text-sm font-medium transition',
                billingPeriod === 'yearly'
                  ? 'bg-[linear-gradient(135deg,#f43f5e,#a855f7)] text-white shadow'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
              )}
            >
              Yearly
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="mb-16 grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'card-lift relative overflow-hidden rounded-2xl',
                plan.popular
                  ? 'glow-primary bg-white/95 dark:bg-slate-900/95'
                  : 'glass-panel'
              )}
            >
              {plan.popular && (
                <div className="flex items-center justify-center gap-1 bg-[linear-gradient(135deg,#f43f5e,#a855f7)] py-2 text-center text-sm font-medium text-white">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  Most Popular
                </div>
              )}

              <div className={cn('p-8', plan.popular && 'pt-14')}>
                {/* Plan Header */}
                <div className="flex items-center space-x-3 mb-4">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      plan.color === 'gray' && 'bg-gray-100 dark:bg-gray-700',
                      plan.color === 'primary' && 'bg-primary-100 dark:bg-primary-900/30',
                      plan.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30'
                    )}
                  >
                    <plan.icon
                      className={cn(
                        'w-6 h-6',
                        plan.color === 'gray' && 'text-gray-500',
                        plan.color === 'primary' && 'text-primary-500',
                        plan.color === 'purple' && 'text-purple-500'
                      )}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {plan.description}
                    </p>
                  </div>
                </div>

                {/* Pricing */}
                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(
                        billingPeriod === 'monthly'
                          ? plan.monthlyPrice
                          : plan.yearlyPrice / 12
                      )}
                    </span>
                    {plan.monthlyPrice > 0 && (
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        /month
                      </span>
                    )}
                  </div>
                  {plan.monthlyPrice > 0 && billingPeriod === 'yearly' && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {formatCurrency(plan.yearlyPrice)} billed annually
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={plan.disabled}
                  className={cn(
                    'flex w-full items-center justify-center rounded-xl py-3 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60',
                    plan.color === 'primary'
                      ? 'bg-[linear-gradient(135deg,#f43f5e,#a855f7)] text-white shadow-blossom'
                      : plan.color === 'purple'
                      ? 'bg-[linear-gradient(135deg,#a855f7,#06b6d4)] text-white shadow-purple'
                      : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                  )}
                >
                  {plan.cta}
                  {!plan.disabled && <ArrowRight className="w-4 h-4 ml-2" />}
                </button>

                {/* Features */}
                <div className="mt-8 space-y-3">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />
                      )}
                      <span
                        className={cn(
                          'text-sm',
                          feature.included
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-500'
                        )}
                      >
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="mb-16 text-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-primary-100/60 bg-white/70 px-8 py-4 backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
            {['30-day money-back guarantee','Cancel anytime','Secure payments via Stripe'].map((label) => (
              <div key={label} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* FAQs */}
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-950 dark:text-white">
            Frequently Asked Questions
          </h2>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-xl border border-primary-100/50 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-slate-900/70"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="flex w-full items-center justify-between p-5 text-left"
                >
                  <span className="font-medium text-slate-900 dark:text-white">
                    {faq.question}
                  </span>
                  <HelpCircle
                    className={cn(
                      'h-5 w-5 flex-shrink-0 text-primary-500 transition-transform',
                      expandedFaq === index && 'rotate-180'
                    )}
                  />
                </button>
                {expandedFaq === index && (
                  <div className="border-t border-primary-100/40 px-5 pb-5 pt-3 text-sm leading-6 text-slate-600 dark:border-white/10 dark:text-slate-300">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <div className="overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#1a0a2e,#0d1b3e)] p-8 md:p-12">
            <div aria-hidden="true" className="cyber-grid pointer-events-none absolute inset-0 opacity-20" />
            <div className="relative">
              <h2 className="mb-4 text-2xl font-bold text-white md:text-3xl">
                Ready to <span className="gradient-text-cyber">accelerate your career</span>?
              </h2>
              <p className="mx-auto mb-6 max-w-2xl text-white/80">
                Join thousands of women who are using ATHENA to land their dream jobs,
                build meaningful connections, and achieve their career goals.
              </p>
              <button
                onClick={() => handleSelectPlan('pro')}
                className="mx-auto flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#f43f5e,#a855f7,#06b6d4)] px-8 py-3 font-semibold text-white shadow-blossom transition hover:-translate-y-0.5"
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </button>
              <p className="mt-4 text-sm text-white/50">
                14-day free trial • No credit card required
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
