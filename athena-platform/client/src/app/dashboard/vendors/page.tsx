'use client';

/**
 * The vendor directory, and a member's own vendor listing. A member registers
 * her business here (or claims a catalogue entry from an address at its
 * domain); owning a vendor is what lets her answer RFPs.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { BadgeCheck, Briefcase, Loader2, Star } from 'lucide-react';
import { businessApi } from '@/lib/api';
import { useAuthStore } from '@/lib/hooks';

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
  email?: string | null;
  location?: string | null;
  isVerified?: boolean;
  isPartner?: boolean;
  avgRating?: string | number | null;
  reviewCount?: number | null;
  ownerId?: string | null;
  rfpResponses?: Array<{ id: string; status: string }>;
};

const errorMessage = (err: unknown) =>
  (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;

const label = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

const inputClass = 'w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm';

export default function VendorsPage() {
  const { user } = useAuthStore();
  const [category, setCategory] = useState('');
  const [partnerOnly, setPartnerOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [minRating, setMinRating] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [mine, setMine] = useState<Vendor[]>([]);
  const [reviewVendorId, setReviewVendorId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Registering a vendor.
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'TECH_DEVELOPMENT', description: '', services: '', priceRange: '', website: '', email: '', phone: '', location: '' });
  const [registering, setRegistering] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [response, mineRes] = await Promise.all([
        businessApi.getVendors({
          category: category || undefined,
          partner: partnerOnly || undefined,
          verified: verifiedOnly || undefined,
          minRating: minRating ? Number(minRating) : undefined,
        }),
        businessApi.getMyVendors().catch(() => ({ data: { data: [] } })),
      ]);
      setVendors(response.data?.data || []);
      setMine(mineRes.data?.data || []);
    } catch (err) {
      setError(errorMessage(err) || 'Failed to load vendors.');
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, partnerOnly, verifiedOnly, minRating]);

  const handleSubmitReview = async (vendorId: string) => {
    setSavingId(vendorId);
    setError(null);
    try {
      await businessApi.reviewVendor(vendorId, { rating, title: reviewTitle || undefined, content: reviewContent || undefined });
      setReviewVendorId(null);
      setReviewTitle('');
      setReviewContent('');
      toast.success('Review posted');
      await loadData();
    } catch (err) {
      setError(errorMessage(err) || 'Unable to submit review.');
    } finally {
      setSavingId(null);
    }
  };

  const claim = async (vendor: Vendor) => {
    setSavingId(vendor.id);
    try {
      await businessApi.claimVendor(vendor.id);
      toast.success(`${vendor.name} is now yours. You can pitch for RFPs as ${vendor.name}.`);
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err) || 'Could not claim this listing');
    } finally {
      setSavingId(null);
    }
  };

  const register = async () => {
    if (!form.name.trim()) {
      toast.error('Give your business a name');
      return;
    }
    setRegistering(true);
    try {
      await businessApi.registerVendor({
        name: form.name.trim(),
        category: form.category,
        description: form.description || undefined,
        services: form.services
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        priceRange: form.priceRange || undefined,
        website: form.website || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        location: form.location || undefined,
      });
      toast.success('Registered. You can now pitch for RFPs.');
      setShowRegister(false);
      setForm({ name: '', category: 'TECH_DEVELOPMENT', description: '', services: '', priceRange: '', website: '', email: '', phone: '', location: '' });
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err) || 'Could not register the vendor');
    } finally {
      setRegistering(false);
    }
  };

  const headerLabel = useMemo(() => (category ? `${label(category)} vendors` : 'Preferred vendors'), [category]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600">
            <Briefcase className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Vendors</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">{headerLabel} for every business need</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Book verified partners, compare pricing, and leave reviews.</p>
        </div>
        <Link href="/dashboard/rfps" className="btn-primary inline-flex items-center gap-2">
          Create an RFP
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid gap-4 md:grid-cols-5">
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Category</label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className={`mt-2 ${inputClass}`}>
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Min rating</label>
          <select value={minRating} onChange={(event) => setMinRating(event.target.value)} className={`mt-2 ${inputClass}`}>
            <option value="">Any</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
            <option value="4.5">4.5+</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 md:mt-7">
          <input type="checkbox" checked={partnerOnly} onChange={(event) => setPartnerOnly(event.target.checked)} className="rounded border-slate-300" />
          Partners only
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 md:mt-7">
          <input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} className="rounded border-slate-300" />
          Verified only
        </label>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading vendors...
        </div>
      ) : vendors.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-sm text-slate-500">No vendors found. Try different filters.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vendors.map((vendor) => {
            const yours = Boolean(user?.id) && vendor.ownerId === user?.id;
            return (
              <div key={vendor.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-lg font-semibold text-slate-900 dark:text-white">
                      {vendor.name}
                      {vendor.isVerified && <BadgeCheck className="h-4 w-4 text-emerald-600" aria-label="Verified" />}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {label(vendor.category)}
                      {vendor.location ? ` · ${vendor.location}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {vendor.isPartner && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">Partner</span>}
                    {yours && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Yours</span>}
                  </div>
                </div>
                {vendor.description && <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">{vendor.description}</p>}
                {vendor.services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {vendor.services.slice(0, 6).map((s) => (
                      <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    {Number(vendor.avgRating ?? 0).toFixed(1)} ({vendor.reviewCount ?? 0})
                  </span>
                  {vendor.priceRange && <span>{vendor.priceRange}</span>}
                  {typeof vendor.discountPct === 'number' && vendor.discountPct > 0 && <span className="text-emerald-700">{vendor.discountPct}% member discount</span>}
                  {vendor.website && (
                    <a href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                      Website
                    </a>
                  )}
                </div>

                {reviewVendorId === vendor.id ? (
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <select value={rating} onChange={(event) => setRating(Number(event.target.value))} aria-label="Rating" className={inputClass}>
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} star{n === 1 ? '' : 's'}
                        </option>
                      ))}
                    </select>
                    <input value={reviewTitle} onChange={(event) => setReviewTitle(event.target.value)} placeholder="Review title" aria-label="Review title" className={inputClass} />
                    <textarea value={reviewContent} onChange={(event) => setReviewContent(event.target.value)} placeholder="How did it go?" aria-label="Review" className={`${inputClass} min-h-[80px]`} />
                    <div className="flex gap-2">
                      <button onClick={() => handleSubmitReview(vendor.id)} disabled={savingId === vendor.id} className="btn-primary text-sm">
                        {savingId === vendor.id ? 'Posting...' : 'Post review'}
                      </button>
                      <button onClick={() => setReviewVendorId(null)} className="text-sm text-slate-500 hover:underline">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setReviewVendorId(vendor.id)} className="btn-secondary text-sm">
                      Leave a review
                    </button>
                    {!vendor.ownerId && (
                      <button onClick={() => claim(vendor)} disabled={savingId === vendor.id} className="text-sm text-primary-600 hover:underline" title={vendor.email ? `Claim from an address at ${vendor.email.split('@')[1]}` : 'Claim this listing as yours'}>
                        {savingId === vendor.id ? 'Claiming...' : 'This is my business'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div id="your-vendor" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your vendor listing</h2>
            <p className="text-sm text-slate-500">Register your business to appear in the directory and pitch for RFPs.</p>
          </div>
          {!showRegister && (
            <button type="button" onClick={() => setShowRegister(true)} className="btn-primary text-sm">
              Register a business
            </button>
          )}
        </div>

        {mine.length > 0 && (
          <ul className="space-y-2">
            {mine.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <div>
                  <span className="font-medium text-slate-900 dark:text-white">{v.name}</span>
                  <span className="text-slate-500"> · {label(v.category)}</span>
                  {v.isVerified ? <span className="ml-2 text-xs text-emerald-700">Verified</span> : <span className="ml-2 text-xs text-slate-500">Awaiting verification</span>}
                </div>
                <Link href="/dashboard/rfps?tab=proposals" className="text-primary-600 hover:underline">
                  {(v.rfpResponses ?? []).length} {(v.rfpResponses ?? []).length === 1 ? 'proposal' : 'proposals'}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {showRegister && (
          <div className="grid gap-3 md:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Business name" aria-label="Business name" className={inputClass} />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} aria-label="Category" className={inputClass}>
              {categories
                .filter((c) => c.value)
                .map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
            </select>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What you do, for whom" aria-label="Description" className={`${inputClass} md:col-span-2 min-h-[80px]`} />
            <input value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} placeholder="Services, comma separated" aria-label="Services" className={inputClass} />
            <input value={form.priceRange} onChange={(e) => setForm({ ...form, priceRange: e.target.value })} placeholder="Price range, e.g. $120–$180/hr" aria-label="Price range" className={inputClass} />
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="Website" aria-label="Website" className={inputClass} />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="Business email" aria-label="Business email" className={inputClass} />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" aria-label="Phone" className={inputClass} />
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location, e.g. Brisbane" aria-label="Location" className={inputClass} />
            <div className="flex gap-2 md:col-span-2">
              <button type="button" onClick={register} disabled={registering} className="btn-primary text-sm">
                {registering ? 'Registering...' : 'Register'}
              </button>
              <button type="button" onClick={() => setShowRegister(false)} className="text-sm text-slate-500 hover:underline">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
