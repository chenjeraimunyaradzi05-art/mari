/**
 * The strategy API: housing, business, tax and investment.
 *
 * The calculators are open routes, so the public pages call them before a
 * visitor has an account. Plans, holdings, net worth and grant matching are
 * the member's own records and need a session.
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

  housing: {
    rent: (data: Body) => api.post('/strategy/housing/rent', data),
    stampDuty: (data: Body) => api.post('/strategy/housing/stamp-duty', data),
    mortgage: (data: Body) => api.post('/strategy/housing/mortgage', data),
    borrowingPower: (data: Body) => api.post('/strategy/housing/borrowing-power', data),
    deposit: (data: Body) => api.post('/strategy/housing/deposit', data),
    rentVsBuy: (data: Body) => api.post('/strategy/housing/rent-vs-buy', data),
  },

  business: {
    structures: (data: Body) => api.post('/strategy/business/structures', data),
    valuation: (data: Body) => api.post('/strategy/business/valuation', data),
    raise: (data: Body) => api.post('/strategy/business/raise', data),
    runway: (data: Body) => api.post('/strategy/business/runway', data),
    grantMatches: (params: Body) => api.get('/strategy/business/grant-matches', { params }),
  },

  tax: {
    estimate: (data: Body) => api.post('/strategy/tax/estimate', data),
    deductions: (data: Body) => api.post('/strategy/tax/deductions', data),
    superPlan: (data: Body) => api.post('/strategy/tax/super', data),
    setAside: (data: Body) => api.post('/strategy/tax/set-aside', data),
  },

  investing: {
    riskProfile: (data: Body) => api.post('/strategy/investing/risk-profile', data),
    getHoldings: () => api.get('/strategy/investing/holdings'),
    addHolding: (data: Body) => api.post('/strategy/investing/holdings', data),
    updateHolding: (id: string, data: Body) => api.patch(`/strategy/investing/holdings/${id}`, data),
    deleteHolding: (id: string) => api.delete(`/strategy/investing/holdings/${id}`),
    netWorth: (params?: Body) => api.get('/strategy/investing/net-worth', { params }),
    projection: (data: Body) => api.post('/strategy/investing/projection', data),
    emergencyFund: (data: Body) => api.post('/strategy/investing/emergency-fund', data),
  },
};

/** The message an API error carries, or a fallback. */
export function apiMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string; error?: string } } };
  return e?.response?.data?.message || e?.response?.data?.error || fallback;
}
