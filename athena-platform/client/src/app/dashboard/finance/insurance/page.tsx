'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, Loader2, Check } from 'lucide-react';
import { financeApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

type InsuranceProduct = {
  id: string;
  type: string;
  name: string;
  provider: string;
  description?: string;
  monthlyPremium: string | number;
  coverageAmount: string | number;
  features: string[];
  eligible: boolean;
};

type InsuranceApplication = {
  id: string;
  status: string;
  product: { name: string; type: string; provider: string };
  appliedAt: string;
  approvedAt?: string | null;
  policyNumber?: string | null;
};

const insuranceTypes = [
  { value: 'ALL', label: 'All types' },
  { value: 'LIFE', label: 'Life' },
  { value: 'INCOME_PROTECTION', label: 'Income protection' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'DISABILITY', label: 'Disability' },
  { value: 'RENTERS', label: 'Renters' },
];

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700',
  UNDER_REVIEW: 'bg-blue-50 text-blue-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export default function InsurancePage() {
  const [products, setProducts] = useState<InsuranceProduct[]>([]);
  const [applications, setApplications] = useState<InsuranceApplication[]>([]);
  const [filterType, setFilterType] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsRes, appsRes] = await Promise.all([
        financeApi.getInsuranceProducts(filterType === 'ALL' ? undefined : { type: filterType }),
        financeApi.getMyInsuranceApplications(),
      ]);
      setProducts(productsRes.data?.data || []);
      setApplications(appsRes.data?.data || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load insurance information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  const handleApply = async (productId: string) => {
    setApplying(productId);
    setError(null);
    try {
      await financeApi.applyForInsurance(productId);
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Unable to submit application.');
    } finally {
      setApplying(null);
    }
  };

  const toNumber = (value: unknown) => {
    if (value === null || value === undefined) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-emerald-600">
          <Shield className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Insurance</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
          Protect your future
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Compare insurance options and apply online
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {/* My applications */}
      {applications.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">My applications</h2>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-left text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Applied</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Policy #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{app.product.name}</td>
                    <td className="px-4 py-3 capitalize">{app.product.type.replace('_', ' ').toLowerCase()}</td>
                    <td className="px-4 py-3">{formatDate(app.appliedAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColors[app.status] || 'bg-gray-100 text-gray-600'}`}>
                        {app.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{app.policyNumber || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Filter */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Compare products</h2>
        <select
          value={filterType}
          onChange={(event) => setFilterType(event.target.value)}
          className="bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
        >
          {insuranceTypes.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading products...
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-sm text-gray-500 text-center">
          No insurance products available in this category.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 flex flex-col gap-4"
            >
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{product.type.replace('_', ' ')}</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{product.name}</h3>
                <p className="text-sm text-gray-500">{product.provider}</p>
              </div>

              {product.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300">{product.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Monthly premium</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(toNumber(product.monthlyPremium))}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Coverage</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(toNumber(product.coverageAmount))}
                  </p>
                </div>
              </div>

              {product.features && product.features.length > 0 && (
                <ul className="text-sm space-y-1">
                  {product.features.slice(0, 4).map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Check className="w-4 h-4 text-emerald-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-auto">
                {applications.some((a) => a.product && a.product.name === product.name && !['REJECTED', 'CANCELLED'].includes(a.status)) ? (
                  <button disabled className="w-full btn-secondary opacity-50">Already applied</button>
                ) : (
                  <button
                    onClick={() => handleApply(product.id)}
                    disabled={!product.eligible || applying === product.id}
                    className="w-full btn-primary disabled:opacity-50"
                  >
                    {applying === product.id ? 'Applying...' : product.eligible ? 'Apply now' : 'Not eligible'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center">
        <Link href="/dashboard/finance" className="text-sm text-primary-600 hover:underline">
          ← Back to Finance Hub
        </Link>
      </div>
    </div>
  );
}
