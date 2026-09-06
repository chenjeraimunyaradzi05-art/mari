'use client';

/**
 * RFPs, both ways round. Founders post what they need; vendors' owners pitch
 * for it; the founder shortlists, selects or passes, and each vendor is told.
 * The proposals themselves exist since the vendor accounts work; this page
 * shows them to the people they belong to.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { CheckCircle2, ClipboardList, Loader2, Send } from 'lucide-react';
import { businessApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

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

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'AWARDED', label: 'Awarded' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

type Vendor = { id: string; name: string; category: string; isVerified?: boolean };

type RfpResponse = {
  id: string;
  proposal: string;
  priceQuote?: string | number | null;
  timeline?: string | null;
  status: 'SUBMITTED' | 'SHORTLISTED' | 'SELECTED' | 'REJECTED';
  isSelected: boolean;
  createdAt: string;
  vendor: Vendor;
  rfp?: { id: string; title: string; category: string; status: string; budget?: string | null; deadline?: string | null };
};

type Rfp = {
  id: string;
  title: string;
  description: string;
  category: string;
  budget?: string | null;
  deadline?: string | null;
  status: string;
  createdAt: string;
  responseCount?: number;
  responses?: RfpResponse[];
  user?: { id: string };
};

type MyVendor = Vendor & { rfpResponses?: RfpResponse[] };

const RESPONSE_TONE: Record<RfpResponse['status'], string> = {
  SUBMITTED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  SHORTLISTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  SELECTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
  REJECTED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const errorMessage = (err: unknown) =>
  (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message ??
  (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.error;

const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && value !== null && value !== undefined && value !== ''
    ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)
    : null;
};

const label = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

export default function RfpsPage() {
  const searchParams = useSearchParams();
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rfps, setRfps] = useState<Rfp[]>([]);
  const [myRfps, setMyRfps] = useState<Rfp[]>([]);
  const [myVendors, setMyVendors] = useState<MyVendor[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [requirements, setRequirements] = useState('');
  const [formCategory, setFormCategory] = useState('TECH_DEVELOPMENT');

  // The pitch form, open on one RFP at a time.
  const [pitchFor, setPitchFor] = useState<string | null>(null);
  const [pitchVendor, setPitchVendor] = useState('');
  const [pitchText, setPitchText] = useState('');
  const [pitchPrice, setPitchPrice] = useState('');
  const [pitchTimeline, setPitchTimeline] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rfpsRes, myRes, vendorsRes] = await Promise.all([
        businessApi.getRfps({ category: category || undefined, status: status || undefined }),
        businessApi.getMyRfps(),
        businessApi.getMyVendors().catch(() => ({ data: { data: [] } })),
      ]);
      setRfps(rfpsRes.data?.data || []);
      setMyRfps(myRes.data?.data || []);
      setMyVendors(vendorsRes.data?.data || []);
    } catch (err) {
      setError(errorMessage(err) || 'Failed to load RFPs.');
      setRfps([]);
      setMyRfps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, status]);

  // A notification lands on the RFP or the proposals it is about.
  useEffect(() => {
    if (loading) return;
    const rfpId = searchParams.get('rfp');
    const tab = searchParams.get('tab');
    const target = rfpId ? document.getElementById(`rfp-${rfpId}`) : tab === 'proposals' ? document.getElementById('proposals') : null;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading, searchParams]);

  const myRfpIds = useMemo(() => new Set(myRfps.map((r) => r.id)), [myRfps]);
  const myProposals = useMemo(
    () =>
      myVendors
        .flatMap((v) => (v.rfpResponses || []).map((r) => ({ ...r, vendor: { id: v.id, name: v.name, category: v.category } })))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [myVendors]
  );
  const pitchedRfpIds = useMemo(() => new Set(myProposals.map((p) => p.rfp?.id).filter(Boolean)), [myProposals]);

  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await businessApi.createRfp({
        title: title.trim(),
        description: description.trim(),
        category: formCategory,
        budget: budget || undefined,
        deadline: deadline || undefined,
        requirements: requirements ? { notes: requirements } : undefined,
      });
      setTitle('');
      setDescription('');
      setBudget('');
      setDeadline('');
      setRequirements('');
      toast.success('RFP published');
      await loadData();
    } catch (err) {
      setError(errorMessage(err) || 'Unable to create RFP.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (rfpId: string, newStatus: string) => {
    setSaving(true);
    setError(null);
    try {
      await businessApi.updateRfpStatus(rfpId, newStatus);
      await loadData();
    } catch (err) {
      setError(errorMessage(err) || 'Unable to update RFP status.');
    } finally {
      setSaving(false);
    }
  };

  const openPitch = (rfpId: string) => {
    setPitchFor(rfpId);
    setPitchVendor(myVendors[0]?.id ?? '');
    setPitchText('');
    setPitchPrice('');
    setPitchTimeline('');
  };

  const sendPitch = async (rfpId: string) => {
    if (!pitchVendor || !pitchText.trim()) {
      toast.error('Choose a vendor and write the proposal');
      return;
    }
    setSaving(true);
    try {
      await businessApi.respondToRfp(rfpId, {
        vendorId: pitchVendor,
        proposal: pitchText.trim(),
        priceQuote: pitchPrice ? Number(pitchPrice) : undefined,
        timeline: pitchTimeline || undefined,
      });
      toast.success('Proposal sent. The founder has been told.');
      setPitchFor(null);
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err) || 'Could not send the proposal');
    } finally {
      setSaving(false);
    }
  };

  const decide = async (rfpId: string, responseId: string, next: 'SHORTLISTED' | 'SELECTED' | 'REJECTED', vendorName: string) => {
    if (next === 'SELECTED' && !window.confirm(`Choose ${vendorName}? The RFP closes as awarded and the other vendors are told.`)) return;
    setSaving(true);
    try {
      await businessApi.decideRfpResponse(rfpId, responseId, next);
      toast.success(next === 'SELECTED' ? `${vendorName} selected` : next === 'SHORTLISTED' ? 'Shortlisted' : 'Passed');
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err) || 'Could not update the proposal');
    } finally {
      setSaving(false);
    }
  };

  const headline = useMemo(() => (status ? `${status.toLowerCase()} RFPs` : 'Open RFPs'), [status]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600">
            <ClipboardList className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">RFPs</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">Source the right vendors quickly</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{headline} from founders across the platform.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {myVendors.length === 0 && (
            <Link href="/dashboard/vendors#your-vendor" className="btn-secondary inline-flex items-center gap-2">
              Register as a vendor to pitch
            </Link>
          )}
          <Link href="/dashboard/vendors" className="btn-secondary inline-flex items-center gap-2">
            Browse vendors
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid gap-4 md:grid-cols-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Category</label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm">
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-2 w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm">
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create a new RFP</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Project title" aria-label="Project title" className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm" />
          <select value={formCategory} onChange={(event) => setFormCategory(event.target.value)} aria-label="Category" className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm">
            {categories
              .filter((option) => option.value)
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
          <input value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Budget (optional)" aria-label="Budget" className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm" />
          <input value={deadline} onChange={(event) => setDeadline(event.target.value)} type="date" aria-label="Deadline" className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm" />
        </div>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the scope, deliverables, and timeline" aria-label="Description" className="w-full min-h-[120px] bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm" />
        <textarea value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="Requirements or success criteria (optional)" aria-label="Requirements" className="w-full min-h-[90px] bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm" />
        <button onClick={handleCreate} disabled={saving} className="btn-primary">
          {saving ? 'Working...' : 'Publish RFP'}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading RFPs...
        </div>
      ) : rfps.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-sm text-slate-500">No RFPs found. Try different filters.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rfps.map((rfp) => {
            const mine = myRfpIds.has(rfp.id);
            const pitched = pitchedRfpIds.has(rfp.id);
            const canPitch = !mine && rfp.status === 'OPEN' && myVendors.length > 0 && !pitched;
            return (
              <div key={rfp.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{rfp.title}</h3>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">{rfp.status}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">{rfp.description}</p>
                <div className="text-xs text-slate-500 space-y-1">
                  <div>Category: {label(rfp.category)}</div>
                  <div>Budget: {rfp.budget || 'Flexible'}</div>
                  <div>Deadline: {rfp.deadline ? formatDate(rfp.deadline) : 'TBD'}</div>
                  <div>
                    {rfp.responseCount ?? 0} {rfp.responseCount === 1 ? 'proposal' : 'proposals'}
                    {mine ? ' · yours' : pitched ? ' · you pitched' : ''}
                  </div>
                </div>
                {canPitch && pitchFor !== rfp.id && (
                  <button type="button" onClick={() => openPitch(rfp.id)} className="btn-secondary inline-flex items-center justify-center gap-2 text-sm">
                    <Send className="w-4 h-4" /> Respond
                  </button>
                )}
                {pitchFor === rfp.id && (
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <select value={pitchVendor} onChange={(e) => setPitchVendor(e.target.value)} aria-label="Pitch as" className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm">
                      {myVendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    <textarea value={pitchText} onChange={(e) => setPitchText(e.target.value)} rows={4} maxLength={5000} placeholder="Your proposal: what you would do, how, and why you" aria-label="Proposal" className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={pitchPrice} onChange={(e) => setPitchPrice(e.target.value)} type="number" min={0} placeholder="Quote (AUD)" aria-label="Price quote" className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm" />
                      <input value={pitchTimeline} onChange={(e) => setPitchTimeline(e.target.value)} maxLength={200} placeholder="Timeline, e.g. 6 weeks" aria-label="Timeline" className="w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => sendPitch(rfp.id)} disabled={saving} className="btn-primary text-sm">
                        Send proposal
                      </button>
                      <button type="button" onClick={() => setPitchFor(null)} className="text-sm text-slate-500 hover:underline">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your RFPs</h2>
        {myRfps.length === 0 ? (
          <p className="text-sm text-slate-500">You have not posted any RFPs yet.</p>
        ) : (
          <div className="space-y-3">
            {myRfps.map((rfp) => (
              <div key={rfp.id} id={`rfp-${rfp.id}`} className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 scroll-mt-24">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{rfp.title}</div>
                    <div className="text-xs text-slate-500">
                      Created {formatDate(rfp.createdAt)} · {(rfp.responses ?? []).length} {(rfp.responses ?? []).length === 1 ? 'proposal' : 'proposals'}
                    </div>
                  </div>
                  <select value={rfp.status} onChange={(event) => handleStatusUpdate(rfp.id, event.target.value)} aria-label={`Status for ${rfp.title}`} className="bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs">
                    {statusOptions
                      .filter((option) => option.value)
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </select>
                </div>

                {(rfp.responses ?? []).length > 0 && (
                  <ul className="space-y-2">
                    {(rfp.responses ?? []).map((response) => {
                      const quote = money(response.priceQuote);
                      const open = rfp.status === 'OPEN' && (response.status === 'SUBMITTED' || response.status === 'SHORTLISTED');
                      return (
                        <li key={response.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {response.isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                              <span className="font-medium text-slate-900 dark:text-white">{response.vendor.name}</span>
                              <span className="text-xs text-slate-500">{label(response.vendor.category)}</span>
                              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', RESPONSE_TONE[response.status])}>{label(response.status)}</span>
                            </div>
                            <div className="text-sm text-slate-700 dark:text-slate-200">
                              {quote ?? 'No quote'}
                              {response.timeline ? ` · ${response.timeline}` : ''}
                            </div>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{response.proposal}</p>
                          {open && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {response.status !== 'SHORTLISTED' && (
                                <button type="button" disabled={saving} onClick={() => decide(rfp.id, response.id, 'SHORTLISTED', response.vendor.name)} className="btn-secondary px-3 py-1 text-xs">
                                  Shortlist
                                </button>
                              )}
                              <button type="button" disabled={saving} onClick={() => decide(rfp.id, response.id, 'SELECTED', response.vendor.name)} className="btn-primary px-3 py-1 text-xs">
                                Select
                              </button>
                              <button type="button" disabled={saving} onClick={() => decide(rfp.id, response.id, 'REJECTED', response.vendor.name)} className="px-3 py-1 text-xs text-slate-500 hover:underline">
                                Pass
                              </button>
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

      {myVendors.length > 0 && (
        <div id="proposals" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 scroll-mt-24">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your proposals</h2>
          {myProposals.length === 0 ? (
            <p className="text-sm text-slate-500">You have not pitched for an RFP yet. Open RFPs above have a Respond button.</p>
          ) : (
            <ul className="space-y-2">
              {myProposals.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <div>
                    <span className="font-medium text-slate-900 dark:text-white">{p.rfp?.title ?? 'RFP'}</span>
                    <span className="text-slate-500"> · as {p.vendor.name} · {formatDate(p.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700 dark:text-slate-200">{money(p.priceQuote) ?? 'No quote'}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', RESPONSE_TONE[p.status])}>{label(p.status)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
