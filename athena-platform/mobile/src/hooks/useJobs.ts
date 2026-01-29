/**
 * Jobs Hooks
 * Phase 5: Mobile Parity - React Query hooks for job search and applications
 */

import { useMutation, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useJobsStore, type Job, type JobFilters, type JobApplication, type ApplicationStatus } from '../stores';
import { api } from '../services/api';

// ============================================
// QUERY KEYS
// ============================================

export const jobKeys = {
  all: ['jobs'] as const,
  list: (filters: JobFilters) => [...jobKeys.all, 'list', filters] as const,
  detail: (id: string) => [...jobKeys.all, 'detail', id] as const,
  featured: () => [...jobKeys.all, 'featured'] as const,
  recommended: () => [...jobKeys.all, 'recommended'] as const,
  saved: () => [...jobKeys.all, 'saved'] as const,
  applications: () => [...jobKeys.all, 'applications'] as const,
  application: (id: string) => [...jobKeys.all, 'application', id] as const,
  company: (id: string) => [...jobKeys.all, 'company', id] as const,
  search: (query: string) => [...jobKeys.all, 'search', query] as const,
};

// ============================================
// HOOKS
// ============================================

/**
 * Search jobs with infinite scroll and filters
 */
export function useJobSearch(filters: JobFilters) {
  const { setJobs, appendJobs, setPagination, setHasMore, setLoading } = useJobsStore();

  return useInfiniteQuery({
    queryKey: jobKeys.list(filters),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get('/jobs', {
        params: {
          ...filters,
          page: pageParam,
          limit: 20,
        },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) {
        return lastPage.nextPage;
      }
      return undefined;
    },
    onSuccess: (data) => {
      const allJobs = data.pages.flatMap((page) => page.jobs);
      if (data.pages.length === 1) {
        setJobs(allJobs);
      } else {
        appendJobs(data.pages[data.pages.length - 1].jobs);
      }
      const lastPage = data.pages[data.pages.length - 1];
      setPagination({
        currentPage: lastPage.page,
        totalPages: lastPage.totalPages,
        totalJobs: lastPage.total,
      });
      setHasMore(lastPage.hasMore);
    },
    onSettled: () => {
      setLoading(false);
    },
  });
}

/**
 * Get single job details
 */
export function useJob(jobId: string) {
  const { addToRecentlyViewed } = useJobsStore();

  return useQuery({
    queryKey: jobKeys.detail(jobId),
    queryFn: async () => {
      const response = await api.get(`/jobs/${jobId}`);
      return response.data;
    },
    enabled: !!jobId,
    staleTime: 5 * 60 * 1000,
    onSuccess: (data) => {
      addToRecentlyViewed(data);
    },
  });
}

/**
 * Get featured jobs
 */
export function useFeaturedJobs() {
  const { setFeaturedJobs } = useJobsStore();

  return useQuery({
    queryKey: jobKeys.featured(),
    queryFn: async () => {
      const response = await api.get('/jobs/featured');
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
    onSuccess: (data) => {
      setFeaturedJobs(data);
    },
  });
}

/**
 * Get AI-recommended jobs
 */
export function useRecommendedJobs() {
  const { setRecommendedJobs } = useJobsStore();

  return useQuery({
    queryKey: jobKeys.recommended(),
    queryFn: async () => {
      const response = await api.get('/jobs/recommended');
      return response.data;
    },
    staleTime: 15 * 60 * 1000,
    onSuccess: (data) => {
      setRecommendedJobs(data);
    },
  });
}

/**
 * Save job mutation (optimistic)
 */
export function useSaveJob() {
  const queryClient = useQueryClient();
  const { saveJob, unsaveJob } = useJobsStore();

  return useMutation({
    mutationFn: async ({ job, isSaved }: { job: Job; isSaved: boolean }) => {
      if (isSaved) {
        await api.delete(`/jobs/${job.id}/save`);
      } else {
        await api.post(`/jobs/${job.id}/save`);
      }
      return { job, isSaved: !isSaved };
    },
    onMutate: async ({ job, isSaved }) => {
      if (isSaved) {
        unsaveJob(job.id);
      } else {
        saveJob(job);
      }
      return { job, wasSaved: isSaved };
    },
    onError: (err, { job }, context) => {
      if (context?.wasSaved) {
        saveJob(job);
      } else {
        unsaveJob(job.id);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.saved() });
    },
  });
}

/**
 * Get saved jobs
 */
export function useSavedJobs() {
  return useInfiniteQuery({
    queryKey: jobKeys.saved(),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get('/jobs/saved', {
        params: { page: pageParam, limit: 20 },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
  });
}

/**
 * Get all applications
 */
export function useApplications() {
  const { setApplications } = useJobsStore();

  return useInfiniteQuery({
    queryKey: jobKeys.applications(),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get('/applications', {
        params: { page: pageParam, limit: 20 },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
    onSuccess: (data) => {
      const allApplications = data.pages.flatMap((page) => page.applications);
      setApplications(allApplications);
    },
  });
}

/**
 * Get single application
 */
export function useApplication(applicationId: string) {
  return useQuery({
    queryKey: jobKeys.application(applicationId),
    queryFn: async () => {
      const response = await api.get(`/applications/${applicationId}`);
      return response.data;
    },
    enabled: !!applicationId,
  });
}

/**
 * Apply to job mutation
 */
export function useApplyToJob() {
  const queryClient = useQueryClient();
  const { addApplication, setApplying } = useJobsStore();

  return useMutation({
    mutationFn: async ({
      jobId,
      coverLetter,
      resumeUrl,
      answers,
    }: {
      jobId: string;
      coverLetter?: string;
      resumeUrl?: string;
      answers?: Record<string, string>;
    }) => {
      setApplying(true);
      const response = await api.post(`/jobs/${jobId}/apply`, {
        coverLetter,
        resumeUrl,
        answers,
      });
      return response.data;
    },
    onSuccess: (data) => {
      addApplication(data);
      queryClient.invalidateQueries({ queryKey: jobKeys.applications() });
    },
    onSettled: () => {
      setApplying(false);
    },
  });
}

/**
 * Withdraw application mutation
 */
export function useWithdrawApplication() {
  const queryClient = useQueryClient();
  const { withdrawApplication } = useJobsStore();

  return useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await api.delete(`/applications/${applicationId}`);
      return response.data;
    },
    onMutate: (applicationId) => {
      withdrawApplication(applicationId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.applications() });
    },
  });
}

/**
 * Update application (e.g., add notes)
 */
export function useUpdateApplication() {
  const queryClient = useQueryClient();
  const { updateApplication } = useJobsStore();

  return useMutation({
    mutationFn: async ({
      applicationId,
      updates,
    }: {
      applicationId: string;
      updates: Partial<JobApplication>;
    }) => {
      const response = await api.patch(`/applications/${applicationId}`, updates);
      return response.data;
    },
    onSuccess: (data, { applicationId }) => {
      updateApplication(applicationId, data);
    },
    onSettled: (_, __, { applicationId }) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.application(applicationId) });
    },
  });
}

/**
 * Save draft application
 */
export function useSaveDraft() {
  const { saveDraftApplication } = useJobsStore();

  return useMutation({
    mutationFn: async (draft: JobApplication) => {
      // Drafts are stored locally only
      return draft;
    },
    onSuccess: (data) => {
      saveDraftApplication(data);
    },
  });
}

/**
 * Get company details
 */
export function useCompany(companyId: string) {
  return useQuery({
    queryKey: jobKeys.company(companyId),
    queryFn: async () => {
      const response = await api.get(`/companies/${companyId}`);
      return response.data;
    },
    enabled: !!companyId,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Get company's jobs
 */
export function useCompanyJobs(companyId: string) {
  return useInfiniteQuery({
    queryKey: [...jobKeys.company(companyId), 'jobs'] as const,
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.get(`/companies/${companyId}/jobs`, {
        params: { page: pageParam, limit: 20 },
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextPage : undefined,
    enabled: !!companyId,
  });
}

/**
 * Quick apply mutation (using saved profile)
 */
export function useQuickApply() {
  const queryClient = useQueryClient();
  const { addApplication, setApplying } = useJobsStore();

  return useMutation({
    mutationFn: async (jobId: string) => {
      setApplying(true);
      const response = await api.post(`/jobs/${jobId}/quick-apply`);
      return response.data;
    },
    onSuccess: (data) => {
      addApplication(data);
      queryClient.invalidateQueries({ queryKey: jobKeys.applications() });
    },
    onSettled: () => {
      setApplying(false);
    },
  });
}

/**
 * Get similar jobs
 */
export function useSimilarJobs(jobId: string) {
  return useQuery({
    queryKey: [...jobKeys.detail(jobId), 'similar'] as const,
    queryFn: async () => {
      const response = await api.get(`/jobs/${jobId}/similar`);
      return response.data;
    },
    enabled: !!jobId,
    staleTime: 15 * 60 * 1000,
  });
}

/**
 * Get job skills match
 */
export function useSkillsMatch(jobId: string) {
  return useQuery({
    queryKey: [...jobKeys.detail(jobId), 'skills-match'] as const,
    queryFn: async () => {
      const response = await api.get(`/jobs/${jobId}/skills-match`);
      return response.data;
    },
    enabled: !!jobId,
  });
}

/**
 * Set job alert
 */
export function useSetJobAlert() {
  const { saveSearch } = useJobsStore();

  return useMutation({
    mutationFn: async ({
      name,
      filters,
      alertEnabled,
    }: {
      name: string;
      filters: JobFilters;
      alertEnabled: boolean;
    }) => {
      const response = await api.post('/jobs/alerts', {
        name,
        filters,
        alertEnabled,
      });
      return response.data;
    },
    onSuccess: (data) => {
      saveSearch(data);
    },
  });
}
