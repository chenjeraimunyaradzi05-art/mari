'use client';

import Link from 'next/link';
import { Globe, Users, Building, Briefcase, GraduationCap, Users2, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';

export default function EcosystemPage() {
  const partners = [
    { name: 'Tech Partners', count: '200+', description: 'Leading technology companies', icon: Building },
    { name: 'Universities', count: '50+', description: 'Top educational institutions', icon: GraduationCap },
    { name: 'Investors', count: '100+', description: 'VCs and angel investors', icon: Briefcase },
    { name: 'Mentors', count: '500+', description: 'Industry experts', icon: Users },
  ];

  const benefits = [
    'Access to exclusive job opportunities',
    'Direct connections to hiring managers',
    'Collaborative learning programs',
    'Investment and funding opportunities',
    'Co-marketing and brand exposure',
    'Early access to new features',
  ];

  const partnerTypes = [
    {
      title: 'Employers',
      description: 'Access top talent and reduce hiring costs with AI-powered matching.',
      benefits: ['AI Candidate Matching', 'Employer Branding', 'ATS Integration', 'Analytics Dashboard'],
      cta: 'Partner as Employer',
      link: '/employer',
    },
    {
      title: 'Educational Institutions',
      description: 'Help your students launch successful careers with our platform.',
      benefits: ['Career Services Integration', 'Student Outcomes Tracking', 'Curriculum Insights', 'Alumni Network'],
      cta: 'Partner as Institution',
      link: '/contact-sales',
    },
    {
      title: 'Service Providers',
      description: 'Expand your reach by integrating with the ATHENA ecosystem.',
      benefits: ['API Integration', 'Referral Programs', 'Co-branded Solutions', 'Revenue Sharing'],
      cta: 'Become a Partner',
      link: '/contact-sales',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full mb-6">
              <Globe className="w-5 h-5" />
              <span className="text-sm font-medium">ATHENA Ecosystem</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              The Career Development Ecosystem
            </h1>
            <p className="text-xl text-purple-100 mb-8">
              Join a thriving network of employers, educators, mentors, and service providers committed to transforming career development.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/contact-sales"
                className="px-6 py-3 bg-white text-purple-700 font-semibold rounded-lg hover:bg-gray-100 transition"
              >
                Become a Partner
              </Link>
              <Link
                href="/developers"
                className="px-6 py-3 bg-purple-800 text-white font-semibold rounded-lg hover:bg-purple-900 transition"
              >
                Explore APIs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Partner Stats */}
      <section className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {partners.map((partner) => (
            <div key={partner.name} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
              <partner.icon className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{partner.count}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{partner.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Partner Types */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Partner With Us
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {partnerTypes.map((type) => (
            <div key={type.title} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{type.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{type.description}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {type.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <CheckCircle className="w-4 h-4 text-purple-500" />
                    {benefit}
                  </li>
                ))}
              </ul>
              <Link
                href={type.link}
                className="w-full py-2 bg-purple-600 text-white text-center rounded-lg hover:bg-purple-700 transition font-medium"
              >
                {type.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-white dark:bg-gray-800 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
              Ecosystem Benefits
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <Sparkles className="w-5 h-5 text-purple-500 flex-shrink-0" />
                  <span className="text-gray-900 dark:text-white">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Integration */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Seamless Integration
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Connect your systems with our robust APIs and pre-built integrations.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Workday', 'Greenhouse', 'Lever', 'SAP', 'Oracle', 'Salesforce', 'Slack', 'Teams'].map((tool) => (
              <div key={tool} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <span className="font-medium text-gray-900 dark:text-white">{tool}</span>
              </div>
            ))}
          </div>
          <Link
            href="/developers"
            className="inline-flex items-center gap-2 mt-8 text-purple-600 hover:text-purple-700 font-medium"
          >
            Explore Developer Docs <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-8 md:p-12 text-white text-center">
          <Users2 className="w-16 h-16 mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl font-bold mb-4">Join the Ecosystem</h2>
          <p className="text-purple-100 mb-8 max-w-2xl mx-auto">
            Partner with ATHENA to shape the future of career development and unlock new growth opportunities.
          </p>
          <Link
            href="/contact-sales"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-purple-700 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Get in Touch <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
