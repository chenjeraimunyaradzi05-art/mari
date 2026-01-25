'use client';

import Link from 'next/link';
import { Gift, Calendar, DollarSign, Users, CheckCircle, ArrowRight, Search, Filter, Clock, Award } from 'lucide-react';
import { useState } from 'react';

export default function GrantsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All Grants' },
    { id: 'tech', name: 'Technology' },
    { id: 'social', name: 'Social Impact' },
    { id: 'climate', name: 'Climate & Sustainability' },
    { id: 'education', name: 'Education' },
    { id: 'healthcare', name: 'Healthcare' },
  ];

  const grants = [
    {
      id: 1,
      title: 'ATHENA Innovation Grant',
      amount: '$50,000',
      deadline: 'March 31, 2026',
      category: 'tech',
      description: 'For early-stage tech startups building solutions for the future of work.',
      eligibility: ['US-based company', 'Less than 2 years old', 'Under $500K raised'],
      featured: true,
    },
    {
      id: 2,
      title: 'Social Impact Fund',
      amount: '$25,000',
      deadline: 'April 15, 2026',
      category: 'social',
      description: 'Supporting ventures that create positive social change in underserved communities.',
      eligibility: ['Non-profit or B-Corp', 'Measurable social impact', 'Operating for 1+ years'],
      featured: true,
    },
    {
      id: 3,
      title: 'Climate Action Grant',
      amount: '$75,000',
      deadline: 'May 1, 2026',
      category: 'climate',
      description: 'Funding innovative solutions to address climate change and sustainability.',
      eligibility: ['Climate-focused mission', 'Scalable solution', 'Technical feasibility'],
      featured: false,
    },
    {
      id: 4,
      title: 'EdTech Innovation Award',
      amount: '$30,000',
      deadline: 'April 30, 2026',
      category: 'education',
      description: 'For startups improving access to quality education through technology.',
      eligibility: ['Education-focused product', 'Demonstrated impact', 'Sustainable model'],
      featured: false,
    },
    {
      id: 5,
      title: 'Healthcare Access Grant',
      amount: '$40,000',
      deadline: 'June 15, 2026',
      category: 'healthcare',
      description: 'Supporting innovations that improve healthcare access and outcomes.',
      eligibility: ['Healthcare solution', 'HIPAA compliant', 'Patient-centered approach'],
      featured: false,
    },
  ];

  const filteredGrants = grants.filter((grant) => {
    const matchesCategory = selectedCategory === 'all' || grant.category === selectedCategory;
    const matchesSearch = grant.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         grant.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const stats = [
    { value: '$5M+', label: 'Grants Awarded' },
    { value: '200+', label: 'Recipients' },
    { value: '50+', label: 'Active Grants' },
    { value: '85%', label: 'Success Rate' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-8 h-8" />
              <span className="text-purple-200 font-medium">ATHENA Grants</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Non-Dilutive Funding for Innovators
            </h1>
            <p className="text-xl text-purple-100 mb-8">
              Access grants and awards to fuel your venture without giving up equity. We support founders across technology, social impact, climate, and more.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="#grants"
                className="px-6 py-3 bg-white text-purple-700 font-semibold rounded-lg hover:bg-gray-100 transition"
              >
                Browse Grants
              </Link>
              <Link
                href="/contact-sales"
                className="px-6 py-3 bg-purple-700 text-white font-semibold rounded-lg hover:bg-purple-800 transition"
              >
                Partner With Us
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
              <div className="text-3xl font-bold text-purple-600">{stat.value}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Search and Filter */}
      <section id="grants" className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search grants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Grants Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {filteredGrants.map((grant) => (
            <div
              key={grant.id}
              className={`bg-white dark:bg-gray-800 rounded-2xl p-6 border ${
                grant.featured
                  ? 'border-purple-500 ring-2 ring-purple-500/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {grant.featured && (
                <span className="inline-flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-1 rounded-full mb-3">
                  <Award className="w-3 h-3" />
                  Featured
                </span>
              )}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{grant.title}</h3>
                <span className="text-2xl font-bold text-purple-600">{grant.amount}</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{grant.description}</p>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                <Clock className="w-4 h-4" />
                <span>Deadline: {grant.deadline}</span>
              </div>
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Eligibility:</h4>
                <ul className="space-y-1">
                  {grant.eligibility.map((req) => (
                    <li key={req} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircle className="w-4 h-4 text-purple-500" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href={`/grants/${grant.id}`}
                className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
              >
                Apply Now <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>

        {filteredGrants.length === 0 && (
          <div className="text-center py-12">
            <Gift className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No grants found</h3>
            <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </section>

      {/* How It Works */}
      <section className="bg-white dark:bg-gray-800 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            How to Apply
          </h2>
          <div className="max-w-4xl mx-auto grid md:grid-cols-4 gap-8">
            {[
              { step: 1, title: 'Find a Grant', description: 'Browse grants that match your venture' },
              { step: 2, title: 'Check Eligibility', description: 'Review requirements carefully' },
              { step: 3, title: 'Submit Application', description: 'Complete the online form' },
              { step: 4, title: 'Receive Funding', description: 'If selected, funds are disbursed within 30 days' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Fund a Grant</h2>
          <p className="text-purple-100 mb-8 max-w-2xl mx-auto">
            Want to support the next generation of innovators? Partner with ATHENA to create a grant program in your name.
          </p>
          <Link
            href="/contact-sales"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-purple-700 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Become a Grant Partner <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
