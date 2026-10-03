/**
 * Content Report Page
 *
 * The reporting mechanism the Online Safety Act 2021 (Cth) and the eSafety
 * Commissioner's Basic Online Safety Expectations ask of an Australian
 * platform, and the UK Online Safety Act 2023 asks of one serving UK members.
 */

'use client';

import { Suspense, useState } from 'react';
import { AlertTriangle, Send, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import OnlineSafetyNotice from '@/components/compliance/OnlineSafetyNotice';
import { QuickExitButton } from '../dashboard/safety/QuickExit';
import { EmergencyHelp } from '@/components/safety/EmergencyHelp';
import { crisisLinesFor, telHref } from '@/lib/crisis-lines';
import { ReportNextSteps } from '@/components/safety/ReportNextSteps';
import {
  REPORT_CONTENT_TYPES,
  asReportContentType,
  resolveReportTarget,
  type ReportContentType,
} from '@/lib/report-target';

interface ReportFormData {
  contentType: ReportContentType;
  contentId: string;
  reason: 'illegal' | 'harmful' | 'harassment' | 'hate_speech' | 'spam' | 'misinformation' | 'csam' | 'terrorism' | 'fraud' | 'intimate_image' | 'threat' | 'other';
  description: string;
  evidenceUrls: string[];
  contactEmail: string;
  isUrgent: boolean;
}

// The two numbers that matter on this form, from the one list the Emergency help
// button reads, so the form and the button cannot disagree about them.
const AU_LINES = crisisLinesFor('AU').lines;
const EMERGENCY_LINE = AU_LINES.find((line) => line.key === 'emergency');
const FAMILY_VIOLENCE_LINE = AU_LINES.find((line) => line.key === '1800respect');

const REPORT_REASONS = [
  // First, and by name: she used to have to guess which of "illegal", "harmful"
  // and "harassment" an image of her shared without consent came under. These two
  // are read first, hidden at once where they can be, and answered within 24 hours.
  { value: 'intimate_image', label: 'Intimate Image Shared Without Consent', description: 'A nude or sexual picture or video of someone, shared without their agreement, or a threat to share one', priority: 'critical' },
  { value: 'threat', label: 'A Threat to Hurt Someone', description: 'Someone has threatened violence or harm to a person', priority: 'critical' },
  { value: 'illegal', label: 'Illegal Content', description: 'Content that breaks the law', priority: 'high' },
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

/** What the server said when it filed the report. */
interface ReportReceipt {
  /** The RPT- reference the acknowledgment email quotes. */
  reference: string | null;
  /** The server's own sentence, which names the review clock it stamped. */
  message: string | null;
  reviewDeadline: string | null;
}

function formatDeadline(iso: string): string {
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return 'the time given above';
  return due.toLocaleString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ReportContentPage() {
  return (
    <>
      <Suspense fallback={null}>
        <ReportContent />
      </Suspense>
      {/* Beside the form and the receipt both: someone reporting what is
          happening to her may need to leave this page fast, or to ring someone. */}
      <QuickExitButton variant="floating" className="print:hidden" />
      <EmergencyHelp className="print:hidden" />
    </>
  );
}

function ReportContent() {
  const searchParams = useSearchParams();
  const prefilledContentId = searchParams.get('contentId');
  const prefilledType = searchParams.get('type');

  const [formData, setFormData] = useState<ReportFormData>({
    // A link into this page can name a type, and a type the form does not file
    // (an old link, a mistyped one) leaves the list on its first choice.
    contentType: asReportContentType(prefilledType) ?? 'post',
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
  // What the server stamped on the report, shown back exactly as it was
  // stamped. This screen used to keep a clock of its own — one hour for a
  // critical report, 72 for anything low — and to show the row id as the
  // reference, while the server stamped 24 or 48 hours and emailed an RPT-
  // number. A woman quoting the number on this screen was quoting one the
  // acknowledgment email had never mentioned, against a deadline nobody kept.
  const [receipt, setReceipt] = useState<ReportReceipt | null>(null);
  // The reason she filed under, kept for the confirmation: some reasons have
  // somewhere else to turn, and it says so.
  const [filedReason, setFiledReason] = useState<ReportFormData['reason'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  // When what she pasted is a link, the link says what it is to, and she is
  // told so before she sends it, so a reel reported as a post is not a surprise.
  const pasted = formData.contentId.trim()
    ? resolveReportTarget(formData.contentId, formData.contentType)
    : null;
  const recognised =
    pasted && pasted.ok && pasted.fromLink
      ? REPORT_CONTENT_TYPES.find((type) => type.value === pasted.contentType)?.label ?? null
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNeedsSignIn(false);

    // What she pasted is a link more often than an ID. Worked out here, because
    // the server looks the thing up by its ID alone and would answer a pasted
    // address with "we could not find it".
    const target = resolveReportTarget(formData.contentId, formData.contentType);
    if (!target.ok) {
      setError(target.message);
      setSubmitting(false);
      return;
    }

    try {
      // Reporters are often signed out, and the shared client bounces an
      // unrecoverable 401 to the login page, which would discard the report.
      // Reading the status here keeps the reporter on the form.
      const response = await api.post(
        '/compliance/report-content',
        {
          contentType: target.contentType,
          contentId: target.contentId,
          reason: formData.reason,
          details: formData.description.trim(),
          evidenceUrls: formData.evidenceUrls,
          contactEmail: formData.contactEmail.trim() || undefined,
          isUrgent: formData.isUrgent,
        },
        { validateStatus: () => true }
      );

      if (response.status === 401) {
        setNeedsSignIn(true);
        throw new Error('Reports can only be submitted from a signed-in account right now.');
      }

      if (response.status >= 400) {
        throw new Error(
          response.data?.error || response.data?.message || 'Failed to submit report'
        );
      }

      const report = response.data?.data;
      setReceipt({
        reference: typeof report?.reference === 'string' ? report.reference : null,
        message: typeof response.data?.message === 'string' ? response.data.message : null,
        reviewDeadline: typeof report?.reviewDeadline === 'string' ? report.reviewDeadline : null,
      });
      setFiledReason(formData.reason);
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
      <div className="min-h-screen bg-gradient-to-b from-white via-rose-50/40 to-white text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-white">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              Report Submitted
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Thank you for helping keep ATHENA safe. Your report has been received and will be reviewed by our Trust & Safety team.
            </p>
            
            {receipt?.reference && (
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-slate-600 dark:text-slate-400">Your reference number:</p>
                <p className="text-lg font-mono font-bold text-slate-900 dark:text-white">{receipt.reference}</p>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8 text-left">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">What happens next?</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                {receipt?.message && <li>• {receipt.message}</li>}
                {receipt?.reviewDeadline && (
                  <li>• A person will have looked at it by {formatDeadline(receipt.reviewDeadline)}</li>
                )}
                {formData.contactEmail.trim() && (
                  <li>• We&apos;ll write to {formData.contactEmail.trim()} with the outcome</li>
                )}
                {receipt?.reference && (
                  <li>
                    • Keep your reference number. You can{' '}
                    <Link href={`/report/status?reference=${encodeURIComponent(receipt.reference)}`} className="underline">
                      check on this report
                    </Link>{' '}
                    with it, and quote it if you contact us about this report
                  </li>
                )}
              </ul>
            </div>

            <ReportNextSteps reason={filedReason} className="mb-8" />

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setReceipt(null);
                  setFiledReason(null);
                  setError(null);
                  setNeedsSignIn(false);
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
    <div className="min-h-screen bg-gradient-to-b from-white via-rose-50/40 to-white text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Report Content</h1>
              <p className="text-slate-600 dark:text-slate-400">Help us maintain a safe platform</p>
            </div>
          </div>
        </div>

        {/* Which online-safety law this meets, with the regulator for the reader's region */}
        <OnlineSafetyNotice variant="report" className="mb-8" />

        {/* Report Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Content Type */}
          <div>
            <label htmlFor="report-content-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              What type of content are you reporting?
            </label>
            <select
              id="report-content-type"
              value={formData.contentType}
              onChange={(e) => setFormData(prev => ({ ...prev, contentType: e.target.value as ReportFormData['contentType'] }))}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {REPORT_CONTENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Reporting a message? Open the conversation and choose Report on the message itself. That keeps a copy of what was said, which we need to act on it.
            </p>
          </div>

          {/* The link, or the ID */}
          <div>
            <label htmlFor="report-content-id" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Link to it, or its ID
            </label>
            <input
              id="report-content-id"
              type="text"
              value={formData.contentId}
              onChange={(e) => setFormData(prev => ({ ...prev, contentId: e.target.value }))}
              placeholder="Paste the link to the post, reel, profile or listing"
              aria-describedby="report-content-id-help"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
            <p id="report-content-id-help" aria-live="polite" className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {recognised
                ? `We read this link as a ${recognised.toLowerCase()}, and will report it as one.`
                : 'Open it and copy the address from the top of your browser. If you only have its ID, choose what it is above and paste the ID.'}
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Reason for report
            </label>
            <div className="grid gap-3">
              {REPORT_REASONS.map(reason => (
                <label
                  key={reason.value}
                  className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                    formData.reason === reason.value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
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
                      <span className="font-medium text-slate-900 dark:text-white">{reason.label}</span>
                      {reason.priority === 'critical' && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
                          Priority
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{reason.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="report-description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Please describe the issue
            </label>
            <textarea
              id="report-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              placeholder="Provide as much detail as possible about why this content is problematic..."
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              required
            />
          </div>

          {/* Evidence URLs */}
          <div>
            <label htmlFor="report-evidence" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Additional evidence (optional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                id="report-evidence"
                type="url"
                value={newEvidenceUrl}
                onChange={(e) => setNewEvidenceUrl(e.target.value)}
                placeholder="Add screenshot or archive link"
                className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={addEvidenceUrl}
                className="px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Add
              </button>
            </div>
            {formData.evidenceUrls.length > 0 && (
              <ul className="space-y-2">
                {formData.evidenceUrls.map((url, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
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
            <label htmlFor="report-contact-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Your email (for updates)
            </label>
            <input
              id="report-contact-email"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
              placeholder="you@example.com"
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {/* What the server does with the address (content-report.service
                runReportIntakeConsequences, sendReportOutcome): a confirmation
                with the reference at once, and the outcome when it is decided.
                This used to say we would write only if we needed more, under a
                confirmation screen promising to write with the outcome. */}
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Optional. If you give one, we&apos;ll email you a confirmation with your reference number, and write again with the outcome. We don&apos;t share it with anyone you report.
            </p>
          </div>

          {/* Urgent Flag */}
          <div className="space-y-3">
            {/* Said first, and in these words, because someone who ticks "urgent"
                may be believing that doing so brings help to her. It does not:
                it puts the report ahead in a queue that people read. */}
            <div role="note" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-100">
              <p>
                <strong>In danger now?</strong> Call{' '}
                <a href={telHref(EMERGENCY_LINE?.phone ?? '000')} className="font-semibold underline">
                  {EMERGENCY_LINE?.phone ?? '000'}
                </a>
                . For help with family or sexual violence, {FAMILY_VIOLENCE_LINE?.name ?? '1800RESPECT'} is on{' '}
                <a href={telHref(FAMILY_VIOLENCE_LINE?.phone ?? '1800 737 732')} className="font-semibold underline">
                  {FAMILY_VIOLENCE_LINE?.phone ?? '1800 737 732'}
                </a>
                , any hour. Marking a report urgent puts it ahead in our queue; it does not send anyone to you.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="urgent"
                checked={formData.isUrgent}
                onChange={(e) => setFormData(prev => ({ ...prev, isUrgent: e.target.checked }))}
                className="mt-1 h-4 w-4"
              />
              <label htmlFor="urgent" className="text-sm">
                <span className="font-medium text-slate-900 dark:text-white">Mark as urgent</span>
                <p className="text-slate-600 dark:text-slate-400">
                  Check this if what you are reporting puts someone at risk now
                </p>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-300">{error}</p>
              {needsSignIn && (
                <Link
                  href="/login?redirect=%2Freport"
                  className="mt-2 inline-block text-sm font-medium text-red-800 dark:text-red-200 underline"
                >
                  Sign in and return to this form
                </Link>
              )}
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
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Additional Resources</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link
              href="/help/community-guidelines"
              className="block p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-purple-500 transition-colors"
            >
              <h3 className="font-medium text-slate-900 dark:text-white">Community Guidelines</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Learn about our content policies</p>
            </Link>
            <Link
              href="/help/safety-center"
              className="block p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-purple-500 transition-colors"
            >
              <h3 className="font-medium text-slate-900 dark:text-white">Safety Center</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Resources for staying safe online</p>
            </Link>
            <Link
              href="/help/transparency-report"
              className="block p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-purple-500 transition-colors"
            >
              <h3 className="font-medium text-slate-900 dark:text-white">Transparency Report</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">See how we handle reports</p>
            </Link>
            <Link
              href="/help/appeal"
              className="block p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-purple-500 transition-colors"
            >
              <h3 className="font-medium text-slate-900 dark:text-white">Appeal a Decision</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Contest content removal</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
