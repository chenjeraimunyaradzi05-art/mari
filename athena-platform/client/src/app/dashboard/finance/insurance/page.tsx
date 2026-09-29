'use client';

/**
 * Insurance products, compared, and the drafts a member has saved.
 *
 * This page read fields the server has never sent. It looked for
 * `monthlyPremium` (the column is `premiumMonthly`), so every premium showed as
 * $0; for an `eligible` flag nothing computes, so every button read "Not
 * eligible" and none could be pressed; and for `appliedAt` (the row has
 * `createdAt`), so every application date was invalid. Two of its filters,
 * Disability and Renters, are not insurance types the platform has, and choosing
 * either failed the whole page.
 *
 * It also said "apply online" when nothing is sent anywhere. The apply route
 * saves a DRAFT, the staff review queue shows only applications that are not
 * drafts, and no member-facing route submits one — so the button now says what
 * it does. And a page comparing insurance products carries the general-advice
 * warning, where to find the insurer's PDS, and ATHENA's licence position,
 * which it did not before.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, Loader2, Check, Info } from 'lucide-react';
import { financeApi } from '@/lib/api';
import { InsuranceNeedsPanel } from '@/components/strategy/InsuranceNeedsPanel';
import { formatDate, getPreferredLocale } from '@/lib/utils';

/** A product as GET /api/finance/insurance returns it. Decimals arrive as strings. */
type InsuranceProduct = {
  id: string;
  type: string;
  name: string;
  provider: string;
  description?: string | null;
  premiumMonthly?: string | number | null;
  coverageAmount?: string | number | null;
  waitingPeriod?: number | null;
  benefitPeriod?: number | null;
  features: string[];
};

type InsuranceApplication = {
  id: string;
  status: string;
  product: { id: string; name: string; type: string; provider: string };
  createdAt: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  policyNumber?: string | null;
};

// The InsuranceType enum on the server, and nothing else: a value it does not
// have is refused with a 400.
const insuranceTypes = [
  { value: 'ALL', label: 'All types' },
  { value: 'INCOME_PROTECTION', label: 'Income protection' },
  { value: 'LIFE', label: 'Life' },
  { value: 'TPD', label: 'Total and permanent disability' },
  { value: 'TRAUMA', label: 'Trauma' },
  { value: 'HEALTH', label: 'Health' },
];

// InsuranceApplicationStatus on the server. DRAFT is the only status a member
// can create; the rest are set by staff once an application reaches them.
const statusLabels: Record<string, string> = {
  DRAFT: 'Draft, not sent',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  ACTIVE: 'Active',
  LAPSED: 'Lapsed',
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SUBMITTED: 'bg-yellow-50 text-yellow-700',
  UNDER_REVIEW: 'bg-blue-50 text-blue-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  DECLINED: 'bg-red-50 text-red-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  LAPSED: 'bg-slate-100 text-slate-600',
};

const readable = (value: string) => value.replace(/_/g, ' ').toLowerCase();

/** A decimal from the server, or null when the product does not state one. */
const toAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Australian dollars, whatever currency the member prefers elsewhere: these
 * are Australian policies priced in AUD. Premiums keep their cents, because a
 * premium rounded to the dollar is not the one she would pay.
 */
const aud = (amount: number, cents: boolean) =>
  new Intl.NumberFormat(getPreferredLocale(), {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(amount);

const readError = (err: unknown, fallback: string) => {
  const error = err as { response?: { data?: { message?: string; error?: string } } };
  return error?.response?.data?.message || error?.response?.data?.error || fallback;
};

export default function InsurancePage() {
  const [products, setProducts] = useState<InsuranceProduct[]>([]);
  const [applications, setApplications] = useState<InsuranceApplication[]>([]);
  const [filterType, setFilterType] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Both lists are paged server-side, and this page reads across the whole
      // of each: the product grid decides what to offer against every
      // application the member holds, so a truncated list would offer a draft
      // she already has and the server would refuse it with a conflict.
      const [productsRes, appsRes] = await Promise.all([
        financeApi.getInsuranceProducts({
          ...(filterType === 'ALL' ? {} : { type: filterType }),
          limit: 100,
        }),
        financeApi.getMyInsuranceApplications({ limit: 100 }),
      ]);
      setProducts(productsRes.data?.data || []);
      setApplications(appsRes.data?.data || []);
    } catch (err: unknown) {
      // Kept apart from the product list, so a failed load is never shown as
      // "no products in this category".
      setLoadError(readError(err, 'We could not load insurance products just now.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  const handleSaveDraft = async (productId: string) => {
    setSaving(productId);
    setActionError(null);
    try {
      await financeApi.applyForInsurance(productId);
      await loadData();
    } catch (err: unknown) {
      setActionError(readError(err, 'We could not save that draft.'));
    } finally {
      setSaving(null);
    }
  };

  const applicationFor = (productId: string) =>
    applications.find((a) => a.product?.id === productId);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-emerald-600">
          <Shield className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Insurance</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-2">
          Protect your future
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Compare insurance options and keep a shortlist
        </p>
      </div>

      {/* The general-advice warning and licence position, above the products
          rather than in a footer, because they change how everything below
          should be read. */}
      <section
        aria-label="About this information"
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <div className="flex gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-2">
            <p>
              <strong>General information only.</strong> This page lists products and the terms their
              insurers publish. It does not take into account your objectives, financial situation or
              needs, and it is not a recommendation to buy any of them.
            </p>
            <p>
              Before you decide, read the insurer&apos;s Product Disclosure Statement (PDS) and Target
              Market Determination, which each insurer publishes on its own website, and consider
              whether the cover suits you.{' '}
              <a
                href="https://moneysmart.gov.au"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                Moneysmart
              </a>
              , run by ASIC, explains how each kind of cover works.
            </p>
            <p>
              ATHENA is not an insurer. It does not hold an Australian financial services licence and is
              not an authorised representative of a licensee, so it cannot give you personal advice or
              arrange cover. Saving a draft here does not send anything to an insurer; to apply, contact
              the insurer directly.
            </p>
          </div>
        </div>
      </section>

      {actionError && (
        <div role="alert" className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{actionError}</div>
      )}

      {loadError ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-sm text-center">
          <p className="font-medium text-slate-900 dark:text-white">{loadError}</p>
          <button onClick={() => loadData()} className="btn-secondary mt-4">
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* My saved and reviewed applications */}
          {applications.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">My applications</h2>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-left text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Saved</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Policy #</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {applications.map((app) => (
                      <tr key={app.id}>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          {app.product.name}
                          <span className="block text-xs font-normal text-slate-500">{app.product.provider}</span>
                        </td>
                        <td className="px-4 py-3 capitalize">{readable(app.product.type)}</td>
                        <td className="px-4 py-3">{formatDate(app.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColors[app.status] || 'bg-slate-100 text-slate-600'}`}>
                            {statusLabels[app.status] ?? readable(app.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{app.policyNumber || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Filter */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Compare products</h2>
            <label htmlFor="insurance-type" className="sr-only">Insurance type</label>
            <select
              id="insurance-type"
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
              className="bg-transparent border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
            >
              {insuranceTypes.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </section>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-sm text-slate-500 text-center">
              No insurance products are listed in this category.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => {
                const premium = toAmount(product.premiumMonthly);
                const coverage = toAmount(product.coverageAmount);
                const existing = applicationFor(product.id);

                return (
                  <div
                    key={product.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col gap-4"
                  >
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">{readable(product.type)}</p>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mt-1">{product.name}</h3>
                      <p className="text-sm text-slate-500">{product.provider}</p>
                    </div>

                    {product.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-300">{product.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 text-xs">Listed monthly premium</p>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {premium === null ? 'Not stated' : aud(premium, true)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Cover</p>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {coverage === null ? 'Not stated' : aud(coverage, false)}
                        </p>
                      </div>
                      {product.waitingPeriod != null && (
                        <div>
                          <p className="text-slate-500 text-xs">Waiting period</p>
                          <p className="font-semibold text-slate-900 dark:text-white">{product.waitingPeriod} days</p>
                        </div>
                      )}
                    </div>

                    {product.features && product.features.length > 0 && (
                      <ul className="text-sm space-y-1">
                        {product.features.slice(0, 4).map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Check className="w-4 h-4 text-emerald-500" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-auto space-y-2">
                      {existing ? (
                        <button disabled className="w-full btn-secondary opacity-50">
                          {existing.status === 'DRAFT' ? 'Draft saved' : statusLabels[existing.status] ?? readable(existing.status)}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSaveDraft(product.id)}
                          disabled={saving === product.id}
                          className="w-full btn-primary disabled:opacity-50"
                        >
                          {saving === product.id ? 'Saving…' : 'Save a draft'}
                        </button>
                      )}
                      <p className="text-xs text-slate-500">
                        A draft stays on your list here. It is not sent to {product.provider}.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <InsuranceNeedsPanel />

      <div className="text-center">
        <Link href="/dashboard/finance" className="text-sm text-primary-600 hover:underline">
          ← Back to Finance Hub
        </Link>
      </div>
    </div>
  );
}
