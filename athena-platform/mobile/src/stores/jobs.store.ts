/**
 * Jobs Store
 * Phase 5: Mobile Parity - Zustand state management
 * 
 * Handles job listings, applications, and saved jobs for mobile
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================
// TYPES
// ============================================

export type JobType = 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship';
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
export type WorkLocation = 'remote' | 'hybrid' | 'onsite';
export type ApplicationStatus = 'draft' | 'submitted' | 'viewed' | 'shortlisted' | 'interview' | 'offer' | 'rejected' | 'withdrawn';

export interface Company {
  id: string;
  name: string;
  logo?: string;
  industry: string;
  size: string;
  location: string;
  website?: string;
  isVerified: boolean;
}

export interface Job {
  id: string;
  title: string;
  company: Company;
  description: string;
  requirements: string[];
  responsibilities: string[];
  skills: string[];
  type: JobType;
  experienceLevel: ExperienceLevel;
  workLocation: WorkLocation;
  location: string;
  salary?: {
    min: number;
    max: number;
    currency: string;
    period: 'hourly' | 'monthly' | 'yearly';
  };
  benefits: string[];
  applicationDeadline?: Date;
  postedAt: Date;
  updatedAt: Date;
  applicantCount: number;
  viewCount: number;
  isSaved: boolean;
  isApplied: boolean;
  matchScore?: number;
}

export interface JobApplication {
  id: string;
  jobId: string;
  job: Job;
  status: ApplicationStatus;
  coverLetter?: string;
  resumeUrl?: string;
  answers?: Record<string, string>;
  notes?: string;
  appliedAt: Date;
  lastUpdated: Date;
  timeline: {
    status: ApplicationStatus;
    date: Date;
    note?: string;
  }[];
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: JobFilters;
  alertEnabled: boolean;
  createdAt: Date;
}

export interface JobFilters {
  query?: string;
  types?: JobType[];
  experienceLevels?: ExperienceLevel[];
  workLocations?: WorkLocation[];
  locations?: string[];
  skills?: string[];
  industries?: string[];
  salaryMin?: number;
  salaryMax?: number;
  postedWithin?: 'day' | 'week' | 'month' | 'any';
  sortBy?: 'relevance' | 'date' | 'salary' | 'match';
}

interface JobsState {
  // Jobs
  jobs: Job[];
  featuredJobs: Job[];
  recommendedJobs: Job[];
  
  // Current job
  selectedJobId: string | null;
  
  // Applications
  applications: JobApplication[];
  draftApplications: JobApplication[];
  
  // Saved
  savedJobs: Job[];
  savedSearches: SavedSearch[];
  
  // Recent
  recentlyViewed: Job[];
  recentSearches: string[];
  
  // Filters & Search
  filters: JobFilters;
  activeFiltersCount: number;
  
  // Pagination
  currentPage: number;
  totalPages: number;
  totalJobs: number;
  hasMore: boolean;
  
  // Loading
  isLoading: boolean;
  isLoadingMore: boolean;
  isApplying: boolean;
  error: string | null;
}

interface JobsActions {
  // Jobs
  setJobs: (jobs: Job[]) => void;
  appendJobs: (jobs: Job[]) => void;
  setFeaturedJobs: (jobs: Job[]) => void;
  setRecommendedJobs: (jobs: Job[]) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  selectJob: (id: string | null) => void;
  
  // Saved Jobs (optimistic)
  saveJob: (job: Job) => void;
  unsaveJob: (jobId: string) => void;
  
  // Applications
  setApplications: (applications: JobApplication[]) => void;
  addApplication: (application: JobApplication) => void;
  updateApplication: (id: string, updates: Partial<JobApplication>) => void;
  withdrawApplication: (id: string) => void;
  
  // Draft Applications
  saveDraftApplication: (application: JobApplication) => void;
  deleteDraftApplication: (id: string) => void;
  submitDraftApplication: (id: string) => void;
  
  // Saved Searches
  saveSearch: (search: SavedSearch) => void;
  deleteSearch: (id: string) => void;
  toggleSearchAlert: (id: string) => void;
  
  // Recent
  addToRecentlyViewed: (job: Job) => void;
  addToRecentSearches: (query: string) => void;
  clearRecentlyViewed: () => void;
  clearRecentSearches: () => void;
  
  // Filters
  setFilters: (filters: Partial<JobFilters>) => void;
  resetFilters: () => void;
  applyFilter: <K extends keyof JobFilters>(key: K, value: JobFilters[K]) => void;
  
  // Pagination
  setPagination: (data: { currentPage: number; totalPages: number; totalJobs: number }) => void;
  nextPage: () => void;
  setHasMore: (hasMore: boolean) => void;
  
  // Loading
  setLoading: (loading: boolean) => void;
  setLoadingMore: (loading: boolean) => void;
  setApplying: (applying: boolean) => void;
  setError: (error: string | null) => void;
  
  // Reset
  reset: () => void;
}

type JobsStore = JobsState & JobsActions;

// ============================================
// INITIAL STATE
// ============================================

const initialFilters: JobFilters = {
  query: '',
  types: [],
  experienceLevels: [],
  workLocations: [],
  locations: [],
  skills: [],
  industries: [],
  salaryMin: undefined,
  salaryMax: undefined,
  postedWithin: 'any',
  sortBy: 'relevance',
};

const initialState: JobsState = {
  jobs: [],
  featuredJobs: [],
  recommendedJobs: [],
  selectedJobId: null,
  applications: [],
  draftApplications: [],
  savedJobs: [],
  savedSearches: [],
  recentlyViewed: [],
  recentSearches: [],
  filters: initialFilters,
  activeFiltersCount: 0,
  currentPage: 1,
  totalPages: 1,
  totalJobs: 0,
  hasMore: false,
  isLoading: false,
  isLoadingMore: false,
  isApplying: false,
  error: null,
};

// ============================================
// HELPERS
// ============================================

const countActiveFilters = (filters: JobFilters): number => {
  let count = 0;
  if (filters.query) count++;
  if (filters.types?.length) count++;
  if (filters.experienceLevels?.length) count++;
  if (filters.workLocations?.length) count++;
  if (filters.locations?.length) count++;
  if (filters.skills?.length) count++;
  if (filters.industries?.length) count++;
  if (filters.salaryMin || filters.salaryMax) count++;
  if (filters.postedWithin && filters.postedWithin !== 'any') count++;
  return count;
};

// ============================================
// STORE
// ============================================

export const useJobsStore = create<JobsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Jobs
      setJobs: (jobs) => set({ jobs }),

      appendJobs: (jobs) => set((state) => ({
        jobs: [...state.jobs, ...jobs],
      })),

      setFeaturedJobs: (featuredJobs) => set({ featuredJobs }),

      setRecommendedJobs: (recommendedJobs) => set({ recommendedJobs }),

      updateJob: (id, updates) => set((state) => ({
        jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
        savedJobs: state.savedJobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
        featuredJobs: state.featuredJobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
        recommendedJobs: state.recommendedJobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
      })),

      selectJob: (id) => set({ selectedJobId: id }),

      // Saved Jobs (optimistic)
      saveJob: (job) => set((state) => ({
        savedJobs: [{ ...job, isSaved: true }, ...state.savedJobs],
        jobs: state.jobs.map((j) => (j.id === job.id ? { ...j, isSaved: true } : j)),
        featuredJobs: state.featuredJobs.map((j) => (j.id === job.id ? { ...j, isSaved: true } : j)),
        recommendedJobs: state.recommendedJobs.map((j) => (j.id === job.id ? { ...j, isSaved: true } : j)),
      })),

      unsaveJob: (jobId) => set((state) => ({
        savedJobs: state.savedJobs.filter((j) => j.id !== jobId),
        jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, isSaved: false } : j)),
        featuredJobs: state.featuredJobs.map((j) => (j.id === jobId ? { ...j, isSaved: false } : j)),
        recommendedJobs: state.recommendedJobs.map((j) => (j.id === jobId ? { ...j, isSaved: false } : j)),
      })),

      // Applications
      setApplications: (applications) => set({ applications }),

      addApplication: (application) => set((state) => ({
        applications: [application, ...state.applications],
        jobs: state.jobs.map((j) =>
          j.id === application.jobId ? { ...j, isApplied: true } : j
        ),
      })),

      updateApplication: (id, updates) => set((state) => ({
        applications: state.applications.map((a) =>
          a.id === id ? { ...a, ...updates, lastUpdated: new Date() } : a
        ),
      })),

      withdrawApplication: (id) => set((state) => {
        const application = state.applications.find((a) => a.id === id);
        return {
          applications: state.applications.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: 'withdrawn' as ApplicationStatus,
                  lastUpdated: new Date(),
                  timeline: [
                    ...a.timeline,
                    { status: 'withdrawn' as ApplicationStatus, date: new Date() },
                  ],
                }
              : a
          ),
          jobs: state.jobs.map((j) =>
            j.id === application?.jobId ? { ...j, isApplied: false } : j
          ),
        };
      }),

      // Draft Applications
      saveDraftApplication: (application) => set((state) => ({
        draftApplications: [
          { ...application, status: 'draft' as ApplicationStatus },
          ...state.draftApplications.filter((d) => d.id !== application.id),
        ],
      })),

      deleteDraftApplication: (id) => set((state) => ({
        draftApplications: state.draftApplications.filter((d) => d.id !== id),
      })),

      submitDraftApplication: (id) => set((state) => {
        const draft = state.draftApplications.find((d) => d.id === id);
        if (!draft) return state;
        return {
          draftApplications: state.draftApplications.filter((d) => d.id !== id),
          applications: [
            { ...draft, status: 'submitted' as ApplicationStatus, appliedAt: new Date() },
            ...state.applications,
          ],
        };
      }),

      // Saved Searches
      saveSearch: (search) => set((state) => ({
        savedSearches: [search, ...state.savedSearches],
      })),

      deleteSearch: (id) => set((state) => ({
        savedSearches: state.savedSearches.filter((s) => s.id !== id),
      })),

      toggleSearchAlert: (id) => set((state) => ({
        savedSearches: state.savedSearches.map((s) =>
          s.id === id ? { ...s, alertEnabled: !s.alertEnabled } : s
        ),
      })),

      // Recent
      addToRecentlyViewed: (job) => set((state) => ({
        recentlyViewed: [
          job,
          ...state.recentlyViewed.filter((j) => j.id !== job.id),
        ].slice(0, 20),
      })),

      addToRecentSearches: (query) => set((state) => ({
        recentSearches: [
          query,
          ...state.recentSearches.filter((q) => q !== query),
        ].slice(0, 10),
      })),

      clearRecentlyViewed: () => set({ recentlyViewed: [] }),

      clearRecentSearches: () => set({ recentSearches: [] }),

      // Filters
      setFilters: (filters) => set((state) => {
        const newFilters = { ...state.filters, ...filters };
        return {
          filters: newFilters,
          activeFiltersCount: countActiveFilters(newFilters),
        };
      }),

      resetFilters: () => set({
        filters: initialFilters,
        activeFiltersCount: 0,
      }),

      applyFilter: (key, value) => set((state) => {
        const newFilters = { ...state.filters, [key]: value };
        return {
          filters: newFilters,
          activeFiltersCount: countActiveFilters(newFilters),
        };
      }),

      // Pagination
      setPagination: ({ currentPage, totalPages, totalJobs }) => set({
        currentPage,
        totalPages,
        totalJobs,
        hasMore: currentPage < totalPages,
      }),

      nextPage: () => set((state) => ({
        currentPage: state.currentPage + 1,
      })),

      setHasMore: (hasMore) => set({ hasMore }),

      // Loading
      setLoading: (isLoading) => set({ isLoading }),
      setLoadingMore: (isLoadingMore) => set({ isLoadingMore }),
      setApplying: (isApplying) => set({ isApplying }),
      setError: (error) => set({ error }),

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'athena-jobs-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        savedJobs: state.savedJobs.slice(0, 50),
        savedSearches: state.savedSearches,
        recentlyViewed: state.recentlyViewed.slice(0, 10),
        recentSearches: state.recentSearches,
        draftApplications: state.draftApplications,
        filters: state.filters,
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

export const selectSelectedJob = (state: JobsStore) =>
  state.jobs.find((j) => j.id === state.selectedJobId) ||
  state.savedJobs.find((j) => j.id === state.selectedJobId) ||
  state.recentlyViewed.find((j) => j.id === state.selectedJobId);

export const selectApplicationsByStatus = (status: ApplicationStatus) => (state: JobsStore) =>
  state.applications.filter((a) => a.status === status);

export const selectPendingApplications = (state: JobsStore) =>
  state.applications.filter((a) =>
    ['submitted', 'viewed', 'shortlisted', 'interview'].includes(a.status)
  );

export const selectActiveApplicationsCount = (state: JobsStore) =>
  state.applications.filter((a) =>
    !['rejected', 'withdrawn', 'draft'].includes(a.status)
  ).length;

export const selectSavedJobsCount = (state: JobsStore) => state.savedJobs.length;

export const selectDraftApplicationsCount = (state: JobsStore) => state.draftApplications.length;
