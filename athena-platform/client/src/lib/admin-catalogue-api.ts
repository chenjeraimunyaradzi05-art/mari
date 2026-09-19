/**
 * Admin catalogue helpers: the accelerator cohorts and sessions, the investor
 * directory and its introductions, and the insurance products. Every call
 * here has a route in server/src/routes/admin-catalogue.routes.ts; keeping
 * the paths literal is what lets the API-contract check see them.
 */

import type { AxiosResponse } from 'axios';
import { api } from './api';

/**
 * The return type the create and update halves of a pair share.
 *
 * Every one of these screens picks between creating and updating inside a
 * single mutation. Left to infer, axios carries the request body into the
 * second parameter of AxiosResponse, so `create` (which takes a whole input)
 * and `update` (which takes a Partial of it) come back as two different types
 * and the ternary between them stops being assignable to either. Naming the
 * response once fixes both halves to the shape the routes actually return.
 */
type AdminWrite<T = { id?: string }> = Promise<AxiosResponse<{ success?: boolean; data?: T; message?: string }>>;

export type CohortStatus = 'UPCOMING' | 'ENROLLING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type InvestorType = 'ANGEL' | 'VC' | 'CORPORATE_VC' | 'FAMILY_OFFICE' | 'ACCELERATOR' | 'GOVERNMENT';
export type IntroductionStatus = 'REQUESTED' | 'APPROVED' | 'INTRODUCED' | 'MEETING_SCHEDULED' | 'DECLINED' | 'EXPIRED';
export type IntroductionDecision = Exclude<IntroductionStatus, 'REQUESTED'>;
export type InsuranceType = 'INCOME_PROTECTION' | 'LIFE' | 'TPD' | 'TRAUMA' | 'HEALTH';

export type CohortInput = {
  name: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  maxParticipants?: number;
  priceAud?: number;
  status?: CohortStatus;
  mentorIds?: string[];
  useDefaultCurriculum?: boolean;
};

export type SessionInput = {
  weekNumber: number;
  title: string;
  description?: string | null;
  scheduledAt: string;
  durationMins?: number;
  meetingUrl?: string | null;
  recordingUrl?: string | null;
};

export type InvestorInput = {
  name: string;
  type: InvestorType;
  description?: string | null;
  minCheckSize?: number | string | null;
  maxCheckSize?: number | string | null;
  stages?: string[];
  industries?: string[];
  regions?: string[];
  thesis?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  portfolioCompanies?: string[] | null;
  isActive?: boolean;
  isVerified?: boolean;
};

export type InsuranceProductInput = {
  provider: string;
  name: string;
  type: InsuranceType;
  description?: string | null;
  coverageAmount?: number | string | null;
  premiumMonthly?: number | string | null;
  premiumAnnual?: number | string | null;
  waitingPeriod?: number | string | null;
  benefitPeriod?: number | string | null;
  features?: string[];
  exclusions?: string[];
  commissionPct?: number | string | null;
  isActive?: boolean;
};

export const adminCatalogueApi = {
  cohorts: {
    list: (params?: { status?: CohortStatus }) => api.get('/admin/accelerator/cohorts', { params }),
    get: (id: string) => api.get(`/admin/accelerator/cohorts/${id}`),
    create: (data: CohortInput): AdminWrite => api.post('/admin/accelerator/cohorts', data),
    update: (id: string, data: Partial<CohortInput>): AdminWrite => api.patch(`/admin/accelerator/cohorts/${id}`, data),
    remove: (id: string) => api.delete(`/admin/accelerator/cohorts/${id}`),
    addDefaultSessions: (id: string) => api.post(`/admin/accelerator/cohorts/${id}/sessions/default`),
    addSession: (id: string, data: SessionInput): AdminWrite => api.post(`/admin/accelerator/cohorts/${id}/sessions`, data),
    updateSession: (id: string, sessionId: string, data: Partial<SessionInput>): AdminWrite =>
      api.patch(`/admin/accelerator/cohorts/${id}/sessions/${sessionId}`, data),
    removeSession: (id: string, sessionId: string) => api.delete(`/admin/accelerator/cohorts/${id}/sessions/${sessionId}`),
  },
  investors: {
    list: (params?: { type?: InvestorType; active?: 'true' | 'false'; search?: string }) => api.get('/admin/investors', { params }),
    create: (data: InvestorInput): AdminWrite => api.post('/admin/investors', data),
    update: (id: string, data: Partial<InvestorInput>): AdminWrite => api.patch(`/admin/investors/${id}`, data),
    remove: (id: string) => api.delete(`/admin/investors/${id}`),
  },
  introductions: {
    list: (params?: { status?: IntroductionStatus }) => api.get('/admin/investors/introductions', { params }),
    decide: (id: string, data: { status: IntroductionDecision; outcome?: string }) =>
      api.patch(`/admin/investors/introductions/${id}`, data),
  },
  insuranceProducts: {
    list: (params?: { type?: InsuranceType; active?: 'true' | 'false' }) => api.get('/admin/insurance/products', { params }),
    create: (data: InsuranceProductInput): AdminWrite => api.post('/admin/insurance/products', data),
    update: (id: string, data: Partial<InsuranceProductInput>): AdminWrite => api.patch(`/admin/insurance/products/${id}`, data),
    remove: (id: string) => api.delete(`/admin/insurance/products/${id}`),
  },
};

/** The message the server put on a failed request, if any. */
export const adminApiMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

/** Split a comma-separated field into trimmed, non-empty entries. */
export const listFromText = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

/** An ISO timestamp as the value a datetime-local input wants, in the browser's zone. */
export function toDateTimeLocal(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A datetime-local value back to ISO, or '' when blank or unparseable. */
export function fromDateTimeLocal(value: string) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
