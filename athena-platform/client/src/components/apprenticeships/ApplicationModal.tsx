'use client';

import { useState } from 'react';
import { Upload, X, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Apprenticeship } from './ApprenticeshipCard';
import { cn } from '@/lib/utils';

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

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      setIsSuccess(true);
    } catch (error) {
      setErrors({ submit: 'Failed to submit application. Please try again.' });
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Application Submitted!
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Your application for <strong>{apprenticeship.title}</strong> at{' '}
            <strong>{apprenticeship.organization.name}</strong> has been submitted successfully.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            You'll receive an email confirmation shortly. The team will review your application and get back to you within 5-7 business days.
          </p>
          <Button onClick={handleClose}>Close</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Apply for ${apprenticeship.title}`} size="lg">
      <div className="p-6">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Step {step} of {totalSteps}</span>
            <span>{Math.round((step / totalSteps) * 100)}% complete</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full">
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tell us about yourself
            </h3>
            <p className="text-sm text-gray-500">
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
                  'w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500',
                  errors.coverLetter
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                )}
              />
              {errors.coverLetter && (
                <p className="mt-1 text-sm text-red-600">{errors.coverLetter}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {formData.coverLetter.length} / 100 minimum characters
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Documents & Dates */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Documents & Availability
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resume URL (optional)
              </label>
              <Input
                type="url"
                value={formData.resumeUrl || ''}
                onChange={(e) => setFormData({ ...formData, resumeUrl: e.target.value })}
                placeholder="https://drive.google.com/your-resume.pdf"
              />
              <p className="mt-1 text-xs text-gray-500">
                Link to your resume on Google Drive, Dropbox, or similar
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Portfolio URL (optional)
              </label>
              <Input
                type="url"
                value={formData.portfolioUrl || ''}
                onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                placeholder="https://yourportfolio.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Review Your Application
            </h3>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Applying for
                </h4>
                <p className="text-gray-900 dark:text-white font-medium">
                  {apprenticeship.title}
                </p>
                <p className="text-sm text-gray-500">{apprenticeship.organization.name}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cover Letter
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                  {formData.coverLetter}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Resume
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.resumeUrl ? 'Attached' : 'Not provided'}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Available From
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formData.availableStartDate
                      ? new Date(formData.availableStartDate).toLocaleDateString()
                      : 'Not specified'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
              By submitting this application, you confirm that the information provided is accurate
              and agree to be contacted regarding this opportunity.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
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
            <Button onClick={handleSubmit} disabled={isSubmitting}>
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
