'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Loader2, Star } from 'lucide-react';
import { businessApi } from '@/lib/api';

const categories = [
  { value: '', label: 'All categories' },
  { value: 'ACCOUNTING_TAX', label: 'Accounting & Tax' },
  { value: 'LEGAL', label: 'Legal' },
  { value: 'DESIGN_MARKETING', label: 'Design & Marketing' },
  { value: 'TECH_DEVELOPMENT', label: 'Tech & Development' },
  { value: 'HR_COMPLIANCE', label: 'HR & Compliance' },
  { value: 'BUSINESS_COACHING', label: 'Business Coaching' },
  { value: 'PHOTOGRAPHY_VIDEO', label: 'Photography & Video' },
  { value: 'COPYWRITING', label: 'Copywriting' },
  { value: 'VIRTUAL_ASSISTANT', label: 'Virtual Assistant' },
  { value: 'OTHER', label: 'Other' },
];

type Vendor = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  services: string[];
  priceRange?: string | null;
  discountPct?: number | null;
  website?: string | null;
  location?: string | null;
  isVerified?: boolean;
  isPartner?: boolean;
  avgRating?: string | number | null;
  reviewCount?: number | null;
};

export default function VendorsPage() {
  const [category, setCategory] = useState('');
  const [partnerOnly, setPartnerOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [minRating, setMinRating] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [reviewVendorId, setReviewVendorId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await businessApi.getVendors({
        category: category || undefined,
        partner: partnerOnly || undefined,
        verified: verifiedOnly || undefined,
        minRating: minRating ? Number(minRating) : undefined,
      });
      setVendors(response.data?.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load vendors.');
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [category, partnerOnly, verifiedOnly, minRating]);

  const handleSubmitReview = async (vendorId: string) => {
    setSavingId(vendorId);
    setError(null);
    try {
      await businessApi.reviewVendor(vendorId, {
        rating,
        title: reviewTitle || undefined,
        content: reviewContent || undefined,
      });
      setReviewVendorId(null);
      setReviewTitle('');
      setReviewContent('');
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to submit review.');
    } finally {
      setSavingId(null);
    }
  };

  const headerLabel = useMemo(() => {
    if (category) return `${category.replace('_', ' ').toLowerCase()} vendors`;
    return 'Preferred vendors';
  }, [category]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600">
            <Briefcase className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Vendors</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {headerLabel} for every business need
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Book verified partners, compare pricing, and leave reviews.
          </p>
        </div>
        <Link href="/dashboard/rfps" className="btn-primary inline-flex items-center gap-2">
          Create an RFP
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 grid gap-4 md:grid-cols-5">
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Category</label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-2 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          >
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Min rating</label>
          <select
            value={minRating}
            onChange={(event) => setMinRating(event.target.value)}
            className="mt-2 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Any</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
            <option value="5">5</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mt-6">
          <input
            type="checkbox"
            checked={partnerOnly}
            onChange={(event) => setPartnerOnly(event.target.checked)}
            className="rounded border-gray-300"
          />
          Partner only
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mt-6">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(event) => setVerifiedOnly(event.target.checked)}
            className="rounded border-gray-300"
          />
          Verified only
        </label>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading vendors...
        </div>
      ) : vendors.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-sm text-gray-500">
          No vendors found. Adjust your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vendors.map((vendor) => (
            <div key={vendor.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{vendor.name}</h3>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">
                    {vendor.category.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {vendor.description || 'Specialist services tailored for founders.'}
                </p>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div>Services: {vendor.services?.length ? vendor.services.join(', ') : 'Custom packages'}</div>
                <div>Pricing: {vendor.priceRange || 'Request quote'}</div>
                <div>Location: {vendor.location || 'Remote'}</div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Star className="w-4 h-4 text-yellow-500" />
                {(vendor.avgRating ?? 0).toString()} ({vendor.reviewCount ?? 0} reviews)
              </div>

              {reviewVendorId === vendor.id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600 dark:text-gray-300">Rating</label>
                    <select
                      value={rating}
                      onChange={(event) => setRating(Number(event.target.value))}
                      className="bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                    >
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    value={reviewTitle}
                    onChange={(event) => setReviewTitle(event.target.value)}
                    placeholder="Review title"
                    className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                  />
                  <textarea
                    value={reviewContent}
                    onChange={(event) => setReviewContent(event.target.value)}
                    placeholder="Share details about your project"
                    className="w-full min-h-[90px] bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSubmitReview(vendor.id)}
                      disabled={savingId === vendor.id}
                      className="btn-primary flex-1"
                    >
                      {savingId === vendor.id ? 'Submitting...' : 'Submit review'}
                    </button>
                    <button
                      onClick={() => setReviewVendorId(null)}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setReviewVendorId(vendor.id)}
                  className="btn-secondary w-full"
                >
                  Write review
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
