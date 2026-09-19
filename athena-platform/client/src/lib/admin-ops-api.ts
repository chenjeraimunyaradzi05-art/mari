/**
 * The admin console's view of how the platform is running: the operator
 * summary (maintenance, breach deadlines, legal holds, unfiled referrals),
 * the runtime configuration the server reports about itself, the feature
 * flags, and the recurring revenue Stripe has actually recorded. All of it
 * is ADMIN-only on the server.
 */

import { api } from './api';

export type MaintenanceState = {
  enabled: boolean;
  message: string;
  startedAt: string | null;
  endsAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type OpsSummary = {
  maintenance: MaintenanceState;
  breaches: { awaitingNotification: number; overdue: number; dueWithin24Hours: number; nextDeadlineAt: string | null };
  legalHolds: { active: number };
  authorityEscalations: { awaitingFiling: number };
};

export type RuntimeConfig = {
  build: {
    service: string;
    version: string | null;
    node: string;
    environment: string;
    buildTime: string | null;
    commitSha: string | null;
  };
  maintenance: MaintenanceState;
  rateLimit: { enabled: boolean; windowMs: number; max: number };
  tokens: { accessSeconds: number | null; refreshSeconds: number | null };
  security: { staffTwoFactor: 'required' | 'optional' };
  storage: { backend: 's3' | 'local'; region: string | null; bucketConfigured: boolean; cdnConfigured: boolean };
  integrations: {
    email: boolean;
    stripe: boolean;
    ai: boolean;
    aiSimulationAllowed: boolean;
    redis: boolean;
    openSearch: boolean;
    livestreamIngest: boolean;
    livestreamPlayback: boolean;
    sentry: boolean;
  };
  checkedAt: string;
};

export type RevenueTier = {
  tier: string;
  count: number;
  recorded: number;
  notRecorded: number;
  mrr: number | null;
  currency: string | null;
  mixedCurrencies: boolean;
};

export type RevenueSummary = {
  /** Null until at least one paying subscription carries a recorded amount, or when currencies are mixed. */
  mrr: number | null;
  arr: number | null;
  currency: string | null;
  mixedCurrencies: boolean;
  subscriptions: { paying: number; recorded: number; notRecorded: number };
  byTier: RevenueTier[];
  checkedAt: string;
};

export const adminOpsApi = {
  summary: () => api.get<OpsSummary>('/admin/ops/summary'),
  config: () => api.get<RuntimeConfig>('/admin/ops/config'),
  revenue: () => api.get<RevenueSummary>('/admin/ops/revenue'),
  featureFlags: () => api.get('/feature-flags'),
};
