import axios from 'axios';
import { clearTokens, getAccessToken, setTokens } from './auth';
import { refreshSession } from './session-refresh';

// Direct backend origin — used for WebSocket connections and SSR calls
export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');

// REST API base URL — use relative path so requests go through the proxy
// (Netlify redirects in prod, Next.js rewrites in dev) avoiding CORS issues.
const API_BASE_URL = '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

const authPathsToSkipRefresh = [
  '/auth/login',
  '/auth/register',
  '/auth/google',
  '/auth/facebook',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
];

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
    const requestUrl = String(originalRequest?.url || '');
    const shouldSkipRefresh = authPathsToSkipRefresh.some((path) => requestUrl.includes(path));

    // If 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !shouldSkipRefresh) {
      originalRequest._retry = true;

      try {
        // Refresh through the shared single-flight call: several requests
        // failing together must not each rotate the cookie, because the
        // server revokes every session when a rotated token is replayed.
        const { accessToken } = await refreshSession();
        if (!accessToken) {
          throw new Error('Session refresh returned no access token');
        }

        setTokens(accessToken, null);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        clearTokens();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
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
    username?: string;
    persona?: string;
    womanSelfAttested: boolean;
    inviteCode?: string;
    referralCode?: string;
  }) => api.post('/auth/register', data),

  google: (data: {
    credential: string;
    mode?: 'login' | 'register';
    persona?: string;
    womanSelfAttested?: boolean;
    inviteCode?: string;
  }) => api.post('/auth/google', data),

  facebook: (data: {
    accessToken: string;
    mode?: 'login' | 'register';
    persona?: string;
    womanSelfAttested?: boolean;
    inviteCode?: string;
  }) => api.post('/auth/facebook', data),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  logout: () => api.post('/auth/logout'),

  me: () => api.get('/auth/me'),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (data: { token: string; password: string }) =>
    api.post('/auth/reset-password', data),

  refresh: () => api.post('/auth/refresh'),
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
  // Members who approve their followers: what is waiting, and the answer.
  followRequests: () => api.get('/users/me/follow-requests'),
  followRequestCount: () => api.get('/users/me/follow-requests/count'),
  acceptFollowRequest: (id: string) => api.post(`/users/me/follow-requests/${id}/accept`),
  declineFollowRequest: (id: string) => api.post(`/users/me/follow-requests/${id}/decline`),

  unfollow: (userId: string) => api.delete(`/users/${userId}/follow`),

  getFollowers: (userId: string) => api.get(`/users/${userId}/followers`),

  getFollowing: (userId: string) => api.get(`/users/${userId}/following`),

  // Privacy / DSAR
  exportMyData: () => api.get('/users/me/export'),
  deleteAccount: () => api.delete('/users/me', { data: { confirm: true } }),
  requestWomanVerification: () => api.post('/users/me/woman-verification'),
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

  // The applicant's own two actions. The employer-side route checks job
  // ownership and so 403s for the candidate.
  updateMyApplication: (applicationId: string, status: 'WITHDRAWN' | 'ACCEPTED') =>
    api.patch(`/jobs/me/applications/${applicationId}`, { status }),

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
export type ReactionType = 'LIKE' | 'CELEBRATE' | 'SUPPORT' | 'INSIGHTFUL' | 'INSPIRED';

export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'LIKE', emoji: '❤️', label: 'Like' },
  { type: 'CELEBRATE', emoji: '🎉', label: 'Celebrate' },
  { type: 'SUPPORT', emoji: '💜', label: 'Support' },
  { type: 'INSIGHTFUL', emoji: '💡', label: 'Insightful' },
  { type: 'INSPIRED', emoji: '✨', label: 'Inspired' },
];

export const postApi = {
  getFeed: (params?: any) => api.get('/posts/feed', { params }),

  getById: (id: string) => api.get(`/posts/${id}`),

  create: (data: any) => api.post('/posts', data),

  update: (id: string, data: any) => api.patch(`/posts/${id}`, data),

  delete: (id: string) => api.delete(`/posts/${id}`),

  like: (id: string) => api.post(`/posts/${id}/like`),

  unlike: (id: string) => api.delete(`/posts/${id}/like`),

  // A reaction with a meaning (LIKE, CELEBRATE, SUPPORT, INSIGHTFUL, INSPIRED).
  // Reacting again with another type changes it; unlike removes it.
  react: (id: string, type: ReactionType) => api.post(`/posts/${id}/react`, { type }),

  vote: (id: string, optionId: string) => api.post(`/posts/${id}/vote`, { optionId }),

  likeComment: (postId: string, commentId: string) => api.post(`/posts/${postId}/comments/${commentId}/like`),

  unlikeComment: (postId: string, commentId: string) => api.delete(`/posts/${postId}/comments/${commentId}/like`),

  pin: (id: string, pinned: boolean) => api.patch(`/posts/${id}/pin`, { pinned }),

  getScheduled: () => api.get('/posts/me/scheduled'),

  getMentions: () => api.get('/posts/me/mentions'),

  save: (id: string) => api.post(`/posts/${id}/save`),

  unsave: (id: string) => api.delete(`/posts/${id}/save`),

  getSaved: () => api.get('/posts/me/saved'),

  // parentId makes it a reply, threaded under that comment on the server
  // rather than faked with an "@Name" prefix in the text.
  comment: (postId: string, content: string, parentId?: string) =>
    api.post(`/posts/${postId}/comments`, parentId ? { content, parentId } : { content }),

  deleteComment: (postId: string, commentId: string) =>
    api.delete(`/posts/${postId}/comments/${commentId}`),

  getUserPosts: (userId: string) => api.get(`/posts/user/${userId}`),

  // Reposts: as-is (idempotent) or with your own words.
  repost: (id: string, content?: string) => api.post(`/posts/${id}/repost`, content ? { content } : {}),
  unrepost: (id: string) => api.delete(`/posts/${id}/repost`),
  getReposts: (id: string) => api.get(`/posts/${id}/reposts`),

  // What was on screen, batched by the impression tracker.
  recordImpressions: (data: { ids: string[]; source?: string; anonId?: string }) =>
    api.post('/posts/impressions', data),
  getInsights: (id: string) => api.get(`/posts/${id}/insights`),
  getMyInsights: (days = 30) => api.get('/posts/me/insights', { params: { days } }),

  // What you are writing, kept until published or discarded.
  getDrafts: () => api.get('/posts/me/drafts'),
  saveDraft: (data: {
    id?: string | null;
    kind: string;
    content: string;
    mediaUrls?: string[];
    mediaAlt?: string[];
    poll?: { options: string[]; durationHours: number } | null;
    isPublic?: boolean;
    isSensitive?: boolean;
  }) => api.put('/posts/me/drafts', data),
  deleteDraft: (id: string) => api.delete(`/posts/me/drafts/${id}`),

  // The author's thread controls.
  setCommentsOff: (id: string, commentsOff: boolean) => api.patch(`/posts/${id}`, { commentsOff }),
  pinComment: (postId: string, commentId: string, pinned: boolean) =>
    api.patch(`/posts/${postId}/comments/${commentId}/pin`, { pinned }),

  // Saved-post folders.
  saveTo: (id: string, collectionId: string | null) => api.patch(`/posts/${id}/save`, { collectionId }),
  getSavedIn: (collectionId: string) => api.get('/posts/me/saved', { params: { collectionId } }),

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
// Mirrors the validators on POST /api/mentors/me.
export interface MentorProfileInput {
  specializations?: string[];
  hourlyRate?: number;
  yearsExperience?: number;
  isAvailable?: boolean;
}

export const mentorApi = {
  getAll: (params?: any) => api.get('/mentors', { params }),

  getById: (id: string) => api.get(`/mentors/${id}`),

  // `POST /mentors/me` upserts the mentor profile, so becoming a mentor and
  // editing the profile are the same call. There is no `/mentors/become`.
  become: (data: MentorProfileInput) => api.post('/mentors/me', data),

  updateProfile: (data: MentorProfileInput) => api.post('/mentors/me', data),

  bookSession: (data: {
    mentorId: string;
    scheduledAt?: string;
    date?: string;
    time?: string;
    durationMinutes?: number;
    duration?: number;
    note?: string;
  }) => {
    const scheduledAt =
      data.scheduledAt ||
      (data.date && data.time
        ? new Date(`${data.date}T${data.time}`).toISOString()
        : undefined);

    return api.post(`/mentors/${data.mentorId}/book`, {
      scheduledAt,
      durationMinutes: data.durationMinutes ?? data.duration,
      note: data.note,
    });
  },
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
    targetType: 'post' | 'comment' | 'video' | 'user' | 'message' | 'channel' | 'other';
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
    allowMessagesFrom?: 'all' | 'connections' | 'none';
    filterOffensiveContent?: boolean;
    hideReadReceipts?: boolean;
    profileVisibility?: 'public' | 'connections' | 'private';
    hideOnlineStatus?: boolean;
    hideLastSeen?: boolean;
    enableSafetyAlerts?: boolean;
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
  createPost: (id: string, data: { content: string; mediaUrls?: string[]; mediaAlt?: string[]; isSensitive?: boolean }) =>
    api.post(`/groups/${id}/posts`, data),
  // The author, or a group admin or moderator.
  deletePost: (id: string, postId: string) => api.delete(`/groups/${id}/posts/${postId}`),
};

// ============================================
// STATUS / STORIES API
// ============================================
export const statusApi = {
  feed: () => api.get('/status/feed'),
  create: (data: { type: 'image' | 'video'; mediaUrl: string; caption?: string; audience?: 'everyone' | 'close_friends' }) =>
    api.post('/status', data),
  // Marks a story watched: its ring goes quiet for you, its count goes up for the author.
  view: (id: string) => api.post(`/status/${id}/view`),
  viewers: (id: string) => api.get(`/status/${id}/viewers`),
  delete: (id: string) => api.delete(`/status/${id}`),
};

// The short list close-friends stories go to.
export const closeFriendApi = {
  list: () => api.get('/users/me/close-friends'),
  add: (userId: string) => api.post(`/users/me/close-friends/${userId}`),
  remove: (userId: string) => api.delete(`/users/me/close-friends/${userId}`),
};

// Folders for saved posts.
export const collectionApi = {
  list: () => api.get('/posts/collections'),
  create: (data: { name: string; description?: string }) => api.post('/posts/collections', data),
  update: (id: string, data: { name?: string; description?: string }) => api.patch(`/posts/collections/${id}`, data),
  remove: (id: string) => api.delete(`/posts/collections/${id}`),
};

// Stories kept on a profile after their 24 hours.
export const highlightApi = {
  archive: () => api.get('/status/highlights/archive'),
  forUser: (userId: string) => api.get(`/status/highlights/user/${userId}`),
  create: (data: { title: string; statusIds: string[] }) => api.post('/status/highlights', data),
  update: (id: string, data: { title?: string; coverUrl?: string | null }) => api.patch(`/status/highlights/${id}`, data),
  remove: (id: string) => api.delete(`/status/highlights/${id}`),
  addItem: (id: string, statusId: string) => api.post(`/status/highlights/${id}/items`, { statusId }),
  removeItem: (id: string, itemId: string) => api.delete(`/status/highlights/${id}/items/${itemId}`),
};

// The composer's @ autocomplete.
export const mentionApi = {
  suggest: (q: string) => api.get('/users/suggest', { params: { q } }),
};

// People you may know, each with the reason they are suggested.
export const peopleApi = {
  suggested: (limit = 6) => api.get('/users/suggested', { params: { limit } }),
};

// Topics: hashtags as places, with follow state the ranked feed honours.
export const topicApi = {
  trending: (params?: { days?: number; limit?: number }) => api.get('/topics/trending', { params }),
  get: (tag: string) => api.get(`/topics/${encodeURIComponent(tag)}`),
  following: () => api.get('/topics/me/following'),
  // The composer's # autocomplete.
  suggest: (q: string) => api.get('/topics/suggest', { params: { q } }),
  follow: (tag: string) => api.post(`/topics/${encodeURIComponent(tag)}/follow`),
  unfollow: (tag: string) => api.delete(`/topics/${encodeURIComponent(tag)}/follow`),
};

// "See fewer posts from" and muted topics, honoured by the ranked feeds.
export const feedPreferencesApi = {
  get: () => api.get('/ai-algorithms/feed-preferences'),
  update: (data: { blockedCreators?: string[]; blockedHashtags?: string[]; followedHashtags?: string[]; inNetworkRatio?: number }) =>
    api.patch('/ai-algorithms/feed-preferences', data),
};

export const eventHostApi = {
  create: (data: {
    title: string;
    description: string;
    type: 'webinar' | 'workshop' | 'networking' | 'conference' | 'meetup';
    format: 'virtual' | 'in-person' | 'hybrid';
    date: string;
    startTime: string;
    endTime: string;
    location?: string;
    link?: string;
    image?: string;
    maxAttendees?: number | null;
    price?: number;
    tags?: string[];
  }) => api.post('/events', data),
};

// ============================================
// NOTIFICATION API
// ============================================
export const notificationApi = {
  getAll: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    api.get('/notifications', { params }),

  markRead: (id: string) => api.patch(`/notifications/${id}/read`),

  // A grouped row ("Mei and 3 others reacted") carries every id it folded.
  markManyRead: (ids: string[]) => api.patch('/notifications/read-many', { ids }),

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

  trackReferral: (data: { referralCode: string; source?: string }) =>
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

  getMessages: (conversationId: string, params?: { limit?: number; before?: string }) =>
    api.get(`/messages/conversations/${conversationId}/messages`, { params }),

  // Searches the thread's text; the most recent matches come back first.
  search: (conversationId: string, q: string) =>
    api.get(`/messages/conversations/${conversationId}/messages`, { params: { q, limit: 50 } }),

  send: (conversationId: string, content: string) =>
    api.post(`/messages/conversations/${conversationId}/messages`, { content }),

  startConversation: (userId: string) => api.post('/messages/conversations', { userId }),

  // Disappearing messages: null turns the timer off; otherwise one of the
  // allowed TTLs in seconds (1 hour, 24 hours, 7 days, 90 days).
  updateConversationSettings: (conversationId: string, disappearingTtlSeconds: number | null) =>
    api.patch(`/messages/conversations/${conversationId}/settings`, { disappearingTtlSeconds }),
};

export const DISAPPEARING_MESSAGE_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Off' },
  { value: 3600, label: '1 hour' },
  { value: 86400, label: '24 hours' },
  { value: 604800, label: '7 days' },
  { value: 7776000, label: '90 days' },
];

export function disappearingLabel(ttl: number | null | undefined): string {
  return DISAPPEARING_MESSAGE_OPTIONS.find((option) => option.value === (ttl ?? null))?.label ?? 'Off';
}

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
  getCareerPrediction: () => api.get('/ai-algorithms/career-compass'),
  generateCareerPrediction: () => api.post('/ai-algorithms/career-compass/generate'),

  // OpportunityScan - Opportunity Matching
  getOpportunities: (params?: { type?: string; viewed?: boolean }) =>
    api.get('/ai-algorithms/opportunity-scan', { params }),
  markOpportunityViewed: (id: string) => api.patch(`/ai-algorithms/opportunity-scan/${id}/view`),
  submitOpportunityFeedback: (id: string, data: { isInterested?: boolean; feedback?: string }) =>
    api.patch(`/ai-algorithms/opportunity-scan/${id}/feedback`, data),

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
  }) => api.post('/ai-algorithms/salary-equity/submit', data),
  analyzeSalary: (params: { role: string; location?: string; company?: string }) =>
    api.get('/ai-algorithms/salary-equity/analyze', { params }),
  getMySalaryAnalyses: () => api.get('/ai-algorithms/salary-equity/my-analyses'),

  // MentorMatch - AI Mentor Pairing
  getMentorMatches: (params?: { skill?: string; industry?: string; minScore?: number }) =>
    api.get('/ai-algorithms/mentor-match', { params }),
  getMentorMatchDetails: (mentorId: string) => api.get(`/ai-algorithms/mentor-match/${mentorId}`),

  // SafetyScore - Trust & Verification
  getMyTrustScore: () => api.get('/ai-algorithms/trust-score'),
  getUserTrustScore: (userId: string) => api.get(`/ai-algorithms/trust-score/${userId}`),
  reportContent: (data: {
    contentType: string;
    contentId: string;
    reportedUserId: string;
    reason: string;
    description?: string;
  }) => api.post('/ai-algorithms/report', data),

  // IncomeStream - Creator Analytics
  getCreatorAnalytics: () => api.get('/ai-algorithms/creator-analytics'),
  getIncomeProjections: () => api.get('/ai-algorithms/creator-analytics/projections'),

  // Feed Preferences - OpportunityVerse
  getFeedPreferences: () => api.get('/ai-algorithms/feed-preferences'),
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
  }) => api.patch('/ai-algorithms/feed-preferences', data),
  recordSearch: (query: string) => api.post('/ai-algorithms/feed-preferences/search', { query }),
};

// ============================================
// PAYMENTS API
// ============================================
export const paymentsApi = {
  // The payment methods available in a region — a catalogue, not the caller's
  // saved cards. Payout destinations live in connectApi below.
  getMethods: (region?: string) => api.get('/payments/methods', { params: { region } }),

  getPricing: (region?: string) => api.get('/payments/pricing', { params: { region } }),

  getCurrencies: () => api.get('/payments/currencies'),

  getBestProvider: (region?: string) => api.get('/payments/best-provider', { params: { region } }),

  process: (data: {
    amount: number;
    currency: string;
    description: string;
    paymentMethodId?: string;
    returnUrl?: string;
    metadata?: Record<string, unknown>;
  }) => api.post('/payments/process', data),

  convert: (data: { amount: number; from: string; to: string }) =>
    api.post('/payments/convert', data),
};

// ============================================
// STRIPE CONNECT API
// ============================================
export interface PayoutMethod {
  id: string;
  type: 'bank' | 'card';
  name: string;
  last4: string | null;
  currency: string | null;
  isDefault: boolean;
}

export const connectApi = {
  getAccount: () => api.get('/connect/account'),

  createAccount: (data?: { country?: string; businessType?: string }) =>
    api.post('/connect/account', data ?? {}),

  getOnboardingLink: () => api.post('/connect/account/onboarding'),

  getEarnings: () => api.get('/connect/earnings'),

  // Payout destinations are Stripe external accounts on the connected account,
  // so `isDefault` is per-currency: an account paid in several currencies has
  // one default for each, not one overall.
  getPayoutMethods: () => api.get<{ data: PayoutMethod[] }>('/connect/payout-methods'),

  setDefaultPayoutMethod: (methodId: string) =>
    api.post(`/connect/payout-methods/${methodId}/default`),

  requestPayout: (data: { amount: number; currency?: string; connectedAccountId: string }) =>
    api.post('/connect/payout', data),
};

// ============================================
// CREATOR API
// ============================================
export const creatorApi = {
  getProfile: () => api.get('/creator/profile'),

  getPublicProfile: (userId: string) => api.get(`/creator/profile/${userId}`),

  enable: () => api.post('/creator/enable'),

  onboard: () => api.post('/creator/onboard'),

  getStripeLoginLink: () => api.post('/creator/stripe-login'),

  getBalance: () => api.get('/creator/balance'),

  getEarnings: (params?: { period?: string }) => api.get('/creator/earnings', { params }),

  getPayouts: () => api.get('/creator/payouts'),

  requestPayout: (data: { amount: number }) => api.post('/creator/payouts/request', data),

  getGifts: () => api.get('/creator/gifts'),

  getSentGifts: () => api.get('/creator/gifts/sent'),

  getTiers: () => api.get('/creator/tiers'),

  getLeaderboard: (params?: { period?: string; limit?: number }) =>
    api.get('/creator/leaderboard', { params }),
};

export default api;
