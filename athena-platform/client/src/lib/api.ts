import axios from 'axios';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './auth';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_BASE_URL = `${API_ORIGIN.replace(/\/$/, '')}/api`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken();
        
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        setTokens(accessToken, newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ============================================
// AUTH API
// ============================================
export const authApi = {
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    persona?: string;
  }) => api.post('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  logout: () => api.post('/auth/logout'),

  me: () => api.get('/auth/me'),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (data: { token: string; password: string }) =>
    api.post('/auth/reset-password', data),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
};

// ============================================
// USER API
// ============================================
export const userApi = {
  getProfile: (id: string) => api.get(`/users/${id}`),

  updateProfile: (data: any) => api.patch('/users/me', data),

  updateDetailedProfile: (data: any) => api.patch('/users/me/profile', data),

  getPreferences: () => api.get('/users/me/preferences'),

  updatePreferences: (data: {
    preferredLocale?: string;
    preferredCurrency?: string;
    timezone?: string;
    region?: 'ANZ' | 'US' | 'SEA' | 'MEA' | 'UK' | 'EU' | 'ROW' | 'JP' | 'KR' | 'IN' | 'BR' | 'MX' | 'LATAM';
  }) => api.patch('/users/me/preferences', data),

  getConsents: () => api.get('/users/me/consents'),

  updateConsents: (data: {
    consentMarketing?: boolean;
    consentDataProcessing?: boolean;
    consentCookies?: boolean;
    consentDoNotSell?: boolean;
  }) => api.patch('/users/me/consents', data),

  getMySkills: () => api.get('/users/me/skills'),

  addSkill: (skillName: string, level?: number) =>
    api.post('/users/me/skills', {
      skillName,
      ...(typeof level === 'number' ? { level } : {}),
    }),

  removeSkill: (skillId: string) => api.delete(`/users/me/skills/${skillId}`),

  addExperience: (data: any) => api.post('/users/me/experience', data),

  addEducation: (data: any) => api.post('/users/me/education', data),

  follow: (userId: string) => api.post(`/users/${userId}/follow`),

  unfollow: (userId: string) => api.delete(`/users/${userId}/follow`),

  getFollowers: (userId: string) => api.get(`/users/${userId}/followers`),

  getFollowing: (userId: string) => api.get(`/users/${userId}/following`),

  // Privacy / DSAR
  exportMyData: () => api.get('/users/me/export'),
  deleteAccount: () => api.delete('/users/me', { data: { confirm: true } }),
};

// ============================================
// JOB API
// ============================================
export const jobApi = {
  search: (params: any) => api.get('/jobs', { params }),

  getById: (id: string) => api.get(`/jobs/${id}`),

  create: (data: any) => api.post('/jobs', data),

  update: (id: string, data: any) => api.patch(`/jobs/${id}`, data),

  publish: (id: string) => api.post(`/jobs/${id}/publish`),

  apply: (id: string, data: any) => api.post(`/jobs/${id}/apply`, data),

  getMyApplications: () => api.get('/jobs/me/applications'),

  getApplications: (jobId: string) => api.get(`/jobs/${jobId}/applications`),

  updateApplication: (jobId: string, applicationId: string, data: any) =>
    api.patch(`/jobs/${jobId}/applications/${applicationId}`, data),

  getRecommendations: () => api.get('/jobs/recommendations/for-me'),

  // Bookmark/Save jobs
  getSavedJobs: () => api.get('/jobs/me/saved'),

  saveJob: (jobId: string) => api.post(`/jobs/${jobId}/save`),

  unsaveJob: (jobId: string) => api.delete(`/jobs/${jobId}/save`),
};

// ============================================
// POST API
// ============================================
export const postApi = {
  getFeed: (params?: any) => api.get('/posts/feed', { params }),

  getById: (id: string) => api.get(`/posts/${id}`),

  create: (data: any) => api.post('/posts', data),

  update: (id: string, data: any) => api.patch(`/posts/${id}`, data),

  delete: (id: string) => api.delete(`/posts/${id}`),

  like: (id: string) => api.post(`/posts/${id}/like`),

  unlike: (id: string) => api.delete(`/posts/${id}/like`),

  comment: (postId: string, content: string) =>
    api.post(`/posts/${postId}/comments`, { content }),

  deleteComment: (postId: string, commentId: string) =>
    api.delete(`/posts/${postId}/comments/${commentId}`),

  getUserPosts: (userId: string) => api.get(`/posts/user/${userId}`),

  shareToFeed: (data: {
    title: string;
    url: string;
    description?: string;
    message?: string;
    entityType?: 'job' | 'course' | 'post' | 'video' | 'resource';
    entityId?: string;
  }) => api.post('/posts/share', data),
};

// ============================================
// ORGANIZATION API
// ============================================
export const organizationApi = {
  getAll: (params?: any) => api.get('/organizations', { params }),

  getBySlug: (slug: string) => api.get(`/organizations/${slug}`),

  create: (data: any) => api.post('/organizations', data),

  update: (id: string, data: any) => api.patch(`/organizations/${id}`, data),

  getJobs: (slug: string) => api.get(`/organizations/${slug}/jobs`),
};

// ============================================
// COURSE API
// ============================================
export const courseApi = {
  getAll: (params?: any) => api.get('/courses', { params }),

  getById: (id: string) => api.get(`/courses/${id}`),

  getBySlug: (slug: string) => api.get(`/courses/${slug}`),

  getMyCourses: () => api.get('/courses/me'),

  enroll: (courseId: string) => api.post(`/courses/${courseId}/enroll`),

  getRecommendations: () => api.get('/courses/recommendations/for-me'),
};

// ============================================
// MENTOR API
// ============================================
export const mentorApi = {
  getAll: (params?: any) => api.get('/mentors', { params }),

  getById: (id: string) => api.get(`/mentors/${id}`),

  become: (data: any) => api.post('/mentors/become', data),

  updateProfile: (data: any) => api.patch('/mentors/me', data),

  bookSession: (data: any) =>
    api.post(`/mentors/${data.mentorId}/book`, data),
};

// ============================================
// SEARCH API
// ============================================
export const searchApi = {
  unified: (params: {
    q: string;
    type?: 'all' | 'users' | 'posts' | 'jobs' | 'courses' | 'videos' | 'mentors';
    page?: number;
    limit?: number;
    sort?: 'relevance' | 'recent' | 'popular';
  }) => api.get('/search', { params }),

  suggestions: (query: string) => api.get('/search/suggestions', { params: { q: query } }),

  trending: () => api.get('/search/trending'),
};

// ============================================
// SAFETY API
// ============================================
export const safetyApi = {
  getReports: () => api.get('/safety/reports'),

  createReport: (data: {
    targetType: 'post' | 'video' | 'user' | 'message' | 'channel' | 'other';
    targetId?: string;
    reason: string;
    details?: string;
  }) => api.post('/safety/reports', data),

  getBlocks: () => api.get('/safety/blocks'),

  blockUser: (data: { blockedUserId: string; reason?: string }) =>
    api.post('/safety/blocks', data),

  unblockUser: (blockedUserId: string) => api.delete(`/safety/blocks/${blockedUserId}`),

  getSettings: () => api.get('/safety/settings'),

  updateSettings: (data: {
    allowMessages?: boolean;
    isSafeMode?: boolean;
    hideFromSearch?: boolean;
  }) => api.patch('/safety/settings', data),
};

// ============================================
// SUBSCRIPTION API
// ============================================
export const subscriptionApi = {
  getCurrent: () => api.get('/subscriptions/me'),

  createCheckout: (tier: string) =>
    api.post('/subscriptions/checkout', { tier }),

  createPortal: () => api.post('/subscriptions/portal'),

  cancel: () => api.post('/subscriptions/cancel'),
};

// ============================================
// EDUCATION API (Week 10)
// ============================================
export const educationApi = {
  listProviders: (params?: any) => api.get('/education/providers', { params }),

  getProviderBySlug: (slug: string) => api.get(`/education/providers/${slug}`),

  getMyApplications: () => api.get('/education/applications/me'),

  createApplication: (data: {
    organizationId: string;
    courseId?: string | null;
    programName?: string | null;
    intakeDate?: string | null;
    notes?: string | null;
  }) => api.post('/education/applications', data),

  updateApplication: (id: string, data: { status?: string; notes?: string }) =>
    api.patch(`/education/applications/${id}`, data),

  // Provider-side (org member)
  getProviderApplications: (organizationId: string, params?: any) =>
    api.get(`/education/providers/${organizationId}/applications`, { params }),

  getProviderOutcomes: (organizationId: string) =>
    api.get(`/education/providers/${organizationId}/outcomes`),
};

// ============================================
// FORMATION API
// ============================================
export const formationApi = {
  list: () => api.get('/formation'),

  create: (data: { type: string; businessName: string }) => api.post('/formation', data),

  getById: (id: string) => api.get(`/formation/${id}`),

  update: (id: string, data: Record<string, unknown>) => api.patch(`/formation/${id}`, data),

  submit: (id: string) => api.post(`/formation/${id}/submit`),
};

// ============================================
// AI API
// ============================================
export const aiApi = {
  opportunityRadar: () => api.get('/ai/opportunity-radar'),

  scanOpportunities: (data: any) => api.post('/ai/opportunity-radar', data),

  resumeOptimizer: (data: { resumeText: string; targetJobId?: string }) =>
    api.post('/ai/resume-optimizer', data),

  interviewCoach: (data: { jobId: string; questionType?: string }) =>
    api.post('/ai/interview-coach', data),

  careerPath: () => api.get('/ai/career-path'),

  generateCareerPath: (data: any) => api.post('/ai/career-path', data),

  contentGenerator: (data: any) => api.post('/ai/content-generator', data),

  ideaValidator: (data: any) => api.post('/ai/idea-validator', data),

  chat: (message: string, context?: any[]) =>
    api.post('/ai/chat', { message, context }),
};

// ============================================
// MEDIA API
// ============================================
export const mediaApi = {
  getPresignedUrl: (data: {
    fileType: string;
    fileName: string;
    contentType: string;
  }) => api.post('/media/presigned-url', data),

  upload: (type: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/media/upload/${type}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  uploadResume: (file: File) => {
    const formData = new FormData();
    formData.append('resume', file);
    return api.post('/media/resume', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  uploadPostImages: (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return api.post('/media/post-images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  delete: (key: string) => api.delete('/media/delete', { data: { key } }),
};

// ============================================
// EVENTS API
// ============================================
export const eventsApi = {
  list: (params?: { type?: string; q?: string }) => api.get('/events', { params }),
  getById: (id: string) => api.get(`/events/${id}`),
  register: (id: string) => api.post(`/events/${id}/register`),
  unregister: (id: string) => api.delete(`/events/${id}/register`),
  save: (id: string) => api.post(`/events/${id}/save`),
  unsave: (id: string) => api.delete(`/events/${id}/save`),
};

// ============================================
// GROUPS API
// ============================================
export const groupsApi = {
  list: (params?: { q?: string }) => api.get('/groups', { params }),
  getById: (id: string) => api.get(`/groups/${id}`),
  create: (data: { name: string; description: string; privacy?: 'public' | 'private' }) =>
    api.post('/groups', data),
  join: (id: string) => api.post(`/groups/${id}/join`),
  getMyJoinRequest: (id: string) => api.get(`/groups/${id}/join-request`),
  cancelMyJoinRequest: (id: string) => api.delete(`/groups/${id}/join-request`),
  leave: (id: string) => api.post(`/groups/${id}/leave`),
  listPosts: (id: string) => api.get(`/groups/${id}/posts`),
  createPost: (id: string, content: string) => api.post(`/groups/${id}/posts`, { content }),
};

// ============================================
// STATUS / STORIES API
// ============================================
export const statusApi = {
  feed: () => api.get('/status/feed'),
  create: (data: { type: 'image' | 'video'; mediaUrl: string }) => api.post('/status', data),
  delete: (id: string) => api.delete(`/status/${id}`),
};

// ============================================
// NOTIFICATION API
// ============================================
export const notificationApi = {
  getAll: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    api.get('/notifications', { params }),

  markRead: (id: string) => api.patch(`/notifications/${id}/read`),

  markAllRead: () => api.patch('/notifications/read-all'),

  delete: (id: string) => api.delete(`/notifications/${id}`),

  clearRead: () => api.delete('/notifications/clear-read'),

  getPreferences: () => api.get('/notifications/preferences'),

  updatePreferences: (preferences: any) =>
    api.patch('/notifications/preferences', { preferences }),
};

// ============================================
// REFERRAL API
// ============================================
export const referralApi = {
  getMyReferrals: () => api.get('/referrals/me'),

  validateCode: (code: string) => api.get(`/referrals/validate/${code}`),

  trackReferral: (data: { referralCode: string; newUserId: string; source?: string }) =>
    api.post('/referrals/track', data),

  completeReferral: (referralId: string) => api.post(`/referrals/${referralId}/complete`),

  getLeaderboard: () => api.get('/referrals/leaderboard'),

  getShareLinks: () => api.get('/referrals/share-links'),
};

// ============================================
// MESSAGE API
// ============================================
export const messageApi = {
  getConversations: () => api.get('/messages/conversations'),

  getMessages: (userId: string, params?: { page?: number; limit?: number }) =>
    api.get(`/messages/with/${userId}`, { params }),

  send: (receiverId: string, content: string) =>
    api.post('/messages/send', { receiverId, content }),

  delete: (id: string) => api.delete(`/messages/${id}`),

  getUnreadCount: () => api.get('/messages/unread-count'),

  search: (query: string) => api.get('/messages/search', { params: { q: query } }),
};

// ============================================
// EMPLOYER API
// ============================================
export const employerApi = {
  // Organizations
  getMyOrganizations: () => api.get('/employer/organizations'),

  createOrganization: (data: {
    name: string;
    type?: string;
    description?: string;
    website?: string;
    industry?: string;
    size?: string;
    location?: string;
    brandColor?: string;
  }) => api.post('/employer/organizations', data),

  getOrganizationDashboard: (orgId: string) =>
    api.get(`/employer/organizations/${orgId}/dashboard`),

  // Jobs
  getOrganizationJobs: (orgId: string, params?: { status?: string }) =>
    api.get(`/employer/organizations/${orgId}/jobs`, { params }),

  createJob: (orgId: string, data: any) =>
    api.post(`/employer/organizations/${orgId}/jobs`, data),

  updateJob: (jobId: string, data: any) => api.patch(`/employer/jobs/${jobId}`, data),

  // Applications
  getOrganizationApplications: (orgId: string, params?: { status?: string; page?: number; limit?: number }) =>
    api.get(`/employer/organizations/${orgId}/applications`, { params }),

  updateApplicationStatus: (applicationId: string, status: string) =>
    api.patch(`/employer/applications/${applicationId}/status`, { status }),

  // Team
  getOrganizationTeam: (orgId: string) => api.get(`/employer/organizations/${orgId}/team`),

  inviteTeamMember: (orgId: string, data: { email: string; role: string }) =>
    api.post(`/employer/organizations/${orgId}/team/invite`, data),

  removeTeamMember: (orgId: string, memberId: string) =>
    api.delete(`/employer/organizations/${orgId}/team/${memberId}`),

  // Analytics
  getOrganizationAnalytics: (orgId: string) =>
    api.get(`/employer/organizations/${orgId}/analytics`),
};

// ============================================
// BUSINESS API (Phase 9: Business Transformation)
// ============================================
export const businessApi = {
  // Accelerators
  getAccelerators: (params?: { status?: string; upcoming?: boolean }) =>
    api.get('/business/accelerators', { params }),

  getAccelerator: (id: string) => api.get(`/business/accelerators/${id}`),

  enrollInAccelerator: (id: string) => api.post(`/business/accelerators/${id}/enroll`),

  getMyAcceleratorEnrollments: () => api.get('/business/accelerators/my/enrollments'),

  // Grants
  getGrants: (params?: { providerType?: string; industry?: string; region?: string; active?: boolean }) =>
    api.get('/business/grants', { params }),

  getGrant: (id: string) => api.get(`/business/grants/${id}`),

  applyForGrant: (id: string, data?: { applicationData?: any }) =>
    api.post(`/business/grants/${id}/apply`, data),

  getMyGrantApplications: () => api.get('/business/grants/my/applications'),

  updateGrantApplication: (id: string, data: { applicationData?: any; status?: string }) =>
    api.patch(`/business/grants/applications/${id}`, data),

  // Investors
  getInvestors: (params?: { type?: string; industry?: string; stage?: string; region?: string }) =>
    api.get('/business/investors', { params }),

  getInvestor: (id: string) => api.get(`/business/investors/${id}`),

  requestInvestorIntro: (id: string, data?: { message?: string }) =>
    api.post(`/business/investors/${id}/request-intro`, data),

  getMyInvestorIntroductions: () => api.get('/business/investors/my/introductions'),

  // Vendors
  getVendors: (params?: { category?: string; partner?: boolean; verified?: boolean; minRating?: number }) =>
    api.get('/business/vendors', { params }),

  getVendor: (id: string) => api.get(`/business/vendors/${id}`),

  reviewVendor: (id: string, data: { rating: number; title?: string; content?: string; projectType?: string }) =>
    api.post(`/business/vendors/${id}/reviews`, data),

  // RFPs
  getRfps: (params?: { category?: string; status?: string }) =>
    api.get('/business/rfps', { params }),

  createRfp: (data: {
    title: string;
    description: string;
    category: string;
    budget?: string;
    deadline?: string;
    requirements?: any;
  }) => api.post('/business/rfps', data),

  getMyRfps: () => api.get('/business/rfps/my'),

  getRfp: (id: string) => api.get(`/business/rfps/${id}`),

  updateRfpStatus: (id: string, status: string) => api.patch(`/business/rfps/${id}`, { status }),
};

// ============================================
// HOUSING API (Phase 10: Housing & Financial Security)
// ============================================
export const housingApi = {
  // Listings
  getListings: (params?: {
    type?: string;
    city?: string;
    state?: string;
    minRent?: number;
    maxRent?: number;
    bedrooms?: number;
    dvSafe?: boolean;
    petFriendly?: boolean;
    accessible?: boolean;
    page?: number;
    limit?: number;
  }) => api.get('/housing/listings', { params }),

  getListing: (id: string) => api.get(`/housing/listings/${id}`),

  createListing: (data: {
    title: string;
    description: string;
    type: string;
    address?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
    rentWeekly?: number;
    bondAmount?: number;
    bedrooms?: number;
    bathrooms?: number;
    parking?: number;
    features?: string[];
    safetyVerified?: boolean;
    dvSafe?: boolean;
    petFriendly?: boolean;
    accessibleUnit?: boolean;
    availableFrom?: string;
    minLeaseTerm?: number;
    flexibleLease?: boolean;
    images?: any;
  }) => api.post('/housing/listings', data),

  // Inquiries
  inquireAboutListing: (id: string, data?: { message?: string }) =>
    api.post(`/housing/listings/${id}/inquire`, data),

  getMyInquiries: () => api.get('/housing/my/inquiries'),

  updateInquiry: (id: string, data: { status?: string; viewingDate?: string; notes?: string }) =>
    api.patch(`/housing/inquiries/${id}`, data),
};

// ============================================
// FINANCE API (Phase 10: Financial Wellness)
// ============================================
export const financeApi = {
  // Savings Goals
  getSavingsGoals: () => api.get('/finance/savings-goals'),

  createSavingsGoal: (data: {
    name: string;
    type: string;
    targetAmount: number;
    targetDate?: string;
    monthlyTarget?: number;
    autoSaveEnabled?: boolean;
    autoSaveAmount?: number;
  }) => api.post('/finance/savings-goals', data),

  contributeTo: (goalId: string, data: { amount: number; source?: string; note?: string }) =>
    api.post(`/finance/savings-goals/${goalId}/contribute`, data),

  updateSavingsGoal: (id: string, data: {
    name?: string;
    targetAmount?: number;
    targetDate?: string;
    monthlyTarget?: number;
    autoSaveEnabled?: boolean;
    autoSaveAmount?: number;
    status?: string;
  }) => api.patch(`/finance/savings-goals/${id}`, data),

  // Insurance
  getInsuranceProducts: (params?: { type?: string }) =>
    api.get('/finance/insurance', { params }),

  getInsuranceProduct: (id: string) => api.get(`/finance/insurance/${id}`),

  applyForInsurance: (productId: string, data?: { applicationData?: any }) =>
    api.post(`/finance/insurance/${productId}/apply`, data),

  getMyInsuranceApplications: () => api.get('/finance/insurance/my/applications'),

  // Superannuation
  getSuperAccounts: () => api.get('/finance/super'),

  addSuperAccount: (data: {
    fundName: string;
    memberNumber?: string;
    balance?: number;
    investmentOpt?: string;
    insuranceInc?: boolean;
  }) => api.post('/finance/super', data),

  updateSuperAccount: (id: string, data: {
    balance?: number;
    employerContr?: number;
    personalContr?: number;
    investmentOpt?: string;
    insuranceInc?: boolean;
  }) => api.patch(`/finance/super/${id}`, data),

  // Financial Health Score
  getHealthScore: () => api.get('/finance/health-score'),

  recalculateHealthScore: () => api.post('/finance/health-score/recalculate'),
};

// ===========================================
// PHASE 11: SOCIAL IMPACT & SCALE
// ===========================================

export const impactApi = {
  // Impact Metrics
  getMyMetrics: () => api.get('/impact/metrics'),

  recordMetric: (data: {
    metricType: string;
    value?: number;
    description?: string;
    evidenceUrl?: string;
    communityType?: string;
    programId?: string;
  }) => api.post('/impact/metrics', data),

  getImpactSummary: () => api.get('/impact/summary'),

  // Impact Reports (public)
  getReports: (params?: { communityType?: string; region?: string; period?: string }) =>
    api.get('/impact/reports', { params }),

  getReport: (id: string) => api.get(`/impact/reports/${id}`),

  // Impact Partners
  getPartners: (params?: { region?: string; type?: string; focusArea?: string }) =>
    api.get('/impact/partners', { params }),

  getPartner: (id: string) => api.get(`/impact/partners/${id}`),

  // DV Support Services
  getDVServices: (params?: { state?: string; type?: string; national?: boolean }) =>
    api.get('/impact/dv-services', { params }),

  // Safety Plan (private)
  getSafetyPlan: () => api.get('/impact/safety-plan'),

  saveSafetyPlan: (data: {
    emergencyContacts?: unknown;
    safeLocations?: unknown;
    warningTriggers?: unknown;
    exitStrategies?: unknown;
    importantDocs?: unknown;
    financialPlan?: unknown;
    legalContacts?: unknown;
  }) => api.post('/impact/safety-plan', data),

  // Accessibility Profile
  getAccessibilityProfile: () => api.get('/impact/accessibility'),

  saveAccessibilityProfile: (data: {
    hasVisionImpairment?: boolean;
    hasHearingImpairment?: boolean;
    hasMobilityImpairment?: boolean;
    hasCognitiveDisability?: boolean;
    usesScreenReader?: boolean;
    usesVoiceControl?: boolean;
    preferredFontSize?: string;
    highContrastMode?: boolean;
    reducedMotion?: boolean;
    captionsRequired?: boolean;
    otherNeeds?: string;
    workAccommodations?: string[];
  }) => api.post('/impact/accessibility', data),

  // Disability-Friendly Employers
  getDisabilityFriendlyEmployers: (params?: {
    hasRemote?: boolean;
    hasFlexible?: boolean;
    minRating?: number;
  }) => api.get('/impact/disability-friendly-employers', { params }),
};

export const communitySupportApi = {
  // Support Programs
  getPrograms: (params?: { communityType?: string; region?: string; active?: boolean }) =>
    api.get('/community-support/programs', { params }),

  getProgram: (id: string) => api.get(`/community-support/programs/${id}`),

  enrollInProgram: (id: string, data?: { goalsSet?: unknown }) =>
    api.post(`/community-support/programs/${id}/enroll`, data),

  getMyEnrollments: () => api.get('/community-support/my/enrollments'),

  updateMilestoneProgress: (enrollmentId: string, data: {
    milestoneId: string;
    isCompleted?: boolean;
    evidence?: string;
  }) => api.patch(`/community-support/enrollments/${enrollmentId}/milestone`, data),

  // Indigenous Communities
  getIndigenousCommunities: (params?: { region?: string; womenOnly?: boolean; verified?: boolean }) =>
    api.get('/community-support/indigenous/communities', { params }),

  getIndigenousCommunity: (id: string) => api.get(`/community-support/indigenous/communities/${id}`),

  joinIndigenousCommunity: (id: string) => api.post(`/community-support/indigenous/communities/${id}/join`),

  getIndigenousResources: (params?: { type?: string; national?: boolean }) =>
    api.get('/community-support/indigenous/resources', { params }),

  // Language Profile
  getLanguageProfile: () => api.get('/community-support/language-profile'),

  saveLanguageProfile: (data: {
    primaryLanguage: string;
    primaryProficiency?: string;
    englishProficiency?: string;
    otherLanguages?: unknown;
    needsInterpreter?: boolean;
    preferredInterpreterLang?: string;
  }) => api.post('/community-support/language-profile', data),

  // International Credentials
  getCredentials: () => api.get('/community-support/credentials'),

  addCredential: (data: {
    originalCountry: string;
    credentialType: string;
    credentialName: string;
    institution: string;
    yearObtained?: number;
    fieldOfStudy?: string;
    documentUrl?: string;
  }) => api.post('/community-support/credentials', data),

  // Bridging Programs
  getBridgingPrograms: (params?: { profession?: string; region?: string; fundingAvailable?: boolean }) =>
    api.get('/community-support/bridging-programs', { params }),

  enrollInBridgingProgram: (id: string, data?: { credentialId?: string }) =>
    api.post(`/community-support/bridging-programs/${id}/enroll`, data),

  getMyBridgingEnrollments: () => api.get('/community-support/my/bridging-enrollments'),
};

// ============================================
// AI ALGORITHMS API (Phase 12)
// ============================================
export const aiAlgorithmsApi = {
  // CareerCompass - Career Trajectory Prediction
  getCareerPrediction: () => api.get('/ai/career-compass'),
  generateCareerPrediction: () => api.post('/ai/career-compass/generate'),

  // OpportunityScan - Opportunity Matching
  getOpportunities: (params?: { type?: string; viewed?: boolean }) =>
    api.get('/ai/opportunity-scan', { params }),
  markOpportunityViewed: (id: string) => api.patch(`/ai/opportunity-scan/${id}/view`),
  submitOpportunityFeedback: (id: string, data: { isInterested?: boolean; feedback?: string }) =>
    api.patch(`/ai/opportunity-scan/${id}/feedback`, data),

  // SalaryEquity - Pay Gap Analysis
  submitSalaryData: (data: {
    jobTitle: string;
    company?: string;
    companySize?: string;
    industry?: string;
    city?: string;
    state?: string;
    country?: string;
    isRemote?: boolean;
    baseSalary: number;
    currency?: string;
    bonus?: number;
    equity?: number;
    yearsExperience?: number;
    yearsInRole?: number;
    educationLevel?: string;
    gender?: string;
    ageRange?: string;
  }) => api.post('/ai/salary-equity/submit', data),
  analyzeSalary: (params: { role: string; location?: string; company?: string }) =>
    api.get('/ai/salary-equity/analyze', { params }),
  getMySalaryAnalyses: () => api.get('/ai/salary-equity/my-analyses'),

  // MentorMatch - AI Mentor Pairing
  getMentorMatches: (params?: { skill?: string; industry?: string; minScore?: number }) =>
    api.get('/ai/mentor-match', { params }),
  getMentorMatchDetails: (mentorId: string) => api.get(`/ai/mentor-match/${mentorId}`),

  // SafetyScore - Trust & Verification
  getMyTrustScore: () => api.get('/ai/trust-score'),
  getUserTrustScore: (userId: string) => api.get(`/ai/trust-score/${userId}`),
  reportContent: (data: {
    contentType: string;
    contentId: string;
    reportedUserId: string;
    reason: string;
    description?: string;
  }) => api.post('/ai/report', data),

  // IncomeStream - Creator Analytics
  getCreatorAnalytics: () => api.get('/ai/creator-analytics'),
  getIncomeProjections: () => api.get('/ai/creator-analytics/projections'),

  // Feed Preferences - OpportunityVerse
  getFeedPreferences: () => api.get('/ai/feed-preferences'),
  updateFeedPreferences: (data: {
    followedCategories?: string[];
    followedHashtags?: string[];
    blockedHashtags?: string[];
    blockedCreators?: string[];
    inNetworkRatio?: number;
    outNetworkRatio?: number;
    trendingRatio?: number;
    preferredDuration?: string;
    autoplayEnabled?: boolean;
  }) => api.patch('/ai/feed-preferences', data),
  recordSearch: (query: string) => api.post('/ai/feed-preferences/search', { query }),
};

export default api;
