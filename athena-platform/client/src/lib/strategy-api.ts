/**
 * The strategy API: housing, business, tax and investment.
 *
 * The calculators are open routes, so the public pages call them before a
 * visitor has an account. Plans, holdings, net worth, the roadmap, grant
 * and investor matching, formation documents, the earnings statement and
 * anything read from the bank feed are the member's own records and need
 * a session.
 */

import { api } from './api';

export type StrategyArea = 'HOUSING' | 'BUSINESS' | 'TAX' | 'INVESTMENT';

type Body = Record<string, unknown>;
const plan = (area: StrategyArea) => area.toLowerCase();

export const strategyApi = {
  reference: () => api.get('/strategy/reference'),

  getPlans: () => api.get('/strategy/plans'),
  savePlan: (area: StrategyArea, data: { title?: string; inputs: Body; result: Body }) => api.put(`/strategy/plans/${plan(area)}`, data),
  deletePlan: (area: StrategyArea) => api.delete(`/strategy/plans/${plan(area)}`),

  roadmap: () => api.get('/strategy/roadmap'),
  peers: () => api.get('/strategy/peers'),

  housing: {
    rent: (data: Body) => api.post('/strategy/housing/rent', data),
    stampDuty: (data: Body) => api.post('/strategy/housing/stamp-duty', data),
    mortgage: (data: Body) => api.post('/strategy/housing/mortgage', data),
    borrowingPower: (data: Body) => api.post('/strategy/housing/borrowing-power', data),
    deposit: (data: Body) => api.post('/strategy/housing/deposit', data),
    rentVsBuy: (data: Body) => api.post('/strategy/housing/rent-vs-buy', data),
    rentHelp: () => api.get('/strategy/housing/rent-help'),
    rentAssistance: (data: Body) => api.post('/strategy/housing/rent-assistance', data),
    compareLoans: (data: Body) => api.post('/strategy/housing/compare-loans', data),
    investmentProperty: (data: Body) => api.post('/strategy/housing/investment-property', data),
  },

  business: {
    structures: (data: Body) => api.post('/strategy/business/structures', data),
    valuation: (data: Body) => api.post('/strategy/business/valuation', data),
    raise: (data: Body) => api.post('/strategy/business/raise', data),
    runway: (data: Body) => api.post('/strategy/business/runway', data),
    grantMatches: (params: Body) => api.get('/strategy/business/grant-matches', { params }),
    investorMatches: (params: Body) => api.get('/strategy/business/investor-matches', { params }),
    pitchCheck: (data: Body) => api.post('/strategy/business/pitch-check', data),
    deckOutline: (data: Body) => api.post('/strategy/business/deck-outline', data),
    launchPackage: (params: Body) => api.get('/strategy/business/launch-package', { params }),
    acceleratorCertificate: (enrollmentId: string) => api.get(`/strategy/business/accelerator-certificates/${enrollmentId}`),
  },

  formation: {
    documents: (id: string) => api.get(`/formation/${id}/documents`),
    generateDocuments: (id: string) => api.post(`/formation/${id}/documents`),
    document: (id: string, key: string) => api.get(`/formation/${id}/documents/${key}`, { responseType: 'text' }),
  },

  tax: {
    estimate: (data: Body) => api.post('/strategy/tax/estimate', data),
    deductions: (data: Body) => api.post('/strategy/tax/deductions', data),
    superPlan: (data: Body) => api.post('/strategy/tax/super', data),
    setAside: (data: Body) => api.post('/strategy/tax/set-aside', data),
    helpDebt: (data: Body) => api.post('/strategy/tax/help-debt', data),
    bankDeductions: (params?: Body) => api.get('/strategy/tax/bank-deductions', { params }),
    earningsStatement: (params?: Body) => api.get('/strategy/tax/earnings-statement', { params }),
  },

  investing: {
    riskProfile: (data: Body) => api.post('/strategy/investing/risk-profile', data),
    getHoldings: () => api.get('/strategy/investing/holdings'),
    addHolding: (data: Body) => api.post('/strategy/investing/holdings', data),
    updateHolding: (id: string, data: Body) => api.patch(`/strategy/investing/holdings/${id}`, data),
    deleteHolding: (id: string) => api.delete(`/strategy/investing/holdings/${id}`),
    netWorth: (params?: Body) => api.get('/strategy/investing/net-worth', { params }),
    netWorthHistory: () => api.get('/strategy/investing/net-worth-history'),
    holdingsReview: (params?: Body) => api.get('/strategy/investing/holdings-review', { params }),
    projection: (data: Body) => api.post('/strategy/investing/projection', data),
    emergencyFund: (data: Body) => api.post('/strategy/investing/emergency-fund', data),
    debts: (data: Body) => api.post('/strategy/investing/debts', data),
    goalPlan: (data: Body) => api.post('/strategy/investing/goal-plan', data),
    roundUps: (params?: Body) => api.get('/strategy/investing/round-ups', { params }),
    insuranceNeeds: (data: Body) => api.post('/strategy/investing/insurance-needs', data),
    superProjection: (data: Body) => api.post('/strategy/investing/super-projection', data),
  },
};

/** The message an API error carries, or a fallback. */
export function apiMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string; error?: string } } };
  return e?.response?.data?.message || e?.response?.data?.error || fallback;
}
