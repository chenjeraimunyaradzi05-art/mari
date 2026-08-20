'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Radar,
  Sparkles,
  MapPin,
  DollarSign,
  Building2,
  Clock,
  TrendingUp,
  Star,
  ExternalLink,
  Filter,
  RefreshCw,
  Briefcase,
  Target,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { useScanOpportunities } from '@/lib/hooks';
import { cn, formatSalary, JOB_TYPE_LABELS } from '@/lib/utils';

interface Opportunity {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  salary: { min: number; max: number };
  type: string;
  matchScore: number;
  matchReasons: string[];
  skills: string[];
  postedAt: string;
  url?: string;
}

export default function OpportunityRadarPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    minMatch: 70,
    remoteOnly: false,
    includePartTime: false,
  });

  const { mutate: scanOpportunities, isPending } = useScanOpportunities();

  const handleScan = () => {
    setIsScanning(true);
    setScanError(null);
    
    scanOpportunities(
      { filters },
      {
        onSuccess: (data) => {
          const normalized = Array.isArray(data?.opportunities)
            ? data.opportunities
            : Array.isArray(data?.jobs)
              ? data.jobs.map((job: any) => ({
                  id: job.id,
                  title: job.title,
                  company: job.organization?.name || 'Independent employer',
                  companyLogo: job.organization?.logo || undefined,
                  location: [
                    job.city,
                    job.state,
                    job.country,
                  ].filter(Boolean).join(', ') || 'Location not specified',
                  salary: {
                    min: job.showSalary ? job.salaryMin || 0 : 0,
                    max: job.showSalary ? job.salaryMax || job.salaryMin || 0 : 0,
                  },
                  type: job.type,
                  matchScore: job.matchScore || 0,
                  matchReasons: job.matchedSkills?.length
                    ? job.matchedSkills.map((skill: string) => `Matches ${skill}`)
                    : ['Profile and role requirements are aligned'],
                  skills: job.skills?.map((item: any) => item.skill?.name).filter(Boolean) || [],
                  postedAt: job.publishedAt
                    ? new Date(job.publishedAt).toLocaleDateString()
                    : new Date(job.createdAt).toLocaleDateString(),
                }))
              : [];
          setOpportunities(normalized);
          setIsScanning(false);
        },
        onError: (error: any) => {
          setScanError(
            error?.response?.data?.message ||
              'Opportunity scan is unavailable right now. Please try again later.'
          );
          setOpportunities([]);
          setIsScanning(false);
        },
      }
    );
  };

  const visibleOpportunities = opportunities
    .filter((opp) => opp.matchScore >= filters.minMatch)
    .sort((a, b) => b.matchScore - a.matchScore);
  const salaryRanges = visibleOpportunities.filter((opp) => opp.salary.min || opp.salary.max);
  const averageSalary =
    salaryRanges.length > 0
      ? Math.round(
          salaryRanges.reduce(
            (sum, opp) => sum + ((opp.salary.min || opp.salary.max) + (opp.salary.max || opp.salary.min)) / 2,
            0
          ) / salaryRanges.length
        )
      : 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/ai"
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <span className="text-3xl">🎯</span>
            <span>Opportunity Radar</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            AI-powered job matching based on your profile and preferences
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
            <Radar className="w-5 h-5 text-primary-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {opportunities.length}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Opportunities Found
          </div>
        </div>
        <div className="card text-center">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
            <Target className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {opportunities.filter((o) => o.matchScore >= 80).length}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            High Match (80%+)
          </div>
        </div>
        <div className="card text-center">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {opportunities.filter((o) => o.postedAt.includes('hour')).length}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            New Today
          </div>
        </div>
        <div className="card text-center">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
            <DollarSign className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {averageSalary > 0 ? formatSalary(averageSalary) : 'N/A'}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Avg Salary
          </div>
        </div>
      </div>

      {/* Scan Controls */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Scan Settings
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Customize your opportunity search
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* Min Match Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">
                Min Match:
              </label>
              <select
                value={filters.minMatch}
                onChange={(e) =>
                  setFilters({ ...filters, minMatch: Number(e.target.value) })
                }
                className="border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm px-2 py-1"
              >
                <option value={50}>50%</option>
                <option value={60}>60%</option>
                <option value={70}>70%</option>
                <option value={80}>80%</option>
                <option value={90}>90%</option>
              </select>
            </div>

            {/* Remote Toggle */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.remoteOnly}
                onChange={(e) =>
                  setFilters({ ...filters, remoteOnly: e.target.checked })
                }
                className="w-4 h-4 text-primary-500 rounded"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Remote Only
              </span>
            </label>

            <button
              onClick={handleScan}
              disabled={isScanning || isPending}
              className="btn-primary flex items-center space-x-2"
            >
              {isScanning || isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Radar className="w-4 h-4" />
                  <span>Scan Opportunities</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Opportunities List */}
      {opportunities.length === 0 && !isScanning ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Radar className="w-8 h-8 text-primary-500" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            {scanError ? 'Scan Could Not Complete' : 'Ready to Find Your Next Opportunity'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
            {scanError ||
              'Click "Scan Opportunities" to discover jobs that match your skills, experience, and career goals'}
          </p>
          <button onClick={handleScan} className="btn-primary">
            <Radar className="w-4 h-4 mr-2" />
            {scanError ? 'Try Again' : 'Start Scanning'}
          </button>
        </div>
      ) : isScanning || isPending ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Zap className="w-8 h-8 text-primary-500" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            Scanning Opportunities
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            Analyzing job listings and matching them to your profile...
          </p>
          <div className="mt-6 flex items-center justify-center space-x-4 text-sm text-slate-500">
            <span className="flex items-center">
              <CheckCircle2 className="w-4 h-4 text-green-500 mr-1" />
              Profile analyzed
            </span>
            <span className="flex items-center">
              <RefreshCw className="w-4 h-4 animate-spin mr-1" />
              Matching jobs...
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleOpportunities.length === 0 ? (
            <div className="card text-center py-12">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Filter className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                No Matches With These Filters
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                Lower the minimum match score or broaden your scan settings.
              </p>
            </div>
          ) : (
            visibleOpportunities.map((opportunity) => (
              <div
                key={opportunity.id}
                className="card hover:border-primary-200 dark:hover:border-primary-800 transition"
              >
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Company Info */}
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      {opportunity.companyLogo ? (
                        <img
                          src={opportunity.companyLogo}
                          alt={opportunity.company}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Building2 className="w-7 h-7 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
                        {opportunity.title}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400">
                        {opportunity.company}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500 dark:text-slate-400">
                        <span className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {opportunity.location}
                        </span>
                        <span className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-0.5" />
                          {formatSalary(opportunity.salary.min)} - {formatSalary(opportunity.salary.max)}
                        </span>
                        <span className="flex items-center">
                          <Briefcase className="w-4 h-4 mr-1" />
                          {JOB_TYPE_LABELS[opportunity.type] || opportunity.type}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {opportunity.postedAt}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Match Score */}
                  <div className="flex items-center lg:flex-col lg:items-end gap-4">
                    <div
                      className={cn(
                        'flex items-center space-x-2 px-4 py-2 rounded-full',
                        opportunity.matchScore >= 90
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : opportunity.matchScore >= 80
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      )}
                    >
                      <Star className="w-4 h-4" />
                      <span className="font-semibold">{opportunity.matchScore}% Match</span>
                    </div>
                    <Link
                      href={opportunity.url || `/dashboard/jobs/${opportunity.id}`}
                      className="btn-primary text-sm flex items-center space-x-1"
                    >
                      <span>View Job</span>
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Match Reasons & Skills */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Match Reasons */}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Why you match:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {opportunity.matchReasons.map((reason, i) => (
                          <span
                            key={i}
                            className="flex items-center text-xs px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Required Skills */}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Key skills:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {opportunity.skills.map((skill, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pro Tips */}
      <div className="card bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 border-primary-200 dark:border-primary-800">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
          🚀 Improve Your Match Score
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
            <span>Complete your profile with detailed work experience</span>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
            <span>Add relevant skills and certifications</span>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
            <span>Update your career preferences and salary expectations</span>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
            <span>Enable location preferences for better local matches</span>
          </div>
        </div>
      </div>
    </div>
  );
}
