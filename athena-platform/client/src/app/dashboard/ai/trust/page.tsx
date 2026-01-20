'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, Loader2, BadgeCheck, AlertTriangle, Flag, Award, Star } from 'lucide-react';
import { aiAlgorithmsApi } from '@/lib/api';

type TrustScore = {
  id: string;
  userId: string;
  trustScore: number;
  identityVerified: boolean;
  identityScore: number;
  accountAge: number;
  accountAgeScore: number;
  communityFeedback: number;
  engagementScore: number;
  professionalScore: number;
  badges: string[];
  warningsCount: number;
  suspensionsCount: number;
  reportsAgainst: number;
  reportsSubmitted: number;
  reportAccuracy?: number;
};

const badgeInfo: Record<string, { label: string; icon: typeof BadgeCheck; color: string }> = {
  VERIFIED_IDENTITY: { label: 'Verified Identity', icon: BadgeCheck, color: 'text-blue-600 bg-blue-100' },
  EMPLOYER_VERIFIED: { label: 'Employer Verified', icon: Award, color: 'text-purple-600 bg-purple-100' },
  EDUCATOR_VERIFIED: { label: 'Educator Verified', icon: Award, color: 'text-indigo-600 bg-indigo-100' },
  MENTOR_CERTIFIED: { label: 'Certified Mentor', icon: Star, color: 'text-amber-600 bg-amber-100' },
  CREATOR_VERIFIED: { label: 'Verified Creator', icon: Star, color: 'text-pink-600 bg-pink-100' },
};

export default function TrustScorePage() {
  const [trustScore, setTrustScore] = useState<TrustScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Report form
  const [showReport, setShowReport] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportForm, setReportForm] = useState({
    contentType: 'PROFILE',
    contentId: '',
    reportedUserId: '',
    reason: '',
    description: '',
  });

  const loadTrustScore = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await aiAlgorithmsApi.getMyTrustScore();
      setTrustScore(response.data?.data);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load trust score');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrustScore();
  }, []);

  const handleReport = async () => {
    if (!reportForm.contentId || !reportForm.reportedUserId || !reportForm.reason) {
      setError('Please fill in all required fields');
      return;
    }

    setReporting(true);
    setError(null);
    try {
      await aiAlgorithmsApi.reportContent({
        contentType: reportForm.contentType,
        contentId: reportForm.contentId,
        reportedUserId: reportForm.reportedUserId,
        reason: reportForm.reason,
        description: reportForm.description,
      });

      setShowReport(false);
      setReportForm({
        contentType: 'PROFILE',
        contentId: '',
        reportedUserId: '',
        reason: '',
        description: '',
      });
      // Refresh trust score to show updated reports submitted
      loadTrustScore();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to submit report');
    } finally {
      setReporting(false);
    }
  };

  const getTrustLevel = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'text-emerald-600' };
    if (score >= 60) return { label: 'Good', color: 'text-blue-600' };
    if (score >= 40) return { label: 'Fair', color: 'text-amber-600' };
    return { label: 'Building', color: 'text-gray-600' };
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-amber-600">
          <Shield className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">SafetyScore</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
          Trust & Safety Profile
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Build credibility, verify your identity, and stay protected
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        </div>
      ) : trustScore ? (
        <>
          {/* Main Trust Score */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Score Circle */}
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-gray-100 dark:text-gray-800"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={440}
                    strokeDashoffset={440 - (440 * trustScore.trustScore) / 100}
                    strokeLinecap="round"
                    className="text-amber-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">{trustScore.trustScore}</span>
                  <span className={`text-sm font-medium ${getTrustLevel(trustScore.trustScore).color}`}>
                    {getTrustLevel(trustScore.trustScore).label}
                  </span>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="flex-1 space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Score Components</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Identity Verification</span>
                    <span className="font-medium text-gray-900 dark:text-white">+{trustScore.identityScore}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Account Age ({trustScore.accountAge} days)</span>
                    <span className="font-medium text-gray-900 dark:text-white">+{trustScore.accountAgeScore}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Community Feedback</span>
                    <span className="font-medium text-gray-900 dark:text-white">{trustScore.communityFeedback}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Engagement Authenticity</span>
                    <span className="font-medium text-gray-900 dark:text-white">{trustScore.engagementScore}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Professional Verification</span>
                    <span className="font-medium text-gray-900 dark:text-white">+{trustScore.professionalScore}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Badges</h2>
            {trustScore.badges.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 text-center">
                <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No badges earned yet</p>
                <p className="text-sm text-gray-400 mt-1">Complete verifications to earn trust badges</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {trustScore.badges.map((badge) => {
                  const info = badgeInfo[badge];
                  if (!info) return null;
                  const Icon = info.icon;
                  return (
                    <div
                      key={badge}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full ${info.color}`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium text-sm">{info.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Available Badges */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Earn More Badges</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(badgeInfo).map(([key, info]) => {
                const hasBadge = trustScore.badges.includes(key);
                const Icon = info.icon;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      hasBadge
                        ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                        : 'bg-white/50 dark:bg-gray-900/50 border-dashed border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasBadge ? info.color : 'bg-gray-100 text-gray-400'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`font-medium text-sm ${hasBadge ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                        {info.label}
                      </p>
                      <p className="text-xs text-gray-400">
                        {hasBadge ? '✓ Earned' : 'Not yet earned'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Moderation History */}
          {(trustScore.warningsCount > 0 || trustScore.reportsAgainst > 0) && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Account Notices
              </h3>
              <div className="space-y-2 text-sm">
                {trustScore.warningsCount > 0 && (
                  <p className="text-red-700 dark:text-red-300">
                    {trustScore.warningsCount} warning(s) on your account
                  </p>
                )}
                {trustScore.reportsAgainst > 0 && (
                  <p className="text-red-700 dark:text-red-300">
                    {trustScore.reportsAgainst} report(s) filed against you
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Report Section */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Report Content</h3>
                <p className="text-sm text-gray-500">Help keep ATHENA safe for everyone</p>
              </div>
              <button
                onClick={() => setShowReport(!showReport)}
                className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200"
              >
                <Flag className="w-4 h-4 inline mr-1" />
                Report
              </button>
            </div>

            {showReport && (
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="grid md:grid-cols-2 gap-4">
                  <select
                    value={reportForm.contentType}
                    onChange={(e) => setReportForm(prev => ({ ...prev, contentType: e.target.value }))}
                    className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent"
                  >
                    <option value="PROFILE">Profile</option>
                    <option value="MESSAGE">Message</option>
                    <option value="VIDEO">Video</option>
                    <option value="COMMENT">Comment</option>
                    <option value="STATUS">Status</option>
                  </select>
                  <input
                    type="text"
                    value={reportForm.contentId}
                    onChange={(e) => setReportForm(prev => ({ ...prev, contentId: e.target.value }))}
                    placeholder="Content ID *"
                    className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent"
                  />
                  <input
                    type="text"
                    value={reportForm.reportedUserId}
                    onChange={(e) => setReportForm(prev => ({ ...prev, reportedUserId: e.target.value }))}
                    placeholder="User ID *"
                    className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent"
                  />
                  <select
                    value={reportForm.reason}
                    onChange={(e) => setReportForm(prev => ({ ...prev, reason: e.target.value }))}
                    className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent"
                  >
                    <option value="">Select reason *</option>
                    <option value="HARASSMENT">Harassment</option>
                    <option value="HATE_SPEECH">Hate Speech</option>
                    <option value="SPAM">Spam</option>
                    <option value="MISINFORMATION">Misinformation</option>
                    <option value="INAPPROPRIATE">Inappropriate Content</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <textarea
                  value={reportForm.description}
                  onChange={(e) => setReportForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Additional details (optional)"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent"
                />
                <button
                  onClick={handleReport}
                  disabled={reporting}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {reporting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            )}

            {trustScore.reportsSubmitted > 0 && (
              <p className="text-sm text-gray-500 mt-4">
                You&apos;ve submitted {trustScore.reportsSubmitted} report(s)
                {trustScore.reportAccuracy && ` • ${Math.round(trustScore.reportAccuracy * 100)}% accuracy`}
              </p>
            )}
          </div>
        </>
      ) : null}

      <div className="text-center">
        <Link href="/dashboard/ai" className="text-sm text-primary-600 hover:underline">
          ← Back to AI Tools
        </Link>
      </div>
    </div>
  );
}
