'use client';

import Link from 'next/link';
import { Users, Briefcase, Award, ArrowRight, CheckCircle, Globe, Heart, Zap } from 'lucide-react';

export default function TeamPage() {
  const leadership = [
    {
      name: 'Alexandra Chen',
      role: 'CEO & Co-Founder',
      bio: 'Former VP of Product at LinkedIn. Stanford MBA. Passionate about democratizing career opportunities.',
      image: null,
    },
    {
      name: 'Marcus Williams',
      role: 'CTO & Co-Founder',
      bio: 'Ex-Google engineer. Built ML systems serving billions. MIT Computer Science.',
      image: null,
    },
    {
      name: 'Priya Patel',
      role: 'Chief Product Officer',
      bio: 'Product leader from Airbnb and Stripe. Harvard Business School.',
      image: null,
    },
    {
      name: 'David Kim',
      role: 'Chief Revenue Officer',
      bio: 'Scaled revenue 10x at Salesforce. Expert in enterprise sales.',
      image: null,
    },
  ];

  const values = [
    { icon: Heart, title: 'People First', description: 'We believe in the potential of every individual to achieve their career dreams.' },
    { icon: Zap, title: 'Innovation', description: 'We push boundaries with AI and technology to create better career outcomes.' },
    { icon: Globe, title: 'Inclusion', description: 'We build for everyone, ensuring equal access to opportunities worldwide.' },
    { icon: Award, title: 'Excellence', description: 'We hold ourselves to the highest standards in everything we do.' },
  ];

  const stats = [
    { value: '150+', label: 'Team Members' },
    { value: '30+', label: 'Countries' },
    { value: '60%', label: 'Women in Leadership' },
    { value: '4.8★', label: 'Glassdoor Rating' },
  ];

  const benefits = [
    'Competitive salary & equity',
    'Unlimited PTO',
    'Remote-first culture',
    'Health, dental & vision',
    'Learning stipend ($2,000/yr)',
    'Home office budget',
    'Parental leave (16 weeks)',
    'Mental health support',
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Meet the Team Behind ATHENA</h1>
            <p className="text-xl text-primary-100 mb-8">
              We&apos;re a diverse team of engineers, designers, and career experts on a mission to help everyone find their dream career.
            </p>
            <Link
              href="/careers"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary-700 font-semibold rounded-lg hover:bg-gray-100 transition"
            >
              <Briefcase className="w-5 h-5" />
              Join Our Team
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
              <div className="text-3xl font-bold text-primary-600">{stat.value}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Leadership */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Leadership Team</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {leadership.map((person) => (
            <div key={person.name} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Users className="w-12 h-12 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{person.name}</h3>
              <p className="text-sm text-primary-600 mb-2">{person.role}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{person.bio}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="bg-white dark:bg-gray-800 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Our Values</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {values.map((value) => (
              <div key={value.title} className="text-center">
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{value.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Why Work at ATHENA?</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span className="text-gray-900 dark:text-white">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Join Us?</h2>
          <p className="text-primary-100 mb-8 max-w-2xl mx-auto">
            We&apos;re always looking for talented people who share our mission. Check out our open positions.
          </p>
          <Link
            href="/careers"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-primary-700 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            View Open Positions <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
