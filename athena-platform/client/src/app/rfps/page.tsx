'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Building,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { businessApi } from '@/lib/api';
import { formatDate, formatRelativeTime } from '@/lib/utils';

const categories = [
  { id: '', name: 'All categories' },
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

type Rfp = {
  id: string;
  title: string;
  description: string;
  category: string;
  budget?: string | null;
  deadline?: string | null;
  requirements?: unknown;
  status: string;
  createdAt: string;
  responseCount?: number;
  user?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

function formatCategory(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function requesterName(rfp: Rfp) {
  const fullName = `${rfp.user?.firstName || ''} ${rfp.user?.lastName || ''}`.trim();
  return fullName || 'Platform member';
}

function requirementLabels(requirements: unknown): string[] {
  if (Array.isArray(requirements)) {
    return requirements.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (requirements && typeof requirements === 'object') {
    const values = Object.values(requirements as Record<string, unknown>);
    return values
      .flatMap((value) => {
        if (typeof value === 'string') return value.split('\n');
        if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
        return [];
      })
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [];
}

export default function RFPsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [rfps, setRfps] = useState<Rfp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRfps = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await businessApi.getRfps({
          category: selectedCategory || undefined,
          status: 'OPEN',
        });

        if (!cancelled) {
          setRfps(response.data?.data || []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setRfps([]);
          setError(err?.response?.data?.error || 'Unable to load RFPs right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadRfps();

    return () => {
      cancelled = true;
    };
  }, [selectedCategory]);

  const filteredRfps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return rfps.filter((rfp) => {
      if (!query) return true;

      return [
        rfp.title,
        rfp.description,
        rfp.budget,
        formatCategory(rfp.category),
        requesterName(rfp),
        ...requirementLabels(rfp.requirements),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [rfps, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <section className="bg-gradient-to-br from-teal-600 to-cyan-700 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-8 h-8" />
              <span className="text-teal-200 font-medium">ATHENA RFP Marketplace</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">Request for Proposals</h1>
            <p className="text-xl text-teal-100">
              Browse open RFPs from ATHENA members and continue proposal workflows from your dashboard.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search RFPs..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.id || 'all'}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                  selectedCategory === category.id
                    ? 'bg-teal-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50'
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
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading RFPs...
          </div>
        ) : filteredRfps.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No open RFPs available</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery || selectedCategory
                ? 'Try adjusting your search or category.'
                : 'No members have published open RFPs yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRfps.map((rfp) => {
              const labels = requirementLabels(rfp.requirements).slice(0, 3);

              return (
                <div
                  key={rfp.id}
                  className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{rfp.title}</h3>
                        <span className="text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-2 py-1 rounded-full">
                          {rfp.responseCount ?? 0} proposals
                        </span>
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">
                          {formatCategory(rfp.category)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                        <span className="flex items-center gap-1">
                          <Building className="w-4 h-4" />
                          {requesterName(rfp)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Posted {formatRelativeTime(rfp.createdAt)}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">{rfp.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {(labels.length ? labels : ['Requirements available in dashboard']).map((label) => (
                          <span
                            key={label}
                            className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded"
                          >
                            <CheckCircle className="w-3 h-3 text-teal-500" />
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col md:items-end gap-2 min-w-[180px]">
                      <div className="md:text-right">
                        <div className="flex items-center gap-1 text-lg font-bold text-gray-900 dark:text-white">
                          <DollarSign className="w-5 h-5 text-teal-600" />
                          {rfp.budget || 'Flexible budget'}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-red-600">
                          <Calendar className="w-4 h-4" />
                          {rfp.deadline ? `Due: ${formatDate(rfp.deadline)}` : 'Deadline TBD'}
                        </div>
                      </div>
                      <Link
                        href="/dashboard/rfps"
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium"
                      >
                        View & Submit
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-3xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Post an RFP</h2>
          <p className="text-teal-100 mb-8 max-w-2xl mx-auto">
            Looking for service providers? Publish an RFP and collect vendor responses from the dashboard.
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
