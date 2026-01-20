'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Loader2, Briefcase, Users, DollarSign, Mic, Building, Link2, Check, X } from 'lucide-react';
import { aiAlgorithmsApi } from '@/lib/api';

type Opportunity = {
  id: string;
  opportunityType: string;
  referenceId: string;
  referenceType: string;
  matchScore: number;
  skillsMatch: number;
  salaryFit?: number;
  growthPotential?: number;
  cultureFit?: number;
  matchReasons: Array<{ reason: string; weight: number }>;
  isViewed: boolean;
  viewedAt?: string;
  isInterested?: boolean;
  feedback?: string;
  createdAt: string;
};

const opportunityIcons: Record<string, typeof Briefcase> = {
  JOB: Briefcase,
  MENTORSHIP: Users,
  GRANT: DollarSign,
  SPEAKING: Mic,
  INVESTOR: Building,
  FREELANCE: Link2,
  PARTNERSHIP: Link2,
  BOARD: Building,
};

const opportunityColors: Record<string, string> = {
  JOB: 'from-blue-500 to-blue-600',
  MENTORSHIP: 'from-pink-500 to-rose-600',
  GRANT: 'from-emerald-500 to-green-600',
  SPEAKING: 'from-purple-500 to-violet-600',
  INVESTOR: 'from-amber-500 to-orange-600',
  FREELANCE: 'from-cyan-500 to-teal-600',
  PARTNERSHIP: 'from-indigo-500 to-blue-600',
  BOARD: 'from-gray-500 to-gray-600',
};

export default function OpportunityScanPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showViewed, setShowViewed] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await aiAlgorithmsApi.getOpportunities({
        type: filter || undefined,
        viewed: showViewed ? undefined : false,
      });
      setOpportunities(response.data?.data || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load opportunities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, showViewed]);

  const handleView = async (id: string) => {
    try {
      await aiAlgorithmsApi.markOpportunityViewed(id);
      setOpportunities(prev =>
        prev.map(o => o.id === id ? { ...o, isViewed: true, viewedAt: new Date().toISOString() } : o)
      );
    } catch {
      // Silent fail
    }
  };

  const handleFeedback = async (id: string, isInterested: boolean) => {
    try {
      await aiAlgorithmsApi.submitOpportunityFeedback(id, {
        isInterested,
        feedback: isInterested ? 'INTERESTED' : 'NOT_RELEVANT',
      });
      setOpportunities(prev =>
        prev.map(o => o.id === id ? { ...o, isInterested } : o)
      );
    } catch {
      // Silent fail
    }
  };

  const opportunityTypes = ['JOB', 'MENTORSHIP', 'GRANT', 'SPEAKING', 'INVESTOR', 'FREELANCE', 'PARTNERSHIP', 'BOARD'];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-blue-600">
          <Search className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">OpportunityScan</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
          Your Matched Opportunities
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          AI-surfaced jobs, mentors, grants, and partnerships tailored to your profile
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Type:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All opportunities</option>
            {opportunityTypes.map(type => (
              <option key={type} value={type}>{type.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showViewed}
            onChange={(e) => setShowViewed(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show viewed
        </label>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{opportunities.length}</p>
          <p className="text-xs text-gray-500">Total Matches</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{opportunities.filter(o => !o.isViewed).length}</p>
          <p className="text-xs text-gray-500">New</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{opportunities.filter(o => o.matchScore >= 80).length}</p>
          <p className="text-xs text-gray-500">High Match (80%+)</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-pink-600">{opportunities.filter(o => o.isInterested).length}</p>
          <p className="text-xs text-gray-500">Interested</p>
        </div>
      </div>

      {/* Opportunities List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : opportunities.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No opportunities found</h3>
          <p className="text-sm text-gray-500">Check back later or adjust your filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {opportunities.map((opp) => {
            const Icon = opportunityIcons[opp.opportunityType] || Briefcase;
            const color = opportunityColors[opp.opportunityType] || 'from-gray-500 to-gray-600';

            return (
              <div
                key={opp.id}
                className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 ${
                  !opp.isViewed ? 'ring-2 ring-blue-500/20' : ''
                }`}
                onClick={() => !opp.isViewed && handleView(opp.id)}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                        {opp.opportunityType}
                      </span>
                      {!opp.isViewed && (
                        <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded">
                          NEW
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                      {opp.referenceType} Match
                    </h3>

                    {/* Match Scores */}
                    <div className="flex flex-wrap gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Overall:</span>
                        <span className={`ml-1 font-semibold ${opp.matchScore >= 80 ? 'text-emerald-600' : opp.matchScore >= 60 ? 'text-amber-600' : 'text-gray-600'}`}>
                          {opp.matchScore}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Skills:</span>
                        <span className="ml-1 font-medium text-gray-900 dark:text-white">{opp.skillsMatch}%</span>
                      </div>
                      {opp.salaryFit && (
                        <div>
                          <span className="text-gray-500">Salary:</span>
                          <span className="ml-1 font-medium text-gray-900 dark:text-white">{opp.salaryFit}%</span>
                        </div>
                      )}
                      {opp.growthPotential && (
                        <div>
                          <span className="text-gray-500">Growth:</span>
                          <span className="ml-1 font-medium text-gray-900 dark:text-white">{opp.growthPotential}%</span>
                        </div>
                      )}
                    </div>

                    {/* Match Reasons */}
                    {opp.matchReasons && opp.matchReasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {opp.matchReasons.slice(0, 3).map((reason, idx) => (
                          <span key={idx} className="text-xs px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded">
                            {reason.reason}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      {opp.isInterested === undefined ? (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleFeedback(opp.id, true); }}
                            className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
                          >
                            <Check className="w-4 h-4" /> Interested
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleFeedback(opp.id, false); }}
                            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                          >
                            <X className="w-4 h-4" /> Not relevant
                          </button>
                        </>
                      ) : (
                        <span className={`text-sm ${opp.isInterested ? 'text-emerald-600' : 'text-gray-500'}`}>
                          {opp.isInterested ? '✓ Marked interested' : '✗ Marked not relevant'}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(opp.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center">
        <Link href="/dashboard/ai" className="text-sm text-primary-600 hover:underline">
          ← Back to AI Tools
        </Link>
      </div>
    </div>
  );
}
