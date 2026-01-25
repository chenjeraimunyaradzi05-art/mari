'use client';

import Link from 'next/link';
import { Building, Briefcase, FileText, CheckCircle, ArrowRight, Shield, Clock, Globe, Zap } from 'lucide-react';

export default function BusinessPage() {
  const services = [
    {
      title: 'Company Formation',
      description: 'Register your business in multiple jurisdictions with our streamlined process.',
      icon: Building,
      features: ['LLC & Corp Formation', 'EIN Registration', 'Registered Agent', 'Operating Agreements'],
      price: 'From $299',
    },
    {
      title: 'Compliance & Legal',
      description: 'Stay compliant with automated reminders and document management.',
      icon: Shield,
      features: ['Annual Reports', 'BOI Filing', 'Corporate Amendments', 'Document Storage'],
      price: 'From $99/yr',
    },
    {
      title: 'Business Banking',
      description: 'Open business bank accounts and manage finances in one place.',
      icon: Briefcase,
      features: ['Business Checking', 'Multi-currency', 'Payment Processing', 'Expense Tracking'],
      price: 'Free',
    },
  ];

  const jurisdictions = [
    { name: 'Delaware', time: '24 hours', popular: true },
    { name: 'Wyoming', time: '48 hours', popular: true },
    { name: 'Nevada', time: '48 hours', popular: false },
    { name: 'Florida', time: '3-5 days', popular: false },
    { name: 'Texas', time: '3-5 days', popular: false },
    { name: 'California', time: '5-7 days', popular: false },
  ];

  const steps = [
    { title: 'Choose Entity Type', description: 'LLC, Corporation, or other business structure' },
    { title: 'Select State', description: 'Pick your formation jurisdiction' },
    { title: 'Submit Information', description: 'Provide business details online' },
    { title: 'We Handle Filing', description: 'Our team processes everything' },
    { title: 'Receive Documents', description: 'Get your formation docs digitally' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Building className="w-8 h-8" />
              <span className="text-blue-200 font-medium">ATHENA Business Services</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Start & Grow Your Business
            </h1>
            <p className="text-xl text-blue-100 mb-8">
              From company formation to compliance, we provide everything you need to build and scale your business.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/dashboard/formation"
                className="px-6 py-3 bg-white text-blue-700 font-semibold rounded-lg hover:bg-gray-100 transition flex items-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Start Your Business
              </Link>
              <Link
                href="/contact-sales"
                className="px-6 py-3 bg-blue-800 text-white font-semibold rounded-lg hover:bg-blue-900 transition"
              >
                Talk to an Expert
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: '50K+', label: 'Businesses Formed' },
            { value: '50', label: 'States Covered' },
            { value: '24hr', label: 'Fast Formation' },
            { value: '4.9★', label: 'Customer Rating' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg text-center">
              <div className="text-3xl font-bold text-blue-600">{stat.value}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
          Business Services
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {services.map((service) => (
            <div key={service.title} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4">
                <service.icon className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{service.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{service.description}</p>
              <ul className="space-y-2 mb-6">
                {service.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <span className="text-lg font-bold text-gray-900 dark:text-white">{service.price}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Formation States */}
      <section className="bg-white dark:bg-gray-800 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Formation Jurisdictions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-4xl mx-auto">
            {jurisdictions.map((state) => (
              <div
                key={state.name}
                className={`p-4 rounded-xl text-center border ${
                  state.popular
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'
                }`}
              >
                {state.popular && (
                  <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full mb-2 inline-block">
                    Popular
                  </span>
                )}
                <h3 className="font-semibold text-gray-900 dark:text-white">{state.name}</h3>
                <div className="flex items-center justify-center gap-1 text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <Clock className="w-3 h-3" />
                  {state.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-12 text-center">
          How It Works
        </h2>
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-blue-200 dark:bg-blue-800 hidden md:block"></div>
            <div className="space-y-8">
              {steps.map((step, i) => (
                <div key={step.title} className="flex gap-6 items-start">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xl font-bold relative z-10">
                    {i + 1}
                  </div>
                  <div className="pt-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{step.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Your Business?</h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            Form your company in minutes. Our team handles all the paperwork so you can focus on building.
          </p>
          <Link
            href="/dashboard/formation"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-blue-700 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
