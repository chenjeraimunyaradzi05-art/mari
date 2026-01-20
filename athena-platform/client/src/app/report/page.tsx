/**
 * Content Report Page
 * UK Online Safety Act Compliance
 * Phase 4: UK/EU Market Launch
 */

'use client';

import { useState } from 'react';
import { AlertTriangle, Send, CheckCircle, ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface ReportFormData {
  contentType: 'post' | 'message' | 'profile' | 'comment' | 'job' | 'other';
  contentId: string;
  reason: 'illegal' | 'harmful' | 'harassment' | 'hate_speech' | 'spam' | 'misinformation' | 'csam' | 'terrorism' | 'fraud' | 'other';
  description: string;
  evidenceUrls: string[];
  contactEmail: string;
  isUrgent: boolean;
}

const CONTENT_TYPES = [
  { value: 'post', label: 'Post or Article' },
  { value: 'message', label: 'Direct Message' },
  { value: 'profile', label: 'User Profile' },
  { value: 'comment', label: 'Comment' },
  { value: 'job', label: 'Job Listing' },
  { value: 'other', label: 'Other Content' },
];

const REPORT_REASONS = [
  { value: 'illegal', label: 'Illegal Content', description: 'Content that violates UK law', priority: 'high' },
  { value: 'csam', label: 'Child Sexual Abuse Material', description: 'Any content involving child exploitation', priority: 'critical' },
  { value: 'terrorism', label: 'Terrorism or Violent Extremism', description: 'Content promoting terrorism or extreme violence', priority: 'critical' },
  { value: 'harmful', label: 'Harmful Content', description: 'Content that could cause harm to individuals', priority: 'high' },
  { value: 'harassment', label: 'Harassment or Bullying', description: 'Targeted harassment, threats, or intimidation', priority: 'medium' },
  { value: 'hate_speech', label: 'Hate Speech', description: 'Content promoting hatred based on protected characteristics', priority: 'high' },
  { value: 'fraud', label: 'Fraud or Scam', description: 'Fraudulent schemes or financial scams', priority: 'high' },
  { value: 'misinformation', label: 'Misinformation', description: 'False or misleading information', priority: 'medium' },
  { value: 'spam', label: 'Spam or Unwanted Content', description: 'Repetitive or promotional spam', priority: 'low' },
  { value: 'other', label: 'Other', description: 'Other violations not listed above', priority: 'medium' },
];

export default function ReportContentPage() {
  const searchParams = useSearchParams();
  const prefilledContentId = searchParams.get('contentId');
  const prefilledType = searchParams.get('type');

  const [formData, setFormData] = useState<ReportFormData>({
    contentType: (prefilledType as ReportFormData['contentType']) || 'post',
    contentId: prefilledContentId || '',
    reason: 'harmful',
    description: '',
    evidenceUrls: [],
    contactEmail: '',
    isUrgent: false,
  });

  const [newEvidenceUrl, setNewEvidenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get expected response time based on reason priority
  const selectedReason = REPORT_REASONS.find(r => r.value === formData.reason);
  const expectedResponse = selectedReason?.priority === 'critical' ? '1 hour' : 
                          selectedReason?.priority === 'high' ? '24 hours' : '72 hours';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/compliance/report-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit report');
      }

      const data = await response.json();
      setTicketId(data.data.ticketId);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const addEvidenceUrl = () => {
    if (newEvidenceUrl && !formData.evidenceUrls.includes(newEvidenceUrl)) {
      setFormData(prev => ({
        ...prev,
        evidenceUrls: [...prev.evidenceUrls, newEvidenceUrl],
      }));
      setNewEvidenceUrl('');
    }
  };

  const removeEvidenceUrl = (url: string) => {
    setFormData(prev => ({
      ...prev,
      evidenceUrls: prev.evidenceUrls.filter(u => u !== url),
    }));
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Report Submitted
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Thank you for helping keep ATHENA safe. Your report has been received and will be reviewed by our Trust & Safety team.
            </p>
            
            {ticketId && (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">Your reference number:</p>
                <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">{ticketId}</p>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8 text-left">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">What happens next?</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <li>• Our Trust &amp; Safety team will review your report within 24-72 hours</li>
                <li>• For critical reports (illegal content, CSAM, terrorism), we aim to respond within 24 hours</li>
                <li>• If we need more information, we&apos;ll contact you at the email provided</li>
                <li>• You can track your report status using the reference number above</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setFormData({
                    contentType: 'post',
                    contentId: '',
                    reason: 'harmful',
                    description: '',
                    evidenceUrls: [],
                    contactEmail: '',
                    isUrgent: false,
                  });
                }}
                className="inline-flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Submit Another Report
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Report Content</h1>
              <p className="text-gray-600 dark:text-gray-400">Help us maintain a safe platform</p>
            </div>
          </div>
        </div>

        {/* UK Online Safety Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">UK Online Safety Act</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                Under the UK Online Safety Act 2023, ATHENA is committed to providing effective mechanisms for users to report harmful content. All reports are reviewed by our Trust & Safety team and actioned in accordance with our policies and legal obligations.
              </p>
            </div>
          </div>
        </div>

        {/* Report Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Content Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              What type of content are you reporting?
            </label>
            <select
              value={formData.contentType}
              onChange={(e) => setFormData(prev => ({ ...prev, contentType: e.target.value as ReportFormData['contentType'] }))}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {CONTENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Content ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Content ID or URL
            </label>
            <input
              type="text"
              value={formData.contentId}
              onChange={(e) => setFormData(prev => ({ ...prev, contentId: e.target.value }))}
              placeholder="Paste the URL or ID of the content"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              You can find this in the browser address bar or by clicking &quot;Share&quot; on the content
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason for report
            </label>
            <div className="grid gap-3">
              {REPORT_REASONS.map(reason => (
                <label
                  key={reason.value}
                  className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                    formData.reason === reason.value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason.value}
                    checked={formData.reason === reason.value}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value as ReportFormData['reason'] }))}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">{reason.label}</span>
                      {reason.priority === 'critical' && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
                          Priority
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{reason.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Please describe the issue
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              placeholder="Provide as much detail as possible about why this content is problematic..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              required
            />
          </div>

          {/* Evidence URLs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Additional evidence (optional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="url"
                value={newEvidenceUrl}
                onChange={(e) => setNewEvidenceUrl(e.target.value)}
                placeholder="Add screenshot or archive link"
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={addEvidenceUrl}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Add
              </button>
            </div>
            {formData.evidenceUrls.length > 0 && (
              <ul className="space-y-2">
                {formData.evidenceUrls.map((url, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="truncate flex-1">{url}</span>
                    <button
                      type="button"
                      onClick={() => removeEvidenceUrl(url)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Contact Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your email (for updates)
            </label>
            <input
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
              placeholder="you@example.com"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              We&apos;ll only contact you if we need additional information
            </p>
          </div>

          {/* Urgent Flag */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="urgent"
              checked={formData.isUrgent}
              onChange={(e) => setFormData(prev => ({ ...prev, isUrgent: e.target.checked }))}
              className="mt-1"
            />
            <label htmlFor="urgent" className="text-sm">
              <span className="font-medium text-gray-900 dark:text-white">Mark as urgent</span>
              <p className="text-gray-600 dark:text-gray-400">
                Check this if the content poses an immediate risk to safety
              </p>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Report
                </>
              )}
            </button>
          </div>
        </form>

        {/* Additional Info */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Additional Resources</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link
              href="/help/community-guidelines"
              className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 transition-colors"
            >
              <h3 className="font-medium text-gray-900 dark:text-white">Community Guidelines</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Learn about our content policies</p>
            </Link>
            <Link
              href="/help/safety-center"
              className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 transition-colors"
            >
              <h3 className="font-medium text-gray-900 dark:text-white">Safety Center</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Resources for staying safe online</p>
            </Link>
            <Link
              href="/help/transparency-report"
              className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 transition-colors"
            >
              <h3 className="font-medium text-gray-900 dark:text-white">Transparency Report</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">See how we handle reports</p>
            </Link>
            <Link
              href="/help/appeal"
              className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 transition-colors"
            >
              <h3 className="font-medium text-gray-900 dark:text-white">Appeal a Decision</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Contest content removal</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
