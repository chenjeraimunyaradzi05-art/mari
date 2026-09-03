'use client';

import Link from 'next/link';
import { DollarSign, TrendingUp, Users, Building, ArrowRight, CheckCircle, Briefcase, Target, BarChart, Zap } from 'lucide-react';

export default function CapitalPage() {
  const fundingOptions = [
    {
      title: 'Seed',
      description: 'For early-stage startups with a validated idea and initial traction.',
      icon: Target,
      requirements: ['MVP or prototype', 'Initial users/revenue', 'Scalable business model'],
    },
    {
      title: 'Series A',
      description: 'For startups ready to scale operations and expand market reach.',
      icon: TrendingUp,
      requirements: ['Product-market fit', 'Recurring revenue', 'Growth metrics'],
    },
    {
      title: 'Growth',
      description: 'For established companies looking to accelerate growth.',
      icon: BarChart,
      requirements: ['Proven business model', 'Strong unit economics', 'Clear path to profitability'],
    },
  ];

  const benefits = [
    { icon: Users, title: 'Network Access', description: 'Introductions to the mentors and operators in the ATHENA network' },
    { icon: Building, title: 'Founder Resources', description: 'Playbooks and the vendor directory on the ATHENA platform' },
    { icon: Briefcase, title: 'Talent Pipeline', description: 'Recruit top talent through the ATHENA platform' },
    { icon: Zap, title: 'Growth Support', description: 'Marketing, legal, and operational support' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-8 h-8" />
              <span className="text-green-200 font-medium">ATHENA Capital</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Funding the Next Generation of Innovators
            </h1>
            <p className="text-xl text-green-100 mb-8">
              We are building ATHENA Capital to back exceptional founders, and to pair that capital with the network, resources, and support behind it.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/contact-sales?intent=funding"
                className="px-6 py-3 bg-white text-green-700 font-semibold rounded-lg hover:bg-slate-100 transition"
              >
                Apply for Funding
              </Link>
              <Link
                href="/contact-sales"
                className="px-6 py-3 bg-green-700 text-white font-semibold rounded-lg hover:bg-green-800 transition"
              >
                Become an LP
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Track record */}
      <section className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">Where we are today</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            ATHENA Capital is new. We have no deployment figures, portfolio returns, or company
            count to report yet, and we would rather say so than publish projections as results.
            Track record will be published here once there is one to publish.
          </p>
        </div>
      </section>

      {/* Funding Options */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">
          Funding Stages
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {fundingOptions.map((option) => (
            <div key={option.title} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-4">
                <option.icon className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{option.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">{option.description}</p>
              <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Requirements:</h4>
              <ul className="space-y-2">
                {option.requirements.map((req) => (
                  <li key={req} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-white dark:bg-slate-800 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">
            More Than Just Capital
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{benefit.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">
          Portfolio
        </h2>
        <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <Building className="mx-auto mb-4 h-14 w-14 text-slate-300 dark:text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No investments to announce yet</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Companies we back will be listed here with their permission. Until then this page
            stays empty rather than showing examples.
          </p>
        </div>
      </section>

      {/* Investment Thesis */}
      <section className="bg-slate-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Our Investment Thesis</h2>
            <p className="text-slate-300 mb-8">
              We back founders who are building solutions that democratize access to opportunities, leverage AI and technology for good, and create sustainable impact in the future of work.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {['Future of Work', 'AI & Automation', 'EdTech & SkillsTech'].map((focus) => (
                <div key={focus} className="p-4 border border-slate-700 rounded-lg">
                  <span className="text-green-400 font-medium">{focus}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Build Something Great?</h2>
          <p className="text-green-100 mb-8 max-w-2xl mx-auto">
            We&apos;re always looking for exceptional founders. Apply for funding or book a call to talk through what you&apos;re building.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/contact-sales?intent=funding"
              className="px-8 py-3 bg-white text-green-700 font-semibold rounded-lg hover:bg-slate-100 transition"
            >
              Apply Now
            </Link>
            <Link
              href="/contact-sales"
              className="px-8 py-3 bg-green-700 text-white font-semibold rounded-lg hover:bg-green-800 transition flex items-center gap-2"
            >
              Schedule a Call <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
