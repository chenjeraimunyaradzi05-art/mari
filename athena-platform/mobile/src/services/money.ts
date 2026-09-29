/**
 * The money side of the app: the strategy plans (housing, business, tax,
 * investing) and their calculators, savings goals, super, the financial
 * health score, and business registrations.
 *
 * Paths and bodies are server/src/routes/strategy.routes.ts,
 * finance.routes.ts and formation.routes.ts, and
 * server/scripts/check-api-contract.js walks this file, which is why every
 * calculator is a literal call below rather than a path assembled at run
 * time: a path built from a variable is a path the check cannot see.
 *
 * Nothing here moves money. A savings contribution is a record of money she
 * moved herself, and a registration's fee is paid on the web.
 */
import { api } from './api';

export type StrategyArea = 'HOUSING' | 'BUSINESS' | 'TAX' | 'INVESTMENT';

type Body = Record<string, unknown>;

export const strategyApi = {
  reference: () => api.get('/strategy/reference'),
  plans: () => api.get('/strategy/plans'),

  housing: {
    rent: (body: Body) => api.post('/strategy/housing/rent', body),
    stampDuty: (body: Body) => api.post('/strategy/housing/stamp-duty', body),
    mortgage: (body: Body) => api.post('/strategy/housing/mortgage', body),
    borrowingPower: (body: Body) => api.post('/strategy/housing/borrowing-power', body),
    deposit: (body: Body) => api.post('/strategy/housing/deposit', body),
    rentVsBuy: (body: Body) => api.post('/strategy/housing/rent-vs-buy', body),
  },
  business: {
    structures: (body: Body) => api.post('/strategy/business/structures', body),
    valuation: (body: Body) => api.post('/strategy/business/valuation', body),
    raise: (body: Body) => api.post('/strategy/business/raise', body),
    runway: (body: Body) => api.post('/strategy/business/runway', body),
  },
  tax: {
    estimate: (body: Body) => api.post('/strategy/tax/estimate', body),
    deductions: (body: Body) => api.post('/strategy/tax/deductions', body),
    superPlan: (body: Body) => api.post('/strategy/tax/super', body),
    setAside: (body: Body) => api.post('/strategy/tax/set-aside', body),
  },
  investing: {
    riskProfile: (body: Body) => api.post('/strategy/investing/risk-profile', body),
    emergencyFund: (body: Body) => api.post('/strategy/investing/emergency-fund', body),
    projection: (body: Body) => api.post('/strategy/investing/projection', body),
  },
};

/** A plan saved from the web, one per area. */
export interface SavedPlan {
  id: string;
  area: StrategyArea;
  title: string | null;
  inputs: Record<string, unknown>;
  result: Record<string, unknown>;
  updatedAt: string;
}

export interface RiskQuestion {
  id: string;
  text: string;
  options: Array<{ score: number; label: string }>;
}

export interface StrategyReference {
  asAt: string;
  investing: { questions: RiskQuestion[] };
}

// ------------------------------------------------------------------ finance

export type GoalType = 'EMERGENCY_FUND' | 'HOME_DEPOSIT' | 'EDUCATION' | 'BUSINESS' | 'TRAVEL' | 'OTHER';
export type GoalStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export const GOAL_TYPES: ReadonlyArray<{ value: GoalType; label: string }> = [
  { value: 'EMERGENCY_FUND', label: 'Safety net' },
  { value: 'HOME_DEPOSIT', label: 'Home deposit' },
  { value: 'EDUCATION', label: 'Study' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'OTHER', label: 'Something else' },
];

/**
 * A savings goal as GET /finance/savings-goals returns it. The amounts are
 * Decimal columns and arrive as strings; read them with toNumber.
 */
export interface SavingsGoal {
  id: string;
  name: string;
  type: GoalType;
  status: GoalStatus;
  targetAmount: string | number;
  currentAmount: string | number;
  targetDate: string | null;
  monthlyTarget: string | number | null;
  progressPct: number;
  contributions: Array<{ id: string; amount: string | number; note: string | null; source: string | null; createdAt: string }>;
}

export interface SuperAccount {
  id: string;
  fundName: string;
  balance: string | number;
  investmentOpt: string | null;
  insuranceInc: boolean;
}

export interface HealthScore {
  overallScore: number;
  emergencyFundScore: number;
  superScore: number;
  insuranceScore: number;
  savingsRateScore: number;
  recommendations: { items?: string[]; measures?: Record<string, string> } | null;
}

export const financeApi = {
  goals: () => api.get('/finance/savings-goals'),
  createGoal: (data: { name: string; type: GoalType; targetAmount: number; targetDate?: string; monthlyTarget?: number }) =>
    api.post('/finance/savings-goals', data),
  // A record of money she put aside herself. ATHENA moves no money.
  contribute: (goalId: string, data: { amount: number; note?: string }) => api.post(`/finance/savings-goals/${goalId}/contribute`, data),
  updateGoal: (goalId: string, data: { name?: string; targetAmount?: number; targetDate?: string; monthlyTarget?: number | null; status?: GoalStatus }) =>
    api.patch(`/finance/savings-goals/${goalId}`, data),
  superAccounts: () => api.get('/finance/super'),
  healthScore: () => api.get('/finance/health-score'),
};

// ---------------------------------------------------------------- formation

export interface Registration {
  id: string;
  type: 'SOLE_TRADER' | 'PARTNERSHIP' | 'COMPANY' | 'TRUST';
  status: string;
  businessName: string | null;
  abn: string | null;
  acn: string | null;
  data: Record<string, unknown> | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationDocuments {
  generatedAt: string | null;
  items: Array<{ key: string; title: string; purpose: string }>;
  available: Array<{ key: string; title: string; purpose: string }>;
}

/**
 * The body of GET /formation or GET /formation/:id.
 *
 * Those two answer the rows themselves rather than `{ success, data }`, and a
 * registration has a `data` column of its own (the details, and what a
 * reviewer wrote). unwrapApiData reads `payload.data` first, so it handed back
 * that column in place of the registration: no status, no name, no id. This
 * reads the envelope only when there is one.
 */
export function formationBody<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'success' in payload && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export const formationApi = {
  // These two answer the registration itself, not { success, data }; read
  // them with formationBody.
  list: () => api.get('/formation'),
  get: (id: string) => api.get(`/formation/${id}`),
  documents: (id: string) => api.get(`/formation/${id}/documents`),
  // Markdown, as text.
  document: (id: string, key: string) => api.get(`/formation/${id}/documents/${key}`, { responseType: 'text', transformResponse: (body: unknown) => body }),
  // Sends a registration a reviewer asked about back for review. Not a
  // re-submission: the fee is already paid.
  provideInfo: (id: string) => api.post(`/formation/${id}/provide-info`),
};

export const BUSINESS_TYPE_WORDS: Record<Registration['type'], string> = {
  SOLE_TRADER: 'Sole trader',
  PARTNERSHIP: 'Partnership',
  COMPANY: 'Company',
  TRUST: 'Trust',
};

/**
 * What each status means for her, in the order it happens. The same words the
 * web's registration page uses, so the phone and the web never disagree about
 * where a paid registration is up to.
 */
export const REGISTRATION_STEPS: Record<string, { heading: string; body: string }> = {
  DRAFT: { heading: 'Not sent yet', body: 'The details and the fee are done on the web. Nothing happens to your registration until it is paid.' },
  PAYMENT_PENDING: { heading: 'Waiting on the fee', body: 'Your details are in. The registration goes into the review queue the moment the card is authorised.' },
  PAYMENT_COMPLETE: { heading: 'Fee received', body: 'We have your payment and your registration is moving into the review queue.' },
  SUBMITTED: { heading: 'In the queue', body: 'A person at ATHENA has been notified and will pick this up for review. You will hear from us here and by email when they do.' },
  UNDER_REVIEW: { heading: 'Being reviewed', body: 'Someone is going through your details now. If anything is missing we will ask you rather than guess.' },
  ADDITIONAL_INFO_REQUIRED: { heading: 'We need something from you', body: 'Update your details on the web with what was asked for, then send it back. Your fee stands; there is nothing more to pay.' },
  APPROVED: { heading: 'Approved', body: 'Your registration has been approved and its ABN or ACN is recorded. The certificate follows when it comes through.' },
  REJECTED: { heading: 'Not approved', body: 'This registration was refused and the fee has been refunded to the card you paid with. Refunds usually land within five to ten business days.' },
  COMPLETED: { heading: 'Done', body: 'Your business is registered and the certificate is on file.' },
};

/** A status the steps above do not name reads as itself rather than as nothing. */
export function registrationStep(status: string): { heading: string; body: string } {
  return REGISTRATION_STEPS[status] ?? { heading: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' '), body: 'The full detail is on the web.' };
}
