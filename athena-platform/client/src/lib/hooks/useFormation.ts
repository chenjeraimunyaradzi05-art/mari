'use client';

/**
 * Formation Studio Hooks
 * Phase 4: Web Client - Persona Studios
 * React Query hooks for Formation Studio features
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFormationStore } from '@/lib/stores/formation.store';
import type { 
  Business, 
  FormationWizardData, 
  CofounderMatch, 
  ComplianceItem, 
  FormationDocument,
  BusinessType,
  CofounderStatus
} from '@/lib/stores/formation.store';

// ============================================
// QUERY KEYS
// ============================================

export const formationKeys = {
  all: ['formation'] as const,
  businesses: () => [...formationKeys.all, 'businesses'] as const,
  business: (id: string) => [...formationKeys.businesses(), id] as const,
  wizard: (businessId: string) => [...formationKeys.all, 'wizard', businessId] as const,
  cofounders: () => [...formationKeys.all, 'cofounders'] as const,
  cofounderMatch: (id: string) => [...formationKeys.cofounders(), id] as const,
  compliance: (businessId: string) => [...formationKeys.all, 'compliance', businessId] as const,
  documents: (businessId: string) => [...formationKeys.all, 'documents', businessId] as const,
};

// ============================================
// API FUNCTIONS (would connect to real API)
// ============================================

const formationApi = {
  // Businesses
  getBusinesses: async (): Promise<Business[]> => {
    const response = await fetch('/api/formation/businesses', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch businesses');
    const { data } = await response.json();
    return data;
  },

  getBusiness: async (id: string): Promise<Business> => {
    const response = await fetch(`/api/formation/businesses/${id}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch business');
    const { data } = await response.json();
    return data;
  },

  createBusiness: async (data: Partial<Business>): Promise<Business> => {
    const response = await fetch('/api/formation/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create business');
    const { data: business } = await response.json();
    return business;
  },

  updateBusiness: async (id: string, data: Partial<Business>): Promise<Business> => {
    const response = await fetch(`/api/formation/businesses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update business');
    const { data: business } = await response.json();
    return business;
  },

  deleteBusiness: async (id: string): Promise<void> => {
    const response = await fetch(`/api/formation/businesses/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to delete business');
  },

  // Wizard
  getWizardProgress: async (businessId: string): Promise<FormationWizardData> => {
    const response = await fetch(`/api/formation/wizard/${businessId}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch wizard progress');
    const { data } = await response.json();
    return data;
  },

  saveWizardProgress: async (businessId: string, data: FormationWizardData): Promise<void> => {
    const response = await fetch(`/api/formation/wizard/${businessId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to save wizard progress');
  },

  // Co-founders
  getCofounderMatches: async (): Promise<CofounderMatch[]> => {
    const response = await fetch('/api/formation/cofounders', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch co-founder matches');
    const { data } = await response.json();
    return data;
  },

  updateCofounderStatus: async (
    matchId: string, 
    status: CofounderStatus, 
    message?: string
  ): Promise<CofounderMatch> => {
    const response = await fetch(`/api/formation/cofounders/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, message }),
    });
    if (!response.ok) throw new Error('Failed to update co-founder status');
    const { data } = await response.json();
    return data;
  },

  // Compliance
  getComplianceItems: async (businessId: string): Promise<ComplianceItem[]> => {
    const response = await fetch(`/api/formation/compliance/${businessId}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch compliance items');
    const { data } = await response.json();
    return data;
  },

  markComplianceComplete: async (itemId: string): Promise<ComplianceItem> => {
    const response = await fetch(`/api/formation/compliance/${itemId}/complete`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to mark compliance item complete');
    const { data } = await response.json();
    return data;
  },

  // Documents
  getDocuments: async (businessId: string): Promise<FormationDocument[]> => {
    const response = await fetch(`/api/formation/documents/${businessId}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch documents');
    const { data } = await response.json();
    return data;
  },

  uploadDocument: async (businessId: string, file: File, type: FormationDocument['type']): Promise<FormationDocument> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const response = await fetch(`/api/formation/documents/${businessId}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload document');
    const { data } = await response.json();
    return data;
  },
};

// ============================================
// QUERY HOOKS
// ============================================

/**
 * Fetch all businesses for the current user
 */
export function useBusinesses() {
  const { setBusinesses, setLoading, setError } = useFormationStore();

  return useQuery({
    queryKey: formationKeys.businesses(),
    queryFn: async () => {
      setLoading('businesses', true);
      try {
        const businesses = await formationApi.getBusinesses();
        setBusinesses(businesses);
        setLoading('businesses', false);
        return businesses;
      } catch (error) {
        setError('businesses', 'Failed to load businesses');
        setLoading('businesses', false);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch a single business by ID
 */
export function useBusiness(id: string) {
  return useQuery({
    queryKey: formationKeys.business(id),
    queryFn: () => formationApi.getBusiness(id),
    enabled: !!id,
  });
}

/**
 * Create a new business
 */
export function useCreateBusiness() {
  const queryClient = useQueryClient();
  const { addBusiness, setCurrentBusiness } = useFormationStore();

  return useMutation({
    mutationFn: (data: { name: string; type: BusinessType; state: string }) =>
      formationApi.createBusiness({
        ...data,
        status: 'draft',
        formationProgress: 0,
        currentStep: 'entity-type',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Business),
    onSuccess: (business) => {
      addBusiness(business);
      setCurrentBusiness(business.id);
      queryClient.invalidateQueries({ queryKey: formationKeys.businesses() });
    },
  });
}

/**
 * Update an existing business
 */
export function useUpdateBusiness() {
  const queryClient = useQueryClient();
  const { updateBusiness } = useFormationStore();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Business> }) =>
      formationApi.updateBusiness(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: formationKeys.business(id) });

      // Snapshot previous value
      const previousBusiness = queryClient.getQueryData(formationKeys.business(id));

      // Optimistically update
      updateBusiness(id, data);

      return { previousBusiness };
    },
    onError: (_err, { id }, context) => {
      // Rollback on error
      if (context?.previousBusiness) {
        queryClient.setQueryData(formationKeys.business(id), context.previousBusiness);
      }
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({ queryKey: formationKeys.business(id) });
    },
  });
}

/**
 * Delete a business
 */
export function useDeleteBusiness() {
  const queryClient = useQueryClient();
  const { removeBusiness } = useFormationStore();

  return useMutation({
    mutationFn: (id: string) => formationApi.deleteBusiness(id),
    onSuccess: (_, id) => {
      removeBusiness(id);
      queryClient.invalidateQueries({ queryKey: formationKeys.businesses() });
    },
  });
}

// ============================================
// CO-FOUNDER MATCHING HOOKS
// ============================================

/**
 * Fetch co-founder matches
 */
export function useCofounderMatches() {
  const { setCofounderMatches, setLoading, setError } = useFormationStore();

  return useQuery({
    queryKey: formationKeys.cofounders(),
    queryFn: async () => {
      setLoading('cofounders', true);
      try {
        const matches = await formationApi.getCofounderMatches();
        setCofounderMatches(matches);
        setLoading('cofounders', false);
        return matches;
      } catch (error) {
        setError('cofounders', 'Failed to load co-founder matches');
        setLoading('cofounders', false);
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Update co-founder match status (connect/decline)
 */
export function useUpdateCofounderStatus() {
  const queryClient = useQueryClient();
  const { updateCofounderStatus: updateStore } = useFormationStore();

  return useMutation({
    mutationFn: ({ matchId, status, message }: { matchId: string; status: CofounderStatus; message?: string }) =>
      formationApi.updateCofounderStatus(matchId, status, message),
    onMutate: async ({ matchId, status, message }) => {
      await queryClient.cancelQueries({ queryKey: formationKeys.cofounders() });
      
      // Optimistically update
      updateStore(matchId, status, message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: formationKeys.cofounders() });
    },
  });
}

// ============================================
// COMPLIANCE HOOKS
// ============================================

/**
 * Fetch compliance items for a business
 */
export function useComplianceItems(businessId: string) {
  const { setComplianceItems, setLoading, setError } = useFormationStore();

  return useQuery({
    queryKey: formationKeys.compliance(businessId),
    queryFn: async () => {
      setLoading('compliance', true);
      try {
        const items = await formationApi.getComplianceItems(businessId);
        setComplianceItems(items);
        setLoading('compliance', false);
        return items;
      } catch (error) {
        setError('compliance', 'Failed to load compliance items');
        setLoading('compliance', false);
        throw error;
      }
    },
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mark a compliance item as complete
 */
export function useMarkComplianceComplete() {
  const queryClient = useQueryClient();
  const { markComplianceComplete: markComplete, currentBusinessId } = useFormationStore();

  return useMutation({
    mutationFn: (itemId: string) => formationApi.markComplianceComplete(itemId),
    onMutate: async (itemId) => {
      // Optimistically update
      markComplete(itemId);
    },
    onSettled: () => {
      if (currentBusinessId) {
        queryClient.invalidateQueries({ queryKey: formationKeys.compliance(currentBusinessId) });
      }
    },
  });
}

// ============================================
// DOCUMENT HOOKS
// ============================================

/**
 * Fetch documents for a business
 */
export function useFormationDocuments(businessId: string) {
  const { setDocuments, setLoading, setError } = useFormationStore();

  return useQuery({
    queryKey: formationKeys.documents(businessId),
    queryFn: async () => {
      setLoading('documents', true);
      try {
        const docs = await formationApi.getDocuments(businessId);
        setDocuments(docs);
        setLoading('documents', false);
        return docs;
      } catch (error) {
        setError('documents', 'Failed to load documents');
        setLoading('documents', false);
        throw error;
      }
    },
    enabled: !!businessId,
  });
}

/**
 * Upload a document
 */
export function useUploadDocument() {
  const queryClient = useQueryClient();
  const { addDocument, currentBusinessId } = useFormationStore();

  return useMutation({
    mutationFn: ({ businessId, file, type }: { businessId: string; file: File; type: FormationDocument['type'] }) =>
      formationApi.uploadDocument(businessId, file, type),
    onSuccess: (document) => {
      addDocument(document);
      if (currentBusinessId) {
        queryClient.invalidateQueries({ queryKey: formationKeys.documents(currentBusinessId) });
      }
    },
  });
}

// ============================================
// WIZARD HOOKS
// ============================================

/**
 * Save wizard progress
 */
export function useSaveWizardProgress() {
  const queryClient = useQueryClient();
  const { wizardData, currentBusinessId, setLoading, setError } = useFormationStore();

  return useMutation({
    mutationFn: async () => {
      if (!currentBusinessId) throw new Error('No business selected');
      return formationApi.saveWizardProgress(currentBusinessId, wizardData);
    },
    onMutate: () => {
      setLoading('wizard', true);
    },
    onSuccess: () => {
      setLoading('wizard', false);
      if (currentBusinessId) {
        queryClient.invalidateQueries({ queryKey: formationKeys.wizard(currentBusinessId) });
      }
    },
    onError: () => {
      setLoading('wizard', false);
      setError('wizard', 'Failed to save progress');
    },
  });
}
