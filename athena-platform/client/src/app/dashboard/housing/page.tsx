'use client';

/**
 * Housing, both sides. Members search listings and ask about them; the member
 * who listed a place answers those asking (contacted, viewing booked,
 * approved, declined), and each answer reaches the asker as a notification.
 * Listing a place happens here too, not through a sales form.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Home, Loader2, MapPin, BedDouble, ShieldCheck, Heart, Search, Plus } from 'lucide-react';
import { housingApi } from '@/lib/api';
import { EmptyState } from '@/components/layout/PageShell';
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

const LISTING_STATUS = [
  ['ACTIVE', 'Available'],
  ['PENDING', 'Application pending'],
  ['LEASED', 'Leased'],
  ['WITHDRAWN', 'Withdrawn'],
] as const;

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
  agentId?: string | null;
  inquiries?: HousingInquiry[];
};

type HousingInquiry = {
  id: string;
  status: string;
  message?: string | null;
  viewingDate?: string | null;
  listing?: HousingListing;
  user?: { id: string; firstName?: string | null; lastName?: string | null; displayName?: string | null; avatar?: string | null };
  createdAt: string;
};

const errorMessage = (err: unknown) =>
  (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;

const inputClass = 'w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm';
const statusLabel = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
const personName = (u?: HousingInquiry['user']) => u?.displayName?.trim() || [u?.firstName, u?.lastName].filter(Boolean).join(' ') || 'A member';

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
  const [myListings, setMyListings] = useState<HousingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listing a place.
  const [showListForm, setShowListForm] = useState(false);
  const [listing, setListing] = useState({ title: '', description: '', type: 'RENTAL', suburb: '', city: '', state: 'QLD', rentWeekly: '', bedrooms: '', bathrooms: '', dvSafe: false, petFriendly: false, accessibleUnit: false, availableFrom: '' });
  const [listingSaving, setListingSaving] = useState(false);

  // Answering an inquiry: a viewing date and a line for the asker.
  const [answerFor, setAnswerFor] = useState<string | null>(null);
  const [viewingDate, setViewingDate] = useState('');
  const [answerMessage, setAnswerMessage] = useState('');

  const hasHousingFilters = Boolean(type || city || state || minRent || maxRent || bedrooms || dvSafe || petFriendly || accessible);

  const clearHousingFilters = () => {
    setType('');
    setCity('');
    setState('');
    setMinRent('');
    setMaxRent('');
    setBedrooms('');
    setDvSafe(false);
    setPetFriendly(false);
    setAccessible(false);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [listingsRes, inquiriesRes, mineRes] = await Promise.all([
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
        housingApi.getMyListings().catch(() => ({ data: { data: [] } })),
      ]);
      setListings(listingsRes.data?.data || []);
      setInquiries(inquiriesRes.data?.data || []);
      setMyListings(mineRes.data?.data || []);
    } catch (err) {
      setError(errorMessage(err) || 'Failed to load housing listings.');
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

  const handleInquire = async (listingId: string) => {
    setSavingId(listingId);
    setError(null);
    try {
      await housingApi.inquireAboutListing(listingId, { message: 'I am interested in this property. Please contact me with more details.' });
      toast.success('Inquiry sent. The lister has been told.');
      await loadData();
    } catch (err) {
      setError(errorMessage(err) || 'Unable to send inquiry.');
    } finally {
      setSavingId(null);
    }
  };

  const updateMyInquiry = async (inquiryId: string, status: 'APPLICATION_SUBMITTED' | 'WITHDRAWN') => {
    if (status === 'WITHDRAWN' && !window.confirm('Withdraw this inquiry?')) return;
    setSavingId(inquiryId);
    try {
      await housingApi.updateInquiry(inquiryId, { status });
      toast.success(status === 'WITHDRAWN' ? 'Withdrawn' : 'Noted that you have applied');
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err) || 'Could not update the inquiry');
    } finally {
      setSavingId(null);
    }
  };

  const createListing = async () => {
    if (!listing.title.trim() || !listing.description.trim()) {
      toast.error('A title and a description are needed');
      return;
    }
    setListingSaving(true);
    try {
      await housingApi.createListing({
        title: listing.title.trim(),
        description: listing.description.trim(),
        type: listing.type,
        suburb: listing.suburb || undefined,
        city: listing.city || undefined,
        state: listing.state || undefined,
        rentWeekly: listing.rentWeekly ? Number(listing.rentWeekly) : undefined,
        bedrooms: listing.bedrooms ? Number(listing.bedrooms) : undefined,
        bathrooms: listing.bathrooms ? Number(listing.bathrooms) : undefined,
        dvSafe: listing.dvSafe,
        petFriendly: listing.petFriendly,
        accessibleUnit: listing.accessibleUnit,
        availableFrom: listing.availableFrom || undefined,
      });
      toast.success('Listed. Inquiries land in "Your listings" below.');
      setShowListForm(false);
      setListing({ title: '', description: '', type: 'RENTAL', suburb: '', city: '', state: 'QLD', rentWeekly: '', bedrooms: '', bathrooms: '', dvSafe: false, petFriendly: false, accessibleUnit: false, availableFrom: '' });
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err) || 'Could not list the place');
    } finally {
      setListingSaving(false);
    }
  };

  const setListingStatus = async (listingId: string, status: string) => {
    setSavingId(listingId);
    try {
      await housingApi.updateListing(listingId, { status });
      toast.success(`Marked ${statusLabel(status).toLowerCase()}`);
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err) || 'Could not update the listing');
    } finally {
      setSavingId(null);
    }
  };

  const answer = async (listingId: string, inquiry: HousingInquiry, status: 'CONTACTED' | 'VIEWING_SCHEDULED' | 'APPROVED' | 'DECLINED') => {
    if (status === 'VIEWING_SCHEDULED' && !viewingDate) {
      toast.error('Pick a date and time for the viewing');
      return;
    }
    if (status === 'DECLINED' && !window.confirm(`Decline ${personName(inquiry.user)}? They are told.`)) return;
    setSavingId(inquiry.id);
    try {
      await housingApi.answerInquiry(listingId, inquiry.id, {
        status,
        ...(status === 'VIEWING_SCHEDULED' ? { viewingDate: new Date(viewingDate).toISOString() } : {}),
        ...(answerMessage.trim() ? { message: answerMessage.trim() } : {}),
      });
      toast.success(`${personName(inquiry.user)} has been told`);
      setAnswerFor(null);
      setViewingDate('');
      setAnswerMessage('');
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err) || 'Could not send that');
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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">Safe, flexible housing for women</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{headerLabel}. Verified landlords, privacy-first.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="#list-a-place" onClick={() => setShowListForm(true)} className="btn-secondary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> List a place
          </a>
          <Link href="/dashboard/finance" className="btn-primary inline-flex items-center gap-2">
            Financial wellness
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid gap-4 md:grid-cols-6">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Type</label>
          <select value={type} onChange={(event) => setType(event.target.value)} className={`mt-2 ${inputClass}`}>
            {listingTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">State</label>
          <select value={state} onChange={(event) => setState(event.target.value)} className={`mt-2 ${inputClass}`}>
            {australianStates.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">City</label>
          <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Brisbane" className={`mt-2 ${inputClass}`} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Min rent/wk</label>
          <input value={minRent} onChange={(event) => setMinRent(event.target.value)} type="number" placeholder="$0" className={`mt-2 ${inputClass}`} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Max rent/wk</label>
          <input value={maxRent} onChange={(event) => setMaxRent(event.target.value)} type="number" placeholder="$1000" className={`mt-2 ${inputClass}`} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Bedrooms</label>
          <select value={bedrooms} onChange={(event) => setBedrooms(event.target.value)} className={`mt-2 ${inputClass}`}>
            <option value="">Any</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={dvSafe} onChange={(event) => setDvSafe(event.target.checked)} className="rounded border-slate-300" />
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> DV-safe
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={petFriendly} onChange={(event) => setPetFriendly(event.target.checked)} className="rounded border-slate-300" />
          <Heart className="w-4 h-4 text-pink-500" /> Pet friendly
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={accessible} onChange={(event) => setAccessible(event.target.checked)} className="rounded border-slate-300" />
          Accessible
        </label>
        <button onClick={() => loadData()} className="btn-secondary inline-flex items-center gap-2 ml-auto">
          <Search className="w-4 h-4" /> Search
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading listings...
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          icon={Home}
          reason={hasHousingFilters ? 'filtered' : 'empty'}
          title={hasHousingFilters ? 'Nothing matches those filters' : 'No listings yet'}
          description={
            hasHousingFilters
              ? 'Widen the search and see what else is available.'
              : 'No one has listed a place here yet. If you need somewhere to go now, the safety centre lists services that can help today.'
          }
          onClear={clearHousingFilters}
          primaryAction={hasHousingFilters ? undefined : { label: 'List a place', href: '#list-a-place' }}
          secondaryAction={hasHousingFilters ? undefined : { label: 'Get support now', href: '/help/safety-center' }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listings.map((item) => (
            <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" />
                    {item.suburb || item.city || 'Location TBD'}, {item.state || 'Australia'}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">{item.type}</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{item.description}</p>
              <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1">
                  <BedDouble className="w-4 h-4" />
                  {item.bedrooms ?? '?'} bed · {item.bathrooms ?? '?'} bath
                </div>
                <div className="font-semibold text-slate-900 dark:text-white">{formatCurrency(toNumber(item.rentWeekly))}/wk</div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {item.safetyVerified && <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Safety verified</span>}
                {item.dvSafe && <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-700">DV-safe</span>}
                {item.petFriendly && <span className="px-2 py-1 rounded-full bg-pink-50 text-pink-700">Pet friendly</span>}
                {item.accessibleUnit && <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">Accessible</span>}
              </div>
              {item.availableFrom && <p className="text-xs text-slate-500">Available from {formatDate(item.availableFrom)}</p>}
              {myListings.some((m) => m.id === item.id) ? (
                <p className="text-center text-xs text-slate-500">Your listing</p>
              ) : (
                <button onClick={() => handleInquire(item.id)} disabled={savingId === item.id} className="btn-primary w-full">
                  {savingId === item.id ? 'Sending...' : 'Inquire'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your inquiries</h2>
        {inquiries.length === 0 ? (
          <p className="text-sm text-slate-500">No inquiries yet.</p>
        ) : (
          <div className="space-y-3">
            {inquiries.map((inquiry) => (
              <div key={inquiry.id} className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{inquiry.listing?.title}</div>
                    <div className="text-xs text-slate-500">
                      Inquired {formatDate(inquiry.createdAt)}
                      {inquiry.viewingDate && ` · viewing ${new Date(inquiry.viewingDate).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}`}
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">{statusLabel(inquiry.status)}</span>
                </div>
                {!['WITHDRAWN', 'DECLINED', 'APPROVED'].includes(inquiry.status) && (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {inquiry.status !== 'APPLICATION_SUBMITTED' && (
                      <button type="button" disabled={savingId === inquiry.id} onClick={() => updateMyInquiry(inquiry.id, 'APPLICATION_SUBMITTED')} className="text-primary-600 hover:underline">
                        I have applied
                      </button>
                    )}
                    <button type="button" disabled={savingId === inquiry.id} onClick={() => updateMyInquiry(inquiry.id, 'WITHDRAWN')} className="text-slate-500 hover:underline">
                      Withdraw
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div id="list-a-place" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your listings</h2>
            <p className="text-sm text-slate-500">Places you have listed, and the people asking about them. Every answer you give reaches them as a notification.</p>
          </div>
          {!showListForm && (
            <button type="button" onClick={() => setShowListForm(true)} className="btn-primary text-sm">
              List a place
            </button>
          )}
        </div>

        {showListForm && (
          <div className="grid gap-3 md:grid-cols-2 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <input value={listing.title} onChange={(e) => setListing({ ...listing, title: e.target.value })} placeholder="Title, e.g. Sunny room in Paddington" aria-label="Title" className={`${inputClass} md:col-span-2`} />
            <textarea value={listing.description} onChange={(e) => setListing({ ...listing, description: e.target.value })} placeholder="The place, the household, what you are looking for in a tenant" aria-label="Description" className={`${inputClass} md:col-span-2 min-h-[90px]`} />
            <select value={listing.type} onChange={(e) => setListing({ ...listing, type: e.target.value })} aria-label="Type" className={inputClass}>
              {listingTypes
                .filter((t) => t.value)
                .map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
            </select>
            <select value={listing.state} onChange={(e) => setListing({ ...listing, state: e.target.value })} aria-label="State" className={inputClass}>
              {australianStates
                .filter((s) => s.value)
                .map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
            </select>
            <input value={listing.suburb} onChange={(e) => setListing({ ...listing, suburb: e.target.value })} placeholder="Suburb" aria-label="Suburb" className={inputClass} />
            <input value={listing.city} onChange={(e) => setListing({ ...listing, city: e.target.value })} placeholder="City" aria-label="City" className={inputClass} />
            <input value={listing.rentWeekly} onChange={(e) => setListing({ ...listing, rentWeekly: e.target.value })} type="number" min={0} placeholder="Rent per week (AUD)" aria-label="Rent per week" className={inputClass} />
            <input value={listing.availableFrom} onChange={(e) => setListing({ ...listing, availableFrom: e.target.value })} type="date" aria-label="Available from" className={inputClass} />
            <input value={listing.bedrooms} onChange={(e) => setListing({ ...listing, bedrooms: e.target.value })} type="number" min={0} placeholder="Bedrooms" aria-label="Bedrooms" className={inputClass} />
            <input value={listing.bathrooms} onChange={(e) => setListing({ ...listing, bathrooms: e.target.value })} type="number" min={0} placeholder="Bathrooms" aria-label="Bathrooms" className={inputClass} />
            <div className="flex flex-wrap gap-4 md:col-span-2 text-sm text-slate-600 dark:text-slate-300">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={listing.dvSafe} onChange={(e) => setListing({ ...listing, dvSafe: e.target.checked })} className="rounded border-slate-300" /> DV-safe
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={listing.petFriendly} onChange={(e) => setListing({ ...listing, petFriendly: e.target.checked })} className="rounded border-slate-300" /> Pet friendly
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={listing.accessibleUnit} onChange={(e) => setListing({ ...listing, accessibleUnit: e.target.checked })} className="rounded border-slate-300" /> Accessible
              </label>
            </div>
            <div className="flex gap-2 md:col-span-2">
              <button type="button" onClick={createListing} disabled={listingSaving} className="btn-primary text-sm">
                {listingSaving ? 'Listing...' : 'Publish listing'}
              </button>
              <button type="button" onClick={() => setShowListForm(false)} className="text-sm text-slate-500 hover:underline">
                Cancel
              </button>
            </div>
          </div>
        )}

        {myListings.length === 0 ? (
          !showListForm && <p className="text-sm text-slate-500">You have not listed a place yet.</p>
        ) : (
          <div className="space-y-4">
            {myListings.map((mine) => (
              <div key={mine.id} className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{mine.title}</div>
                    <div className="text-xs text-slate-500">
                      {[mine.suburb, mine.city, mine.state].filter(Boolean).join(', ') || 'Location TBD'} · {formatCurrency(toNumber(mine.rentWeekly))}/wk · {(mine.inquiries ?? []).length}{' '}
                      {(mine.inquiries ?? []).length === 1 ? 'inquiry' : 'inquiries'}
                    </div>
                  </div>
                  <select value={mine.status} onChange={(e) => setListingStatus(mine.id, e.target.value)} disabled={savingId === mine.id} aria-label={`Status for ${mine.title}`} className="bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs">
                    {LISTING_STATUS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                {(mine.inquiries ?? []).length > 0 && (
                  <ul className="space-y-2">
                    {(mine.inquiries ?? []).map((inq) => {
                      const open = !['WITHDRAWN', 'DECLINED', 'APPROVED'].includes(inq.status);
                      return (
                        <li key={inq.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-medium text-slate-900 dark:text-white">{personName(inq.user)}</span>
                              <span className="text-xs text-slate-500"> · {formatDate(inq.createdAt)}</span>
                              {inq.user?.id && (
                                <Link href={`/dashboard/messages?user=${inq.user.id}`} className="ml-2 text-xs text-primary-600 hover:underline">
                                  Message
                                </Link>
                              )}
                            </div>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">{statusLabel(inq.status)}</span>
                          </div>
                          {inq.message && <p className="mt-1 text-slate-600 dark:text-slate-300">{inq.message}</p>}
                          {inq.viewingDate && <p className="mt-1 text-xs text-slate-500">Viewing {new Date(inq.viewingDate).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
                          {open && answerFor !== inq.id && (
                            <button type="button" onClick={() => setAnswerFor(inq.id)} className="mt-2 text-xs text-primary-600 hover:underline">
                              Answer
                            </button>
                          )}
                          {answerFor === inq.id && (
                            <div className="mt-2 space-y-2">
                              <input value={answerMessage} onChange={(e) => setAnswerMessage(e.target.value)} maxLength={1000} placeholder="A line for them (optional)" aria-label="Message to the asker" className={inputClass} />
                              <div className="flex flex-wrap items-center gap-2">
                                <button type="button" disabled={savingId === inq.id} onClick={() => answer(mine.id, inq, 'CONTACTED')} className="btn-secondary px-3 py-1 text-xs">
                                  Mark contacted
                                </button>
                                <input value={viewingDate} onChange={(e) => setViewingDate(e.target.value)} type="datetime-local" aria-label="Viewing date and time" className="bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs" />
                                <button type="button" disabled={savingId === inq.id} onClick={() => answer(mine.id, inq, 'VIEWING_SCHEDULED')} className="btn-secondary px-3 py-1 text-xs">
                                  Book viewing
                                </button>
                                <button type="button" disabled={savingId === inq.id} onClick={() => answer(mine.id, inq, 'APPROVED')} className="btn-primary px-3 py-1 text-xs">
                                  Approve
                                </button>
                                <button type="button" disabled={savingId === inq.id} onClick={() => answer(mine.id, inq, 'DECLINED')} className="px-3 py-1 text-xs text-red-600 hover:underline">
                                  Decline
                                </button>
                                <button type="button" onClick={() => setAnswerFor(null)} className="px-2 py-1 text-xs text-slate-500 hover:underline">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
