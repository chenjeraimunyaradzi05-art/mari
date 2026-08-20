'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Building,
  CheckCircle,
  Loader2,
  MapPin,
  Search,
  Star,
  Store,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { businessApi } from '@/lib/api';

const categories = [
  { id: '', name: 'All vendors' },
  { id: 'ACCOUNTING_TAX', name: 'Accounting & Tax' },
  { id: 'LEGAL', name: 'Legal' },
  { id: 'DESIGN_MARKETING', name: 'Design & Marketing' },
  { id: 'TECH_DEVELOPMENT', name: 'Tech & Development' },
  { id: 'HR_COMPLIANCE', name: 'HR & Compliance' },
  { id: 'BUSINESS_COACHING', name: 'Business Coaching' },
  { id: 'PHOTOGRAPHY_VIDEO', name: 'Photography & Video' },
  { id: 'COPYWRITING', name: 'Copywriting' },
  { id: 'VIRTUAL_ASSISTANT', name: 'Virtual Assistant' },
  { id: 'OTHER', name: 'Other' },
];

type Vendor = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  services?: string[];
  priceRange?: string | null;
  discountPct?: number | null;
  website?: string | null;
  location?: string | null;
  isVerified?: boolean;
  isPartner?: boolean;
  avgRating?: string | number | null;
  reviewCount?: number | null;
};

function formatCategory(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRating(vendor: Vendor) {
  const count = vendor.reviewCount ?? 0;
  if (count === 0) return 'No reviews yet';

  const rating = Number(vendor.avgRating ?? 0);
  return `${Number.isFinite(rating) ? rating.toFixed(1) : '0.0'} (${count})`;
}

export default function VendorsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadVendors = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await businessApi.getVendors({
          category: selectedCategory || undefined,
        });

        if (!cancelled) {
          setVendors(response.data?.data || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setVendors([]);
          setError(err?.response?.data?.error || 'Unable to load vendors right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadVendors();

    return () => {
      cancelled = true;
    };
  }, [selectedCategory]);

  const filteredVendors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return vendors.filter((vendor) => {
      if (!query) return true;

      return [
        vendor.name,
        vendor.description,
        vendor.location,
        vendor.priceRange,
        formatCategory(vendor.category),
        ...(vendor.services || []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [searchQuery, vendors]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Store className="w-8 h-8" />
              <span className="text-blue-200 font-medium">ATHENA Marketplace</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">Vendor Directory</h1>
            <p className="text-xl text-blue-100">
              Browse service providers connected to the ATHENA business marketplace.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.id || 'all'}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-50'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading vendors...
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <Store className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No vendors available</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {searchQuery || selectedCategory
                ? 'Try adjusting your search or category.'
                : 'The marketplace has no published vendors yet.'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVendors.map((vendor) => (
              <div
                key={vendor.id}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center">
                    <Building className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {vendor.isPartner && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                        Partner
                      </span>
                    )}
                    {vendor.isVerified && (
                      <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{vendor.name}</h3>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400 mb-2">
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    {formatRating(vendor)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {vendor.location || 'Remote'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-3">
                  {vendor.description || 'No public description has been provided yet.'}
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                    {formatCategory(vendor.category)}
                  </span>
                  {(vendor.services?.length ? vendor.services : ['Services available by request']).slice(0, 3).map((service) => (
                    <span
                      key={service}
                      className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded"
                    >
                      {service}
                    </span>
                  ))}
                </div>
                <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                  Pricing: {vendor.priceRange || 'Request quote'}
                </div>
                <Link
                  href="/dashboard/vendors"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  View in dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Become a Vendor</h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            Join the marketplace and connect with businesses looking for your services.
          </p>
          <Link
            href="/contact-sales"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-blue-700 font-semibold rounded-lg hover:bg-slate-100 transition"
          >
            Apply to Join <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
