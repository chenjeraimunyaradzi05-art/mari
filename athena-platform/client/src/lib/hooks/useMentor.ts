'use client';

/**
 * Mentor Studio Hooks
 * Phase 4: Web Client - Persona Studios
 * React Query hooks for Mentor Dashboard features
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMentorStore } from '@/lib/stores/mentor.store';
import type { 
  Session, 
  TimeSlot, 
  Mentee, 
  Transaction, 
  EarningsData, 
  PayoutMethod,
  MentorStats,
  SessionType,
  SessionStatus
} from '@/lib/stores/mentor.store';

// ============================================
// QUERY KEYS
// ============================================

export const mentorKeys = {
  all: ['mentor'] as const,
  sessions: () => [...mentorKeys.all, 'sessions'] as const,
  sessionsByDate: (date: string) => [...mentorKeys.sessions(), 'date', date] as const,
  session: (id: string) => [...mentorKeys.sessions(), id] as const,
  availability: () => [...mentorKeys.all, 'availability'] as const,
  mentees: () => [...mentorKeys.all, 'mentees'] as const,
  mentee: (id: string) => [...mentorKeys.mentees(), id] as const,
  earnings: (range: string) => [...mentorKeys.all, 'earnings', range] as const,
  transactions: () => [...mentorKeys.all, 'transactions'] as const,
  stats: () => [...mentorKeys.all, 'stats'] as const,
  payoutMethods: () => [...mentorKeys.all, 'payout-methods'] as const,
};

// ============================================
// API FUNCTIONS
// ============================================

const mentorApi = {
  // Sessions
  getSessions: async (params?: { startDate?: Date; endDate?: Date }): Promise<Session[]> => {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set('startDate', params.startDate.toISOString());
    if (params?.endDate) searchParams.set('endDate', params.endDate.toISOString());
    
    const response = await fetch(`/api/mentor/sessions?${searchParams}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch sessions');
    const { data } = await response.json();
    return data;
  },

  getSession: async (id: string): Promise<Session> => {
    const response = await fetch(`/api/mentor/sessions/${id}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch session');
    const { data } = await response.json();
    return data;
  },

  createSession: async (data: Omit<Session, 'id'>): Promise<Session> => {
    const response = await fetch('/api/mentor/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create session');
    const { data: session } = await response.json();
    return session;
  },

  updateSession: async (id: string, data: Partial<Session>): Promise<Session> => {
    const response = await fetch(`/api/mentor/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update session');
    const { data: session } = await response.json();
    return session;
  },

  cancelSession: async (id: string, reason?: string): Promise<void> => {
    const response = await fetch(`/api/mentor/sessions/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) throw new Error('Failed to cancel session');
  },

  completeSession: async (id: string, notes?: string): Promise<void> => {
    const response = await fetch(`/api/mentor/sessions/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ notes }),
    });
    if (!response.ok) throw new Error('Failed to complete session');
  },

  rescheduleSession: async (id: string, newDate: Date, newStartTime: string, newEndTime: string): Promise<Session> => {
    const response = await fetch(`/api/mentor/sessions/${id}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ date: newDate, startTime: newStartTime, endTime: newEndTime }),
    });
    if (!response.ok) throw new Error('Failed to reschedule session');
    const { data } = await response.json();
    return data;
  },

  // Availability
  getAvailability: async (): Promise<TimeSlot[]> => {
    const response = await fetch('/api/mentor/availability', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch availability');
    const { data } = await response.json();
    return data;
  },

  saveAvailability: async (slots: TimeSlot[]): Promise<TimeSlot[]> => {
    const response = await fetch('/api/mentor/availability', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ slots }),
    });
    if (!response.ok) throw new Error('Failed to save availability');
    const { data } = await response.json();
    return data;
  },

  // Mentees
  getMentees: async (): Promise<Mentee[]> => {
    const response = await fetch('/api/mentor/mentees', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch mentees');
    const { data } = await response.json();
    return data;
  },

  getMentee: async (id: string): Promise<Mentee> => {
    const response = await fetch(`/api/mentor/mentees/${id}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch mentee');
    const { data } = await response.json();
    return data;
  },

  updateMentee: async (id: string, data: Partial<Mentee>): Promise<Mentee> => {
    const response = await fetch(`/api/mentor/mentees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update mentee');
    const { data: mentee } = await response.json();
    return mentee;
  },

  // Earnings
  getEarnings: async (range: string): Promise<EarningsData[]> => {
    const response = await fetch(`/api/mentor/earnings?range=${range}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch earnings');
    const { data } = await response.json();
    return data;
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const response = await fetch('/api/mentor/transactions', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch transactions');
    const { data } = await response.json();
    return data;
  },

  getStats: async (): Promise<MentorStats> => {
    const response = await fetch('/api/mentor/stats', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch stats');
    const { data } = await response.json();
    return data;
  },

  // Payouts
  getPayoutMethods: async (): Promise<PayoutMethod[]> => {
    const response = await fetch('/api/mentor/payout-methods', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch payout methods');
    const { data } = await response.json();
    return data;
  },

  addPayoutMethod: async (method: Omit<PayoutMethod, 'id'>): Promise<PayoutMethod> => {
    const response = await fetch('/api/mentor/payout-methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(method),
    });
    if (!response.ok) throw new Error('Failed to add payout method');
    const { data } = await response.json();
    return data;
  },

  requestPayout: async (amount: number, methodId: string): Promise<Transaction> => {
    const response = await fetch('/api/mentor/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ amount, methodId }),
    });
    if (!response.ok) throw new Error('Failed to request payout');
    const { data } = await response.json();
    return data;
  },
};

// ============================================
// SESSION HOOKS
// ============================================

/**
 * Fetch mentor sessions
 */
export function useMentorSessions(params?: { startDate?: Date; endDate?: Date }) {
  const { setSessions, setLoading, setError } = useMentorStore();

  return useQuery({
    queryKey: mentorKeys.sessions(),
    queryFn: async () => {
      setLoading('sessions', true);
      try {
        const sessions = await mentorApi.getSessions(params);
        setSessions(sessions);
        setLoading('sessions', false);
        return sessions;
      } catch (error) {
        setError('sessions', 'Failed to load sessions');
        setLoading('sessions', false);
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetch single session
 */
export function useSession(id: string) {
  return useQuery({
    queryKey: mentorKeys.session(id),
    queryFn: () => mentorApi.getSession(id),
    enabled: !!id,
  });
}

/**
 * Create a new session
 */
export function useCreateSession() {
  const queryClient = useQueryClient();
  const { addSession } = useMentorStore();

  return useMutation({
    mutationFn: (data: Omit<Session, 'id'>) => mentorApi.createSession(data),
    onSuccess: (session) => {
      addSession(session);
      queryClient.invalidateQueries({ queryKey: mentorKeys.sessions() });
    },
  });
}

/**
 * Update a session
 */
export function useUpdateSession() {
  const queryClient = useQueryClient();
  const { updateSession } = useMentorStore();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Session> }) =>
      mentorApi.updateSession(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: mentorKeys.session(id) });
      updateSession(id, data);
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.session(id) });
      queryClient.invalidateQueries({ queryKey: mentorKeys.sessions() });
    },
  });
}

/**
 * Cancel a session
 */
export function useCancelSession() {
  const queryClient = useQueryClient();
  const { cancelSession } = useMentorStore();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      mentorApi.cancelSession(id, reason),
    onMutate: async ({ id, reason }) => {
      // Optimistic update
      cancelSession(id, reason);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.sessions() });
    },
  });
}

/**
 * Complete a session
 */
export function useCompleteSession() {
  const queryClient = useQueryClient();
  const { completeSession } = useMentorStore();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      mentorApi.completeSession(id, notes),
    onMutate: async ({ id, notes }) => {
      // Optimistic update
      completeSession(id, notes);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: mentorKeys.stats() });
    },
  });
}

/**
 * Reschedule a session
 */
export function useRescheduleSession() {
  const queryClient = useQueryClient();
  const { rescheduleSessionOptimistic } = useMentorStore();

  return useMutation({
    mutationFn: ({ id, newDate, newStartTime, newEndTime }: { 
      id: string; 
      newDate: Date; 
      newStartTime: string; 
      newEndTime: string;
    }) => mentorApi.rescheduleSession(id, newDate, newStartTime, newEndTime),
    onMutate: async ({ id, newDate, newStartTime, newEndTime }) => {
      // Optimistic update
      rescheduleSessionOptimistic(id, newDate, newStartTime, newEndTime);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.sessions() });
    },
  });
}

/**
 * Confirm a pending session
 */
export function useConfirmSession() {
  const queryClient = useQueryClient();
  const { confirmSessionOptimistic } = useMentorStore();

  return useMutation({
    mutationFn: (id: string) => mentorApi.updateSession(id, { status: 'confirmed' }),
    onMutate: async (id) => {
      confirmSessionOptimistic(id);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.sessions() });
    },
  });
}

// ============================================
// AVAILABILITY HOOKS
// ============================================

/**
 * Fetch availability slots
 */
export function useAvailability() {
  const { setAvailability, setLoading, setError } = useMentorStore();

  return useQuery({
    queryKey: mentorKeys.availability(),
    queryFn: async () => {
      setLoading('availability', true);
      try {
        const slots = await mentorApi.getAvailability();
        setAvailability(slots);
        setLoading('availability', false);
        return slots;
      } catch (error) {
        setError('availability', 'Failed to load availability');
        setLoading('availability', false);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Save availability slots
 */
export function useSaveAvailability() {
  const queryClient = useQueryClient();
  const { availability, setAvailability } = useMentorStore();

  return useMutation({
    mutationFn: (slots: TimeSlot[]) => mentorApi.saveAvailability(slots),
    onMutate: async (slots) => {
      await queryClient.cancelQueries({ queryKey: mentorKeys.availability() });
      const previousSlots = availability;
      setAvailability(slots);
      return { previousSlots };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousSlots) {
        setAvailability(context.previousSlots);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.availability() });
    },
  });
}

// ============================================
// MENTEE HOOKS
// ============================================

/**
 * Fetch all mentees
 */
export function useMentees() {
  const { setMentees, setLoading, setError } = useMentorStore();

  return useQuery({
    queryKey: mentorKeys.mentees(),
    queryFn: async () => {
      setLoading('mentees', true);
      try {
        const mentees = await mentorApi.getMentees();
        setMentees(mentees);
        setLoading('mentees', false);
        return mentees;
      } catch (error) {
        setError('mentees', 'Failed to load mentees');
        setLoading('mentees', false);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch single mentee
 */
export function useMentee(id: string) {
  return useQuery({
    queryKey: mentorKeys.mentee(id),
    queryFn: () => mentorApi.getMentee(id),
    enabled: !!id,
  });
}

/**
 * Update mentee
 */
export function useUpdateMentee() {
  const queryClient = useQueryClient();
  const { updateMentee } = useMentorStore();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Mentee> }) =>
      mentorApi.updateMentee(id, data),
    onMutate: async ({ id, data }) => {
      updateMentee(id, data);
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.mentee(id) });
      queryClient.invalidateQueries({ queryKey: mentorKeys.mentees() });
    },
  });
}

// ============================================
// EARNINGS HOOKS
// ============================================

/**
 * Fetch earnings data
 */
export function useEarnings(range: string = '30d') {
  const { setEarningsData, setLoading, setError } = useMentorStore();

  return useQuery({
    queryKey: mentorKeys.earnings(range),
    queryFn: async () => {
      setLoading('earnings', true);
      try {
        const data = await mentorApi.getEarnings(range);
        setEarningsData(data);
        setLoading('earnings', false);
        return data;
      } catch (error) {
        setError('earnings', 'Failed to load earnings');
        setLoading('earnings', false);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch transactions
 */
export function useTransactions() {
  const { setTransactions } = useMentorStore();

  return useQuery({
    queryKey: mentorKeys.transactions(),
    queryFn: async () => {
      const transactions = await mentorApi.getTransactions();
      setTransactions(transactions);
      return transactions;
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetch mentor stats
 */
export function useMentorStats() {
  const { setStats, setLoading, setError } = useMentorStore();

  return useQuery({
    queryKey: mentorKeys.stats(),
    queryFn: async () => {
      setLoading('stats', true);
      try {
        const stats = await mentorApi.getStats();
        setStats(stats);
        setLoading('stats', false);
        return stats;
      } catch (error) {
        setError('stats', 'Failed to load stats');
        setLoading('stats', false);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// PAYOUT HOOKS
// ============================================

/**
 * Fetch payout methods
 */
export function usePayoutMethods() {
  const { setPayoutMethods } = useMentorStore();

  return useQuery({
    queryKey: mentorKeys.payoutMethods(),
    queryFn: async () => {
      const methods = await mentorApi.getPayoutMethods();
      setPayoutMethods(methods);
      return methods;
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Add payout method
 */
export function useAddPayoutMethod() {
  const queryClient = useQueryClient();
  const { addPayoutMethod } = useMentorStore();

  return useMutation({
    mutationFn: (method: Omit<PayoutMethod, 'id'>) => mentorApi.addPayoutMethod(method),
    onSuccess: (method) => {
      addPayoutMethod(method);
      queryClient.invalidateQueries({ queryKey: mentorKeys.payoutMethods() });
    },
  });
}

/**
 * Request payout
 */
export function useRequestPayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ amount, methodId }: { amount: number; methodId: string }) =>
      mentorApi.requestPayout(amount, methodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: mentorKeys.stats() });
    },
  });
}
