'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, RefreshCw, Loader2, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { financeApi } from '@/lib/api';

type HealthScore = {
  id: string;
  overallScore: number;
  savingsScore: number;
  debtScore: number;
  emergencyFundScore: number;
  investmentScore: number;
  insuranceScore: number;
  recommendations: string[];
  calculatedAt: string;
};

const scoreColor = (score: number) => {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
};

const scoreBgColor = (score: number) => {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
};

const scoreLabel = (score: number) => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Needs work';
  return 'Critical';
};

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
};

export default function HealthScorePage() {
  const [score, setScore] = useState<HealthScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await financeApi.getHealthScore();
      setScore(response.data?.data || null);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { error?: string } } };
      // If no score exists, that's okay
      if (error?.response?.status === 404) {
        setScore(null);
      } else {
        setError(error?.response?.data?.error || 'Failed to load financial health score.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecalculate = async () => {
    setRecalculating(true);
    setError(null);
    try {
      const response = await financeApi.recalculateHealthScore();
      setScore(response.data?.data || null);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Unable to recalculate score.');
    } finally {
      setRecalculating(false);
    }
  };

  const scoreComponents = score
    ? [
        { label: 'Savings', value: score.savingsScore, icon: TrendingUp },
        { label: 'Debt management', value: score.debtScore, icon: TrendingDown },
        { label: 'Emergency fund', value: score.emergencyFundScore, icon: AlertCircle },
        { label: 'Investments', value: score.investmentScore, icon: TrendingUp },
        { label: 'Insurance', value: score.insuranceScore, icon: CheckCircle },
      ]
    : [];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-600">
            <Activity className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Health Score</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
            Your financial wellness
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Get a personalized snapshot of your financial health
          </p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="btn-primary inline-flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
          {recalculating ? 'Calculating...' : score ? 'Recalculate' : 'Calculate score'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading your score...
        </div>
      ) : !score ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">No score yet</h2>
          <p className="text-sm text-gray-500 mt-2 mb-6 max-w-md mx-auto">
            Click &ldquo;Calculate score&rdquo; to analyze your financial data and get personalized recommendations.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall score */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
            <div className="relative inline-flex items-center justify-center">
              <svg className="w-40 h-40" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-gray-200 dark:text-gray-700"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${score.overallScore * 2.83} 283`}
                  transform="rotate(-90 50 50)"
                  className={scoreBgColor(score.overallScore)}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className={`text-4xl font-bold ${scoreColor(score.overallScore)}`}>{score.overallScore}</span>
                <span className="text-sm text-gray-500">/ 100</span>
              </div>
            </div>
            <p className={`text-lg font-semibold mt-4 ${scoreColor(score.overallScore)}`}>
              {scoreLabel(score.overallScore)}
            </p>
            <p className="text-xs text-gray-500 mt-2">Last calculated: {formatDate(score.calculatedAt)}</p>
          </div>

          {/* Component scores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {scoreComponents.map((component) => {
              const Icon = component.icon;
              return (
                <div
                  key={component.label}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-4 h-4 ${scoreColor(component.value)}`} />
                    <span className="text-xs text-gray-500">{component.label}</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className={`text-2xl font-bold ${scoreColor(component.value)}`}>{component.value}</span>
                    <span className="text-xs text-gray-400">/ 100</span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${scoreBgColor(component.value)}`}
                      style={{ width: `${component.value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommendations */}
          {score.recommendations && score.recommendations.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Personalized recommendations</h2>
              <ul className="space-y-3">
                {score.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-emerald-600">{idx + 1}</span>
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
