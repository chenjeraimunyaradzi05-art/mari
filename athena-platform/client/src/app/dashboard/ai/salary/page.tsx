'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DollarSign, Loader2, TrendingUp, AlertTriangle, Lightbulb, BarChart3, Send } from 'lucide-react';
import { aiAlgorithmsApi } from '@/lib/api';

type SalaryAnalysis = {
  id: string;
  targetRole: string;
  targetLocation?: string;
  marketMedian: string | number;
  userPercentile?: number;
  genderGapAmount?: string | number;
  genderGapPercent?: number;
  sampleSize: number;
  salaryBands: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  negotiationTips?: Array<{ tip: string; priority: number }>;
  generatedAt: string;
};

export default function SalaryEquityPage() {
  const [analyses, setAnalyses] = useState<SalaryAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Analysis form
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');

  // Contribution form
  const [showContribute, setShowContribute] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [contributeForm, setContributeForm] = useState({
    jobTitle: '',
    company: '',
    city: '',
    baseSalary: '',
    yearsExperience: '',
    gender: '',
  });

  const loadAnalyses = async () => {
    setLoading(true);
    try {
      const response = await aiAlgorithmsApi.getMySalaryAnalyses();
      setAnalyses(response.data?.data || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load analyses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyses();
  }, []);

  const handleAnalyze = async () => {
    if (!role) {
      setError('Please enter a role to analyze');
      return;
    }

    setAnalyzing(true);
    setError(null);
    try {
      const response = await aiAlgorithmsApi.analyzeSalary({
        role,
        location: location || undefined,
      });

      if (response.data?.data) {
        setAnalyses(prev => [response.data.data, ...prev]);
        setRole('');
        setLocation('');
      } else {
        setError(response.data?.message || 'Insufficient data for analysis');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to analyze salary');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleContribute = async () => {
    if (!contributeForm.jobTitle || !contributeForm.baseSalary) {
      setError('Job title and base salary are required');
      return;
    }

    setContributing(true);
    setError(null);
    try {
      await aiAlgorithmsApi.submitSalaryData({
        jobTitle: contributeForm.jobTitle,
        company: contributeForm.company || undefined,
        city: contributeForm.city || undefined,
        baseSalary: parseFloat(contributeForm.baseSalary),
        yearsExperience: contributeForm.yearsExperience ? parseInt(contributeForm.yearsExperience) : undefined,
        gender: contributeForm.gender || undefined,
      });

      setSuccess('Thank you! Your anonymous salary data has been submitted.');
      setShowContribute(false);
      setContributeForm({
        jobTitle: '',
        company: '',
        city: '',
        baseSalary: '',
        yearsExperience: '',
        gender: '',
      });

      setTimeout(() => setSuccess(null), 5000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to submit salary data');
    } finally {
      setContributing(false);
    }
  };

  const formatCurrency = (value?: string | number) => {
    if (!value) return '$0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-emerald-600">
          <DollarSign className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">SalaryEquity</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
          Pay Gap Analysis & Negotiation
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Know your worth. Detect gender pay gaps. Get negotiation coaching.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {success && (
        <div className="bg-emerald-50 text-emerald-600 p-4 rounded-lg text-sm">{success}</div>
      )}

      {/* Analysis Form */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          Analyze Market Salary
        </h2>
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Job title (e.g., Software Engineer)"
            className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent"
          />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className="md:w-48 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent"
          />
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !role}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4" />
                Analyze
              </>
            )}
          </button>
        </div>
      </div>

      {/* Contribute Section */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-1">
              Help close the pay gap
            </h3>
            <p className="text-sm text-purple-600 dark:text-purple-400">
              Anonymously contribute your salary data to help other women negotiate fair pay.
            </p>
          </div>
          <button
            onClick={() => setShowContribute(!showContribute)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
          >
            <Send className="w-4 h-4 inline mr-1" />
            Contribute
          </button>
        </div>

        {showContribute && (
          <div className="mt-6 pt-6 border-t border-purple-200 dark:border-purple-800">
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                value={contributeForm.jobTitle}
                onChange={(e) => setContributeForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                placeholder="Job title *"
                className="px-4 py-2 border border-purple-200 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-900"
              />
              <input
                type="text"
                value={contributeForm.company}
                onChange={(e) => setContributeForm(prev => ({ ...prev, company: e.target.value }))}
                placeholder="Company (optional)"
                className="px-4 py-2 border border-purple-200 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-900"
              />
              <input
                type="number"
                value={contributeForm.baseSalary}
                onChange={(e) => setContributeForm(prev => ({ ...prev, baseSalary: e.target.value }))}
                placeholder="Base salary (AUD) *"
                className="px-4 py-2 border border-purple-200 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-900"
              />
              <input
                type="text"
                value={contributeForm.city}
                onChange={(e) => setContributeForm(prev => ({ ...prev, city: e.target.value }))}
                placeholder="City (optional)"
                className="px-4 py-2 border border-purple-200 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-900"
              />
              <input
                type="number"
                value={contributeForm.yearsExperience}
                onChange={(e) => setContributeForm(prev => ({ ...prev, yearsExperience: e.target.value }))}
                placeholder="Years of experience (optional)"
                className="px-4 py-2 border border-purple-200 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-900"
              />
              <select
                value={contributeForm.gender}
                onChange={(e) => setContributeForm(prev => ({ ...prev, gender: e.target.value }))}
                className="px-4 py-2 border border-purple-200 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-900"
              >
                <option value="">Gender (optional)</option>
                <option value="WOMAN">Woman</option>
                <option value="MAN">Man</option>
                <option value="NON_BINARY">Non-binary</option>
                <option value="PREFER_NOT">Prefer not to say</option>
              </select>
            </div>
            <button
              onClick={handleContribute}
              disabled={contributing}
              className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {contributing ? 'Submitting...' : 'Submit Anonymously'}
            </button>
          </div>
        )}
      </div>

      {/* Recent Analyses */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Your Salary Analyses
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : analyses.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
            <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No analyses yet</h3>
            <p className="text-sm text-gray-500">Enter a role above to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{analysis.targetRole}</h3>
                    {analysis.targetLocation && (
                      <p className="text-sm text-gray-500">{analysis.targetLocation}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(analysis.generatedAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Salary Bands */}
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">Salary distribution (n={analysis.sampleSize})</p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">10th</span>
                    <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded-full relative overflow-hidden">
                      <div
                        className="absolute h-full bg-gradient-to-r from-emerald-300 to-emerald-500 rounded-full"
                        style={{ left: '10%', right: '10%' }}
                      />
                      <div
                        className="absolute h-full w-1 bg-emerald-700"
                        style={{ left: '50%' }}
                      />
                    </div>
                    <span className="text-gray-500">90th</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{formatCurrency(analysis.salaryBands.p10)}</span>
                    <span className="font-semibold text-emerald-600">{formatCurrency(analysis.salaryBands.p50)} median</span>
                    <span>{formatCurrency(analysis.salaryBands.p90)}</span>
                  </div>
                </div>

                {/* Gender Gap */}
                {analysis.genderGapPercent !== null && analysis.genderGapPercent !== undefined && (
                  <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mb-4">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        Gender Pay Gap Detected: {analysis.genderGapPercent.toFixed(1)}%
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Women earn {formatCurrency(analysis.genderGapAmount)} less on average in this role
                      </p>
                    </div>
                  </div>
                )}

                {/* Negotiation Tips */}
                {analysis.negotiationTips && analysis.negotiationTips.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-1">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      Negotiation Tips
                    </p>
                    <ul className="space-y-1">
                      {analysis.negotiationTips.map((tip, idx) => (
                        <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                          <span className="text-emerald-600 font-medium">{idx + 1}.</span>
                          {tip.tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-center">
        <Link href="/dashboard/ai" className="text-sm text-primary-600 hover:underline">
          ← Back to AI Tools
        </Link>
      </div>
    </div>
  );
}
