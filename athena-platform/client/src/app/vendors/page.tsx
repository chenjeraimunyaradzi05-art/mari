'use client';

import Link from 'next/link';
import { Store, Search, Star, MapPin, CheckCircle, ArrowRight, Filter, Building } from 'lucide-react';
import { useState } from 'react';

export default function VendorsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All Vendors' },
    { id: 'technology', name: 'Technology' },
    { id: 'marketing', name: 'Marketing' },
    { id: 'hr', name: 'HR & Recruiting' },
    { id: 'finance', name: 'Finance' },
    { id: 'legal', name: 'Legal' },
    { id: 'consulting', name: 'Consulting' },
  ];

  const vendors = [
    {
      id: '1',
      name: 'CloudTech Solutions',
      category: 'technology',
      rating: 4.9,
      reviews: 127,
      location: 'San Francisco, CA',
      description: 'Enterprise cloud infrastructure and DevOps services.',
      verified: true,
      services: ['Cloud Migration', 'DevOps', 'Security'],
    },
    {
      id: '2',
      name: 'GrowthHub Marketing',
      category: 'marketing',
      rating: 4.8,
      reviews: 89,
      location: 'New York, NY',
      description: 'Full-service digital marketing and growth agency.',
      verified: true,
      services: ['SEO', 'PPC', 'Content Marketing'],
    },
    {
      id: '3',
      name: 'TalentFirst HR',
      category: 'hr',
      rating: 4.7,
      reviews: 56,
      location: 'Austin, TX',
      description: 'HR consulting and recruiting solutions for startups.',
      verified: true,
      services: ['Recruiting', 'HR Setup', 'Compliance'],
    },
    {
      id: '4',
      name: 'FinanceFlow',
      category: 'finance',
      rating: 4.9,
      reviews: 73,
      location: 'Chicago, IL',
      description: 'Accounting, bookkeeping, and financial planning.',
      verified: true,
      services: ['Bookkeeping', 'Tax Planning', 'CFO Services'],
    },
    {
      id: '5',
      name: 'LegalEdge',
      category: 'legal',
      rating: 4.8,
      reviews: 42,
      location: 'Boston, MA',
      description: 'Startup legal services and business formation.',
      verified: true,
      services: ['Incorporation', 'Contracts', 'IP Protection'],
    },
    {
      id: '6',
      name: 'StrategyPro Consulting',
      category: 'consulting',
      rating: 4.6,
      reviews: 31,
      location: 'Seattle, WA',
      description: 'Business strategy and operational consulting.',
      verified: false,
      services: ['Strategy', 'Operations', 'M&A Advisory'],
    },
  ];

  const filteredVendors = vendors.filter((vendor) => {
    const matchesCategory = selectedCategory === 'all' || vendor.category === selectedCategory;
    const matchesSearch = vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         vendor.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Store className="w-8 h-8" />
              <span className="text-blue-200 font-medium">ATHENA Marketplace</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">Vendor Directory</h1>
            <p className="text-xl text-blue-100">
              Find trusted service providers vetted by the ATHENA community. From technology to legal, discover vendors that can help your business grow.
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
              placeholder="Search vendors..."
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Vendors Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVendors.map((vendor) => (
            <div
              key={vendor.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center">
                  <Building className="w-7 h-7 text-white" />
                </div>
                {vendor.verified && (
                  <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full">
                    <CheckCircle className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{vendor.name}</h3>
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  {vendor.rating} ({vendor.reviews})
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {vendor.location}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{vendor.description}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {vendor.services.map((service) => (
                  <span
                    key={service}
                    className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded"
                  >
                    {service}
                  </span>
                ))}
              </div>
              <Link
                href={`/vendors/${vendor.id}`}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                View Profile <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>

        {filteredVendors.length === 0 && (
          <div className="text-center py-12">
            <Store className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No vendors found</h3>
            <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Become a Vendor</h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            Join our marketplace and connect with thousands of businesses looking for your services.
          </p>
          <Link
            href="/contact-sales"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-blue-700 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Apply to Join <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
