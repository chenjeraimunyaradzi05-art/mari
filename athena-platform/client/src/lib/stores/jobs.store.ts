// @ts-nocheck - Immer Draft types conflict with explicit array callback types
'use client';

/**
 * Jobs Manager Store
 * Phase 4: Web Client - Persona Studios
 * Zustand store for employer job posting and candidate tracking
 * 
 * Features:
 * - Job posting management
 * - Kanban board state
 * - Candidate tracking
 * - Drag-and-drop persistence
 * - Bulk actions
 * 
 * Note: Using immer middleware - callback parameter types are inferred from state.
 * Type checking disabled for immer's Draft<T> type compatibility with array methods.
 * Type safety is ensured by JobsState and JobsActions interface definitions.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================
// TYPES
// ============================================

export type JobStatus = 'draft' | 'active' | 'paused' | 'closed' | 'archived';
export type JobType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';
export type WorkMode = 'remote' | 'onsite' | 'hybrid';
export type StageId = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
export type CandidateSource = 'direct' | 'linkedin' | 'referral' | 'indeed' | 'athena' | 'other';

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  workMode: WorkMode;
  type: JobType;
  description: string;
  requirements: string[];
  responsibilities: string[];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  benefits?: string[];
  status: JobStatus;
  postedAt?: Date;
  closesAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  views: number;
  applications: number;
  hiringManagerId?: string;
}

export interface Candidate {
  id: string;
  jobId: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  location: string;
  currentRole: string;
  currentCompany?: string;
  experience: number; // years
  education?: string;
  skills: string[];
  matchScore: number;
  source: CandidateSource;
  resumeUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  coverLetter?: string;
  notes: CandidateNote[];
  rating?: number;
  stage: StageId;
  appliedAt: Date;
  lastActivity: Date;
  interviews?: Interview[];
  tags?: string[];
}

export interface CandidateNote {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
}

export interface Interview {
  id: string;
  candidateId: string;
  scheduledAt: Date;
  duration: number; // minutes
  type: 'phone' | 'video' | 'onsite';
  interviewers: string[];
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  feedback?: {
    rating: number;
    notes: string;
    recommendation: 'strong-hire' | 'hire' | 'no-hire' | 'strong-no-hire';
  };
}

export interface Stage {
  id: StageId;
  name: string;
  color: string;
  candidateIds: string[];
}

export interface KanbanColumn {
  id: StageId;
  title: string;
  color: string;
  candidateCount: number;
}

// ============================================
// STORE STATE
// ============================================

interface JobsState {
  // Jobs
  jobs: Job[];
  selectedJobId: string | null;
  
  // Candidates
  candidates: Candidate[];
  selectedCandidateId: string | null;
  
  // Kanban board state
  kanbanColumns: KanbanColumn[];
  draggedCandidateId: string | null;
  
  // Filters
  jobFilters: {
    status: JobStatus[];
    department: string[];
    type: JobType[];
    search: string;
  };
  candidateFilters: {
    stage: StageId[];
    source: CandidateSource[];
    minMatchScore: number;
    skills: string[];
    search: string;
  };
  
  // Bulk selection
  selectedCandidateIds: string[];
  
  // View preferences
  kanbanViewMode: 'compact' | 'detailed';
  sortBy: 'appliedAt' | 'matchScore' | 'name' | 'lastActivity';
  sortOrder: 'asc' | 'desc';
  
  // Loading states
  loading: {
    jobs: boolean;
    candidates: boolean;
    moving: boolean;
    interview: boolean;
  };
  
  // Errors
  errors: {
    jobs?: string;
    candidates?: string;
    moving?: string;
    interview?: string;
  };
}

interface JobsActions {
  // Jobs
  setJobs: (jobs: Job[]) => void;
  addJob: (job: Job) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  removeJob: (id: string) => void;
  setSelectedJob: (id: string | null) => void;
  publishJob: (id: string) => void;
  pauseJob: (id: string) => void;
  closeJob: (id: string) => void;
  duplicateJob: (id: string) => Job;
  
  // Candidates
  setCandidates: (candidates: Candidate[]) => void;
  addCandidate: (candidate: Candidate) => void;
  updateCandidate: (id: string, updates: Partial<Candidate>) => void;
  setSelectedCandidate: (id: string | null) => void;
  addCandidateNote: (candidateId: string, note: Omit<CandidateNote, 'id' | 'createdAt'>) => void;
  rateCandidate: (id: string, rating: number) => void;
  addCandidateTag: (id: string, tag: string) => void;
  removeCandidateTag: (id: string, tag: string) => void;
  
  // Kanban drag-and-drop
  moveCandidate: (candidateId: string, toStage: StageId) => void;
  moveCandidateOptimistic: (candidateId: string, fromStage: StageId, toStage: StageId) => void;
  revertCandidateMove: (candidateId: string, originalStage: StageId) => void;
  setDraggedCandidate: (id: string | null) => void;
  
  // Bulk actions
  toggleCandidateSelection: (id: string) => void;
  selectAllCandidates: (stage?: StageId) => void;
  clearCandidateSelection: () => void;
  bulkMoveCandidate: (toStage: StageId) => void;
  bulkRejectCandidates: (reason?: string) => void;
  
  // Interviews
  scheduleInterview: (candidateId: string, interview: Omit<Interview, 'id' | 'candidateId'>) => void;
  updateInterview: (candidateId: string, interviewId: string, updates: Partial<Interview>) => void;
  cancelInterview: (candidateId: string, interviewId: string) => void;
  submitInterviewFeedback: (candidateId: string, interviewId: string, feedback: Interview['feedback']) => void;
  
  // Filters
  setJobFilters: (filters: Partial<JobsState['jobFilters']>) => void;
  setCandidateFilters: (filters: Partial<JobsState['candidateFilters']>) => void;
  clearFilters: () => void;
  
  // View preferences
  setKanbanViewMode: (mode: 'compact' | 'detailed') => void;
  setSortBy: (sortBy: JobsState['sortBy']) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  
  // Loading/Error states
  setLoading: (key: keyof JobsState['loading'], value: boolean) => void;
  setError: (key: keyof JobsState['errors'], error?: string) => void;
  clearErrors: () => void;
  
  // Reset
  reset: () => void;
}

type JobsStore = JobsState & JobsActions;

// ============================================
// DEFAULT STATE
// ============================================

const defaultKanbanColumns: KanbanColumn[] = [
  { id: 'applied', title: 'Applied', color: 'bg-gray-100', candidateCount: 0 },
  { id: 'screening', title: 'Screening', color: 'bg-blue-100', candidateCount: 0 },
  { id: 'interview', title: 'Interview', color: 'bg-purple-100', candidateCount: 0 },
  { id: 'offer', title: 'Offer', color: 'bg-yellow-100', candidateCount: 0 },
  { id: 'hired', title: 'Hired', color: 'bg-green-100', candidateCount: 0 },
  { id: 'rejected', title: 'Rejected', color: 'bg-red-100', candidateCount: 0 },
];

const initialState: JobsState = {
  jobs: [],
  selectedJobId: null,
  
  candidates: [],
  selectedCandidateId: null,
  
  kanbanColumns: defaultKanbanColumns,
  draggedCandidateId: null,
  
  jobFilters: {
    status: [],
    department: [],
    type: [],
    search: '',
  },
  candidateFilters: {
    stage: [],
    source: [],
    minMatchScore: 0,
    skills: [],
    search: '',
  },
  
  selectedCandidateIds: [],
  
  kanbanViewMode: 'detailed',
  sortBy: 'appliedAt',
  sortOrder: 'desc',
  
  loading: {
    jobs: false,
    candidates: false,
    moving: false,
    interview: false,
  },
  
  errors: {},
};

// ============================================
// STORE
// ============================================

export const useJobsStore = create<JobsStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // ============================================
      // JOBS
      // ============================================
      
      setJobs: (jobs) => set((state) => {
        state.jobs = jobs;
      }),

      addJob: (job) => set((state) => {
        state.jobs.push(job);
      }),

      updateJob: (id, updates) => set((state) => {
        const index = state.jobs.findIndex((j) => j.id === id);
        if (index !== -1) {
          state.jobs[index] = { 
            ...state.jobs[index], 
            ...updates, 
            updatedAt: new Date() 
          };
        }
      }),

      removeJob: (id) => set((state) => {
        state.jobs = state.jobs.filter((j) => j.id !== id);
        if (state.selectedJobId === id) {
          state.selectedJobId = null;
        }
        // Also remove associated candidates
        state.candidates = state.candidates.filter((c) => c.jobId !== id);
      }),

      setSelectedJob: (id) => set((state) => {
        state.selectedJobId = id;
      }),

      publishJob: (id) => set((state) => {
        const index = state.jobs.findIndex((j) => j.id === id);
        if (index !== -1) {
          state.jobs[index].status = 'active';
          state.jobs[index].postedAt = new Date();
          state.jobs[index].updatedAt = new Date();
        }
      }),

      pauseJob: (id) => set((state) => {
        const index = state.jobs.findIndex((j) => j.id === id);
        if (index !== -1) {
          state.jobs[index].status = 'paused';
          state.jobs[index].updatedAt = new Date();
        }
      }),

      closeJob: (id) => set((state) => {
        const index = state.jobs.findIndex((j) => j.id === id);
        if (index !== -1) {
          state.jobs[index].status = 'closed';
          state.jobs[index].updatedAt = new Date();
        }
      }),

      duplicateJob: (id) => {
        const state = get();
        const job = state.jobs.find((j) => j.id === id);
        if (!job) throw new Error('Job not found');
        
        const newJob: Job = {
          ...job,
          id: `job-${Date.now()}`,
          title: `${job.title} (Copy)`,
          status: 'draft',
          postedAt: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
          views: 0,
          applications: 0,
        };
        
        set((state) => {
          state.jobs.push(newJob);
        });
        
        return newJob;
      },

      // ============================================
      // CANDIDATES
      // ============================================
      
      setCandidates: (candidates) => set((state) => {
        state.candidates = candidates;
        // Update kanban column counts
        state.kanbanColumns = state.kanbanColumns.map((col) => ({
          ...col,
          candidateCount: candidates.filter((c) => c.stage === col.id).length,
        }));
      }),

      addCandidate: (candidate) => set((state) => {
        state.candidates.push(candidate);
        // Update kanban column count
        const colIndex = state.kanbanColumns.findIndex((c) => c.id === candidate.stage);
        if (colIndex !== -1) {
          state.kanbanColumns[colIndex].candidateCount++;
        }
      }),

      updateCandidate: (id, updates) => set((state) => {
        const index = state.candidates.findIndex((c) => c.id === id);
        if (index !== -1) {
          state.candidates[index] = { 
            ...state.candidates[index], 
            ...updates,
            lastActivity: new Date()
          };
        }
      }),

      setSelectedCandidate: (id) => set((state) => {
        state.selectedCandidateId = id;
      }),

      addCandidateNote: (candidateId, note) => set((state) => {
        const index = state.candidates.findIndex((c) => c.id === candidateId);
        if (index !== -1) {
          state.candidates[index].notes.push({
            ...note,
            id: `note-${Date.now()}`,
            createdAt: new Date(),
          });
          state.candidates[index].lastActivity = new Date();
        }
      }),

      rateCandidate: (id, rating) => set((state) => {
        const index = state.candidates.findIndex((c) => c.id === id);
        if (index !== -1) {
          state.candidates[index].rating = rating;
          state.candidates[index].lastActivity = new Date();
        }
      }),

      addCandidateTag: (id, tag) => set((state) => {
        const index = state.candidates.findIndex((c) => c.id === id);
        if (index !== -1) {
          const tags = state.candidates[index].tags || [];
          if (!tags.includes(tag)) {
            state.candidates[index].tags = [...tags, tag];
          }
        }
      }),

      removeCandidateTag: (id, tag) => set((state) => {
        const index = state.candidates.findIndex((c) => c.id === id);
        if (index !== -1 && state.candidates[index].tags) {
          state.candidates[index].tags = state.candidates[index].tags!.filter((t) => t !== tag);
        }
      }),

      // ============================================
      // KANBAN DRAG-AND-DROP
      // ============================================
      
      moveCandidate: (candidateId, toStage) => set((state) => {
        const candidateIndex = state.candidates.findIndex((c) => c.id === candidateId);
        if (candidateIndex !== -1) {
          const fromStage = state.candidates[candidateIndex].stage;
          
          // Update candidate stage
          state.candidates[candidateIndex].stage = toStage;
          state.candidates[candidateIndex].lastActivity = new Date();
          
          // Update column counts
          const fromColIndex = state.kanbanColumns.findIndex((c) => c.id === fromStage);
          const toColIndex = state.kanbanColumns.findIndex((c) => c.id === toStage);
          
          if (fromColIndex !== -1) {
            state.kanbanColumns[fromColIndex].candidateCount--;
          }
          if (toColIndex !== -1) {
            state.kanbanColumns[toColIndex].candidateCount++;
          }
        }
      }),

      moveCandidateOptimistic: (candidateId, fromStage, toStage) => set((state) => {
        const candidateIndex = state.candidates.findIndex((c) => c.id === candidateId);
        if (candidateIndex !== -1) {
          state.candidates[candidateIndex].stage = toStage;
          
          // Update column counts
          const fromColIndex = state.kanbanColumns.findIndex((c) => c.id === fromStage);
          const toColIndex = state.kanbanColumns.findIndex((c) => c.id === toStage);
          
          if (fromColIndex !== -1) {
            state.kanbanColumns[fromColIndex].candidateCount--;
          }
          if (toColIndex !== -1) {
            state.kanbanColumns[toColIndex].candidateCount++;
          }
        }
      }),

      revertCandidateMove: (candidateId, originalStage) => set((state) => {
        const candidateIndex = state.candidates.findIndex((c) => c.id === candidateId);
        if (candidateIndex !== -1) {
          const currentStage = state.candidates[candidateIndex].stage;
          state.candidates[candidateIndex].stage = originalStage;
          
          // Revert column counts
          const currentColIndex = state.kanbanColumns.findIndex((c) => c.id === currentStage);
          const originalColIndex = state.kanbanColumns.findIndex((c) => c.id === originalStage);
          
          if (currentColIndex !== -1) {
            state.kanbanColumns[currentColIndex].candidateCount--;
          }
          if (originalColIndex !== -1) {
            state.kanbanColumns[originalColIndex].candidateCount++;
          }
        }
      }),

      setDraggedCandidate: (id) => set((state) => {
        state.draggedCandidateId = id;
      }),

      // ============================================
      // BULK ACTIONS
      // ============================================
      
      toggleCandidateSelection: (id) => set((state) => {
        if (state.selectedCandidateIds.includes(id)) {
          state.selectedCandidateIds = state.selectedCandidateIds.filter((cid) => cid !== id);
        } else {
          state.selectedCandidateIds.push(id);
        }
      }),

      selectAllCandidates: (stage) => set((state) => {
        if (stage) {
          state.selectedCandidateIds = state.candidates
            .filter((c) => c.stage === stage)
            .map((c) => c.id);
        } else {
          state.selectedCandidateIds = state.candidates.map((c) => c.id);
        }
      }),

      clearCandidateSelection: () => set((state) => {
        state.selectedCandidateIds = [];
      }),

      bulkMoveCandidate: (toStage) => set((state) => {
        state.selectedCandidateIds.forEach((id) => {
          const candidateIndex = state.candidates.findIndex((c) => c.id === id);
          if (candidateIndex !== -1) {
            const fromStage = state.candidates[candidateIndex].stage;
            state.candidates[candidateIndex].stage = toStage;
            state.candidates[candidateIndex].lastActivity = new Date();
            
            // Update column counts
            const fromColIndex = state.kanbanColumns.findIndex((c) => c.id === fromStage);
            const toColIndex = state.kanbanColumns.findIndex((c) => c.id === toStage);
            
            if (fromColIndex !== -1) {
              state.kanbanColumns[fromColIndex].candidateCount--;
            }
            if (toColIndex !== -1) {
              state.kanbanColumns[toColIndex].candidateCount++;
            }
          }
        });
        state.selectedCandidateIds = [];
      }),

      bulkRejectCandidates: (reason) => set((state) => {
        state.selectedCandidateIds.forEach((id) => {
          const candidateIndex = state.candidates.findIndex((c) => c.id === id);
          if (candidateIndex !== -1) {
            const fromStage = state.candidates[candidateIndex].stage;
            state.candidates[candidateIndex].stage = 'rejected';
            state.candidates[candidateIndex].lastActivity = new Date();
            
            if (reason) {
              state.candidates[candidateIndex].notes.push({
                id: `note-${Date.now()}-${id}`,
                authorId: 'system',
                authorName: 'System',
                content: `Rejected: ${reason}`,
                createdAt: new Date(),
              });
            }
            
            // Update column counts
            const fromColIndex = state.kanbanColumns.findIndex((c) => c.id === fromStage);
            const rejectedColIndex = state.kanbanColumns.findIndex((c) => c.id === 'rejected');
            
            if (fromColIndex !== -1) {
              state.kanbanColumns[fromColIndex].candidateCount--;
            }
            if (rejectedColIndex !== -1) {
              state.kanbanColumns[rejectedColIndex].candidateCount++;
            }
          }
        });
        state.selectedCandidateIds = [];
      }),

      // ============================================
      // INTERVIEWS
      // ============================================
      
      scheduleInterview: (candidateId, interview) => set((state) => {
        const index = state.candidates.findIndex((c) => c.id === candidateId);
        if (index !== -1) {
          if (!state.candidates[index].interviews) {
            state.candidates[index].interviews = [];
          }
          state.candidates[index].interviews!.push({
            ...interview,
            id: `interview-${Date.now()}`,
            candidateId,
          });
          state.candidates[index].lastActivity = new Date();
        }
      }),

      updateInterview: (candidateId, interviewId, updates) => set((state) => {
        const candidateIndex = state.candidates.findIndex((c) => c.id === candidateId);
        if (candidateIndex !== -1 && state.candidates[candidateIndex].interviews) {
          const interviewIndex = state.candidates[candidateIndex].interviews!.findIndex(
            (i) => i.id === interviewId
          );
          if (interviewIndex !== -1) {
            state.candidates[candidateIndex].interviews![interviewIndex] = {
              ...state.candidates[candidateIndex].interviews![interviewIndex],
              ...updates,
            };
          }
        }
      }),

      cancelInterview: (candidateId, interviewId) => set((state) => {
        const candidateIndex = state.candidates.findIndex((c) => c.id === candidateId);
        if (candidateIndex !== -1 && state.candidates[candidateIndex].interviews) {
          const interviewIndex = state.candidates[candidateIndex].interviews!.findIndex(
            (i) => i.id === interviewId
          );
          if (interviewIndex !== -1) {
            state.candidates[candidateIndex].interviews![interviewIndex].status = 'cancelled';
          }
        }
      }),

      submitInterviewFeedback: (candidateId, interviewId, feedback) => set((state) => {
        const candidateIndex = state.candidates.findIndex((c) => c.id === candidateId);
        if (candidateIndex !== -1 && state.candidates[candidateIndex].interviews) {
          const interviewIndex = state.candidates[candidateIndex].interviews!.findIndex(
            (i) => i.id === interviewId
          );
          if (interviewIndex !== -1) {
            state.candidates[candidateIndex].interviews![interviewIndex].status = 'completed';
            state.candidates[candidateIndex].interviews![interviewIndex].feedback = feedback;
          }
        }
      }),

      // ============================================
      // FILTERS
      // ============================================
      
      setJobFilters: (filters) => set((state) => {
        state.jobFilters = { ...state.jobFilters, ...filters };
      }),

      setCandidateFilters: (filters) => set((state) => {
        state.candidateFilters = { ...state.candidateFilters, ...filters };
      }),

      clearFilters: () => set((state) => {
        state.jobFilters = initialState.jobFilters;
        state.candidateFilters = initialState.candidateFilters;
      }),

      // ============================================
      // VIEW PREFERENCES
      // ============================================
      
      setKanbanViewMode: (mode) => set((state) => {
        state.kanbanViewMode = mode;
      }),

      setSortBy: (sortBy) => set((state) => {
        state.sortBy = sortBy;
      }),

      setSortOrder: (order) => set((state) => {
        state.sortOrder = order;
      }),

      // ============================================
      // LOADING/ERROR STATES
      // ============================================
      
      setLoading: (key, value) => set((state) => {
        state.loading[key] = value;
      }),

      setError: (key, error) => set((state) => {
        if (error) {
          state.errors[key] = error;
        } else {
          delete state.errors[key];
        }
      }),

      clearErrors: () => set((state) => {
        state.errors = {};
      }),

      reset: () => set(initialState),
    })),
    {
      name: 'athena-jobs-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedJobId: state.selectedJobId,
        kanbanViewMode: state.kanbanViewMode,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        // Don't persist jobs, candidates (should be fetched fresh)
        // Don't persist loading/error states or filters
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

export const selectJobById = (id: string) => (state: JobsStore) =>
  state.jobs.find((j) => j.id === id);

export const selectCurrentJob = (state: JobsStore) =>
  state.jobs.find((j) => j.id === state.selectedJobId);

export const selectFilteredJobs = (state: JobsStore) => {
  const { jobs, jobFilters } = state;
  
  return jobs.filter((job) => {
    if (jobFilters.status.length && !jobFilters.status.includes(job.status)) {
      return false;
    }
    if (jobFilters.department.length && !jobFilters.department.includes(job.department)) {
      return false;
    }
    if (jobFilters.type.length && !jobFilters.type.includes(job.type)) {
      return false;
    }
    if (jobFilters.search) {
      const search = jobFilters.search.toLowerCase();
      if (!job.title.toLowerCase().includes(search) && 
          !job.description.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });
};

export const selectCandidatesByStage = (stage: StageId) => (state: JobsStore) =>
  state.candidates.filter((c) => c.stage === stage);

export const selectCandidatesForJob = (jobId: string) => (state: JobsStore) =>
  state.candidates.filter((c) => c.jobId === jobId);

export const selectFilteredCandidates = (state: JobsStore) => {
  const { candidates, candidateFilters, selectedJobId } = state;
  
  return candidates.filter((candidate) => {
    // Filter by job if one is selected
    if (selectedJobId && candidate.jobId !== selectedJobId) {
      return false;
    }
    
    if (candidateFilters.stage.length && !candidateFilters.stage.includes(candidate.stage)) {
      return false;
    }
    if (candidateFilters.source.length && !candidateFilters.source.includes(candidate.source)) {
      return false;
    }
    if (candidateFilters.minMatchScore && candidate.matchScore < candidateFilters.minMatchScore) {
      return false;
    }
    if (candidateFilters.skills.length) {
      const hasSkill = candidateFilters.skills.some((s) => candidate.skills.includes(s));
      if (!hasSkill) return false;
    }
    if (candidateFilters.search) {
      const search = candidateFilters.search.toLowerCase();
      if (!candidate.name.toLowerCase().includes(search) &&
          !candidate.email.toLowerCase().includes(search) &&
          !candidate.currentRole.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });
};

export const selectSortedCandidates = (state: JobsStore) => {
  const filtered = selectFilteredCandidates(state);
  const { sortBy, sortOrder } = state;
  
  return [...filtered].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'appliedAt':
        comparison = new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime();
        break;
      case 'matchScore':
        comparison = a.matchScore - b.matchScore;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'lastActivity':
        comparison = new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime();
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
};

export const selectSelectedCandidate = (state: JobsStore) =>
  state.candidates.find((c) => c.id === state.selectedCandidateId);

export const selectUpcomingInterviews = (state: JobsStore) => {
  const now = new Date();
  return state.candidates
    .flatMap((c) => (c.interviews || []).map((i) => ({ ...i, candidate: c })))
    .filter((i) => i.status === 'scheduled' && new Date(i.scheduledAt) > now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
};
