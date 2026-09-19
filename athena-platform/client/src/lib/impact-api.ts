/**
 * Impact catalogues and the credential pathway.
 *
 * Member side: the reference table of Australian assessing authorities, the
 * pathway for a credential (body, matching bridging programs, English
 * support) and recording what the assessing body decided.
 *
 * Admin side: the catalogues the impact dashboards read from (community
 * support programs and milestones, bridging programs, DV support services,
 * impact partners, First Nations pages and resources) and the credentials
 * queue. Every call is a literal path so the API-contract check can see it.
 */

import { api } from './api';

export type CredentialOutcome = {
  status?: 'PENDING_REVIEW' | 'RECOGNIZED' | 'PARTIALLY_RECOGNIZED' | 'BRIDGING_REQUIRED' | 'NOT_RECOGNIZED';
  australianEquiv?: string | null;
  bridgingRequired?: string | null;
  assessmentBody?: string | null;
  assessmentDate?: string | null;
  notes?: string | null;
};

export const credentialPathwayApi = {
  /** The public table: who assesses what, with links. */
  assessingBodies: () => api.get('/community-support/assessing-bodies'),

  /** The pathway for one of her credentials, or for the words she is typing. */
  pathway: (params?: { credentialId?: string; fieldOfStudy?: string; credentialName?: string }) =>
    api.get('/community-support/credentials/pathway', { params }),

  /** She records what the assessing body wrote to her. */
  recordOutcome: (id: string, data: CredentialOutcome) => api.patch(`/community-support/credentials/${id}`, data),
};

type Body = Record<string, unknown>;

export const adminImpactApi = {
  programs: {
    list: () => api.get('/admin/impact/programs'),
    create: (data: Body) => api.post('/admin/impact/programs', data),
    update: (id: string, data: Body) => api.patch(`/admin/impact/programs/${id}`, data),
    retire: (id: string) => api.delete(`/admin/impact/programs/${id}`),
  },
  milestones: {
    create: (programId: string, data: Body) => api.post(`/admin/impact/programs/${programId}/milestones`, data),
    update: (id: string, data: Body) => api.patch(`/admin/impact/milestones/${id}`, data),
    remove: (id: string) => api.delete(`/admin/impact/milestones/${id}`),
  },
  bridging: {
    list: () => api.get('/admin/impact/bridging-programs'),
    create: (data: Body) => api.post('/admin/impact/bridging-programs', data),
    update: (id: string, data: Body) => api.patch(`/admin/impact/bridging-programs/${id}`, data),
    retire: (id: string) => api.delete(`/admin/impact/bridging-programs/${id}`),
  },
  dvServices: {
    list: () => api.get('/admin/impact/dv-services'),
    create: (data: Body) => api.post('/admin/impact/dv-services', data),
    update: (id: string, data: Body) => api.patch(`/admin/impact/dv-services/${id}`, data),
    remove: (id: string) => api.delete(`/admin/impact/dv-services/${id}`),
  },
  partners: {
    list: () => api.get('/admin/impact/partners'),
    create: (data: Body) => api.post('/admin/impact/partners', data),
    update: (id: string, data: Body) => api.patch(`/admin/impact/partners/${id}`, data),
    retire: (id: string) => api.delete(`/admin/impact/partners/${id}`),
  },
  communities: {
    list: () => api.get('/admin/impact/indigenous/communities'),
    create: (data: Body) => api.post('/admin/impact/indigenous/communities', data),
    update: (id: string, data: Body) => api.patch(`/admin/impact/indigenous/communities/${id}`, data),
    remove: (id: string) => api.delete(`/admin/impact/indigenous/communities/${id}`),
  },
  resources: {
    list: () => api.get('/admin/impact/indigenous/resources'),
    create: (data: Body) => api.post('/admin/impact/indigenous/resources', data),
    update: (id: string, data: Body) => api.patch(`/admin/impact/indigenous/resources/${id}`, data),
    remove: (id: string) => api.delete(`/admin/impact/indigenous/resources/${id}`),
  },
  credentials: {
    list: (status?: string) => api.get('/admin/credentials', { params: status ? { status } : {} }),
    decide: (id: string, data: CredentialOutcome & { status: NonNullable<CredentialOutcome['status']> }) =>
      api.patch(`/admin/credentials/${id}`, data),
  },
};
