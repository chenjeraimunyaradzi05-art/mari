import { api } from './api';

/**
 * Helpers for the routes that compute something true from the database.
 *
 * /api/algorithms/* (server algorithm.routes.ts) queries Job, JobSkill,
 * Course, UserSkill, MentorProfile and Event. /api/trust-score returns the
 * factors behind a member's trust score. /api/salary/* reads the
 * SalaryDataPoint table members contribute to and the ranges employers publish.
 * None of the numbers here are seeded or modelled; where there is not enough
 * to say, the server returns null or an empty list and the page says so.
 *
 * These replaced the /api/ai-algorithms/* readers on the AI pages, whose
 * careerPrediction, mentorMatchScore and opportunityMatch tables nothing ever
 * wrote. They live in their own file so the shared api.ts is not rewritten;
 * the API-contract check walks this file like any other.
 *
 * The generics are single-level on purpose: the contract check's regex reads
 * `api.get<Name>(` and a nested `<A<B>>` would hide the call from it.
 */

type Envelope<T> = { success: boolean; data: T };

export type CareerCompassResult = {
  targetRole: string;
  persona?: string | null;
  /** Skills active roles with this title list that are not on her profile. */
  skillGaps: string[];
  recommendedCourses: Array<{
    id: string;
    title: string;
    providerName: string | null;
    type: string | null;
    cost: number | null;
  }>;
  suggestedJobs: Array<{
    id: string;
    title: string;
    organizationName: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  }>;
};
type CareerCompassEnvelope = Envelope<CareerCompassResult>;

export type MentorMatch = {
  /** The mentorProfile id, which /dashboard/mentors/[id] takes. */
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  headline: string | null;
  specializations: string[];
  yearsExperience: number | null;
  rating: number | null;
  /** An unbounded heuristic, not a percentage. Never render it. */
  matchScore: number;
  /** The honest part: 'Shared skills: ...', '8+ years experience', 'Rated 4.8'. */
  matchReasons: string[];
};
export type MentorMatchResult = { mentors: MentorMatch[] };
type MentorMatchEnvelope = Envelope<MentorMatchResult>;

export type OpportunityScanResult = {
  jobs: Array<{
    id: string;
    title: string;
    organizationName: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  }>;
  courses: Array<{
    id: string;
    title: string;
    providerName: string | null;
    type: string | null;
  }>;
  events: Array<{
    id: string;
    title: string;
    date: string;
    location: string | null;
    isFeatured: boolean;
  }>;
};
type OpportunityScanEnvelope = Envelope<OpportunityScanResult>;

export type SalaryEquityResult = {
  targetRole: string;
  /** Active listings with this title that publish a range. */
  sampleSize: number;
  /** Null below three listings; the server will not guess from fewer. */
  marketMedian: number | null;
  userTargetMid: number | null;
  gap: number | null;
  status: 'above' | 'below' | 'aligned' | 'insufficient_data';
  /** Canned coaching lines, not data. Not rendered. */
  tips: string[];
};
type SalaryEquityEnvelope = Envelope<SalaryEquityResult>;

export type TrustScoreResult = {
  score: number;
  factors: Array<{ label: string; points: number }>;
  updatedAt: string;
};
type TrustScoreEnvelope = Envelope<TrustScoreResult>;

export type NegotiationScenario = 'new_job' | 'raise' | 'promotion' | 'counter_offer';

/** A coaching template per scenario; the server fills in only what was typed. */
export type NegotiationScript = {
  situation: string;
  openingStatement: string;
  keyPoints: string[];
  counterResponses: Record<string, string>;
  closingStatement: string;
  tips: string[];
};

export type CompanyTransparency = {
  companyName: string;
  score: number;
  rolesPosted: number;
  rolesWithPayPublished: number;
  employeesReporting: number;
  factors: Array<{ name: string; score: number; weight: number }>;
  recommendations: string[];
};

export const algorithmApi = {
  /** Defaults to her current job title when no role is given. */
  careerCompass: (targetRole?: string) =>
    api.get<CareerCompassEnvelope>('/algorithms/career-compass', {
      params: targetRole ? { targetRole } : undefined,
    }),

  mentorMatch: () => api.get<MentorMatchEnvelope>('/algorithms/mentor-match'),

  /** The newest listings on ATHENA. Not personalised. */
  opportunityScan: () => api.get<OpportunityScanEnvelope>('/algorithms/opportunity-scan'),

  /** The median of the ranges employers advertise for this title. */
  salaryEquity: (targetRole?: string) =>
    api.get<SalaryEquityEnvelope>('/algorithms/salary-equity', {
      params: targetRole ? { targetRole } : undefined,
    }),
};

export const trustApi = {
  mine: () => api.get<TrustScoreEnvelope>('/trust-score'),
};

export const salaryApi = {
  negotiationScript: (data: {
    scenario: NegotiationScenario;
    role: string;
    targetSalary: number;
    currentSalary?: number;
    achievements?: string[];
    yearsAtCompany?: number;
  }) => api.post<NegotiationScript>('/salary/negotiation-script', data),

  /** 404 when the employer has no roles on ATHENA; there is nothing to measure. */
  companyTransparency: (companyName: string) =>
    api.get<CompanyTransparency>(`/salary/company/${encodeURIComponent(companyName)}/transparency`),
};
