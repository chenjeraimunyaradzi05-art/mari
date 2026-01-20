'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  Building2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Globe,
  MapPin,
  Users,
  Palette,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

interface CreateOrgForm {
  name: string;
  type: string;
  description: string;
  website: string;
  industry: string;
  size: string;
  city: string;
  state: string;
  country: string;
  brandColor: string;
}

const orgTypes = [
  { value: 'company', label: 'Company', description: 'For-profit business' },
  { value: 'university', label: 'University', description: 'Higher education institution' },
  { value: 'tafe', label: 'TAFE', description: 'Technical and Further Education' },
  { value: 'government', label: 'Government', description: 'Government agency' },
  { value: 'ngo', label: 'NGO', description: 'Non-profit organization' },
];

const companySizes = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5000+',
];

const industries = [
  'Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Retail',
  'Manufacturing',
  'Media & Entertainment',
  'Professional Services',
  'Real Estate',
  'Government',
  'Non-Profit',
  'Other',
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

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateOrgForm>({
    defaultValues: {
      country: 'Australia',
      brandColor: '#6366f1',
    },
  });

  const selectedType = watch('type');
  const brandColor = watch('brandColor');

  const createOrgMutation = useMutation({
    mutationFn: async (data: CreateOrgForm) => {
      const response = await api.post('/employer/organizations', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Organization created successfully!');
      router.push(`/employer/organizations/${data.data.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create organization');
    },
  });

  const onSubmit = (data: CreateOrgForm) => {
    createOrgMutation.mutate(data);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Back Button */}
      <Link
        href="/employer"
        className="inline-flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Employer Dashboard
      </Link>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Create Your Organization
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Set up your company profile to start posting jobs on ATHENA
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
                Basic Information
              </h2>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Organization Name *
                </label>
                <input
                  {...register('name', { required: 'Organization name is required' })}
                  type="text"
                  className="input w-full"
                  placeholder="e.g., Acme Corporation"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organization Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {orgTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setValue('type', type.value)}
                      className={`p-4 rounded-lg border-2 text-left transition ${
                        selectedType === type.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {type.label}
                      </div>
                      <div className="text-xs text-gray-500">{type.description}</div>
                    </button>
                  ))}
                </div>
                <input type="hidden" {...register('type', { required: true })} />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  rows={4}
                  className="input w-full"
                  placeholder="Tell us about your organization..."
                />
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
                Company Details
              </h2>

              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Globe className="inline h-4 w-4 mr-1" />
                  Website
                </label>
                <input
                  {...register('website')}
                  type="url"
                  className="input w-full"
                  placeholder="https://www.yourcompany.com"
                />
              </div>

              {/* Industry & Size */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Industry
                  </label>
                  <select {...register('industry')} className="input w-full">
                    <option value="">Select industry</option>
                    {industries.map((ind) => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Users className="inline h-4 w-4 mr-1" />
                    Company Size
                  </label>
                  <select {...register('size')} className="input w-full">
                    <option value="">Select size</option>
                    {companySizes.map((size) => (
                      <option key={size} value={size}>{size} employees</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location */}
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
                Branding
              </h2>

              {/* Brand Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Palette className="inline h-4 w-4 mr-1" />
                  Brand Color
                </label>
                <div className="flex items-center gap-4">
                  <input
                    {...register('brandColor')}
                    type="color"
                    className="w-16 h-12 rounded-lg border-2 border-gray-200 cursor-pointer"
                  />
                  <div
                    className="flex-1 h-12 rounded-lg flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: brandColor }}
                  >
                    Preview: Your Career Page
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  This color will be used on your public career page
                </p>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Summary</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Organization:</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">{watch('name') || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Type:</dt>
                    <dd className="font-medium text-gray-900 dark:text-white capitalize">{watch('type') || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Industry:</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">{watch('industry') || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Location:</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">
                      {[watch('city'), watch('state')].filter(Boolean).join(', ') || '-'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button type="submit" disabled={createOrgMutation.isPending}>
                  {createOrgMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Organization
                      <Building2 className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
