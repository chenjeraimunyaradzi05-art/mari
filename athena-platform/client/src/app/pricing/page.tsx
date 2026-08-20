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
  const { user } = useAuthStore();
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Path to Success
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Invest in your career with the tools, connections, and support you need to thrive
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center mb-12">
          <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-full flex items-center">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={cn(
                'px-6 py-2 rounded-full text-sm font-medium transition',
                billingPeriod === 'monthly'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 dark:text-gray-400'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={cn(
                'px-6 py-2 rounded-full text-sm font-medium transition flex items-center',
                billingPeriod === 'yearly'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 dark:text-gray-400'
              )}
            >
              Yearly
              <span className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden transition-transform hover:scale-105',
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
                    'w-full py-3 rounded-lg font-semibold transition flex items-center justify-center',
                    plan.color === 'primary'
                      ? 'bg-primary-500 text-white hover:bg-primary-600'
                      : plan.color === 'purple'
                      ? 'bg-purple-500 text-white hover:bg-purple-600'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
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
        <div className="text-center mb-16">
          <div className="flex flex-wrap items-center justify-center gap-8 text-gray-400 dark:text-gray-500">
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-500" />
              <span>30-day money-back guarantee</span>
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="font-medium text-gray-900 dark:text-white">
                    {faq.question}
                  </span>
                  <HelpCircle
                    className={cn(
                      'w-5 h-5 text-gray-400 transition-transform',
                      expandedFaq === index && 'rotate-180'
                    )}
                  />
                </button>
                {expandedFaq === index && (
                  <div className="px-4 pb-4 text-gray-600 dark:text-gray-300 text-sm">
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
              Join thousands of women who are using ATHENA to land their dream jobs,
              build meaningful connections, and achieve their career goals.
            </p>
            <button
              onClick={() => handleSelectPlan('pro')}
              className="bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition flex items-center mx-auto"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
            <p className="text-white/70 text-sm mt-4">
              14-day free trial • No credit card required
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
