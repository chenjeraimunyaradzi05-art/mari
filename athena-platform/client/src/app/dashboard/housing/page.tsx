'use client';

/**
 * Housing, both sides. Members search listings and ask about them; the member
 * who listed a place answers those asking (contacted, viewing booked,
 * approved, declined), and each answer reaches the asker as a notification.
 * Listing a place happens here too, not through a sales form.
 *
 * The safety rules the server keeps, shown honestly here: an address appears
 * only once the lister has answered; DV-safe, emergency and transitional
 * listings are for members with Safe Mode on or a verified account; a DV-safe
 * claim is checked by ATHENA staff before the listing goes live; and on a
 * DV-safe listing the lister sees the asker as an alias, with the
 * conversation carried on the inquiry rather than in messages, until she is
 * approved and chooses to share her details.
 */

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Home, Loader2, MapPin, BedDouble, ShieldCheck, Heart, Search, Plus, Lock } from 'lucide-react';
import { housingApi } from '@/lib/api';
import { EmptyState } from '@/components/layout/PageShell';
import { formatCurrency, formatDate } from '@/lib/utils';
import { QuickExitButton } from '../safety/QuickExit';

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
  address?: string | null;
  suburb?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  addressReleased?: boolean;
  rentWeekly?: string | number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  features: string[];
  safetyVerified?: boolean;
  dvSafe?: boolean;
  dvSafeNote?: string | null;
  awaitingSafetyCheck?: boolean;
  petFriendly?: boolean;
  accessibleUnit?: boolean;
  availableFrom?: string | null;
  status: string;
  agentId?: string | null;
  inquiries?: HousingInquiry[];
};

type ThreadEntry = { from: 'ASKER' | 'LISTER'; text: string; at: string };

type HousingInquiry = {
  id: string;
  status: string;
  message?: string | null;
  viewingDate?: string | null;
  listing?: HousingListing;
  /** Null on a DV-safe listing until the asker is approved and shares her details. */
  user?: { id: string; firstName?: string | null; lastName?: string | null; displayName?: string | null; avatar?: string | null } | null;
  alias?: string;
  thread?: ThreadEntry[];
  contactShared?: boolean;
  confidential?: boolean;
  createdAt: string;
};

type ConfidentialNotice = { hidden: boolean; reason: string | null };

const errorMessage = (err: unknown) =>
  (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;

const inputClass = 'w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm';
const statusLabel = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
const personName = (u?: HousingInquiry['user']) => u?.displayName?.trim() || [u?.firstName, u?.lastName].filter(Boolean).join(' ') || 'A member';
/** Who the lister sees: the person, or on a DV-safe listing her alias. */
const askerName = (inq: HousingInquiry) => (inq.user ? personName(inq.user) : inq.alias || 'Applicant');
const isConfidential = (l?: Pick<HousingListing, 'dvSafe' | 'type'> | null) => Boolean(l?.dvSafe) || l?.type === 'EMERGENCY' || l?.type === 'TRANSITIONAL';
const whenShort = (iso: string) => new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
const releasedAddress = (l?: HousingListing | null) => (l?.addressReleased && l.address ? [l.address, l.suburb, l.state, l.postcode].filter(Boolean).join(', ') : null);

const emptyListing = { title: '', description: '', type: 'RENTAL', suburb: '', city: '', state: 'QLD', rentWeekly: '', bedrooms: '', bathrooms: '', dvSafe: false, dvSafeNote: '', petFriendly: false, accessibleUnit: false, availableFrom: '' };

function Thread({ inquiry, me }: { inquiry: HousingInquiry; me: 'ASKER' | 'LISTER' }) {
  const entries = inquiry.thread ?? [];
  if (!inquiry.message && entries.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {inquiry.message && (
        <li className="text-sm text-slate-600 dark:text-slate-300">
          <span className="text-xs font-medium text-slate-500">{me === 'ASKER' ? 'You' : askerName(inquiry)} · {formatDate(inquiry.createdAt)}</span>
          <p>{inquiry.message}</p>
        </li>
      )}
      {entries.map((e, i) => (
        <li key={`${e.at}-${i}`} className="text-sm text-slate-600 dark:text-slate-300">
          <span className="text-xs font-medium text-slate-500">
            {e.from === me ? 'You' : e.from === 'LISTER' ? 'The lister' : askerName(inquiry)} · {whenShort(e.at)}
          </span>
          <p>{e.text}</p>
        </li>
      ))}
    </ul>
  );
}

function HousingContent() {
  const searchParams = useSearchParams();

  const [type, setType] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [minRent, setMinRent] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  // The safety pages link here with ?dvSafe=true.
  const [dvSafe, setDvSafe] = useState(searchParams.get('dvSafe') === 'true');
  const [petFriendly, setPetFriendly] = useState(false);
  const [accessible, setAccessible] = useState(false);

  const [listings, setListings] = useState<HousingListing[]>([]);
  const [confidential, setConfidential] = useState<ConfidentialNotice>({ hidden: false, reason: null });
  const [inquiries, setInquiries] = useState<HousingInquiry[]>([]);
  const [myListings, setMyListings] = useState<HousingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listing a place.
  const [showListForm, setShowListForm] = useState(false);
  const [listing, setListing] = useState(emptyListing);
  const [listingSaving, setListingSaving] = useState(false);

  // Asking for DV-safe on a place already listed.
  const [dvSafeAskFor, setDvSafeAskFor] = useState<string | null>(null);
  const [dvSafeAskNote, setDvSafeAskNote] = useState('');

  // Answering an inquiry: a viewing date and a line for the asker.
  const [answerFor, setAnswerFor] = useState<string | null>(null);
  const [viewingDate, setViewingDate] = useState('');
  const [answerMessage, setAnswerMessage] = useState('');

  // Replying to the lister from your own inquiry.
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

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
      setConfidential(listingsRes.data?.confidential ?? { hidden: false, reason: null });
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

  const sendReply = async (inquiryId: string) => {
    if (!replyText.trim()) return;
    setSavingId(inquiryId);
    try {
      await housingApi.updateInquiry(inquiryId, { reply: replyText.trim() });
      toast.success('Sent. The lister has been told.');
      setReplyFor(null);
      setReplyText('');
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err) || 'Could not send that');
    } finally {
      setSavingId(null);
    }
  };

  const shareDetails = async (inquiryId: string) => {
    if (!window.confirm('Let the lister see your name and profile? Until now they have only seen an alias.')) return;
    setSavingId(inquiryId);
    try {
      await housingApi.shareContact(inquiryId);
      toast.success('Shared. The lister can now see who you are.');
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err) || 'Could not share that');
    } finally {
      setSavingId(null);
    }
  };

  const createListing = async () => {
    if (!listing.title.trim() || !listing.description.trim()) {
      toast.error('A title and a description are needed');
      return;
    }
    if (listing.dvSafe && !listing.dvSafeNote.trim()) {
      toast.error('Say in a sentence why the place is safe for a woman leaving violence');
      return;
    }
    setListingSaving(true);
    try {
      const res = await housingApi.createListing({
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
        dvSafeNote: listing.dvSafe ? listing.dvSafeNote.trim() : undefined,
        petFriendly: listing.petFriendly,
        accessibleUnit: listing.accessibleUnit,
        availableFrom: listing.availableFrom || undefined,
      });
      toast.success(res.data?.message || 'Listed. Inquiries land in "Your listings" below.', { duration: res.data?.pendingSafetyCheck ? 8000 : 4000 });
      setShowListForm(false);
      setListing(emptyListing);
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

  const askDvSafe = async (listingId: string) => {
    if (!dvSafeAskNote.trim()) {
      toast.error('Say in a sentence why the place is safe for a woman leaving violence');
      return;
    }
    setSavingId(listingId);
    try {
      const res = await housingApi.updateListing(listingId, { dvSafe: true, dvSafeNote: dvSafeAskNote.trim() });
      toast.success(res.data?.message || 'Asked. Staff will look at it.', { duration: 8000 });
      setDvSafeAskFor(null);
      setDvSafeAskNote('');
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err) || 'Could not ask for that');
    } finally {
      setSavingId(null);
    }
  };

  const answer = async (listingId: string, inquiry: HousingInquiry, status: 'CONTACTED' | 'VIEWING_SCHEDULED' | 'APPROVED' | 'DECLINED') => {
    if (status === 'VIEWING_SCHEDULED' && !viewingDate) {
      toast.error('Pick a date and time for the viewing');
      return;
    }
    if (status === 'DECLINED' && !window.confirm(`Decline ${askerName(inquiry)}? They are told.`)) return;
    setSavingId(inquiry.id);
    try {
      await housingApi.answerInquiry(listingId, inquiry.id, {
        status,
        ...(status === 'VIEWING_SCHEDULED' ? { viewingDate: new Date(viewingDate).toISOString() } : {}),
        ...(answerMessage.trim() ? { message: answerMessage.trim() } : {}),
      });
      toast.success(`${askerName(inquiry)} has been told`);
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

  const messageOnly = async (listingId: string, inquiry: HousingInquiry) => {
    if (!answerMessage.trim()) {
      toast.error('Write a line first');
      return;
    }
    setSavingId(inquiry.id);
    try {
      await housingApi.messageInquiry(listingId, inquiry.id, { message: answerMessage.trim() });
      toast.success(`${askerName(inquiry)} has been told`);
      setAnswerFor(null);
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
          <p className="text-slate-500 dark:text-slate-400 mt-1">{headerLabel}. Addresses stay hidden until the lister answers you; DV-safe listings are checked by ATHENA staff before they show.</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400"><Link href="/dashboard/safety" className="font-medium text-rose-600 hover:underline dark:text-rose-400">Leaving violence? Emergency help and a safety plan</Link>, and 1800RESPECT on 1800 737 732, any hour.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/*
            A woman browsing DV-safe listings is looking at exactly the screen
            she cannot be caught looking at. Quick exit used to live on the
            Safety page alone, which is the one page she is not on when it
            matters.
          */}
          <QuickExitButton />
          <a href="#list-a-place" onClick={() => setShowListForm(true)} className="btn-secondary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> List a place
          </a>
          <Link href="/dashboard/housing/plan" className="btn-primary inline-flex items-center gap-2">
            Plan to rent or buy
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid gap-4 md:grid-cols-6">
        <div>
          <label htmlFor="housing-type" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Type</label>
          <select id="housing-type" value={type} onChange={(event) => setType(event.target.value)} className={`mt-2 ${inputClass}`}>
            {listingTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="housing-state" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">State</label>
          <select id="housing-state" value={state} onChange={(event) => setState(event.target.value)} className={`mt-2 ${inputClass}`}>
            {australianStates.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="housing-city" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">City</label>
          <input id="housing-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Brisbane" className={`mt-2 ${inputClass}`} />
        </div>
        <div>
          <label htmlFor="housing-min-rent" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Min rent/wk</label>
          <input id="housing-min-rent" value={minRent} onChange={(event) => setMinRent(event.target.value)} type="number" placeholder="$0" className={`mt-2 ${inputClass}`} />
        </div>
        <div>
          <label htmlFor="housing-max-rent" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Max rent/wk</label>
          <input id="housing-max-rent" value={maxRent} onChange={(event) => setMaxRent(event.target.value)} type="number" placeholder="$1000" className={`mt-2 ${inputClass}`} />
        </div>
        <div>
          <label htmlFor="housing-bedrooms" className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Bedrooms</label>
          <select id="housing-bedrooms" value={bedrooms} onChange={(event) => setBedrooms(event.target.value)} className={`mt-2 ${inputClass}`}>
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

      {confidential.hidden && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-100">
          <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p>{confidential.reason || 'Safe housing listings are shown to members with Safe Mode on or a verified account.'}</p>
            <p className="mt-1">
              <Link href="/dashboard/safety" className="font-semibold underline">Turn on Safe Mode</Link>
              <span> · </span>
              <Link href="/dashboard/settings/profile" className="font-semibold underline">Verification</Link>
            </p>
          </div>
        </div>
      )}

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
        <>
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
                  {item.safetyVerified && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700" title="A person at ATHENA looked at this listing and the lister before it went live">
                      <ShieldCheck className="h-3 w-3" /> Checked by ATHENA staff
                    </span>
                  )}
                  {item.dvSafe && <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-700">DV-safe</span>}
                  {item.petFriendly && <span className="px-2 py-1 rounded-full bg-pink-50 text-pink-700">Pet friendly</span>}
                  {item.accessibleUnit && <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">Accessible</span>}
                </div>
                {item.availableFrom && <p className="text-xs text-slate-500">Available from {formatDate(item.availableFrom)}</p>}
                {releasedAddress(item) && <p className="text-xs text-slate-600 dark:text-slate-300">Address: {releasedAddress(item)}</p>}
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
          <p className="text-xs text-slate-500 dark:text-slate-400">
            &ldquo;Checked by ATHENA staff&rdquo; means a person at ATHENA looked at the listing and the lister before it went live. An address is shown once the lister has answered you.
          </p>
        </>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your inquiries</h2>
        {inquiries.length === 0 ? (
          <p className="text-sm text-slate-500">No inquiries yet.</p>
        ) : (
          <div className="space-y-3">
            {inquiries.map((inquiry) => {
              const open = !['WITHDRAWN', 'DECLINED'].includes(inquiry.status);
              const address = releasedAddress(inquiry.listing);
              return (
                <div key={inquiry.id} className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{inquiry.listing?.title}</div>
                      <div className="text-xs text-slate-500">
                        Inquired {formatDate(inquiry.createdAt)}
                        {inquiry.viewingDate && ` · viewing ${whenShort(inquiry.viewingDate)}`}
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">{statusLabel(inquiry.status)}</span>
                  </div>
                  {address ? (
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200"><MapPin className="mr-1 inline h-3.5 w-3.5" />{address}</p>
                  ) : (
                    open && <p className="mt-2 text-xs text-slate-500">The address appears here once the lister answers you.</p>
                  )}
                  {inquiry.confidential && open && (
                    <p className="mt-1 text-xs text-slate-500">
                      {inquiry.contactShared
                        ? 'The lister can see who you are, because you chose to share it.'
                        : inquiry.status === 'APPROVED'
                          ? 'The lister still sees you only as an alias.'
                          : 'The lister sees you as an alias, not your name, until you are approved and choose to share it.'}
                    </p>
                  )}
                  <Thread inquiry={inquiry} me="ASKER" />
                  {open && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      {replyFor === inquiry.id ? (
                        <div className="flex w-full flex-wrap items-center gap-2">
                          <input value={replyText} onChange={(e) => setReplyText(e.target.value)} maxLength={1000} placeholder="A line for the lister" aria-label="Message to the lister" className={`${inputClass} flex-1`} />
                          <button type="button" disabled={savingId === inquiry.id || !replyText.trim()} onClick={() => sendReply(inquiry.id)} className="btn-primary px-3 py-1 text-xs">
                            Send
                          </button>
                          <button type="button" onClick={() => { setReplyFor(null); setReplyText(''); }} className="px-2 py-1 text-xs text-slate-500 hover:underline">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button type="button" disabled={savingId === inquiry.id} onClick={() => { setReplyFor(inquiry.id); setReplyText(''); }} className="text-primary-600 hover:underline">
                          Write to the lister
                        </button>
                      )}
                      {inquiry.confidential && inquiry.status === 'APPROVED' && !inquiry.contactShared && (
                        <button type="button" disabled={savingId === inquiry.id} onClick={() => shareDetails(inquiry.id)} className="text-primary-600 hover:underline">
                          Share my details with the lister
                        </button>
                      )}
                      {!['APPLICATION_SUBMITTED', 'APPROVED'].includes(inquiry.status) && (
                        <button type="button" disabled={savingId === inquiry.id} onClick={() => updateMyInquiry(inquiry.id, 'APPLICATION_SUBMITTED')} className="text-primary-600 hover:underline">
                          I have applied
                        </button>
                      )}
                      {inquiry.status !== 'APPROVED' && (
                        <button type="button" disabled={savingId === inquiry.id} onClick={() => updateMyInquiry(inquiry.id, 'WITHDRAWN')} className="text-slate-500 hover:underline">
                          Withdraw
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
                <input type="checkbox" checked={listing.dvSafe} onChange={(e) => setListing({ ...listing, dvSafe: e.target.checked })} className="rounded border-slate-300" /> Ask to show it as DV-safe
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={listing.petFriendly} onChange={(e) => setListing({ ...listing, petFriendly: e.target.checked })} className="rounded border-slate-300" /> Pet friendly
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={listing.accessibleUnit} onChange={(e) => setListing({ ...listing, accessibleUnit: e.target.checked })} className="rounded border-slate-300" /> Accessible
              </label>
            </div>
            {listing.dvSafe && (
              <div className="md:col-span-2 space-y-2 rounded-lg bg-purple-50 p-3 text-sm dark:bg-purple-900/20">
                <label htmlFor="dv-safe-note" className="block font-medium text-purple-900 dark:text-purple-100">Why is this place safe for a woman leaving violence?</label>
                <textarea id="dv-safe-note" value={listing.dvSafeNote} onChange={(e) => setListing({ ...listing, dvSafeNote: e.target.value })} maxLength={1000} placeholder="Who lives there, how the entry is secured, whether the address is known to anyone else, what you are able to be flexible on" className={`${inputClass} min-h-[70px]`} />
                <p className="text-xs text-purple-800 dark:text-purple-200">ATHENA staff read this and check the listing before it goes live. Until then it is not on the list. Only members with Safe Mode on or a verified account can see DV-safe listings, and they see you answer before they see the address.</p>
              </div>
            )}
            <div className="flex gap-2 md:col-span-2">
              <button type="button" onClick={createListing} disabled={listingSaving} className="btn-primary text-sm">
                {listingSaving ? 'Listing...' : listing.dvSafe ? 'Send for a safety check' : 'Publish listing'}
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
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {mine.safetyVerified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700"><ShieldCheck className="h-3 w-3" /> Checked by ATHENA staff</span>}
                      {mine.dvSafe && !mine.awaitingSafetyCheck && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-700">DV-safe</span>}
                      {mine.awaitingSafetyCheck && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">Waiting for a safety check</span>}
                    </div>
                  </div>
                  {mine.awaitingSafetyCheck ? (
                    <p className="max-w-xs text-xs text-slate-500">ATHENA staff look at DV-safe listings before they go live. You will be told when it does.</p>
                  ) : (
                    <select value={mine.status} onChange={(e) => setListingStatus(mine.id, e.target.value)} disabled={savingId === mine.id} aria-label={`Status for ${mine.title}`} className="bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs">
                      {LISTING_STATUS.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {!mine.dvSafe && mine.status !== 'WITHDRAWN' && (
                  dvSafeAskFor === mine.id ? (
                    <div className="space-y-2 rounded-lg bg-purple-50 p-3 text-sm dark:bg-purple-900/20">
                      <label htmlFor={`dv-safe-ask-${mine.id}`} className="block font-medium text-purple-900 dark:text-purple-100">Why is this place safe for a woman leaving violence?</label>
                      <textarea id={`dv-safe-ask-${mine.id}`} value={dvSafeAskNote} onChange={(e) => setDvSafeAskNote(e.target.value)} maxLength={1000} className={`${inputClass} min-h-[70px]`} />
                      <p className="text-xs text-purple-800 dark:text-purple-200">Staff check it before it shows as DV-safe; the listing is off the list until then.</p>
                      <div className="flex gap-2">
                        <button type="button" disabled={savingId === mine.id} onClick={() => askDvSafe(mine.id)} className="btn-primary px-3 py-1 text-xs">Send for a safety check</button>
                        <button type="button" onClick={() => { setDvSafeAskFor(null); setDvSafeAskNote(''); }} className="px-2 py-1 text-xs text-slate-500 hover:underline">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setDvSafeAskFor(mine.id); setDvSafeAskNote(''); }} className="text-xs text-primary-600 hover:underline">
                      Ask to show it as DV-safe
                    </button>
                  )
                )}

                {isConfidential(mine) && (mine.inquiries ?? []).length > 0 && (
                  <p className="text-xs text-slate-500">On a DV-safe listing you see each person as an alias until you approve her and she chooses to share her details. Write to her here rather than in messages.</p>
                )}

                {(mine.inquiries ?? []).length > 0 && (
                  <ul className="space-y-2">
                    {(mine.inquiries ?? []).map((inq) => {
                      const open = !['WITHDRAWN', 'DECLINED'].includes(inq.status);
                      return (
                        <li key={inq.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-medium text-slate-900 dark:text-white">{askerName(inq)}</span>
                              <span className="text-xs text-slate-500"> · {formatDate(inq.createdAt)}</span>
                              {inq.user?.id && (
                                <Link href={`/dashboard/messages?user=${inq.user.id}`} className="ml-2 text-xs text-primary-600 hover:underline">
                                  Message
                                </Link>
                              )}
                            </div>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">{statusLabel(inq.status)}</span>
                          </div>
                          <Thread inquiry={inq} me="LISTER" />
                          {inq.viewingDate && <p className="mt-1 text-xs text-slate-500">Viewing {whenShort(inq.viewingDate)}</p>}
                          {open && answerFor !== inq.id && (
                            <button type="button" onClick={() => setAnswerFor(inq.id)} className="mt-2 text-xs text-primary-600 hover:underline">
                              {inq.status === 'APPROVED' ? 'Write to her' : 'Answer'}
                            </button>
                          )}
                          {answerFor === inq.id && (
                            <div className="mt-2 space-y-2">
                              <input value={answerMessage} onChange={(e) => setAnswerMessage(e.target.value)} maxLength={1000} placeholder="A line for them (optional)" aria-label="Message to the asker" className={inputClass} />
                              <div className="flex flex-wrap items-center gap-2">
                                <button type="button" disabled={savingId === inq.id || !answerMessage.trim()} onClick={() => messageOnly(mine.id, inq)} className="btn-secondary px-3 py-1 text-xs">
                                  Send message only
                                </button>
                                {inq.status !== 'APPROVED' && (
                                  <>
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
                                  </>
                                )}
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

// useSearchParams needs a Suspense boundary above it.
export default function HousingPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto p-6 text-slate-500">Loading...</div>}>
      <HousingContent />
    </Suspense>
  );
}
