'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PiggyBank, Plus, Loader2, Target, TrendingUp } from 'lucide-react';
import { financeApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

const goalTypes = [
  { value: 'EMERGENCY_FUND', label: 'Emergency fund' },
  { value: 'HOME_DEPOSIT', label: 'Home deposit' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'OTHER', label: 'Other' },
];

type SavingsGoal = {
  id: string;
  name: string;
  type: string;
  targetAmount: string | number;
  currentAmount: string | number;
  targetDate?: string | null;
  monthlyTarget?: string | number | null;
  autoSaveEnabled?: boolean;
  status: string;
  progressPct?: number;
};

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function SavingsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contributingId, setContributingId] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState('EMERGENCY_FUND');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [monthlyTarget, setMonthlyTarget] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await financeApi.getSavingsGoals();
      setGoals(response.data?.data || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load savings goals.');
      setGoals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || !targetAmount) {
      setError('Name and target amount are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await financeApi.createSavingsGoal({
        name: name.trim(),
        type,
        targetAmount: Number(targetAmount),
        targetDate: targetDate || undefined,
        monthlyTarget: monthlyTarget ? Number(monthlyTarget) : undefined,
      });
      setName('');
      setTargetAmount('');
      setTargetDate('');
      setMonthlyTarget('');
      setShowForm(false);
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Unable to create goal.');
    } finally {
      setSaving(false);
    }
  };

  const handleContribute = async (goalId: string) => {
    if (!contributionAmount || Number(contributionAmount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await financeApi.contributeTo(goalId, { amount: Number(contributionAmount) });
      setContributingId(null);
      setContributionAmount('');
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Unable to add contribution.');
    } finally {
      setSaving(false);
    }
  };

  const totalSaved = goals.reduce((sum, goal) => sum + toNumber(goal.currentAmount), 0);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-600">
            <PiggyBank className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Savings</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
            Build your financial safety net
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Total saved: {formatCurrency(totalSaved)}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> New goal
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create savings goal</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Goal name"
              className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
            />
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
            >
              {goalTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              value={targetAmount}
              onChange={(event) => setTargetAmount(event.target.value)}
              type="number"
              placeholder="Target amount ($)"
              className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
            />
            <input
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              type="date"
              className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
            />
            <input
              value={monthlyTarget}
              onChange={(event) => setMonthlyTarget(event.target.value)}
              type="number"
              placeholder="Monthly target (optional)"
              className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="btn-primary">
              {saving ? 'Creating...' : 'Create goal'}
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
          Loading goals...
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-sm text-gray-500 text-center">
          No savings goals yet. Create one to start tracking your progress!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const current = toNumber(goal.currentAmount);
            const target = toNumber(goal.targetAmount);
            const progress = goal.progressPct ?? (target > 0 ? Math.round((current / target) * 100) : 0);

            return (
              <div key={goal.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
                    <p className="text-xs text-gray-500">{goal.type.replace('_', ' ')}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    goal.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-primary-50 text-primary-700'
                  }`}>
                    {goal.status}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>{formatCurrency(current)} saved</span>
                    <span className="text-gray-500">of {formatCurrency(target)}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-emerald-500 h-3 rounded-full transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{progress}% complete</p>
                </div>

                {goal.targetDate && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Target className="w-3 h-3" /> Target date: {formatDate(goal.targetDate)}
                  </p>
                )}

                {contributingId === goal.id ? (
                  <div className="flex gap-2">
                    <input
                      value={contributionAmount}
                      onChange={(event) => setContributionAmount(event.target.value)}
                      type="number"
                      placeholder="Amount"
                      className="flex-1 bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => handleContribute(goal.id)}
                      disabled={saving}
                      className="btn-primary"
                    >
                      {saving ? '...' : 'Add'}
                    </button>
                    <button onClick={() => setContributingId(null)} className="btn-secondary">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setContributingId(goal.id)}
                    className="btn-secondary w-full inline-flex items-center justify-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4" /> Add contribution
                  </button>
                )}
              </div>
            );
          })}
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
