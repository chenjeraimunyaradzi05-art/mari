'use client';

import Link from 'next/link';
import { DollarSign, TrendingUp, Users, Building, ArrowRight, CheckCircle, Briefcase, Target, BarChart, Zap } from 'lucide-react';

export default function CapitalPage() {
  const fundingOptions = [
    {
      title: 'Seed Funding',
      amount: '$50K - $500K',
      description: 'For early-stage startups with a validated idea and initial traction.',
      icon: Target,
      requirements: ['MVP or prototype', 'Initial users/revenue', 'Scalable business model'],
    },
    {
      title: 'Series A',
      amount: '$1M - $5M',
      description: 'For startups ready to scale operations and expand market reach.',
      icon: TrendingUp,
      requirements: ['Product-market fit', '$100K+ ARR', 'Growth metrics'],
    },
    {
      title: 'Growth Capital',
      amount: '$5M+',
      description: 'For established companies looking to accelerate growth.',
      icon: BarChart,
      requirements: ['Proven business model', 'Strong unit economics', 'Clear path to profitability'],
    },
  ];

  const portfolio = [
    { name: 'TechFlow', sector: 'SaaS', raised: '$2.5M', status: 'Series A' },
    { name: 'EcoStyle', sector: 'E-commerce', raised: '$1.2M', status: 'Seed' },
    { name: 'HealthAI', sector: 'HealthTech', raised: '$4M', status: 'Series A' },
    { name: 'FinSync', sector: 'FinTech', raised: '$800K', status: 'Seed' },
  ];

  const stats = [
    { value: '$50M+', label: 'Capital Deployed' },
    { value: '75+', label: 'Portfolio Companies' },
    { value: '3.2x', label: 'Avg. Return Multiple' },
    { value: '85%', label: 'Follow-on Rate' },
  ];

  const benefits = [
    { icon: Users, title: 'Network Access', description: 'Connect with our network of 500+ mentors and industry experts' },
    { icon: Building, title: 'Workspace', description: 'Access to co-working spaces and startup resources' },
    { icon: Briefcase, title: 'Talent Pipeline', description: 'Recruit top talent through the ATHENA platform' },
    { icon: Zap, title: 'Growth Support', description: 'Marketing, legal, and operational support' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
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
              We invest in exceptional founders building transformative companies. Beyond capital, we provide the network, resources, and support to help you succeed.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/capital/investors"
                className="px-6 py-3 bg-white text-green-700 font-semibold rounded-lg hover:bg-gray-100 transition"
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

      {/* Stats */}
      <section className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
              <div className="text-3xl font-bold text-green-600">{stat.value}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Funding Options */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Funding Stages
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {fundingOptions.map((option) => (
            <div key={option.title} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-4">
                <option.icon className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{option.title}</h3>
              <p className="text-2xl font-bold text-green-600 mb-3">{option.amount}</p>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{option.description}</p>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Requirements:</h4>
              <ul className="space-y-2">
                {option.requirements.map((req) => (
                  <li key={req} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
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
      <section className="bg-white dark:bg-gray-800 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            More Than Just Capital
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{benefit.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Portfolio Highlights
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {portfolio.map((company) => (
            <div key={company.name} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg mb-4 flex items-center justify-center">
                <Building className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{company.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{company.sector}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-green-600 font-medium">{company.raised}</span>
                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full">
                  {company.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Investment Thesis */}
      <section className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Our Investment Thesis</h2>
            <p className="text-gray-300 mb-8">
              We back founders who are building solutions that democratize access to opportunities, leverage AI and technology for good, and create sustainable impact in the future of work.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {['Future of Work', 'AI & Automation', 'EdTech & SkillsTech'].map((focus) => (
                <div key={focus} className="p-4 border border-gray-700 rounded-lg">
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
            We&apos;re always looking for exceptional founders. Apply for funding or schedule a call with our investment team.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/capital/investors"
              className="px-8 py-3 bg-white text-green-700 font-semibold rounded-lg hover:bg-gray-100 transition"
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
