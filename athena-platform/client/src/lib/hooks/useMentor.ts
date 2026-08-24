'use client';

/**
 * Mentor Studio Hooks
 * Phase 4: Web Client - Persona Studios
 * React Query hooks for Mentor Dashboard features
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';
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

type RawMentorSession = Record<string, any>;

export type CreateMentorSessionInput = Omit<Session, 'id'> & {
  mentorId?: string;
  mentorProfileId?: string;
  scheduledAt?: Date | string;
  durationMinutes?: number;
  note?: string;
};

async function readPayload<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T;
  }
  return payload as T;
}

function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return combined;
}

function getSessionStart(data: CreateMentorSessionInput): Date {
  if (data.scheduledAt instanceof Date) {
    return data.scheduledAt;
  }
  if (typeof data.scheduledAt === 'string') {
    return new Date(data.scheduledAt);
  }
  return combineDateAndTime(data.date, data.startTime);
}

function getDurationMinutes(startTime: string, endTime: string): number {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  const start = (startHours * 60) + startMinutes;
  const end = (endHours * 60) + endMinutes;
  return end > start ? end - start : 60;
}

function unwrapSessionResponse(payload: RawMentorSession | { session?: RawMentorSession }): RawMentorSession {
  if (
    payload &&
    typeof payload === 'object' &&
    'session' in payload &&
    payload.session &&
    typeof payload.session === 'object'
  ) {
    return payload.session;
  }
  return payload as RawMentorSession;
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function normalizeSessionType(type?: string | null): SessionType {
  const normalized = type?.toLowerCase();
  if (normalized === 'audio' || normalized === 'chat') {
    return normalized;
  }
  return 'video';
}

function normalizeSessionStatus(status?: string | null): SessionStatus {
  switch (status) {
    case 'CONFIRMED':
    case 'confirmed':
      return 'confirmed';
    case 'IN_PROGRESS':
    case 'in-progress':
      return 'in-progress';
    case 'COMPLETED':
    case 'completed':
      return 'completed';
    case 'CANCELED':
    case 'CANCELLED':
    case 'cancelled':
      return 'cancelled';
    case 'NO_SHOW':
    case 'no-show':
      return 'no-show';
    case 'REQUESTED':
    case 'scheduled':
    default:
      return 'scheduled';
  }
}

function toBackendSessionStatus(status: SessionStatus): 'CONFIRMED' | 'CANCELED' | 'COMPLETED' {
  if (status === 'completed') return 'COMPLETED';
  if (status === 'cancelled') return 'CANCELED';
  return 'CONFIRMED';
}

function mapMentorSession(raw: RawMentorSession): Session {
  const start = new Date(raw.scheduledAt ?? raw.date ?? Date.now());
  const duration = Number(raw.durationMinutes ?? raw.duration ?? 60);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + duration);

  const mentee = raw.mentee ?? {};
  const menteeName =
    raw.menteeName ||
    mentee.displayName ||
    [mentee.firstName, mentee.lastName].filter(Boolean).join(' ') ||
    'Mentee';

  return {
    id: String(raw.id),
    menteeId: String(raw.menteeId ?? mentee.id ?? ''),
    menteeName,
    menteeAvatar: raw.menteeAvatar ?? mentee.avatar ?? undefined,
    date: start,
    startTime: formatTime(start),
    endTime: formatTime(end),
    duration,
    type: normalizeSessionType(raw.type ?? raw.sessionType),
    status: normalizeSessionStatus(raw.status),
    topic: raw.topic ?? raw.note ?? 'Mentorship session',
    price: Number(raw.sessionAmount ?? raw.price ?? raw.amount ?? raw.mentorPayout ?? 0),
    notes: raw.notes ?? raw.note ?? undefined,
    meetingUrl: raw.meetingUrl ?? undefined,
    recordingUrl: raw.recordingUrl ?? undefined,
  };
}

const mentorApi = {
  // Sessions
  getSessions: async (params?: { startDate?: Date; endDate?: Date }): Promise<Session[]> => {
    const searchParams = new URLSearchParams();
    searchParams.set('role', 'mentor');
    if (params?.startDate) searchParams.set('startDate', params.startDate.toISOString());
    if (params?.endDate) searchParams.set('endDate', params.endDate.toISOString());
    
    const response = await apiFetch(`/api/mentors/sessions?${searchParams}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch sessions');
    const data = await readPayload<RawMentorSession[]>(response);
    return Array.isArray(data) ? data.map(mapMentorSession) : [];
  },

  getSession: async (id: string): Promise<Session> => {
    const response = await apiFetch('/api/mentors/sessions?role=mentor', { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch session');
    const data = await readPayload<RawMentorSession[]>(response);
    const session = Array.isArray(data) ? data.find((item) => item.id === id) : null;
    if (!session) throw new Error('Session not found');
    return mapMentorSession(session);
  },

  createSession: async (data: CreateMentorSessionInput): Promise<Session> => {
    const mentorId = data.mentorProfileId ?? data.mentorId;
    if (!mentorId) {
      throw new Error('A mentor profile id is required to create a mentor session');
    }

    const scheduledAt = getSessionStart(data);
    const response = await apiFetch(`/api/mentors/${mentorId}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: data.durationMinutes ?? data.duration,
        note: data.note ?? data.notes ?? data.topic,
      }),
    });
    if (!response.ok) throw new Error('Failed to create session');
    const payload = await readPayload<RawMentorSession | { session?: RawMentorSession }>(response);
    return mapMentorSession(unwrapSessionResponse(payload));
  },

  updateSession: async (id: string, data: Partial<Session>): Promise<Session> => {
    if (!data.status) {
      throw new Error('Only mentor session status updates are supported');
    }

    const response = await apiFetch(`/api/mentors/sessions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: toBackendSessionStatus(data.status) }),
    });
    if (!response.ok) throw new Error('Failed to update session');
    const session = await readPayload<RawMentorSession>(response);
    return mapMentorSession(session);
  },

  cancelSession: async (id: string, reason?: string): Promise<void> => {
    const response = await apiFetch(`/api/mentors/sessions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'CANCELED', reason }),
    });
    if (!response.ok) throw new Error('Failed to cancel session');
  },

  completeSession: async (id: string, notes?: string): Promise<void> => {
    const response = await apiFetch(`/api/mentors/sessions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'COMPLETED', notes }),
    });
    if (!response.ok) throw new Error('Failed to complete session');
  },

  rescheduleSession: async (id: string, newDate: Date, newStartTime: string, newEndTime: string): Promise<Session> => {
    const scheduledAt = combineDateAndTime(newDate, newStartTime);
    const response = await apiFetch(`/api/mentors/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: getDurationMinutes(newStartTime, newEndTime),
      }),
    });
    if (!response.ok) throw new Error('Failed to reschedule session');
    const session = await readPayload<RawMentorSession>(response);
    return mapMentorSession(session);
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
    queryKey: [
      ...mentorKeys.sessions(),
      params?.startDate?.toISOString() ?? null,
      params?.endDate?.toISOString() ?? null,
    ],
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
    mutationFn: (data: CreateMentorSessionInput) => mentorApi.createSession(data),
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

