'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Loader2 } from 'lucide-react';
import { businessApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';

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

type Rfp = {
  id: string;
  title: string;
  description: string;
  category: string;
  budget?: string | null;
  deadline?: string | null;
  status: string;
  createdAt: string;
};

export default function RfpsPage() {
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rfps, setRfps] = useState<Rfp[]>([]);
  const [myRfps, setMyRfps] = useState<Rfp[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [requirements, setRequirements] = useState('');
  const [formCategory, setFormCategory] = useState('TECH_DEVELOPMENT');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rfpsRes, myRes] = await Promise.all([
        businessApi.getRfps({ category: category || undefined, status: status || undefined }),
        businessApi.getMyRfps(),
      ]);
      setRfps(rfpsRes.data?.data || []);
      setMyRfps(myRes.data?.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load RFPs.');
      setRfps([]);
      setMyRfps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [category, status]);

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
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to create RFP.');
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
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to update RFP status.');
    } finally {
      setSaving(false);
    }
  };

  const headline = useMemo(() => {
    if (status) return `${status.toLowerCase()} RFPs`;
    return 'Open RFPs';
  }, [status]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary-600">
            <ClipboardList className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">RFPs</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
            Source the right vendors quickly
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{headline} from founders across the platform.</p>
        </div>
        <Link href="/dashboard/vendors" className="btn-secondary inline-flex items-center gap-2">
          Browse vendors
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 grid gap-4 md:grid-cols-4">
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
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-2 w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create a new RFP</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Project title"
            className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          />
          <select
            value={formCategory}
            onChange={(event) => setFormCategory(event.target.value)}
            className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          >
            {categories.filter((option) => option.value).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            placeholder="Budget (optional)"
            className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          />
          <input
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            type="date"
            className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the scope, deliverables, and timeline"
          className="w-full min-h-[120px] bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
        />
        <textarea
          value={requirements}
          onChange={(event) => setRequirements(event.target.value)}
          placeholder="Requirements or success criteria (optional)"
          className="w-full min-h-[90px] bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
        />
        <button onClick={handleCreate} disabled={saving} className="btn-primary">
          {saving ? 'Creating...' : 'Publish RFP'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading RFPs...
        </div>
      ) : rfps.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-sm text-gray-500">
          No RFPs found. Try different filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rfps.map((rfp) => (
            <div key={rfp.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{rfp.title}</h3>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-50 text-primary-700">
                  {rfp.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{rfp.description}</p>
              <div className="text-xs text-gray-500 space-y-1">
                <div>Category: {rfp.category.replace('_', ' ')}</div>
                <div>Budget: {rfp.budget || 'Flexible'}</div>
                <div>Deadline: {rfp.deadline ? formatDate(rfp.deadline) : 'TBD'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your RFPs</h2>
        {myRfps.length === 0 ? (
          <p className="text-sm text-gray-500">You have not posted any RFPs yet.</p>
        ) : (
          <div className="space-y-3">
            {myRfps.map((rfp) => (
              <div key={rfp.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{rfp.title}</div>
                    <div className="text-xs text-gray-500">Created {formatDate(rfp.createdAt)}</div>
                  </div>
                  <select
                    value={rfp.status}
                    onChange={(event) => handleStatusUpdate(rfp.id, event.target.value)}
                    className="bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 text-xs"
                  >
                    {statusOptions.filter((option) => option.value).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
