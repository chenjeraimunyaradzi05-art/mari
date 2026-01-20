'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  Briefcase,
  ArrowLeft,
  ArrowRight,
  Loader2,
  MapPin,
  DollarSign,
  Clock,
  FileText,
  Globe,
  Mail,
  X,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

interface JobForm {
  title: string;
  description: string;
  type: string;
  city: string;
  state: string;
  country: string;
  isRemote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryType: string;
  showSalary: boolean;
  experienceMin: number | null;
  experienceMax: number | null;
  benefits: string;
  applicationUrl: string;
  applicationEmail: string;
  status: string;
}

const jobTypes = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'CASUAL', label: 'Casual' },
];

const australianStates = [
  'Australian Capital Territory',
  'New South Wales',
  'Northern Territory',
  'Queensland',
  'South Australia',
  'Tasmania',
  'Victoria',
  'Western Australia',
];

export default function CreateJobPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const [step, setStep] = useState(1);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<JobForm>({
    defaultValues: {
      country: 'Australia',
      isRemote: false,
      showSalary: true,
      salaryType: 'annual',
      status: 'DRAFT',
    },
  });

  const selectedType = watch('type');
  const isRemote = watch('isRemote');

  const createJobMutation = useMutation({
    mutationFn: async (data: JobForm) => {
      const response = await api.post(`/employer/organizations/${orgId}/jobs`, {
        ...data,
        skills,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Job created successfully!');
      router.push(`/employer/organizations/${orgId}/jobs`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create job');
    },
  });

  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const onSubmit = (data: JobForm) => {
    createJobMutation.mutate(data);
  };

  const publishJob = () => {
    setValue('status', 'ACTIVE');
    handleSubmit(onSubmit)();
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Back Button */}
      <Link
        href={`/employer/organizations/${orgId}/jobs`}
        className="inline-flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Jobs
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Briefcase className="h-7 w-7 text-blue-600" />
          Post a New Job
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Create a job listing to attract top talent on ATHENA
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        <div className={`h-1 flex-1 rounded ${step >= 1 ? 'bg-blue-500' : 'bg-gray-200'}`} />
        <div className={`h-1 flex-1 rounded ${step >= 2 ? 'bg-blue-500' : 'bg-gray-200'}`} />
        <div className={`h-1 flex-1 rounded ${step >= 3 ? 'bg-blue-500' : 'bg-gray-200'}`} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Job Details
              </h2>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Job Title *
                </label>
                <input
                  {...register('title', { required: 'Job title is required' })}
                  type="text"
                  className="input w-full"
                  placeholder="e.g., Senior Software Engineer"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Clock className="inline h-4 w-4 mr-1" />
                  Employment Type *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {jobTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setValue('type', type.value)}
                      className={`p-3 rounded-lg border-2 text-center transition ${
                        selectedType === type.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {type.label}
                      </span>
                    </button>
                  ))}
                </div>
                <input type="hidden" {...register('type', { required: true })} />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <FileText className="inline h-4 w-4 mr-1" />
                  Job Description *
                </label>
                <textarea
                  {...register('description', { required: 'Description is required' })}
                  rows={8}
                  className="input w-full"
                  placeholder="Describe the role, responsibilities, and what you're looking for..."
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              {/* Skills */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Required Skills
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                    className="input flex-1"
                    placeholder="Type a skill and press Enter"
                  />
                  <Button type="button" variant="outline" onClick={addSkill}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                      >
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={() => setStep(2)} disabled={!selectedType}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Location & Compensation
              </h2>

              {/* Remote Option */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('isRemote')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-900 dark:text-white">
                    This is a remote position
                  </span>
                </label>
              </div>

              {/* Location */}
              {!isRemote && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    Location
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      {...register('city')}
                      type="text"
                      className="input w-full"
                      placeholder="City"
                    />
                    <select {...register('state')} className="input w-full">
                      <option value="">Select state</option>
                      {australianStates.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Salary */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <DollarSign className="inline h-4 w-4 mr-1" />
                  Salary Range (AUD)
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <input
                    {...register('salaryMin', { valueAsNumber: true })}
                    type="number"
                    className="input w-full"
                    placeholder="Min"
                  />
                  <input
                    {...register('salaryMax', { valueAsNumber: true })}
                    type="number"
                    className="input w-full"
                    placeholder="Max"
                  />
                  <select {...register('salaryType')} className="input w-full">
                    <option value="annual">Per Year</option>
                    <option value="hourly">Per Hour</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('showSalary')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Display salary on job listing
                  </span>
                </label>
              </div>

              {/* Experience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Experience Required (years)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    {...register('experienceMin', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    className="input w-full"
                    placeholder="Minimum"
                  />
                  <input
                    {...register('experienceMax', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    className="input w-full"
                    placeholder="Maximum"
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button type="button" onClick={() => setStep(3)}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Application Settings
              </h2>

              {/* Benefits */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Benefits & Perks
                </label>
                <textarea
                  {...register('benefits')}
                  rows={4}
                  className="input w-full"
                  placeholder="e.g., Health insurance, Flexible hours, Professional development..."
                />
              </div>

              {/* Application URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Globe className="inline h-4 w-4 mr-1" />
                  External Application URL (optional)
                </label>
                <input
                  {...register('applicationUrl')}
                  type="url"
                  className="input w-full"
                  placeholder="https://yourcompany.com/apply"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank to receive applications through ATHENA
                </p>
              </div>

              {/* Application Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Mail className="inline h-4 w-4 mr-1" />
                  Application Email (optional)
                </label>
                <input
                  {...register('applicationEmail')}
                  type="email"
                  className="input w-full"
                  placeholder="jobs@yourcompany.com"
                />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Job Summary</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Title:</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">{watch('title') || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Type:</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">{watch('type') || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Location:</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">
                      {isRemote ? 'Remote' : [watch('city'), watch('state')].filter(Boolean).join(', ') || '-'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Skills:</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">{skills.length} added</dd>
                  </div>
                </dl>
              </div>

              <div className="flex justify-between gap-4">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={createJobMutation.isPending}
                  >
                    Save as Draft
                  </Button>
                  <Button
                    type="button"
                    onClick={publishJob}
                    disabled={createJobMutation.isPending}
                  >
                    {createJobMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      'Publish Job'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
