'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Users,
  DollarSign,
  Clock,
  Award,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { mentorApi, userApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const errorMessage = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

const benefits = [
  {
    icon: DollarSign,
    title: 'Earn Income',
    description: 'Set your own rates and earn money sharing your expertise',
  },
  {
    icon: Users,
    title: 'Grow Your Network',
    description: 'Connect with ambitious women from around the world',
  },
  {
    icon: Award,
    title: 'Build Your Brand',
    description: 'Establish yourself as a thought leader in your field',
  },
  {
    icon: Heart,
    title: 'Make an Impact',
    description: 'Help other women achieve their career goals',
  },
];

const steps = [
  { id: 1, title: 'Personal Info' },
  { id: 2, title: 'Experience' },
  { id: 3, title: 'Expertise' },
  { id: 4, title: 'Rate & Hours' },
  { id: 5, title: 'Review' },
];

interface FormData {
  // Step 1: Personal Info
  firstName: string;
  lastName: string;
  email: string;
  headline: string;
  bio: string;

  // Step 2: Experience
  currentRole: string;
  company: string;
  yearsExperience: string;
  industry: string;

  // Step 3: Expertise
  expertiseAreas: string[];
  specializations: string[];

  // Step 4: Rate & hours
  hourlyRate: string;
  timezone: string;
}

const expertiseOptions = [
  'Career Transitions',
  'Leadership Development',
  'Negotiation & Salary',
  'Work-Life Balance',
  'Executive Presence',
  'Technical Skills',
  'Entrepreneurship',
  'Personal Branding',
  'Interview Prep',
  'Resume & LinkedIn',
  'Networking',
  'Public Speaking',
];

const industryOptions = [
  'Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Marketing',
  'Legal',
  'Consulting',
  'Media',
  'Non-Profit',
  'Government',
  'Retail',
  'Manufacturing',
];

export default function BecomeMentorPage() {
  const user = useAuthStore((s) => s.user);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    headline: '',
    bio: '',
    currentRole: '',
    company: '',
    yearsExperience: '',
    industry: '',
    expertiseAreas: [],
    specializations: [],
    hourlyRate: '',
    timezone: 'Australia/Brisbane',
  });

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // Start from what the profile already says rather than an empty form.
  useEffect(() => {
    if (!user) return;
    setFormData((prev) => ({
      ...prev,
      firstName: prev.firstName || user.firstName || '',
      lastName: prev.lastName || user.lastName || '',
      email: prev.email || user.email || '',
      headline: prev.headline || user.headline || '',
      bio: prev.bio || user.bio || '',
      currentRole: prev.currentRole || user.currentJobTitle || '',
      company: prev.company || user.currentCompany || '',
      yearsExperience: prev.yearsExperience || (user.yearsExperience != null ? String(user.yearsExperience) : ''),
      timezone: user.timezone || prev.timezone,
    }));
  }, [user]);

  const toggleExpertise = (area: string) => {
    setFormData((prev) => ({
      ...prev,
      expertiseAreas: prev.expertiseAreas.includes(area)
        ? prev.expertiseAreas.filter((a) => a !== area)
        : [...prev.expertiseAreas, area],
    }));
  };

  // Two writes: the person's profile (name, headline, bio, role, timezone) and
  // the mentor profile itself, which the server upserts and lists at once.
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const years = parseInt(formData.yearsExperience, 10);
      const rate = parseFloat(formData.hourlyRate);
      const profile: Record<string, unknown> = {};
      if (formData.firstName.trim()) profile.firstName = formData.firstName.trim();
      if (formData.lastName.trim()) profile.lastName = formData.lastName.trim();
      if (formData.headline.trim()) profile.headline = formData.headline.trim();
      if (formData.bio.trim()) profile.bio = formData.bio.trim();
      if (formData.currentRole.trim()) profile.currentJobTitle = formData.currentRole.trim();
      if (formData.company.trim()) profile.currentCompany = formData.company.trim();
      if (!Number.isNaN(years)) profile.yearsExperience = years;
      if (formData.timezone) profile.timezone = formData.timezone;
      if (Object.keys(profile).length > 0) await userApi.updateProfile(profile);

      await mentorApi.become({
        specializations: Array.from(new Set([...formData.expertiseAreas, ...formData.specializations, ...(formData.industry ? [formData.industry] : [])])),
        ...(Number.isNaN(years) ? {} : { yearsExperience: years }),
        ...(Number.isNaN(rate) ? {} : { hourlyRate: rate }),
        isAvailable: true,
      });
      setIsSubmitted(true);
    } catch (error) {
      toast.error(errorMessage(error) || 'Your mentor profile did not save. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="card py-12">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            You&apos;re listed as a mentor
          </h1>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            Your mentor profile is live now. People can find you on the mentors page and ask for a session; nothing waits on a review.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {/* The payouts step is the one that decides whether she can ever be
                paid, so it leads. This used to be prose pointing at a "mentor
                dashboard" that had no such control on it, and every mentor who
                followed the instruction found a disabled button. */}
            <Link href="/dashboard/earnings" className="btn-primary">
              Connect payouts
            </Link>
            <Link href="/mentors" className="btn-outline">
              See the mentors page
            </Link>
            <Link href="/dashboard/mentors" className="btn-outline">
              Mentor dashboard
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            Until payouts are connected, nobody can pay for a session with you — it only takes a few minutes. You can change your rate, expertise and availability from the mentor dashboard at any time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
          Become a Mentor
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
          Share your expertise and help other women advance their careers while
          earning income and building your personal brand.
        </p>
      </div>

      {/* Benefits */}
      {currentStep === 1 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="card text-center p-4"
            >
              <benefit.icon className="w-8 h-8 text-primary-500 mx-auto mb-2" />
              <h3 className="font-medium text-slate-900 dark:text-white text-sm">
                {benefit.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition',
                currentStep > step.id
                  ? 'bg-primary-500 text-white'
                  : currentStep === step.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              )}
            >
              {currentStep > step.id ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                step.id
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-12 h-1 mx-1',
                  currentStep > step.id
                    ? 'bg-primary-500'
                    : 'bg-slate-200 dark:bg-slate-700'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Form Card */}
      <div className="card">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">
          {steps[currentStep - 1].title}
        </h2>

        {/* Step 1: Personal Info */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => updateFormData({ firstName: e.target.value })}
                  className="input-field"
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => updateFormData({ lastName: e.target.value })}
                  className="input-field"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData({ email: e.target.value })}
                className="input-field"
                placeholder="jane@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Professional Headline *
              </label>
              <input
                type="text"
                value={formData.headline}
                onChange={(e) => updateFormData({ headline: e.target.value })}
                className="input-field"
                placeholder="e.g., Senior Product Manager at Google | Career Coach"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Bio *
              </label>
              <textarea
                rows={4}
                value={formData.bio}
                onChange={(e) => updateFormData({ bio: e.target.value })}
                className="input-field"
                placeholder="Tell mentees about your background, experience, and what you're passionate about helping with..."
              />
              <p className="text-xs text-slate-500 mt-1">Min 100 characters</p>
            </div>

          </div>
        )}

        {/* Step 2: Experience */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Current Role *
                </label>
                <input
                  type="text"
                  value={formData.currentRole}
                  onChange={(e) => updateFormData({ currentRole: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Senior Product Manager"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Company *
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => updateFormData({ company: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Google"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Years of Experience *
                </label>
                <select
                  value={formData.yearsExperience}
                  onChange={(e) => updateFormData({ yearsExperience: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select...</option>
                  <option value="3-5">3-5 years</option>
                  <option value="5-10">5-10 years</option>
                  <option value="10-15">10-15 years</option>
                  <option value="15+">15+ years</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Industry *
                </label>
                <select
                  value={formData.industry}
                  onChange={(e) => updateFormData({ industry: e.target.value })}
                  className="input-field"
                >
                  <option value="">Select industry...</option>
                  {industryOptions.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
              </div>
            </div>

          </div>
        )}

        {/* Step 3: Expertise */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Areas of Expertise * (Select at least 3)
              </label>
              <div className="flex flex-wrap gap-2">
                {expertiseOptions.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleExpertise(area)}
                    className={cn(
                      'px-4 py-2 rounded-full text-sm font-medium transition',
                      formData.expertiseAreas.includes(area)
                        ? 'bg-primary-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    )}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Specializations (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g., FAANG interviews, Product strategy, Startup growth"
                className="input-field"
                onChange={(e) =>
                  updateFormData({
                    specializations: e.target.value.split(',').map((s) => s.trim()),
                  })
                }
              />
            </div>

          </div>
        )}

        {/* Step 4: Rate & hours */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Hourly rate (AUD) *
              </label>
              <div className="relative max-w-xs">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="number"
                  min={0}
                  value={formData.hourlyRate}
                  onChange={(e) => updateFormData({ hourlyRate: e.target.value })}
                  className="input-field pl-10"
                  placeholder="100"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Enter 0 to mentor for free. A paid rate needs payouts connected before anyone can
                book you.
              </p>
            </div>

            {/*
              This step used to also collect a seven-day availability grid, a
              set of session lengths and a monthly mentee cap, and send none of
              them: MentorProfile has no column for any of the three, and the
              slot generator offers every mentor the same nine-to-five, seven
              days a week. A woman who ticked "Saturday only" was published as
              bookable all week, including while she was at her actual job. The
              controls are gone rather than quietened, and what the platform
              really does is written out instead, because a mentor deciding
              whether to be listed at all needs to know which hours she is
              putting her name to.
            */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-2">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                When people can book you
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Your profile offers hourly slots between 9am and 5pm in your own timezone, and a
                slot disappears as soon as someone books it.
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Nothing is confirmed without you. Every request arrives as an invitation you accept
                or decline, so a time that does not suit you is a decline, not an obligation. You
                can stop taking new requests at any moment from your mentor dashboard.
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Choosing specific days, session lengths and a monthly limit is not something ATHENA
                can hold yet, so this step does not ask for them.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Timezone *
              </label>
              <select
                value={formData.timezone}
                onChange={(e) => updateFormData({ timezone: e.target.value })}
                className="input-field"
              >
                <option value="Australia/Brisbane">Brisbane (AEST)</option>
                <option value="Australia/Sydney">Sydney / Melbourne (AEST, AEDT)</option>
                <option value="Australia/Adelaide">Adelaide (ACST)</option>
                <option value="Australia/Perth">Perth (AWST)</option>
                <option value="Australia/Darwin">Darwin (ACST)</option>
                <option value="Australia/Hobart">Hobart (AEST, AEDT)</option>
                <option value="Pacific/Auckland">Auckland (NZST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
                <option value="Europe/London">London (GMT, BST)</option>
                <option value="America/New_York">New York (ET)</option>
                <option value="America/Los_Angeles">Los Angeles (PT)</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-slate-900 dark:text-white">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Name:</span>{' '}
                  <span className="text-slate-900 dark:text-white">
                    {formData.firstName} {formData.lastName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Email:</span>{' '}
                  <span className="text-slate-900 dark:text-white">{formData.email}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Headline:</span>{' '}
                  <span className="text-slate-900 dark:text-white">{formData.headline}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-slate-900 dark:text-white">Experience</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Current Role:</span>{' '}
                  <span className="text-slate-900 dark:text-white">{formData.currentRole}</span>
                </div>
                <div>
                  <span className="text-slate-500">Company:</span>{' '}
                  <span className="text-slate-900 dark:text-white">{formData.company}</span>
                </div>
                <div>
                  <span className="text-slate-500">Experience:</span>{' '}
                  <span className="text-slate-900 dark:text-white">{formData.yearsExperience} years</span>
                </div>
                <div>
                  <span className="text-slate-500">Industry:</span>{' '}
                  <span className="text-slate-900 dark:text-white">{formData.industry}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-slate-900 dark:text-white">Expertise</h3>
              <div className="flex flex-wrap gap-2">
                {formData.expertiseAreas.map((area) => (
                  <span
                    key={area}
                    className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-slate-900 dark:text-white">Rate &amp; hours</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Hourly rate:</span>{' '}
                  <span className="text-slate-900 dark:text-white">
                    {Number(formData.hourlyRate) === 0
                      ? 'Free'
                      : `A$${formData.hourlyRate || '—'} per hour`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Timezone:</span>{' '}
                  <span className="text-slate-900 dark:text-white">{formData.timezone}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Bookable hours:</span>{' '}
                  <span className="text-slate-900 dark:text-white">
                    9am to 5pm in your timezone, one hour at a time, every request yours to accept
                    or decline.
                  </span>
                </div>
              </div>
            </div>

            {/*
              The box was drawn with no state behind it and nothing read it, so
              a woman could publish a mentor profile without ever ticking it and
              the platform would still have a screen claiming she had agreed.
              Its wording also promised a review that does not happen — the
              profile goes live the moment this form is submitted, which the
              confirmation screen says plainly — so the sentence now describes
              what actually follows.
            */}
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="terms" className="text-sm text-slate-600 dark:text-slate-300">
                I agree to the{' '}
                <a href="/terms" className="text-primary-500 hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/mentor-agreement" className="text-primary-500 hover:underline">
                  Mentor Agreement
                </a>
                . I understand my profile goes live straight away, and that mentees will be able to
                see it and ask me for sessions.
              </label>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => prev - 1)}
            disabled={currentStep === 1}
            className={cn(
              'flex items-center space-x-2 px-4 py-2 rounded-lg transition',
              currentStep === 1
                ? 'text-slate-400 cursor-not-allowed'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              className="btn-primary flex items-center space-x-2"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !agreedToTerms}
              title={agreedToTerms ? undefined : 'Agree to the terms above to publish your profile'}
              className="btn-primary flex items-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <span>Publish my mentor profile</span>
                  <CheckCircle className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
