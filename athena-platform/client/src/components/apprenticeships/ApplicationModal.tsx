'use client';

/**
 * Applying for an apprenticeship.
 *
 * The résumé used to be a "Resume URL" box asking for a link to a file on
 * Google Drive or Dropbox. The job application screens stopped taking links
 * for good reasons — a provider's click on one goes to a server somebody else
 * controls, and nothing says the file behind it is hers — so this uses the
 * same upload those screens do, and the server now takes nothing else.
 *
 * Any failure used to read "Failed to submit application. Please try again."
 * The refusals this form meets are mostly ones a retry cannot change: a
 * provider with nobody on ATHENA to receive the application (409), an
 * application already sent, a link that is not a web address (400). She is
 * shown the server's own words, and the generic line only when there are none.
 *
 * The confirmation promised an email "shortly" and a reply "within 5-7
 * business days". Neither is anything ATHENA does or can promise for a
 * provider: she is told in her notifications, and the provider's hiring team
 * is told the application has arrived.
 */

import { useState } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ResumeAttachment, type ResumeAttachmentValue } from '@/app/jobs/ResumeAttachment';
import { HostCheckBadge, HostCheckNotice, hostChecked } from './HostCheck';
import { Apprenticeship, primaryOrg } from './types';
import { cn } from '@/lib/utils';

function serverMessage(error: unknown): string | undefined {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' && message.trim() ? message : undefined;
}

/** "2027-02-01" as a date, read as the calendar day it names wherever she is. */
function formatStartDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-AU', { dateStyle: 'long', timeZone: 'UTC' });
}

interface ApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  apprenticeship: Apprenticeship;
  onSubmit: (data: ApplicationData) => Promise<void>;
}

export interface ApplicationData {
  coverLetter: string;
  resumeUrl?: string;
  portfolioUrl?: string;
  availableStartDate: string;
  answers: Record<string, string>;
}

export function ApplicationModal({
  isOpen,
  onClose,
  apprenticeship,
  onSubmit,
}: ApplicationModalProps) {
  // Either the host employer or the RTO fronts the listing; there is no
  // single `organization` field on an apprenticeship.
  const orgName = primaryOrg(apprenticeship)?.name ?? 'the provider';
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState<ApplicationData>({
    coverLetter: '',
    resumeUrl: '',
    portfolioUrl: '',
    availableStartDate: '',
    answers: {},
  });
  const [resume, setResume] = useState<ResumeAttachmentValue | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalSteps = 3;

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.coverLetter.trim()) {
        newErrors.coverLetter = 'Cover letter is required';
      } else if (formData.coverLetter.length < 100) {
        newErrors.coverLetter = 'Cover letter should be at least 100 characters';
      }
    }

    if (step === 2) {
      if (!formData.availableStartDate) {
        newErrors.availableStartDate = 'Please select your available start date';
      }
      const portfolio = formData.portfolioUrl?.trim();
      if (portfolio && !/^https:\/\/\S+$/i.test(portfolio)) {
        newErrors.portfolioUrl = 'Paste the full link, starting with https://';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  // The server refuses an application to a host ATHENA has not checked (409),
  // and this keeps the form from asking for a cover letter first. It is the
  // same sentence a visitor reads on the page.
  const hostNotChecked = hostChecked(apprenticeship) === false;

  const handleSubmit = async () => {
    if (hostNotChecked) return;
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        resumeUrl: resume?.url || undefined,
        portfolioUrl: formData.portfolioUrl?.trim() || undefined,
      });
      setIsSuccess(true);
    } catch (error) {
      setErrors({
        submit: serverMessage(error) || 'Your application could not be sent just now. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setIsSuccess(false);
    setFormData({
      coverLetter: '',
      resumeUrl: '',
      portfolioUrl: '',
      availableStartDate: '',
      answers: {},
    });
    setResume(null);
    setErrors({});
    onClose();
  };

  if (isSuccess) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} size="md">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Application Submitted!
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Your application for <strong>{apprenticeship.title}</strong> at{' '}
            <strong>{orgName}</strong> has been sent.
          </p>
          <p className="text-sm text-slate-500 mb-6">
            {orgName === 'the provider' ? 'The provider' : orgName}&apos;s hiring team has been told it
            has arrived. When they move it along or make a decision, you will see it in your
            notifications.
          </p>
          <Button onClick={handleClose}>Close</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Apply for ${apprenticeship.title}`} size="lg">
      <div className="p-6">
        {/* Who is hosting, and whether ATHENA has checked them. An applicant sees
            this before a cover letter is written, not after. */}
        <div className="mb-4 space-y-2">
          <HostCheckBadge apprenticeship={apprenticeship} />
          <HostCheckNotice apprenticeship={apprenticeship} />
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
            <span>Step {step} of {totalSteps}</span>
            <span>{Math.round((step / totalSteps) * 100)}% complete</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {errors.submit && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {errors.submit}
          </div>
        )}

        {/* Step 1: Cover Letter */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Tell us about yourself
            </h3>
            <p className="text-sm text-slate-500">
              Write a cover letter explaining why you're interested in this apprenticeship and what makes you a great fit.
            </p>
            <div>
              <textarea
                value={formData.coverLetter}
                onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
                placeholder="Dear Hiring Team,

I am excited to apply for this apprenticeship opportunity because..."
                rows={10}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500',
                  errors.coverLetter
                    ? 'border-red-500'
                    : 'border-slate-300 dark:border-slate-600'
                )}
              />
              {errors.coverLetter && (
                <p className="mt-1 text-sm text-red-600">{errors.coverLetter}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                {formData.coverLetter.length} / 100 minimum characters
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Documents & Dates */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Documents & Availability
            </h3>

            <ResumeAttachment value={resume} onChange={setResume} disabled={isSubmitting} />

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Portfolio link (optional)
              </label>
              <Input
                type="url"
                value={formData.portfolioUrl || ''}
                onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                placeholder="https://yourportfolio.com"
                error={errors.portfolioUrl}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Earliest Available Start Date *
              </label>
              <Input
                type="date"
                value={formData.availableStartDate}
                onChange={(e) => setFormData({ ...formData, availableStartDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                error={errors.availableStartDate}
              />
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Review Your Application
            </h3>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-4">
              <div>
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Applying for
                </h4>
                <p className="text-slate-900 dark:text-white font-medium">
                  {apprenticeship.title}
                </p>
                <p className="text-sm text-slate-500">{orgName}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Cover Letter
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
                  {formData.coverLetter}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Resume
                  </h4>
                  <p className="truncate text-sm text-slate-600 dark:text-slate-400">
                    {resume ? resume.fileName : 'Not attached'}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Available From
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {formData.availableStartDate
                      ? formatStartDate(formData.availableStartDate)
                      : 'Not specified'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
              Your cover letter, résumé, start date and portfolio link go to {orgName}&apos;s hiring
              team, with your name and email address so they can contact you about this opportunity.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
          {step > 1 ? (
            <Button variant="ghost" onClick={handleBack} disabled={isSubmitting}>
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < totalSteps ? (
            <Button onClick={handleNext}>Continue</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting || hostNotChecked}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Application'
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default ApplicationModal;
