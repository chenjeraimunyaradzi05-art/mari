'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2, TrendingUp, Users, Briefcase, Home, GraduationCap, DollarSign } from 'lucide-react';
import { impactApi } from '@/lib/api';

type ImpactReport = {
  id: string;
  reportPeriod: string;
  communityType?: string;
  region: string;
  totalUsersSupported: number;
  employmentGained: number;
  avgIncomeIncrease?: string | number;
  housingSecured: number;
  qualificationsObtained: number;
  businessesStarted: number;
  safetyAchieved: number;
  totalEconomicImpact?: string | number;
  narrativeSummary?: string;
};

const communityTypeLabels: Record<string, string> = {
  FIRST_NATIONS: 'First Nations',
  REFUGEE_IMMIGRANT: 'Refugee & Immigrant',
  DV_SURVIVOR: 'DV Survivor',
  DISABILITY: 'Disability',
  LGBTQIA: 'LGBTQIA+',
  SINGLE_PARENT: 'Single Parent',
  RURAL_REGIONAL: 'Rural & Regional',
  GENERAL: 'All Communities',
};

const formatCurrency = (value?: string | number) => {
  if (!value) return '$0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(num);
};

export default function ReportsPage() {
  const [reports, setReports] = useState<ImpactReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCommunity, setFilterCommunity] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await impactApi.getReports({
        communityType: filterCommunity || undefined,
      });
      setReports(response.data?.data || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCommunity]);

  // Aggregate stats across all reports
  const aggregateStats = reports.reduce(
    (acc, report) => ({
      totalUsers: acc.totalUsers + report.totalUsersSupported,
      employment: acc.employment + report.employmentGained,
      housing: acc.housing + report.housingSecured,
      qualifications: acc.qualifications + report.qualificationsObtained,
      businesses: acc.businesses + report.businessesStarted,
      safety: acc.safety + report.safetyAchieved,
      economicImpact: acc.economicImpact + (parseFloat(String(report.totalEconomicImpact || 0)) || 0),
    }),
    { totalUsers: 0, employment: 0, housing: 0, qualifications: 0, businesses: 0, safety: 0, economicImpact: 0 }
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-indigo-600">
          <FileText className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Impact Reports</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
          Community Impact & Outcomes
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Tracking real outcomes for women across all communities
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Users Supported</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {aggregateStats.totalUsers.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <Briefcase className="w-4 h-4" />
            <span className="text-xs font-medium">Jobs Gained</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {aggregateStats.employment.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Home className="w-4 h-4" />
            <span className="text-xs font-medium">Housing Secured</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {aggregateStats.housing.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium">Economic Impact</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(aggregateStats.economicImpact)}
          </p>
        </div>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 text-center">
          <GraduationCap className="w-6 h-6 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">{aggregateStats.qualifications.toLocaleString()}</p>
          <p className="text-xs text-purple-600 dark:text-purple-400">Qualifications Obtained</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center">
          <TrendingUp className="w-6 h-6 text-amber-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">{aggregateStats.businesses.toLocaleString()}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">Businesses Started</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
          <Users className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-red-800 dark:text-red-200">{aggregateStats.safety.toLocaleString()}</p>
          <p className="text-xs text-red-600 dark:text-red-400">Achieved Safety</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-gray-600 dark:text-gray-400">Filter by community:</label>
        <select
          value={filterCommunity}
          onChange={(e) => setFilterCommunity(e.target.value)}
          className="bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
        >
          <option value="">All communities</option>
          {Object.entries(communityTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading reports...
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center text-sm text-gray-500">
          No impact reports available for this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{report.reportPeriod}</h3>
                  <p className="text-xs text-gray-500">
                    {report.communityType ? communityTypeLabels[report.communityType] : 'All Communities'} • {report.region}
                  </p>
                </div>
                {report.totalEconomicImpact && (
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(report.totalEconomicImpact)}</p>
                    <p className="text-xs text-gray-500">Total economic impact</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Users supported</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{report.totalUsersSupported.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Employment gained</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{report.employmentGained.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Housing secured</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{report.housingSecured.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Qualifications</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{report.qualificationsObtained.toLocaleString()}</p>
                </div>
              </div>

              {report.narrativeSummary && (
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-800 pt-4">
                  {report.narrativeSummary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-center">
        <Link href="/dashboard/impact" className="text-sm text-primary-600 hover:underline">
          ← Back to Impact Hub
        </Link>
      </div>
    </div>
  );
}
