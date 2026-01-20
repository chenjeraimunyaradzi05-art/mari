'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Landmark, Plus, Loader2, TrendingUp, CalendarDays } from 'lucide-react';
import { financeApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

type SuperAccount = {
  id: string;
  fundName: string;
  memberNumber?: string | null;
  balance: string | number;
  investmentOption?: string | null;
  insuranceIncluded?: boolean;
  employerContributing?: boolean;
  lastStatementDate?: string | null;
  projectedRetirementBalance?: string | number | null;
};

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function SuperPage() {
  const [accounts, setAccounts] = useState<SuperAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [fundName, setFundName] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const [balance, setBalance] = useState('');
  const [investmentOption, setInvestmentOption] = useState('Balanced');
  const [insuranceIncluded, setInsuranceIncluded] = useState(false);
  const [employerContributing, setEmployerContributing] = useState(true);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await financeApi.getSuperAccounts();
      setAccounts(response.data?.data || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load super accounts.');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!fundName.trim() || !balance) {
      setError('Fund name and balance are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await financeApi.addSuperAccount({
        fundName: fundName.trim(),
        memberNumber: memberNumber || undefined,
        balance: Number(balance),
        investmentOpt: investmentOption || undefined,
        insuranceInc: insuranceIncluded,
      });
      setFundName('');
      setMemberNumber('');
      setBalance('');
      setInvestmentOption('Balanced');
      setInsuranceIncluded(false);
      setEmployerContributing(true);
      setShowForm(false);
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Unable to add super account.');
    } finally {
      setSaving(false);
    }
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + toNumber(acc.balance), 0);
  const totalProjected = accounts.reduce((sum, acc) => sum + toNumber(acc.projectedRetirementBalance), 0);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-600">
            <Landmark className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Superannuation</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
            Track your retirement savings
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Combined balance: {formatCurrency(totalBalance)}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add account
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add super account</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={fundName}
              onChange={(e) => setFundName(e.target.value)}
              placeholder="Fund name (e.g. AustralianSuper)"
              className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
            />
            <input
              value={memberNumber}
              onChange={(e) => setMemberNumber(e.target.value)}
              placeholder="Member number (optional)"
              className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
            />
            <input
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              type="number"
              placeholder="Current balance ($)"
              className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
            />
            <select
              value={investmentOption}
              onChange={(e) => setInvestmentOption(e.target.value)}
              className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
            >
              <option value="High Growth">High Growth</option>
              <option value="Balanced">Balanced</option>
              <option value="Conservative">Conservative</option>
              <option value="Indexed">Indexed</option>
              <option value="Ethical">Ethical/Sustainable</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={insuranceIncluded}
                onChange={(e) => setInsuranceIncluded(e.target.checked)}
              />
              Insurance included
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={employerContributing}
                onChange={(e) => setEmployerContributing(e.target.checked)}
              />
              Employer contributing
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="btn-primary">
              {saving ? 'Adding...' : 'Add account'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading super accounts...
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-sm text-gray-500 text-center">
          No super accounts linked yet. Add your super fund to start tracking.
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{account.fundName}</h3>
                  {account.memberNumber && (
                    <p className="text-xs text-gray-500">Member #{account.memberNumber}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(toNumber(account.balance))}</p>
                  <p className="text-xs text-gray-500">Current balance</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Investment</p>
                  <p className="font-medium text-gray-900 dark:text-white">{account.investmentOption || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Insurance</p>
                  <p className="font-medium text-gray-900 dark:text-white">{account.insuranceIncluded ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Employer</p>
                  <p className="font-medium text-gray-900 dark:text-white">{account.employerContributing ? 'Contributing' : 'Not contributing'}</p>
                </div>
                {account.lastStatementDate && (
                  <div>
                    <p className="text-gray-500 text-xs flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> Last statement
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDate(account.lastStatementDate)}</p>
                  </div>
                )}
              </div>

              {account.projectedRetirementBalance && toNumber(account.projectedRetirementBalance) > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Projected at retirement:{' '}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(toNumber(account.projectedRetirementBalance))}
                    </span>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Projected summary */}
      {!loading && accounts.length > 0 && totalProjected > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 dark:bg-emerald-800/50 rounded-full p-3">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">Total projected retirement balance</p>
              <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{formatCurrency(totalProjected)}</p>
            </div>
          </div>
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
