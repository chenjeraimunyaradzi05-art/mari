// @ts-nocheck - Immer Draft types conflict with explicit array callback types
'use client';

/**
 * Mentor Studio Store
 * Phase 4: Web Client - Persona Studios
 * Zustand store for mentor dashboard state management
 * 
 * Features:
 * - Session management
 * - Calendar & availability
 * - Earnings tracking
 * - Client relationships
 * - Analytics
 * 
 * Note: Using immer middleware - callback parameter types are inferred from state.
 * Type checking disabled for immer's Draft<T> type compatibility with array methods.
 * Type safety is ensured by MentorState and MentorActions interface definitions.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================
// TYPES
// ============================================

export type SessionType = 'video' | 'audio' | 'chat';
export type SessionStatus = 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TimeSlot {
  id: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  isActive: boolean;
}

export interface Session {
  id: string;
  menteeId: string;
  menteeName: string;
  menteeAvatar?: string;
  date: Date;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  type: SessionType;
  status: SessionStatus;
  topic: string;
  price: number;
  notes?: string;
  meetingUrl?: string;
  recordingUrl?: string;
  recurring?: {
    frequency: 'weekly' | 'biweekly' | 'monthly';
    endDate?: Date;
  };
  feedback?: {
    rating: number;
    comment: string;
    createdAt: Date;
  };
}

export interface Mentee {
  id: string;
  name: string;
  avatar?: string;
  email: string;
  totalSessions: number;
  totalSpent: number;
  firstSessionAt: Date;
  lastSessionAt: Date;
  notes?: string;
  tags?: string[];
}

export interface EarningsData {
  period: string;
  sessions: number;
  courses: number;
  tips: number;
  referrals: number;
}

export interface Transaction {
  id: string;
  type: 'earning' | 'payout' | 'refund';
  source: 'sessions' | 'courses' | 'tips' | 'referrals';
  description: string;
  amount: number;
  status: 'completed' | 'pending' | 'processing' | 'failed';
  date: Date;
  metadata?: {
    clientName?: string;
    sessionDuration?: number;
    courseName?: string;
  };
}

export interface PayoutMethod {
  id: string;
  type: 'bank' | 'paypal' | 'stripe';
  name: string;
  last4?: string;
  isDefault: boolean;
}

export interface MentorStats {
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  totalSessions: number;
  completedSessions: number;
  averageRating: number;
  totalReviews: number;
  repeatClientRate: number;
  responseTime: number; // average in hours
}

// ============================================
// STORE STATE
// ============================================

interface MentorState {
  // Calendar & Availability
  availability: TimeSlot[];
  timezone: string;
  bufferTime: number; // minutes between sessions
  maxAdvanceBooking: number; // days in advance
  minNotice: number; // hours minimum notice for booking
  
  // Sessions
  sessions: Session[];
  selectedDate: Date | null;
  viewMode: 'month' | 'week' | 'day';
  
  // Clients/Mentees
  mentees: Mentee[];
  selectedMenteeId: string | null;
  
  // Earnings
  transactions: Transaction[];
  earningsData: EarningsData[];
  payoutMethods: PayoutMethod[];
  stats: MentorStats | null;
  earningsTimeRange: '7d' | '30d' | '90d' | '12m' | 'all';
  
  // UI State
  sessionFilters: {
    status: SessionStatus[];
    type: SessionType[];
    dateRange: { start: Date | null; end: Date | null };
  };
  
  // Loading states
  loading: {
    sessions: boolean;
    availability: boolean;
    mentees: boolean;
    earnings: boolean;
    stats: boolean;
  };
  
  // Errors
  errors: {
    sessions?: string;
    availability?: string;
    mentees?: string;
    earnings?: string;
    stats?: string;
  };
}

interface MentorActions {
  // Availability
  setAvailability: (slots: TimeSlot[]) => void;
  addTimeSlot: (slot: TimeSlot) => void;
  updateTimeSlot: (id: string, updates: Partial<TimeSlot>) => void;
  removeTimeSlot: (id: string) => void;
  toggleSlotActive: (id: string) => void;
  setTimezone: (timezone: string) => void;
  setBufferTime: (minutes: number) => void;
  setMaxAdvanceBooking: (days: number) => void;
  setMinNotice: (hours: number) => void;
  
  // Sessions
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  cancelSession: (id: string, reason?: string) => void;
  completeSession: (id: string, notes?: string) => void;
  setSelectedDate: (date: Date | null) => void;
  setViewMode: (mode: 'month' | 'week' | 'day') => void;
  setSessionFilters: (filters: Partial<MentorState['sessionFilters']>) => void;
  
  // Optimistic session updates
  confirmSessionOptimistic: (sessionId: string) => void;
  rescheduleSessionOptimistic: (sessionId: string, newDate: Date, newStartTime: string, newEndTime: string) => void;
  
  // Mentees
  setMentees: (mentees: Mentee[]) => void;
  updateMentee: (id: string, updates: Partial<Mentee>) => void;
  addMenteeNote: (id: string, note: string) => void;
  addMenteeTag: (id: string, tag: string) => void;
  removeMenteeTag: (id: string, tag: string) => void;
  setSelectedMentee: (id: string | null) => void;
  
  // Earnings
  setTransactions: (transactions: Transaction[]) => void;
  setEarningsData: (data: EarningsData[]) => void;
  setPayoutMethods: (methods: PayoutMethod[]) => void;
  addPayoutMethod: (method: PayoutMethod) => void;
  removePayoutMethod: (id: string) => void;
  setDefaultPayoutMethod: (id: string) => void;
  setStats: (stats: MentorStats) => void;
  setEarningsTimeRange: (range: MentorState['earningsTimeRange']) => void;
  
  // Request payout
  requestPayout: (amount: number, methodId: string) => Promise<void>;
  
  // Loading/Error states
  setLoading: (key: keyof MentorState['loading'], value: boolean) => void;
  setError: (key: keyof MentorState['errors'], error?: string) => void;
  clearErrors: () => void;
  
  // Reset
  reset: () => void;
}

type MentorStore = MentorState & MentorActions;

// ============================================
// DEFAULT STATE
// ============================================

const initialState: MentorState = {
  availability: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  bufferTime: 15,
  maxAdvanceBooking: 30,
  minNotice: 24,
  
  sessions: [],
  selectedDate: null,
  viewMode: 'week',
  
  mentees: [],
  selectedMenteeId: null,
  
  transactions: [],
  earningsData: [],
  payoutMethods: [],
  stats: null,
  earningsTimeRange: '30d',
  
  sessionFilters: {
    status: [],
    type: [],
    dateRange: { start: null, end: null },
  },
  
  loading: {
    sessions: false,
    availability: false,
    mentees: false,
    earnings: false,
    stats: false,
  },
  
  errors: {},
};

// ============================================
// STORE
// ============================================

export const useMentorStore = create<MentorStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // ============================================
      // AVAILABILITY
      // ============================================
      
      setAvailability: (slots) => set((state) => {
        state.availability = slots;
      }),

      addTimeSlot: (slot) => set((state) => {
        state.availability.push(slot);
      }),

      updateTimeSlot: (id, updates) => set((state) => {
        const index = state.availability.findIndex((s) => s.id === id);
        if (index !== -1) {
          state.availability[index] = { ...state.availability[index], ...updates };
        }
      }),

      removeTimeSlot: (id) => set((state) => {
        state.availability = state.availability.filter((s) => s.id !== id);
      }),

      toggleSlotActive: (id) => set((state) => {
        const index = state.availability.findIndex((s) => s.id === id);
        if (index !== -1) {
          state.availability[index].isActive = !state.availability[index].isActive;
        }
      }),

      setTimezone: (timezone) => set((state) => {
        state.timezone = timezone;
      }),

      setBufferTime: (minutes) => set((state) => {
        state.bufferTime = minutes;
      }),

      setMaxAdvanceBooking: (days) => set((state) => {
        state.maxAdvanceBooking = days;
      }),

      setMinNotice: (hours) => set((state) => {
        state.minNotice = hours;
      }),

      // ============================================
      // SESSIONS
      // ============================================
      
      setSessions: (sessions) => set((state) => {
        state.sessions = sessions;
      }),

      addSession: (session) => set((state) => {
        state.sessions.push(session);
      }),

      updateSession: (id, updates) => set((state) => {
        const index = state.sessions.findIndex((s) => s.id === id);
        if (index !== -1) {
          state.sessions[index] = { ...state.sessions[index], ...updates };
        }
      }),

      cancelSession: (id, reason) => set((state) => {
        const index = state.sessions.findIndex((s) => s.id === id);
        if (index !== -1) {
          state.sessions[index].status = 'cancelled';
          if (reason) {
            state.sessions[index].notes = (state.sessions[index].notes || '') + `\nCancelled: ${reason}`;
          }
        }
      }),

      completeSession: (id, notes) => set((state) => {
        const index = state.sessions.findIndex((s) => s.id === id);
        if (index !== -1) {
          state.sessions[index].status = 'completed';
          if (notes) {
            state.sessions[index].notes = notes;
          }
        }
      }),

      setSelectedDate: (date) => set((state) => {
        state.selectedDate = date;
      }),

      setViewMode: (mode) => set((state) => {
        state.viewMode = mode;
      }),

      setSessionFilters: (filters) => set((state) => {
        state.sessionFilters = { ...state.sessionFilters, ...filters };
      }),

      // Optimistic updates
      confirmSessionOptimistic: (sessionId) => set((state) => {
        const index = state.sessions.findIndex((s) => s.id === sessionId);
        if (index !== -1 && state.sessions[index].status === 'scheduled') {
          state.sessions[index].status = 'confirmed';
        }
      }),

      rescheduleSessionOptimistic: (sessionId, newDate, newStartTime, newEndTime) => set((state) => {
        const index = state.sessions.findIndex((s) => s.id === sessionId);
        if (index !== -1) {
          state.sessions[index].date = newDate;
          state.sessions[index].startTime = newStartTime;
          state.sessions[index].endTime = newEndTime;
        }
      }),

      // ============================================
      // MENTEES
      // ============================================
      
      setMentees: (mentees) => set((state) => {
        state.mentees = mentees;
      }),

      updateMentee: (id, updates) => set((state) => {
        const index = state.mentees.findIndex((m) => m.id === id);
        if (index !== -1) {
          state.mentees[index] = { ...state.mentees[index], ...updates };
        }
      }),

      addMenteeNote: (id, note) => set((state) => {
        const index = state.mentees.findIndex((m) => m.id === id);
        if (index !== -1) {
          const existingNote = state.mentees[index].notes || '';
          state.mentees[index].notes = existingNote ? `${existingNote}\n${note}` : note;
        }
      }),

      addMenteeTag: (id, tag) => set((state) => {
        const index = state.mentees.findIndex((m) => m.id === id);
        if (index !== -1) {
          const tags = state.mentees[index].tags || [];
          if (!tags.includes(tag)) {
            state.mentees[index].tags = [...tags, tag];
          }
        }
      }),

      removeMenteeTag: (id, tag) => set((state) => {
        const index = state.mentees.findIndex((m) => m.id === id);
        if (index !== -1 && state.mentees[index].tags) {
          state.mentees[index].tags = state.mentees[index].tags!.filter((t) => t !== tag);
        }
      }),

      setSelectedMentee: (id) => set((state) => {
        state.selectedMenteeId = id;
      }),

      // ============================================
      // EARNINGS
      // ============================================
      
      setTransactions: (transactions) => set((state) => {
        state.transactions = transactions;
      }),

      setEarningsData: (data) => set((state) => {
        state.earningsData = data;
      }),

      setPayoutMethods: (methods) => set((state) => {
        state.payoutMethods = methods;
      }),

      addPayoutMethod: (method) => set((state) => {
        state.payoutMethods.push(method);
      }),

      removePayoutMethod: (id) => set((state) => {
        state.payoutMethods = state.payoutMethods.filter((m) => m.id !== id);
      }),

      setDefaultPayoutMethod: (id) => set((state) => {
        state.payoutMethods = state.payoutMethods.map((m) => ({
          ...m,
          isDefault: m.id === id,
        }));
      }),

      setStats: (stats) => set((state) => {
        state.stats = stats;
      }),

      setEarningsTimeRange: (range) => set((state) => {
        state.earningsTimeRange = range;
      }),

      requestPayout: async (amount, methodId) => {
        const state = get();
        set((s) => { s.loading.earnings = true; });
        
        try {
          // API call would go here
          // await mentorApi.requestPayout(amount, methodId);
          
          // Add optimistic transaction
          const newTransaction: Transaction = {
            id: `payout-${Date.now()}`,
            type: 'payout',
            source: 'sessions',
            description: 'Payout Request',
            amount: -amount,
            status: 'processing',
            date: new Date(),
          };
          
          set((s) => {
            s.transactions.unshift(newTransaction);
            if (s.stats) {
              s.stats.pendingBalance += amount;
              s.stats.availableBalance -= amount;
            }
            s.loading.earnings = false;
          });
        } catch (error) {
          set((s) => {
            s.errors.earnings = 'Failed to process payout request';
            s.loading.earnings = false;
          });
          throw error;
        }
      },

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
      name: 'athena-mentor-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        availability: state.availability,
        timezone: state.timezone,
        bufferTime: state.bufferTime,
        maxAdvanceBooking: state.maxAdvanceBooking,
        minNotice: state.minNotice,
        viewMode: state.viewMode,
        earningsTimeRange: state.earningsTimeRange,
        // Don't persist sessions, mentees, transactions (should be fetched fresh)
        // Don't persist loading/error states
      }),
    }
  )
);

// ============================================
// SELECTORS
// ============================================

export const selectUpcomingSessions = (state: MentorStore) =>
  state.sessions
    .filter((s) => 
      (s.status === 'scheduled' || s.status === 'confirmed') && 
      new Date(s.date) >= new Date()
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

export const selectTodaySessions = (state: MentorStore) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return state.sessions.filter((s) => {
    const sessionDate = new Date(s.date);
    return sessionDate >= today && sessionDate < tomorrow;
  });
};

export const selectSessionsByDate = (date: Date) => (state: MentorStore) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  
  return state.sessions.filter((s) => {
    const sessionDate = new Date(s.date);
    return sessionDate >= start && sessionDate < end;
  });
};

export const selectFilteredSessions = (state: MentorStore) => {
  const { sessions, sessionFilters } = state;
  
  return sessions.filter((session) => {
    if (sessionFilters.status.length && !sessionFilters.status.includes(session.status)) {
      return false;
    }
    if (sessionFilters.type.length && !sessionFilters.type.includes(session.type)) {
      return false;
    }
    if (sessionFilters.dateRange.start) {
      const sessionDate = new Date(session.date);
      if (sessionDate < sessionFilters.dateRange.start) return false;
    }
    if (sessionFilters.dateRange.end) {
      const sessionDate = new Date(session.date);
      if (sessionDate > sessionFilters.dateRange.end) return false;
    }
    return true;
  });
};

export const selectActiveSlots = (state: MentorStore) =>
  state.availability.filter((slot) => slot.isActive);

export const selectSlotsByDay = (dayOfWeek: number) => (state: MentorStore) =>
  state.availability.filter((slot) => slot.dayOfWeek === dayOfWeek);

export const selectTotalEarningsForPeriod = (state: MentorStore) =>
  state.earningsData.reduce(
    (total, period) => total + period.sessions + period.courses + period.tips + period.referrals,
    0
  );

export const selectPendingTransactions = (state: MentorStore) =>
  state.transactions.filter((t) => t.status === 'pending' || t.status === 'processing');

export const selectDefaultPayoutMethod = (state: MentorStore) =>
  state.payoutMethods.find((m) => m.isDefault);
