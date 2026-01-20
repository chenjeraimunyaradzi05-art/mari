/**
 * Appeal Page
 * UK Online Safety Act Compliance
 * Phase 4: UK/EU Market Launch
 */

'use client';

import { useState } from 'react';
import { Scale, Send, CheckCircle, ArrowLeft, AlertCircle, FileText } from 'lucide-react';
import Link from 'next/link';

interface AppealFormData {
  appealType: 'content_removal' | 'account_suspension' | 'account_ban' | 'warning' | 'other';
  referenceId: string;
  reason: string;
  additionalInfo: string;
  contactEmail: string;
  agreeToTerms: boolean;
}

const APPEAL_TYPES = [
  { value: 'content_removal', label: 'Content Removal', description: 'Your post, comment, or other content was removed' },
  { value: 'account_suspension', label: 'Account Suspension', description: 'Your account has been temporarily suspended' },
  { value: 'account_ban', label: 'Account Ban', description: 'Your account has been permanently banned' },
  { value: 'warning', label: 'Warning', description: 'You received a warning about a policy violation' },
  { value: 'other', label: 'Other', description: 'Other enforcement action' },
];

export default function AppealPage() {
  const [formData, setFormData] = useState<AppealFormData>({
    appealType: 'content_removal',
    referenceId: '',
    reason: '',
    additionalInfo: '',
    contactEmail: '',
    agreeToTerms: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.agreeToTerms) {
      setError('You must agree to the terms to submit an appeal');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Generate ticket ID
      const ticket = `APL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      setTicketId(ticket);
      setSubmitted(true);
    } catch {
      setError('Failed to submit appeal. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
              Appeal Submitted
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Thank you for submitting your appeal. We take all appeals seriously and will review your case carefully.
            </p>

            {ticketId && (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">Your appeal reference:</p>
                <p className="text-lg font-mono font-bold text-gray-900 dark:text-white">{ticketId}</p>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8 text-left">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">What happens next?</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <li>• Your appeal will be reviewed by a different moderator than the one who made the original decision</li>
                <li>• We aim to complete appeal reviews within 5 business days</li>
                <li>• You&apos;ll receive an email notification with our decision</li>
                <li>• If your appeal is successful, your content or account will be restored</li>
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
              <Link
                href="/help/transparency-report"
                className="inline-flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FileText className="w-4 h-4 mr-2" />
                View Transparency Report
              </Link>
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
            href="/help/community-guidelines"
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Community Guidelines
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Scale className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Appeal a Decision</h1>
              <p className="text-gray-600 dark:text-gray-400">Request a review of a moderation action</p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Your Right to Appeal</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                Under the UK Online Safety Act 2023, you have the right to appeal any content moderation decision. 
                All appeals are reviewed by a moderator who was not involved in the original decision.
              </p>
            </div>
          </div>
        </div>

        {/* Appeal Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Appeal Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              What are you appealing?
            </label>
            <div className="grid gap-3">
              {APPEAL_TYPES.map(type => (
                <label
                  key={type.value}
                  className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                    formData.appealType === type.value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="appealType"
                    value={type.value}
                    checked={formData.appealType === type.value}
                    onChange={(e) => setFormData(prev => ({ ...prev, appealType: e.target.value as AppealFormData['appealType'] }))}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{type.label}</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{type.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Reference ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reference ID (if available)
            </label>
            <input
              type="text"
              value={formData.referenceId}
              onChange={(e) => setFormData(prev => ({ ...prev, referenceId: e.target.value }))}
              placeholder="e.g., MOD-123ABC or the URL of removed content"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This helps us find the specific action you&apos;re appealing. Check your email for this ID.
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Why do you believe this decision was incorrect? *
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              rows={4}
              placeholder="Explain why you believe the content did not violate our guidelines, or why the action taken was disproportionate..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              required
            />
          </div>

          {/* Additional Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Additional context (optional)
            </label>
            <textarea
              value={formData.additionalInfo}
              onChange={(e) => setFormData(prev => ({ ...prev, additionalInfo: e.target.value }))}
              rows={3}
              placeholder="Any additional information that might help us understand the context..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Contact Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your email address *
            </label>
            <input
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
              placeholder="you@example.com"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              We&apos;ll send the outcome of your appeal to this address
            </p>
          </div>

          {/* Terms Agreement */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="agreeToTerms"
              checked={formData.agreeToTerms}
              onChange={(e) => setFormData(prev => ({ ...prev, agreeToTerms: e.target.checked }))}
              className="mt-1"
              required
            />
            <label htmlFor="agreeToTerms" className="text-sm text-gray-600 dark:text-gray-400">
              I confirm that the information provided is accurate and understand that submitting false or misleading appeals 
              may result in further action on my account. I also understand that the appeal decision is final.
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
              disabled={submitting || !formData.agreeToTerms}
              className="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  Submit Appeal
                </>
              )}
            </button>
          </div>
        </form>

        {/* FAQ */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">How long does the appeal process take?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                We aim to review all appeals within 5 business days. Complex cases may take longer.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Can I submit multiple appeals?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Each enforcement action can only be appealed once. Please include all relevant information in your initial appeal.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">What if my appeal is rejected?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                If your appeal is rejected, the original decision stands. For users in the UK and EU, you may have additional rights 
                to challenge decisions through external dispute resolution mechanisms.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Will submitting an appeal affect my account?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No, submitting a good-faith appeal will never result in additional action on your account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
