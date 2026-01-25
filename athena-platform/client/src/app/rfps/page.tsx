'use client';

import Link from 'next/link';
import { FileText, Search, Clock, DollarSign, Building, ArrowRight, Filter, CheckCircle, Calendar } from 'lucide-react';
import { useState } from 'react';

export default function RFPsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All RFPs' },
    { id: 'technology', name: 'Technology' },
    { id: 'marketing', name: 'Marketing' },
    { id: 'consulting', name: 'Consulting' },
    { id: 'design', name: 'Design' },
    { id: 'development', name: 'Development' },
  ];

  const rfps = [
    {
      id: '1',
      title: 'Enterprise CRM Implementation',
      company: 'TechCorp Inc.',
      category: 'technology',
      budget: '$150K - $250K',
      deadline: 'Feb 15, 2026',
      posted: '3 days ago',
      description: 'Looking for an experienced vendor to implement Salesforce CRM across our organization.',
      requirements: ['5+ years experience', 'Salesforce certified', 'Enterprise track record'],
      proposals: 8,
    },
    {
      id: '2',
      title: 'Brand Refresh & Marketing Campaign',
      company: 'StartupXYZ',
      category: 'marketing',
      budget: '$50K - $100K',
      deadline: 'Feb 28, 2026',
      posted: '1 week ago',
      description: 'Complete brand refresh including logo, website, and launch marketing campaign.',
      requirements: ['Portfolio required', 'B2B experience', 'Strategy included'],
      proposals: 12,
    },
    {
      id: '3',
      title: 'Business Strategy Consulting',
      company: 'Growth Ventures',
      category: 'consulting',
      budget: '$75K - $125K',
      deadline: 'Mar 1, 2026',
      posted: '5 days ago',
      description: 'Strategic consulting engagement for market expansion into APAC region.',
      requirements: ['APAC experience', 'Strategy firm preferred', 'On-site availability'],
      proposals: 5,
    },
    {
      id: '4',
      title: 'Mobile App UI/UX Redesign',
      company: 'FinApp Inc.',
      category: 'design',
      budget: '$30K - $60K',
      deadline: 'Feb 20, 2026',
      posted: '2 days ago',
      description: 'Redesign of iOS and Android app interfaces for improved user experience.',
      requirements: ['FinTech experience', 'Case studies', 'User research'],
      proposals: 15,
    },
    {
      id: '5',
      title: 'E-commerce Platform Development',
      company: 'RetailPlus',
      category: 'development',
      budget: '$200K - $350K',
      deadline: 'Mar 15, 2026',
      posted: '1 day ago',
      description: 'Build custom e-commerce platform with inventory management and POS integration.',
      requirements: ['E-commerce expertise', 'POS integration', 'Scalable architecture'],
      proposals: 6,
    },
  ];

  const filteredRFPs = rfps.filter((rfp) => {
    const matchesCategory = selectedCategory === 'all' || rfp.category === selectedCategory;
    const matchesSearch = rfp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         rfp.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         rfp.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <section className="bg-gradient-to-br from-teal-600 to-cyan-700 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-8 h-8" />
              <span className="text-teal-200 font-medium">ATHENA RFP Marketplace</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">Request for Proposals</h1>
            <p className="text-xl text-teal-100">
              Browse active RFPs from companies looking for your services. Submit proposals and win new business.
            </p>
          </div>
        </div>
      </section>

      {/* Search and Filter */}
      <section className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search RFPs..."
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
                    ? 'bg-teal-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* RFPs List */}
        <div className="space-y-4">
          {filteredRFPs.map((rfp) => (
            <div
              key={rfp.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{rfp.title}</h3>
                    <span className="text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-2 py-1 rounded-full">
                      {rfp.proposals} proposals
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <span className="flex items-center gap-1">
                      <Building className="w-4 h-4" />
                      {rfp.company}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Posted {rfp.posted}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{rfp.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {rfp.requirements.map((req) => (
                      <span
                        key={req}
                        className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded"
                      >
                        <CheckCircle className="w-3 h-3 text-teal-500" />
                        {req}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 min-w-[180px]">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-lg font-bold text-gray-900 dark:text-white">
                      <DollarSign className="w-5 h-5 text-teal-600" />
                      {rfp.budget}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-red-600">
                      <Calendar className="w-4 h-4" />
                      Due: {rfp.deadline}
                    </div>
                  </div>
                  <Link
                    href={`/rfps/${rfp.id}`}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium"
                  >
                    View & Submit
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredRFPs.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No RFPs found</h3>
            <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Post an RFP</h2>
          <p className="text-teal-100 mb-8 max-w-2xl mx-auto">
            Looking for service providers? Post your RFP and receive proposals from vetted vendors.
          </p>
          <Link
            href="/dashboard/rfps"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-teal-700 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Create RFP <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
