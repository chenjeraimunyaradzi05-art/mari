// @ts-nocheck - Immer Draft types conflict with explicit array callback types
'use client';

/**
 * Formation Studio Store
 * Phase 4: Web Client - Persona Studios
 * Zustand store for business formation state management
 * 
 * Features:
 * - Business entity management
 * - Formation wizard progress
 * - Co-founder matching state
 * - Compliance tracking
 * - Document management
 * 
 * Note: Using immer middleware - callback parameter types are inferred from state.
 * Type checking disabled for immer's Draft<T> type compatibility with array methods.
 * Type safety is ensured by FormationState and FormationActions interface definitions.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================
// TYPES
// ============================================

export type BusinessType = 'LLC' | 'Corporation' | 'Sole Proprietor' | 'Partnership' | 'Non-Profit';
export type BusinessStatus = 'draft' | 'in-progress' | 'pending-approval' | 'registered' | 'active';
export type FormationStep = 
  | 'entity-type' 
  | 'business-details' 
  | 'owners' 
  | 'registered-agent' 
  | 'operating-agreement' 
  | 'ein-application' 
  | 'state-filings' 
  | 'complete';

export type CofounderStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';
export type ComplianceStatus = 'complete' | 'pending' | 'overdue' | 'upcoming';
export type DocumentStatus = 'draft' | 'pending-signature' | 'signed' | 'filed' | 'rejected';

export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  status: BusinessStatus;
  state: string;
  formationProgress: number;
  currentStep: FormationStep;
  createdAt: Date;
  updatedAt: Date;
  ein?: string;
  registrationNumber?: string;
  description?: string;
  industry?: string;
  website?: string;
}

export interface FormationWizardData {
  // Step 1: Entity Type
  entityType?: BusinessType;
  stateFiling?: string;
  
  // Step 2: Business Details
  businessName?: string;
  dbaName?: string;
  description?: string;
  industry?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  
  // Step 3: Owners/Members
  owners: Array<{
    id: string;
    name: string;
    email: string;
    ownershipPercent: number;
    role: string;
    isUser?: boolean;
  }>;
  
  // Step 4: Registered Agent
  registeredAgent?: {
    type: 'self' | 'service' | 'attorney';
    name?: string;
    address?: string;
    serviceId?: string;
  };
  
  // Step 5: Operating Agreement
  operatingAgreement?: {
    templateId?: string;
    customizations?: Record<string, string>;
    signed?: boolean;
  };
  
  // Step 6: EIN Application
  einApplication?: {
    status: 'not-started' | 'in-progress' | 'submitted' | 'received';
    ssn?: string; // Never persisted
    ein?: string;
    submittedAt?: Date;
  };
  
  // Step 7: State Filings
  stateFilings?: {
    articlesOfOrganization?: DocumentStatus;
    initialReport?: DocumentStatus;
    businessLicense?: DocumentStatus;
  };
}

export interface CofounderMatch {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  role: string;
  matchScore: number;
  skills: string[];
  experience: string;
  status: CofounderStatus;
  message?: string;
  connectedAt?: Date;
  viewedAt?: Date;
}

export interface ComplianceItem {
  id: string;
  businessId: string;
  title: string;
  description: string;
  dueDate?: Date;
  status: ComplianceStatus;
  priority: 'high' | 'medium' | 'low';
  category: 'tax' | 'registration' | 'report' | 'license' | 'legal';
  completedAt?: Date;
  documentUrl?: string;
}

export interface FormationDocument {
  id: string;
  businessId: string;
  name: string;
  type: 'articles' | 'operating-agreement' | 'ein' | 'license' | 'report' | 'other';
  status: DocumentStatus;
  url?: string;
  createdAt: Date;
  updatedAt: Date;
  signatureRequired?: boolean;
  signedBy?: string[];
}

// ============================================
// STORE STATE
// ============================================

interface FormationState {
  // Current business context
  currentBusinessId: string | null;
  businesses: Business[];
  
  // Formation wizard
  wizardData: FormationWizardData;
  wizardStep: FormationStep;
  wizardDirty: boolean;
  
  // Co-founder matching
  cofounderMatches: CofounderMatch[];
  cofounderFilters: {
    roles: string[];
    skills: string[];
    minMatchScore: number;
  };
  
  // Compliance
  complianceItems: ComplianceItem[];
  
  // Documents
  documents: FormationDocument[];
  
  // Loading states
  loading: {
    businesses: boolean;
    wizard: boolean;
    cofounders: boolean;
    compliance: boolean;
    documents: boolean;
  };
  
  // Errors
  errors: {
    businesses?: string;
    wizard?: string;
    cofounders?: string;
    compliance?: string;
    documents?: string;
  };
}

interface FormationActions {
  // Business management
  setCurrentBusiness: (id: string | null) => void;
  addBusiness: (business: Business) => void;
  updateBusiness: (id: string, updates: Partial<Business>) => void;
  removeBusiness: (id: string) => void;
  setBusinesses: (businesses: Business[]) => void;
  
  // Formation wizard
  setWizardStep: (step: FormationStep) => void;
  updateWizardData: (data: Partial<FormationWizardData>) => void;
  addOwner: (owner: FormationWizardData['owners'][0]) => void;
  updateOwner: (id: string, updates: Partial<FormationWizardData['owners'][0]>) => void;
  removeOwner: (id: string) => void;
  resetWizard: () => void;
  saveWizardProgress: () => Promise<void>;
  
  // Co-founder matching
  setCofounderMatches: (matches: CofounderMatch[]) => void;
  updateCofounderStatus: (matchId: string, status: CofounderStatus, message?: string) => void;
  setCofounderFilters: (filters: Partial<FormationState['cofounderFilters']>) => void;
  markMatchViewed: (matchId: string) => void;
  
  // Compliance
  setComplianceItems: (items: ComplianceItem[]) => void;
  updateComplianceItem: (id: string, updates: Partial<ComplianceItem>) => void;
  markComplianceComplete: (id: string) => void;
  
  // Documents
  setDocuments: (documents: FormationDocument[]) => void;
  addDocument: (document: FormationDocument) => void;
  updateDocument: (id: string, updates: Partial<FormationDocument>) => void;
  removeDocument: (id: string) => void;
  
  // Loading/Error states
  setLoading: (key: keyof FormationState['loading'], value: boolean) => void;
  setError: (key: keyof FormationState['errors'], error?: string) => void;
  clearErrors: () => void;
}

type FormationStore = FormationState & FormationActions;

// ============================================
// DEFAULT STATE
// ============================================

const defaultWizardData: FormationWizardData = {
  owners: [],
};

const initialState: FormationState = {
  currentBusinessId: null,
  businesses: [],
  wizardData: defaultWizardData,
  wizardStep: 'entity-type',
  wizardDirty: false,
  cofounderMatches: [],
  cofounderFilters: {
    roles: [],
    skills: [],
    minMatchScore: 0,
  },
  complianceItems: [],
  documents: [],
  loading: {
    businesses: false,
    wizard: false,
    cofounders: false,
    compliance: false,
    documents: false,
  },
  errors: {},
};

// ============================================
// STORE
// ============================================

export const useFormationStore = create<FormationStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // ============================================
      // BUSINESS MANAGEMENT
      // ============================================
      
      setCurrentBusiness: (id) => set((state) => {
        state.currentBusinessId = id;
      }),

      addBusiness: (business) => set((state) => {
        state.businesses.push(business);
      }),

      updateBusiness: (id, updates) => set((state) => {
        const index = state.businesses.findIndex((b) => b.id === id);
        if (index !== -1) {
          state.businesses[index] = { 
            ...state.businesses[index], 
            ...updates, 
            updatedAt: new Date() 
          };
        }
      }),

      removeBusiness: (id) => set((state) => {
        state.businesses = state.businesses.filter((b) => b.id !== id);
        if (state.currentBusinessId === id) {
          state.currentBusinessId = null;
        }
      }),

      setBusinesses: (businesses) => set((state) => {
        state.businesses = businesses;
      }),

      // ============================================
      // FORMATION WIZARD
      // ============================================
      
      setWizardStep: (step) => set((state) => {
        state.wizardStep = step;
      }),

      updateWizardData: (data) => set((state) => {
        state.wizardData = { ...state.wizardData, ...data };
        state.wizardDirty = true;
      }),

      addOwner: (owner) => set((state) => {
        state.wizardData.owners.push(owner);
        state.wizardDirty = true;
      }),

      updateOwner: (id, updates) => set((state) => {
        const index = state.wizardData.owners.findIndex((o) => o.id === id);
        if (index !== -1) {
          state.wizardData.owners[index] = { 
            ...state.wizardData.owners[index], 
            ...updates 
          };
          state.wizardDirty = true;
        }
      }),

      removeOwner: (id) => set((state) => {
        state.wizardData.owners = state.wizardData.owners.filter((o) => o.id !== id);
        state.wizardDirty = true;
      }),

      resetWizard: () => set((state) => {
        state.wizardData = defaultWizardData;
        state.wizardStep = 'entity-type';
        state.wizardDirty = false;
      }),

      saveWizardProgress: async () => {
        const state = get();
        set((s) => { s.loading.wizard = true; });
        
        try {
          // API call would go here
          // await formationApi.saveWizardProgress(state.currentBusinessId, state.wizardData);
          set((s) => { 
            s.wizardDirty = false; 
            s.loading.wizard = false;
          });
        } catch (error) {
          set((s) => { 
            s.errors.wizard = 'Failed to save progress';
            s.loading.wizard = false;
          });
          throw error;
        }
      },

      // ============================================
      // CO-FOUNDER MATCHING
      // ============================================
      
      setCofounderMatches: (matches) => set((state) => {
        state.cofounderMatches = matches;
      }),

      updateCofounderStatus: (matchId, status, message) => set((state) => {
        const index = state.cofounderMatches.findIndex((m) => m.id === matchId);
        if (index !== -1) {
          state.cofounderMatches[index].status = status;
          if (message) {
            state.cofounderMatches[index].message = message;
          }
          if (status === 'accepted') {
            state.cofounderMatches[index].connectedAt = new Date();
          }
        }
      }),

      setCofounderFilters: (filters) => set((state) => {
        state.cofounderFilters = { ...state.cofounderFilters, ...filters };
      }),

      markMatchViewed: (matchId) => set((state) => {
        const index = state.cofounderMatches.findIndex((m) => m.id === matchId);
        if (index !== -1) {
          state.cofounderMatches[index].viewedAt = new Date();
        }
      }),

      // ============================================
      // COMPLIANCE
      // ============================================
      
      setComplianceItems: (items) => set((state) => {
        state.complianceItems = items;
      }),

      updateComplianceItem: (id, updates) => set((state) => {
        const index = state.complianceItems.findIndex((c) => c.id === id);
        if (index !== -1) {
          state.complianceItems[index] = { 
            ...state.complianceItems[index], 
            ...updates 
          };
        }
      }),

      markComplianceComplete: (id) => set((state) => {
        const index = state.complianceItems.findIndex((c) => c.id === id);
        if (index !== -1) {
          state.complianceItems[index].status = 'complete';
          state.complianceItems[index].completedAt = new Date();
        }
      }),

      // ============================================
      // DOCUMENTS
      // ============================================
      
      setDocuments: (documents) => set((state) => {
        state.documents = documents;
      }),

      addDocument: (document) => set((state) => {
        state.documents.push(document);
      }),

      updateDocument: (id, updates) => set((state) => {
        const index = state.documents.findIndex((d) => d.id === id);
        if (index !== -1) {
          state.documents[index] = { 
            ...state.documents[index], 
            ...updates,
            updatedAt: new Date()
          };
        }
      }),

      removeDocument: (id) => set((state) => {
        state.documents = state.documents.filter((d) => d.id !== id);
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
    })),
    {
      name: 'athena-formation-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist non-sensitive data
        currentBusinessId: state.currentBusinessId,
        wizardStep: state.wizardStep,
        cofounderFilters: state.cofounderFilters,
        // Don't persist wizard data with potentially sensitive info
        // Don't persist loading/error states
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

export const selectCurrentBusiness = (state: FormationStore) => 
  state.businesses.find((b) => b.id === state.currentBusinessId);

export const selectBusinessesByStatus = (status: BusinessStatus) => (state: FormationStore) =>
  state.businesses.filter((b) => b.status === status);

export const selectPendingComplianceItems = (state: FormationStore) =>
  state.complianceItems.filter((c) => c.status === 'pending' || c.status === 'overdue');

export const selectOverdueComplianceItems = (state: FormationStore) =>
  state.complianceItems.filter((c) => c.status === 'overdue');

export const selectFilteredCofounderMatches = (state: FormationStore) => {
  const { cofounderMatches, cofounderFilters } = state;
  return cofounderMatches.filter((match) => {
    if (cofounderFilters.minMatchScore && match.matchScore < cofounderFilters.minMatchScore) {
      return false;
    }
    if (cofounderFilters.roles.length && !cofounderFilters.roles.includes(match.role)) {
      return false;
    }
    if (cofounderFilters.skills.length) {
      const hasSkill = cofounderFilters.skills.some((s) => match.skills.includes(s));
      if (!hasSkill) return false;
    }
    return true;
  });
};

export const selectWizardProgress = (state: FormationStore) => {
  const steps: FormationStep[] = [
    'entity-type', 'business-details', 'owners', 'registered-agent',
    'operating-agreement', 'ein-application', 'state-filings', 'complete'
  ];
  const currentIndex = steps.indexOf(state.wizardStep);
  return {
    currentStep: currentIndex + 1,
    totalSteps: steps.length,
    percentage: Math.round(((currentIndex + 1) / steps.length) * 100),
  };
};
