'use client';

import Link from 'next/link';
import { Rocket, Calendar, Users, DollarSign, CheckCircle, ArrowRight, Award, Target, Zap, Globe } from 'lucide-react';

export default function AcceleratorPage() {
  const programDetails = [
    { icon: Calendar, label: '12 Weeks', description: 'Intensive program' },
    { icon: DollarSign, label: '$150K', description: 'Investment' },
    { icon: Users, label: '10 Startups', description: 'Per cohort' },
    { icon: Award, label: '7%', description: 'Equity' },
  ];

  const curriculum = [
    { week: 'Week 1-2', title: 'Foundation', topics: ['Business Model Canvas', 'Market Research', 'Team Building'] },
    { week: 'Week 3-4', title: 'Product', topics: ['MVP Development', 'User Testing', 'Product-Market Fit'] },
    { week: 'Week 5-6', title: 'Growth', topics: ['Go-to-Market Strategy', 'Marketing Channels', 'Sales Process'] },
    { week: 'Week 7-8', title: 'Operations', topics: ['Legal & Compliance', 'Finance & Accounting', 'Team Hiring'] },
    { week: 'Week 9-10', title: 'Fundraising', topics: ['Pitch Deck Creation', 'Investor Relations', 'Term Sheet Negotiation'] },
    { week: 'Week 11-12', title: 'Demo Day', topics: ['Pitch Practice', 'Investor Meetings', 'Demo Day Presentation'] },
  ];

  const mentors = [
    { name: 'Sarah Chen', role: 'Ex-Google, 3x Founder', expertise: 'Product & Growth' },
    { name: 'Marcus Williams', role: 'Partner at Sequoia', expertise: 'Fundraising' },
    { name: 'Priya Patel', role: 'Ex-Stripe', expertise: 'FinTech & Payments' },
    { name: 'David Kim', role: 'Serial Entrepreneur', expertise: 'Sales & BD' },
  ];

  const benefits = [
    '$150K investment for 7% equity',
    'World-class mentorship network',
    'Free office space for 12 weeks',
    '$500K+ in partner credits',
    'Legal and accounting support',
    'Lifetime alumni network access',
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Rocket className="w-8 h-8" />
              <span className="text-orange-200 font-medium">ATHENA Accelerator</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Launch Your Startup to New Heights
            </h1>
            <p className="text-xl text-orange-100 mb-8">
              A 12-week intensive program designed to help early-stage founders build, scale, and fundraise. Join the next cohort of innovative startups.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/accelerator/apply"
                className="px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-gray-100 transition flex items-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Apply Now
              </Link>
              <Link
                href="/contact-sales"
                className="px-6 py-3 bg-orange-700 text-white font-semibold rounded-lg hover:bg-orange-800 transition"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Program Details */}
      <section className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {programDetails.map((detail) => (
            <div key={detail.label} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
              <detail.icon className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{detail.label}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{detail.description}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Curriculum */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Program Curriculum
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {curriculum.map((phase) => (
            <div key={phase.week} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <span className="text-sm text-orange-600 font-medium">{phase.week}</span>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-1 mb-3">{phase.title}</h3>
              <ul className="space-y-2">
                {phase.topics.map((topic) => (
                  <li key={topic} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircle className="w-4 h-4 text-orange-500" />
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-white dark:bg-gray-800 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            What You Get
          </h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <span className="text-gray-900 dark:text-white">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mentors */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Learn From the Best
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {mentors.map((mentor) => (
            <div key={mentor.name} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Users className="w-10 h-10 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{mentor.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{mentor.role}</p>
              <span className="inline-block mt-2 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-full">
                {mentor.expertise}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">Application Timeline</h2>
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between gap-8">
              {[
                { date: 'Feb 1', event: 'Applications Open' },
                { date: 'Mar 15', event: 'Applications Close' },
                { date: 'Apr 1', event: 'Interviews Begin' },
                { date: 'Apr 15', event: 'Cohort Announced' },
                { date: 'May 1', event: 'Program Starts' },
              ].map((milestone, i) => (
                <div key={milestone.event} className="text-center">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    {i + 1}
                  </div>
                  <div className="text-orange-400 font-medium">{milestone.date}</div>
                  <div className="text-sm text-gray-400">{milestone.event}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Accelerate?</h2>
          <p className="text-orange-100 mb-8 max-w-2xl mx-auto">
            Join our next cohort and turn your startup idea into a fundable business. Applications are now open.
          </p>
          <Link
            href="/accelerator/apply"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Apply Now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
