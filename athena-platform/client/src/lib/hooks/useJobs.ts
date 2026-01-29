'use client';

/**
 * Jobs Manager Hooks
 * Phase 4: Web Client - Persona Studios
 * React Query hooks for Jobs Manager features
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useJobsStore } from '@/lib/stores/jobs.store';
import type { 
  Job, 
  Candidate, 
  Interview,
  StageId,
  JobStatus,
  JobType,
  CandidateNote
} from '@/lib/stores/jobs.store';

// ============================================
// QUERY KEYS
// ============================================

export const jobsKeys = {
  all: ['jobs'] as const,
  list: () => [...jobsKeys.all, 'list'] as const,
  job: (id: string) => [...jobsKeys.all, id] as const,
  candidates: (jobId: string) => [...jobsKeys.all, 'candidates', jobId] as const,
  candidate: (id: string) => [...jobsKeys.all, 'candidate', id] as const,
  interviews: (jobId?: string) => [...jobsKeys.all, 'interviews', jobId || 'all'] as const,
  analytics: (jobId: string) => [...jobsKeys.all, 'analytics', jobId] as const,
};

// ============================================
// API FUNCTIONS
// ============================================

const jobsApi = {
  // Jobs
  getJobs: async (): Promise<Job[]> => {
    const response = await fetch('/api/employer/jobs', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch jobs');
    const { data } = await response.json();
    return data;
  },

  getJob: async (id: string): Promise<Job> => {
    const response = await fetch(`/api/employer/jobs/${id}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch job');
    const { data } = await response.json();
    return data;
  },

  createJob: async (data: Partial<Job>): Promise<Job> => {
    const response = await fetch('/api/employer/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create job');
    const { data: job } = await response.json();
    return job;
  },

  updateJob: async (id: string, data: Partial<Job>): Promise<Job> => {
    const response = await fetch(`/api/employer/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update job');
    const { data: job } = await response.json();
    return job;
  },

  deleteJob: async (id: string): Promise<void> => {
    const response = await fetch(`/api/employer/jobs/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to delete job');
  },

  publishJob: async (id: string): Promise<Job> => {
    const response = await fetch(`/api/employer/jobs/${id}/publish`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to publish job');
    const { data } = await response.json();
    return data;
  },

  closeJob: async (id: string): Promise<Job> => {
    const response = await fetch(`/api/employer/jobs/${id}/close`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to close job');
    const { data } = await response.json();
    return data;
  },

  // Candidates
  getCandidates: async (jobId: string): Promise<Candidate[]> => {
    const response = await fetch(`/api/employer/jobs/${jobId}/candidates`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch candidates');
    const { data } = await response.json();
    return data;
  },

  getCandidate: async (id: string): Promise<Candidate> => {
    const response = await fetch(`/api/employer/candidates/${id}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch candidate');
    const { data } = await response.json();
    return data;
  },

  updateCandidate: async (id: string, data: Partial<Candidate>): Promise<Candidate> => {
    const response = await fetch(`/api/employer/candidates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update candidate');
    const { data: candidate } = await response.json();
    return candidate;
  },

  moveCandidate: async (candidateId: string, toStage: StageId): Promise<Candidate> => {
    const response = await fetch(`/api/employer/candidates/${candidateId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ stage: toStage }),
    });
    if (!response.ok) throw new Error('Failed to move candidate');
    const { data } = await response.json();
    return data;
  },

  bulkMoveCandidates: async (candidateIds: string[], toStage: StageId): Promise<void> => {
    const response = await fetch('/api/employer/candidates/bulk-move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ candidateIds, stage: toStage }),
    });
    if (!response.ok) throw new Error('Failed to move candidates');
  },

  bulkRejectCandidates: async (candidateIds: string[], reason?: string): Promise<void> => {
    const response = await fetch('/api/employer/candidates/bulk-reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ candidateIds, reason }),
    });
    if (!response.ok) throw new Error('Failed to reject candidates');
  },

  addNote: async (candidateId: string, content: string): Promise<CandidateNote> => {
    const response = await fetch(`/api/employer/candidates/${candidateId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content }),
    });
    if (!response.ok) throw new Error('Failed to add note');
    const { data } = await response.json();
    return data;
  },

  // Interviews
  scheduleInterview: async (candidateId: string, interview: Omit<Interview, 'id' | 'candidateId'>): Promise<Interview> => {
    const response = await fetch(`/api/employer/candidates/${candidateId}/interviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(interview),
    });
    if (!response.ok) throw new Error('Failed to schedule interview');
    const { data } = await response.json();
    return data;
  },

  updateInterview: async (candidateId: string, interviewId: string, data: Partial<Interview>): Promise<Interview> => {
    const response = await fetch(`/api/employer/candidates/${candidateId}/interviews/${interviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update interview');
    const { data: interview } = await response.json();
    return interview;
  },

  submitFeedback: async (candidateId: string, interviewId: string, feedback: Interview['feedback']): Promise<Interview> => {
    const response = await fetch(`/api/employer/candidates/${candidateId}/interviews/${interviewId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(feedback),
    });
    if (!response.ok) throw new Error('Failed to submit feedback');
    const { data } = await response.json();
    return data;
  },
};

// ============================================
// JOB HOOKS
// ============================================

/**
 * Fetch all jobs
 */
export function useJobs() {
  const { setJobs, setLoading, setError } = useJobsStore();

  return useQuery({
    queryKey: jobsKeys.list(),
    queryFn: async () => {
      setLoading('jobs', true);
      try {
        const jobs = await jobsApi.getJobs();
        setJobs(jobs);
        setLoading('jobs', false);
        return jobs;
      } catch (error) {
        setError('jobs', 'Failed to load jobs');
        setLoading('jobs', false);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch single job
 */
export function useJob(id: string) {
  return useQuery({
    queryKey: jobsKeys.job(id),
    queryFn: () => jobsApi.getJob(id),
    enabled: !!id,
  });
}

/**
 * Create a new job
 */
export function useCreateJob() {
  const queryClient = useQueryClient();
  const { addJob, setSelectedJob } = useJobsStore();

  return useMutation({
    mutationFn: (data: Partial<Job>) => jobsApi.createJob({
      ...data,
      status: 'draft',
      views: 0,
      applications: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    onSuccess: (job) => {
      addJob(job);
      setSelectedJob(job.id);
      queryClient.invalidateQueries({ queryKey: jobsKeys.list() });
    },
  });
}

/**
 * Update a job
 */
export function useUpdateJob() {
  const queryClient = useQueryClient();
  const { updateJob } = useJobsStore();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Job> }) =>
      jobsApi.updateJob(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: jobsKeys.job(id) });
      updateJob(id, data);
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.job(id) });
      queryClient.invalidateQueries({ queryKey: jobsKeys.list() });
    },
  });
}

/**
 * Delete a job
 */
export function useDeleteJob() {
  const queryClient = useQueryClient();
  const { removeJob } = useJobsStore();

  return useMutation({
    mutationFn: (id: string) => jobsApi.deleteJob(id),
    onSuccess: (_, id) => {
      removeJob(id);
      queryClient.invalidateQueries({ queryKey: jobsKeys.list() });
    },
  });
}

/**
 * Publish a job
 */
export function usePublishJob() {
  const queryClient = useQueryClient();
  const { publishJob } = useJobsStore();

  return useMutation({
    mutationFn: (id: string) => jobsApi.publishJob(id),
    onMutate: async (id) => {
      publishJob(id);
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.job(id) });
      queryClient.invalidateQueries({ queryKey: jobsKeys.list() });
    },
  });
}

/**
 * Close a job
 */
export function useCloseJob() {
  const queryClient = useQueryClient();
  const { closeJob } = useJobsStore();

  return useMutation({
    mutationFn: (id: string) => jobsApi.closeJob(id),
    onMutate: async (id) => {
      closeJob(id);
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.job(id) });
      queryClient.invalidateQueries({ queryKey: jobsKeys.list() });
    },
  });
}

// ============================================
// CANDIDATE HOOKS
// ============================================

/**
 * Fetch candidates for a job
 */
export function useCandidates(jobId: string) {
  const { setCandidates, setLoading, setError } = useJobsStore();

  return useQuery({
    queryKey: jobsKeys.candidates(jobId),
    queryFn: async () => {
      setLoading('candidates', true);
      try {
        const candidates = await jobsApi.getCandidates(jobId);
        setCandidates(candidates);
        setLoading('candidates', false);
        return candidates;
      } catch (error) {
        setError('candidates', 'Failed to load candidates');
        setLoading('candidates', false);
        throw error;
      }
    },
    enabled: !!jobId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetch single candidate
 */
export function useCandidate(id: string) {
  return useQuery({
    queryKey: jobsKeys.candidate(id),
    queryFn: () => jobsApi.getCandidate(id),
    enabled: !!id,
  });
}

/**
 * Move candidate to different stage (drag-and-drop)
 */
export function useMoveCandidate() {
  const queryClient = useQueryClient();
  const { moveCandidateOptimistic, revertCandidateMove, selectedJobId } = useJobsStore();

  return useMutation({
    mutationFn: ({ candidateId, fromStage, toStage }: { 
      candidateId: string; 
      fromStage: StageId;
      toStage: StageId 
    }) => jobsApi.moveCandidate(candidateId, toStage),
    onMutate: async ({ candidateId, fromStage, toStage }) => {
      // Optimistic update
      moveCandidateOptimistic(candidateId, fromStage, toStage);
      return { candidateId, fromStage };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context) {
        revertCandidateMove(context.candidateId, context.fromStage);
      }
    },
    onSettled: () => {
      if (selectedJobId) {
        queryClient.invalidateQueries({ queryKey: jobsKeys.candidates(selectedJobId) });
      }
    },
  });
}

/**
 * Bulk move candidates
 */
export function useBulkMoveCandidates() {
  const queryClient = useQueryClient();
  const { bulkMoveCandidate, selectedJobId } = useJobsStore();

  return useMutation({
    mutationFn: ({ candidateIds, toStage }: { candidateIds: string[]; toStage: StageId }) =>
      jobsApi.bulkMoveCandidates(candidateIds, toStage),
    onMutate: async ({ toStage }) => {
      bulkMoveCandidate(toStage);
    },
    onSettled: () => {
      if (selectedJobId) {
        queryClient.invalidateQueries({ queryKey: jobsKeys.candidates(selectedJobId) });
      }
    },
  });
}

/**
 * Bulk reject candidates
 */
export function useBulkRejectCandidates() {
  const queryClient = useQueryClient();
  const { bulkRejectCandidates, selectedJobId } = useJobsStore();

  return useMutation({
    mutationFn: ({ candidateIds, reason }: { candidateIds: string[]; reason?: string }) =>
      jobsApi.bulkRejectCandidates(candidateIds, reason),
    onMutate: async ({ reason }) => {
      bulkRejectCandidates(reason);
    },
    onSettled: () => {
      if (selectedJobId) {
        queryClient.invalidateQueries({ queryKey: jobsKeys.candidates(selectedJobId) });
      }
    },
  });
}

/**
 * Add note to candidate
 */
export function useAddCandidateNote() {
  const queryClient = useQueryClient();
  const { addCandidateNote } = useJobsStore();

  return useMutation({
    mutationFn: ({ candidateId, content, authorId, authorName }: { 
      candidateId: string; 
      content: string;
      authorId: string;
      authorName: string;
    }) => jobsApi.addNote(candidateId, content),
    onMutate: async ({ candidateId, content, authorId, authorName }) => {
      addCandidateNote(candidateId, { authorId, authorName, content });
    },
    onSettled: (_, __, { candidateId }) => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.candidate(candidateId) });
    },
  });
}

/**
 * Rate a candidate
 */
export function useRateCandidate() {
  const queryClient = useQueryClient();
  const { rateCandidate, selectedJobId } = useJobsStore();

  return useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) =>
      jobsApi.updateCandidate(id, { rating }),
    onMutate: async ({ id, rating }) => {
      rateCandidate(id, rating);
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.candidate(id) });
      if (selectedJobId) {
        queryClient.invalidateQueries({ queryKey: jobsKeys.candidates(selectedJobId) });
      }
    },
  });
}

// ============================================
// INTERVIEW HOOKS
// ============================================

/**
 * Schedule an interview
 */
export function useScheduleInterview() {
  const queryClient = useQueryClient();
  const { scheduleInterview, selectedJobId } = useJobsStore();

  return useMutation({
    mutationFn: ({ candidateId, interview }: { 
      candidateId: string; 
      interview: Omit<Interview, 'id' | 'candidateId'> 
    }) => jobsApi.scheduleInterview(candidateId, interview),
    onMutate: async ({ candidateId, interview }) => {
      scheduleInterview(candidateId, interview);
    },
    onSettled: (_, __, { candidateId }) => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.candidate(candidateId) });
      if (selectedJobId) {
        queryClient.invalidateQueries({ queryKey: jobsKeys.interviews(selectedJobId) });
      }
    },
  });
}

/**
 * Update an interview
 */
export function useUpdateInterview() {
  const queryClient = useQueryClient();
  const { updateInterview, selectedJobId } = useJobsStore();

  return useMutation({
    mutationFn: ({ candidateId, interviewId, data }: { 
      candidateId: string; 
      interviewId: string;
      data: Partial<Interview>;
    }) => jobsApi.updateInterview(candidateId, interviewId, data),
    onMutate: async ({ candidateId, interviewId, data }) => {
      updateInterview(candidateId, interviewId, data);
    },
    onSettled: (_, __, { candidateId }) => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.candidate(candidateId) });
      if (selectedJobId) {
        queryClient.invalidateQueries({ queryKey: jobsKeys.interviews(selectedJobId) });
      }
    },
  });
}

/**
 * Submit interview feedback
 */
export function useSubmitInterviewFeedback() {
  const queryClient = useQueryClient();
  const { submitInterviewFeedback, selectedJobId } = useJobsStore();

  return useMutation({
    mutationFn: ({ candidateId, interviewId, feedback }: { 
      candidateId: string; 
      interviewId: string;
      feedback: Interview['feedback'];
    }) => jobsApi.submitFeedback(candidateId, interviewId, feedback),
    onMutate: async ({ candidateId, interviewId, feedback }) => {
      submitInterviewFeedback(candidateId, interviewId, feedback);
    },
    onSettled: (_, __, { candidateId }) => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.candidate(candidateId) });
      if (selectedJobId) {
        queryClient.invalidateQueries({ queryKey: jobsKeys.interviews(selectedJobId) });
      }
    },
  });
}
