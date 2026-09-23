'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  ArrowLeft,
  Loader2,
  MapPin,
  DollarSign,
  Clock,
  FileText,
  X,
  Plus,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

/**
 * The job list's "Edit Job" item has always linked here, and until now there
 * was nothing at the other end of the link: an employer could publish a listing
 * and then never correct a word of it. The form below edits the same columns
 * the create wizard writes, through the PATCH the list's status menu already
 * uses.
 */
interface EditableJob {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  city: string | null;
  state: string | null;
  isRemote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryType: string | null;
  showSalary: boolean;
  experienceMin: number | null;
  experienceMax: number | null;
  applicationCount: number;
  skills?: { skill: { id: string; name: string } }[];
}

interface JobEditForm {
  title: string;
  description: string;
  type: string;
  status: string;
  city: string;
  state: string;
  isRemote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryType: string;
  showSalary: boolean;
  experienceMin: number | null;
  experienceMax: number | null;
}

const jobTypes = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'CASUAL', label: 'Casual' },
  { value: 'APPRENTICESHIP', label: 'Apprenticeship' },
];

const jobStatuses = [
  { value: 'DRAFT', label: 'Draft — not visible to anyone yet' },
  { value: 'ACTIVE', label: 'Active — open for applications' },
  { value: 'PAUSED', label: 'Paused — hidden, applications closed' },
  { value: 'CLOSED', label: 'Closed — no longer hiring' },
  { value: 'FILLED', label: 'Filled — the role has been filled' },
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

export default function EditJobPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orgId = params.orgId as string;
  const jobId = params.jobId as string;

  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  // The skill chips live outside the form, so react-hook-form's own dirty flag
  // cannot see them and Save would stay greyed out for an employer who only
  // wanted to correct the skill list.
  const [skillsChanged, setSkillsChanged] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<JobEditForm>();

  const { data: jobResponse, isLoading, isError } = useQuery<{ success: boolean; data: EditableJob }>({
    queryKey: ['employer-job', jobId],
    queryFn: async () => {
      const response = await api.get(`/employer/jobs/${jobId}`);
      return response.data;
    },
    enabled: Boolean(jobId),
  });

  const job = jobResponse?.data;

  // The form only has values to show once the listing has come back, so it is
  // filled in here rather than through defaultValues.
  useEffect(() => {
    if (!job) return;
    reset({
      title: job.title,
      description: job.description,
      type: job.type,
      status: job.status,
      city: job.city ?? '',
      state: job.state ?? '',
      isRemote: job.isRemote,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryType: job.salaryType ?? 'annual',
      showSalary: job.showSalary,
      experienceMin: job.experienceMin,
      experienceMax: job.experienceMax,
    });
    setSkills((job.skills ?? []).map((entry) => entry.skill.name));
    setSkillsChanged(false);
  }, [job, reset]);

  const selectedType = watch('type');
  const isRemote = watch('isRemote');

  const updateJobMutation = useMutation({
    mutationFn: async (data: JobEditForm) => {
      const response = await api.patch(`/employer/jobs/${jobId}`, {
        ...data,
        // An empty number input reads back as NaN, which JSON turns into null —
        // and null is what clearing the field should mean.
        salaryMin: Number.isFinite(data.salaryMin) ? data.salaryMin : null,
        salaryMax: Number.isFinite(data.salaryMax) ? data.salaryMax : null,
        experienceMin: Number.isFinite(data.experienceMin) ? data.experienceMin : null,
        experienceMax: Number.isFinite(data.experienceMax) ? data.experienceMax : null,
        skills,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employer-jobs', orgId] });
      queryClient.invalidateQueries({ queryKey: ['employer-job', jobId] });
      toast.success('Job updated');
      router.push(`/employer/organizations/${orgId}/jobs`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update job');
    },
  });

  const addSkill = () => {
    const skill = skillInput.trim();
    if (skill && !skills.some((existing) => existing.toLowerCase() === skill.toLowerCase())) {
      setSkills([...skills, skill]);
      setSkillsChanged(true);
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
    setSkillsChanged(true);
  };

  const onSubmit = (data: JobEditForm) => {
    updateJobMutation.mutate(data);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link
        href={`/employer/organizations/${orgId}/jobs`}
        className="inline-flex items-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Jobs
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Briefcase className="h-7 w-7 text-blue-600" />
          Edit Job
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Changes go live on the public listing as soon as you save.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-slate-500 mt-2">Loading job...</p>
        </div>
      ) : isError || !job ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <Briefcase className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            This job could not be opened
          </h2>
          <p className="text-slate-500 mb-6">
            It may have been removed, or it belongs to another organisation.
          </p>
          <Link href={`/employer/organizations/${orgId}/jobs`}>
            <Button variant="outline">Back to Jobs</Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
            {job.applicationCount > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
                <Users className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  {job.applicationCount} {job.applicationCount === 1 ? 'woman has' : 'women have'}{' '}
                  already applied for this role. Large changes to the description will not reach
                  them, so consider closing this listing and posting a new one instead.
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="job-title"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Job Title *
              </label>
              <input
                id="job-title"
                {...register('title', { required: 'Job title is required' })}
                type="text"
                className="input w-full"
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Clock className="inline h-4 w-4 mr-1" />
                Employment Type *
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {jobTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setValue('type', type.value, { shouldDirty: true })}
                    className={`p-3 rounded-lg border-2 text-center transition ${
                      selectedType === type.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-medium text-slate-900 dark:text-white text-sm">
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>
              <input type="hidden" {...register('type', { required: true })} />
            </div>

            <div>
              <label
                htmlFor="job-status"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Listing Status
              </label>
              <select id="job-status" {...register('status')} className="input w-full">
                {jobStatuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="job-description"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                <FileText className="inline h-4 w-4 mr-1" />
                Job Description *
              </label>
              <textarea
                id="job-description"
                {...register('description', { required: 'Description is required' })}
                rows={10}
                className="input w-full"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="job-skill-input"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Required Skills
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  id="job-skill-input"
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
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
                      <button
                        type="button"
                        aria-label={`Remove ${skill}`}
                        onClick={() => removeSkill(skill)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('isRemote')}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-slate-900 dark:text-white">
                  This is a remote position
                </span>
              </label>
            </div>

            {!isRemote && (
              <div>
                <label
                  htmlFor="job-city"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Location
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    id="job-city"
                    {...register('city')}
                    type="text"
                    className="input w-full"
                    placeholder="City"
                  />
                  <select {...register('state')} className="input w-full" aria-label="State">
                    <option value="">Select state</option>
                    {australianStates.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="job-salary-min"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                <DollarSign className="inline h-4 w-4 mr-1" />
                Salary Range (AUD)
              </label>
              <div className="grid grid-cols-3 gap-4">
                <input
                  id="job-salary-min"
                  {...register('salaryMin', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  className="input w-full"
                  placeholder="Min"
                />
                <input
                  {...register('salaryMax', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  className="input w-full"
                  placeholder="Max"
                  aria-label="Maximum salary"
                />
                <select {...register('salaryType')} className="input w-full" aria-label="Salary period">
                  <option value="annual">Per Year</option>
                  <option value="hourly">Per Hour</option>
                </select>
              </div>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('showSalary')}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Display salary on job listing
                </span>
              </label>
            </div>

            <div>
              <label
                htmlFor="job-experience-min"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Experience Required (years)
              </label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  id="job-experience-min"
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
                  aria-label="Maximum years of experience"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between gap-4 mt-6">
            <Link href={`/employer/organizations/${orgId}/jobs`}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={updateJobMutation.isPending || (!isDirty && !skillsChanged)}
            >
              {updateJobMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
