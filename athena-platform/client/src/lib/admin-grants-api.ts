/**
 * Grant programmes, from the platform's side. This is the grants directory's
 * only write path: staff enter a programme from the funder's published page
 * (the official application link is required for that reason), and nothing
 * is seeded. Application reviews are a separate matter and stay under
 * /admin/grants/applications in api.ts callers.
 */

import { api } from './api';

export type GrantProviderType = 'FEDERAL' | 'STATE' | 'PRIVATE_FOUNDATION' | 'CORPORATE' | 'INTERNATIONAL';

export type GrantProgrammeInput = {
  name: string;
  description: string;
  provider: string;
  providerType: GrantProviderType;
  minFunding?: number | null;
  maxFunding?: number | null;
  industries?: string[];
  stages?: string[];
  regions?: string[];
  tags?: string[];
  requirements?: string | null;
  applicationUrl: string;
  deadline?: string | null;
  isRolling?: boolean;
};

export type GrantProgramme = GrantProgrammeInput & {
  id: string;
  minFunding: string | number | null;
  maxFunding: string | number | null;
  industries: string[];
  stages: string[];
  regions: string[];
  tags: string[];
  requirements: { text?: string } | null;
  applicationUrl: string | null;
  deadline: string | null;
  isRolling: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { applications: number };
};

export const adminGrantsApi = {
  /** Every programme, paused ones included; `active` narrows to one side. */
  list: (params?: { active?: 'true' | 'false' }) => api.get('/admin/grants', { params }),

  create: (data: GrantProgrammeInput) => api.post('/admin/grants', data),

  /** Edit any field, or pause and reactivate with `isActive`. */
  update: (id: string, data: Partial<GrantProgrammeInput> & { isActive?: boolean }) => api.patch(`/admin/grants/${id}`, data),
};
