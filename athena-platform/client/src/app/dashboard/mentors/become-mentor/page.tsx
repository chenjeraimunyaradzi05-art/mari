'use client';

import { useState } from 'react';
import {
  Users,
  DollarSign,
  Clock,
  Award,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Star,
  Briefcase,
  GraduationCap,
  Heart,
  Upload,
  Plus,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  { id: 4, title: 'Availability' },
  { id: 5, title: 'Review' },
];

interface FormData {
  // Step 1: Personal Info
  firstName: string;
  lastName: string;
  email: string;
  headline: string;
  bio: string;
  linkedinUrl: string;
  profilePhoto: File | null;

  // Step 2: Experience
  currentRole: string;
  company: string;
  yearsExperience: string;
  industry: string;
  previousRoles: Array<{ title: string; company: string; years: string }>;

  // Step 3: Expertise
  expertiseAreas: string[];
  specializations: string[];
  languages: string[];
  certifications: string[];

  // Step 4: Availability
  hourlyRate: string;
  sessionLength: string[];
  availability: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  timezone: string;
  maxMenteesPerMonth: string;
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
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    headline: '',
    bio: '',
    linkedinUrl: '',
    profilePhoto: null,
    currentRole: '',
    company: '',
    yearsExperience: '',
    industry: '',
    previousRoles: [],
    expertiseAreas: [],
    specializations: [],
    languages: ['English'],
    certifications: [],
    hourlyRate: '',
    sessionLength: ['60'],
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    },
    timezone: 'America/New_York',
    maxMenteesPerMonth: '5',
  });

  const updateFormData = (updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const toggleExpertise = (area: string) => {
    setFormData((prev) => ({
      ...prev,
      expertiseAreas: prev.expertiseAreas.includes(area)
        ? prev.expertiseAreas.filter((a) => a !== area)
        : [...prev.expertiseAreas, area],
    }));
  };

  const addPreviousRole = () => {
    setFormData((prev) => ({
      ...prev,
      previousRoles: [...prev.previousRoles, { title: '', company: '', years: '' }],
    }));
  };

  const removePreviousRole = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      previousRoles: prev.previousRoles.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="card py-12">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Application Submitted!
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Thank you for applying to become a mentor on ATHENA. Our team will review
            your application and get back to you within 3-5 business days.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            In the meantime, make sure your profile is complete and up-to-date.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Become a Mentor
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
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
              <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                {benefit.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
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
                    : 'bg-gray-200 dark:bg-gray-700'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Form Card */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          {steps[currentStep - 1].title}
        </h2>

        {/* Step 1: Personal Info */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bio *
              </label>
              <textarea
                rows={4}
                value={formData.bio}
                onChange={(e) => updateFormData({ bio: e.target.value })}
                className="input-field"
                placeholder="Tell mentees about your background, experience, and what you're passionate about helping with..."
              />
              <p className="text-xs text-gray-500 mt-1">Min 100 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                LinkedIn Profile URL
              </label>
              <input
                type="url"
                value={formData.linkedinUrl}
                onChange={(e) => updateFormData({ linkedinUrl: e.target.value })}
                className="input-field"
                placeholder="https://linkedin.com/in/janedoe"
              />
            </div>
          </div>
        )}

        {/* Step 2: Experience */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Previous Roles (Optional)
                </label>
                <button
                  type="button"
                  onClick={addPreviousRole}
                  className="text-sm text-primary-500 hover:text-primary-600 flex items-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Role
                </button>
              </div>
              {formData.previousRoles.map((role, index) => (
                <div key={index} className="flex items-start gap-2 mb-2">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Title"
                      value={role.title}
                      onChange={(e) => {
                        const updated = [...formData.previousRoles];
                        updated[index].title = e.target.value;
                        updateFormData({ previousRoles: updated });
                      }}
                      className="input-field"
                    />
                    <input
                      type="text"
                      placeholder="Company"
                      value={role.company}
                      onChange={(e) => {
                        const updated = [...formData.previousRoles];
                        updated[index].company = e.target.value;
                        updateFormData({ previousRoles: updated });
                      }}
                      className="input-field"
                    />
                    <input
                      type="text"
                      placeholder="Years"
                      value={role.years}
                      onChange={(e) => {
                        const updated = [...formData.previousRoles];
                        updated[index].years = e.target.value;
                        updateFormData({ previousRoles: updated });
                      }}
                      className="input-field"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePreviousRole(index)}
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Expertise */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
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
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Languages Spoken
              </label>
              <input
                type="text"
                value={formData.languages.join(', ')}
                placeholder="e.g., English, Spanish, Mandarin"
                className="input-field"
                onChange={(e) =>
                  updateFormData({
                    languages: e.target.value.split(',').map((s) => s.trim()),
                  })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Certifications (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g., PMP, AWS Solutions Architect, ICF Coach"
                className="input-field"
                onChange={(e) =>
                  updateFormData({
                    certifications: e.target.value.split(',').map((s) => s.trim()),
                  })
                }
              />
            </div>
          </div>
        )}

        {/* Step 4: Availability */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hourly Rate (USD) *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={formData.hourlyRate}
                    onChange={(e) => updateFormData({ hourlyRate: e.target.value })}
                    className="input-field pl-10"
                    placeholder="100"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Average on ATHENA: $75-$200/hour
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Mentees/Month *
                </label>
                <select
                  value={formData.maxMenteesPerMonth}
                  onChange={(e) => updateFormData({ maxMenteesPerMonth: e.target.value })}
                  className="input-field"
                >
                  <option value="3">Up to 3</option>
                  <option value="5">Up to 5</option>
                  <option value="10">Up to 10</option>
                  <option value="15">Up to 15</option>
                  <option value="unlimited">Unlimited</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Session Lengths Offered *
              </label>
              <div className="flex flex-wrap gap-3">
                {['30', '45', '60', '90'].map((length) => (
                  <label
                    key={length}
                    className={cn(
                      'flex items-center px-4 py-2 rounded-lg border cursor-pointer transition',
                      formData.sessionLength.includes(length)
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={formData.sessionLength.includes(length)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateFormData({ sessionLength: [...formData.sessionLength, length] });
                        } else {
                          updateFormData({
                            sessionLength: formData.sessionLength.filter((l) => l !== length),
                          });
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">{length} min</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Available Days *
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(formData.availability).map(([day, available]) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      updateFormData({
                        availability: { ...formData.availability, [day]: !available },
                      })
                    }
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium capitalize transition',
                      available
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                    )}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Timezone *
              </label>
              <select
                value={formData.timezone}
                onChange={(e) => updateFormData({ timezone: e.target.value })}
                className="input-field"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">GMT/London</option>
                <option value="Europe/Paris">Central European (CET)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
                <option value="Australia/Sydney">Sydney (AEST)</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Name:</span>{' '}
                  <span className="text-gray-900 dark:text-white">
                    {formData.firstName} {formData.lastName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Email:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{formData.email}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Headline:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{formData.headline}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Experience</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Current Role:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{formData.currentRole}</span>
                </div>
                <div>
                  <span className="text-gray-500">Company:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{formData.company}</span>
                </div>
                <div>
                  <span className="text-gray-500">Experience:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{formData.yearsExperience} years</span>
                </div>
                <div>
                  <span className="text-gray-500">Industry:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{formData.industry}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Expertise</h3>
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

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Availability & Pricing</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Hourly Rate:</span>{' '}
                  <span className="text-gray-900 dark:text-white">${formData.hourlyRate}/hour</span>
                </div>
                <div>
                  <span className="text-gray-500">Session Lengths:</span>{' '}
                  <span className="text-gray-900 dark:text-white">
                    {formData.sessionLength.join(', ')} min
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Max Mentees:</span>{' '}
                  <span className="text-gray-900 dark:text-white">
                    {formData.maxMenteesPerMonth}/month
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Timezone:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{formData.timezone}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="terms"
                className="mt-1"
              />
              <label htmlFor="terms" className="text-sm text-gray-600 dark:text-gray-300">
                I agree to the{' '}
                <a href="/terms" className="text-primary-500 hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/mentor-agreement" className="text-primary-500 hover:underline">
                  Mentor Agreement
                </a>
                . I understand that my application will be reviewed and I may be contacted for
                additional information.
              </label>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => prev - 1)}
            disabled={currentStep === 1}
            className={cn(
              'flex items-center space-x-2 px-4 py-2 rounded-lg transition',
              currentStep === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
              disabled={isSubmitting}
              className="btn-primary flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Submit Application</span>
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
