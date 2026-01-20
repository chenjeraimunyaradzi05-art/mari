'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Home, Loader2, MapPin, BedDouble, ShieldCheck, Heart, Search } from 'lucide-react';
import { housingApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

const listingTypes = [
  { value: '', label: 'All types' },
  { value: 'RENTAL', label: 'Rental' },
  { value: 'SHARE', label: 'Share house' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'TRANSITIONAL', label: 'Transitional' },
];

const australianStates = [
  { value: '', label: 'All states' },
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'ACT' },
  { value: 'NT', label: 'Northern Territory' },
];

type HousingListing = {
  id: string;
  title: string;
  description: string;
  type: string;
  suburb?: string | null;
  city?: string | null;
  state?: string | null;
  rentWeekly?: string | number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  features: string[];
  safetyVerified?: boolean;
  dvSafe?: boolean;
  petFriendly?: boolean;
  accessibleUnit?: boolean;
  availableFrom?: string | null;
  status: string;
};

type HousingInquiry = {
  id: string;
  status: string;
  message?: string | null;
  listing: HousingListing;
  createdAt: string;
};

export default function HousingPage() {
  const [type, setType] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [minRent, setMinRent] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [dvSafe, setDvSafe] = useState(false);
  const [petFriendly, setPetFriendly] = useState(false);
  const [accessible, setAccessible] = useState(false);

  const [listings, setListings] = useState<HousingListing[]>([]);
  const [inquiries, setInquiries] = useState<HousingInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [listingsRes, inquiriesRes] = await Promise.all([
        housingApi.getListings({
          type: type || undefined,
          city: city || undefined,
          state: state || undefined,
          minRent: minRent ? Number(minRent) : undefined,
          maxRent: maxRent ? Number(maxRent) : undefined,
          bedrooms: bedrooms ? Number(bedrooms) : undefined,
          dvSafe: dvSafe || undefined,
          petFriendly: petFriendly || undefined,
          accessible: accessible || undefined,
        }),
        housingApi.getMyInquiries(),
      ]);
      setListings(listingsRes.data?.data || []);
      setInquiries(inquiriesRes.data?.data || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load housing listings.');
      setListings([]);
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, state, dvSafe, petFriendly, accessible]);

  const handleSearch = () => {
    loadData();
  };

  const handleInquire = async (listingId: string) => {
    setSavingId(listingId);
    setError(null);
    try {
      await housingApi.inquireAboutListing(listingId, {
        message: 'I am interested in this property. Please contact me with more details.',
      });
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Unable to send inquiry.');
    } finally {
      setSavingId(null);
    }
  };

  const headerLabel = useMemo(() => {
    if (dvSafe) return 'DV-safe housing';
    if (type) return `${type.toLowerCase()} properties`;
    return 'All listings';
  }, [type, dvSafe]);

  const toNumber = (value: unknown) => {
    if (value === null || value === undefined) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600">
            <Home className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Housing</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
            Safe, flexible housing for women
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {headerLabel}. Verified landlords, privacy-first.
          </p>
        </div>
        <Link href="/dashboard/finance" className="btn-primary inline-flex items-center gap-2">
          Financial wellness
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 grid gap-4 md:grid-cols-6">
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Type</label>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="mt-2 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          >
            {listingTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">State</label>
          <select
            value={state}
            onChange={(event) => setState(event.target.value)}
            className="mt-2 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          >
            {australianStates.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">City</label>
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="e.g. Sydney"
            className="mt-2 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Min rent/wk</label>
          <input
            value={minRent}
            onChange={(event) => setMinRent(event.target.value)}
            type="number"
            placeholder="$0"
            className="mt-2 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Max rent/wk</label>
          <input
            value={maxRent}
            onChange={(event) => setMaxRent(event.target.value)}
            type="number"
            placeholder="$1000"
            className="mt-2 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Bedrooms</label>
          <select
            value={bedrooms}
            onChange={(event) => setBedrooms(event.target.value)}
            className="mt-2 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Any</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={dvSafe}
            onChange={(event) => setDvSafe(event.target.checked)}
            className="rounded border-gray-300"
          />
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> DV-safe
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={petFriendly}
            onChange={(event) => setPetFriendly(event.target.checked)}
            className="rounded border-gray-300"
          />
          <Heart className="w-4 h-4 text-pink-500" /> Pet friendly
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={accessible}
            onChange={(event) => setAccessible(event.target.checked)}
            className="rounded border-gray-300"
          />
          Accessible
        </label>
        <button onClick={handleSearch} className="btn-secondary inline-flex items-center gap-2 ml-auto">
          <Search className="w-4 h-4" /> Search
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading listings...
        </div>
      ) : listings.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-sm text-gray-500">
          No listings found. Try adjusting your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listings.map((listing) => (
            <div key={listing.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{listing.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" />
                    {listing.suburb || listing.city || 'Location TBD'}, {listing.state || 'Australia'}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">
                  {listing.type}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{listing.description}</p>
              <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-1">
                  <BedDouble className="w-4 h-4" />
                  {listing.bedrooms ?? '?'} bed · {listing.bathrooms ?? '?'} bath
                </div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(toNumber(listing.rentWeekly))}/wk
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {listing.safetyVerified && (
                  <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Safety verified</span>
                )}
                {listing.dvSafe && (
                  <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-700">DV-safe</span>
                )}
                {listing.petFriendly && (
                  <span className="px-2 py-1 rounded-full bg-pink-50 text-pink-700">Pet friendly</span>
                )}
                {listing.accessibleUnit && (
                  <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">Accessible</span>
                )}
              </div>
              {listing.availableFrom && (
                <p className="text-xs text-gray-500">Available from {formatDate(listing.availableFrom)}</p>
              )}
              <button
                onClick={() => handleInquire(listing.id)}
                disabled={savingId === listing.id}
                className="btn-primary w-full"
              >
                {savingId === listing.id ? 'Sending...' : 'Inquire'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your inquiries</h2>
        {inquiries.length === 0 ? (
          <p className="text-sm text-gray-500">No inquiries yet.</p>
        ) : (
          <div className="space-y-3">
            {inquiries.map((inquiry) => (
              <div key={inquiry.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{inquiry.listing.title}</div>
                    <div className="text-xs text-gray-500">Inquired {formatDate(inquiry.createdAt)}</div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">
                    {inquiry.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
