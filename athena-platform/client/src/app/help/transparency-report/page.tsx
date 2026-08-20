/**
 * Transparency Report Page
 * UK Online Safety Act Compliance
 * Phase 4: UK/EU Market Launch
 */

'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Shield, AlertTriangle, Users, Clock, TrendingUp, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

interface ReportMetrics {
  period: string;
  startDate?: string;
  endDate?: string;
  publishedAt?: string;
  totalReports: number;
  byCategory: {
    illegal: number;
    harmful: number;
    harassment: number;
    hate_speech: number;
    spam: number;
    misinformation: number;
    csam: number;
    terrorism: number;
    fraud: number;
    other: number;
  };
  actions: {
    contentRemoved: number;
    accountsSuspended: number;
    accountsBanned: number;
    warnings: number;
    noAction: number;
  };
  timing: {
    avgResponseHours: number;
    under24Hours: number;
    under72Hours: number;
    over72Hours: number;
  };
  appeals: {
    total: number;
    upheld: number;
    overturned: number;
    pending: number;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  illegal: 'Illegal Content',
  harmful: 'Harmful Content',
  harassment: 'Harassment',
  hate_speech: 'Hate Speech',
  spam: 'Spam',
  misinformation: 'Misinformation',
  csam: 'CSAM',
  terrorism: 'Terrorism',
  fraud: 'Fraud',
  other: 'Other',
};

export default function TransparencyReportPage() {
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');
  const [reportData, setReportData] = useState<ReportMetrics | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTransparencyReport() {
      setIsLoadingReport(true);
      setReportError(null);

      try {
        const response = await fetch('/api/compliance/transparency-report', {
          credentials: 'include',
          cache: 'no-store',
        });
        const payload = await response.json();

        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error || 'Unable to load transparency report.');
        }

        if (!cancelled) {
          setReportData(payload?.data ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setReportData(null);
          setReportError(error instanceof Error ? error.message : 'Unable to load transparency report.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingReport(false);
        }
      }
    }

    loadTransparencyReport();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getPercentage = (value: number, total: number) => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  };

  const getBarWidth = (value: number, total: number) => {
    return total > 0 ? `${(value / total) * 100}%` : '0%';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-rose-50/40 to-white text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-white">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mx-auto w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-6">
            <FileText className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Transparency Report
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            We believe in being open about how we moderate content and protect our community. 
            {reportData
              ? ` This report details our content moderation activities for ${reportData.period}.`
              : ' Published transparency metrics will appear here after formal review.'}
          </p>
        </div>

        {/* UK Online Safety Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                UK Online Safety Act 2023 Compliance
              </h3>
              <p className="text-blue-800 dark:text-blue-200">
                This transparency report is published in accordance with the UK Online Safety Act 2023. 
                We are committed to providing clear information about how we handle reports of harmful content 
                and protect users from online harms.
              </p>
            </div>
          </div>
        </div>

        {isLoadingReport ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm font-medium text-slate-900 dark:text-white">Loading transparency report...</p>
          </div>
        ) : reportError ? (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-100">
            <h2 className="font-semibold">Transparency report unavailable</h2>
            <p className="mt-2 text-sm">{reportError}</p>
          </div>
        ) : !reportData ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <FileText className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">No published transparency report yet</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              ATHENA will publish moderation metrics here after a reviewed reporting period is approved for release.
            </p>
          </div>
        ) : (
          <>
        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Total Reports</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{reportData.totalReports.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-5 h-5 text-green-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Content Removed</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{reportData.actions.contentRemoved.toLocaleString()}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Avg Response</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{reportData.timing.avgResponseHours}h</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Appeal Rate</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {getPercentage(reportData.appeals.total, reportData.actions.contentRemoved)}%
            </p>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-4">
          {/* Reports by Category */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => toggleSection('categories')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span className="font-semibold text-slate-900 dark:text-white">Reports by Category</span>
              </div>
              {expandedSection === 'categories' ? (
                <ChevronUp className="w-5 h-5 text-slate-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500" />
              )}
            </button>
            {expandedSection === 'categories' && (
              <div className="px-6 pb-6">
                <div className="space-y-3">
                  {Object.entries(reportData.byCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, count]) => (
                      <div key={category} className="flex items-center gap-4">
                        <span className="w-32 text-sm text-slate-600 dark:text-slate-400">
                          {CATEGORY_LABELS[category]}
                        </span>
                        <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                          <div
                            className="bg-purple-600 h-full rounded-full transition-all"
                            style={{ width: getBarWidth(count, reportData.totalReports) }}
                          />
                        </div>
                        <span className="w-20 text-right text-sm font-medium text-slate-900 dark:text-white">
                          {count} ({getPercentage(count, reportData.totalReports)}%)
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions Taken */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => toggleSection('actions')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="font-semibold text-slate-900 dark:text-white">Actions Taken</span>
              </div>
              {expandedSection === 'actions' ? (
                <ChevronUp className="w-5 h-5 text-slate-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500" />
              )}
            </button>
            {expandedSection === 'actions' && (
              <div className="px-6 pb-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {reportData.actions.contentRemoved}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Content Removed</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {reportData.actions.accountsSuspended}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Accounts Suspended</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {reportData.actions.accountsBanned}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Accounts Banned</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {reportData.actions.warnings}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Warnings Issued</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                      {reportData.actions.noAction}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">No Action</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Response Times */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => toggleSection('timing')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="font-semibold text-slate-900 dark:text-white">Response Times</span>
              </div>
              {expandedSection === 'timing' ? (
                <ChevronUp className="w-5 h-5 text-slate-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500" />
              )}
            </button>
            {expandedSection === 'timing' && (
              <div className="px-6 pb-6">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {reportData.timing.under24Hours}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Resolved &lt;24 hours</p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {getPercentage(reportData.timing.under24Hours, reportData.totalReports)}%
                    </p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {reportData.timing.under72Hours}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Resolved 24-72 hours</p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      {getPercentage(reportData.timing.under72Hours, reportData.totalReports)}%
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {reportData.timing.over72Hours}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Resolved &gt;72 hours</p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {getPercentage(reportData.timing.over72Hours, reportData.totalReports)}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Appeals */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => toggleSection('appeals')}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <span className="font-semibold text-slate-900 dark:text-white">Appeals</span>
              </div>
              {expandedSection === 'appeals' ? (
                <ChevronUp className="w-5 h-5 text-slate-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500" />
              )}
            </button>
            {expandedSection === 'appeals' && (
              <div className="px-6 pb-6">
                <div className="grid sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {reportData.appeals.total}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Appeals</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {reportData.appeals.upheld}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Decision Upheld</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {reportData.appeals.overturned}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Overturned</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {reportData.appeals.pending}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Pending Review</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                  Our appeal overturn rate of {getPercentage(reportData.appeals.overturned, reportData.appeals.total)}% 
                  reflects our commitment to fair content moderation and willingness to correct errors.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Methodology */}
        <div className="mt-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Methodology</h2>
          <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400">
            <p>
              This report covers content moderation activities for {reportData.period}. All data is
              collected from our internal moderation systems and represents actions taken in response
              to both user reports and proactive detection systems.
            </p>
            <p className="mt-4">
              <strong>Definitions:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Content Removed:</strong> Posts, comments, or other content permanently removed from the platform</li>
              <li><strong>Accounts Suspended:</strong> Temporary restrictions placed on accounts (typically 7-30 days)</li>
              <li><strong>Accounts Banned:</strong> Permanent removal of accounts from the platform</li>
              <li><strong>Warnings:</strong> Formal notices sent to users about policy violations</li>
              <li><strong>No Action:</strong> Reports reviewed but found not to violate our policies</li>
            </ul>
          </div>
        </div>
          </>
        )}

        {/* Footer Links */}
        <div className="mt-12 flex flex-wrap gap-4 justify-center">
          <Link
            href="/report"
            className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Report Content
          </Link>
          <Link
            href="/help/community-guidelines"
            className="inline-flex items-center px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <FileText className="w-4 h-4 mr-2" />
            Community Guidelines
          </Link>
          <Link
            href="/help/appeal"
            className="inline-flex items-center px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Users className="w-4 h-4 mr-2" />
            Appeal a Decision
          </Link>
        </div>
      </div>
    </div>
  );
}
