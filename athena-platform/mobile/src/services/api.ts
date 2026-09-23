/**
 * API Service
 * Axios instance configured for ATHENA backend
 */
import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';

// app.config.js sets extra.apiUrl from the build profile's API_URL with /api
// already appended (every server mount is under /api). The localhost fallback
// is only reached when the config layer is absent, such as in Jest.
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:5000/api';

export function unwrapApiData<T>(payload: any): T {
  return (payload?.data ?? payload) as T;
}

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let authToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> | null = null;

const authPathsToSkipRefresh = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
];

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const setRefreshToken = (token: string | null) => {
  refreshToken = token;
};

/**
 * The access token this app is currently using, for the one caller that needs
 * it outside an axios request: the socket handshake. The socket client asks
 * for it on every connection attempt rather than holding a copy, because the
 * response interceptor above rotates the token on a 401 and a reconnect with
 * the token from an hour ago is refused by the server's socket middleware.
 */
export const getAuthToken = (): string | null => authToken;

export const setAuthTokens = (accessToken: string | null, newRefreshToken: string | null) => {
  setAuthToken(accessToken);
  setRefreshToken(newRefreshToken);
};

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = String(originalRequest?.url || '');
    const shouldSkipRefresh = authPathsToSkipRefresh.some((path) => requestUrl.includes(path));

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !shouldSkipRefresh) {
      originalRequest._retry = true;
      try {
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_URL}/auth/refresh`, { refreshToken })
            .then((response) =>
              unwrapApiData<{ accessToken: string; refreshToken?: string; expiresIn?: number }>(
                response.data
              )
            )
            .finally(() => {
              refreshPromise = null;
            });
        }

        const refreshed = await refreshPromise;
        const newAccessToken = refreshed?.accessToken;
        const newRefreshToken = refreshed?.refreshToken;

        if (!newAccessToken) {
          throw new Error('Refresh failed');
        }

        setAuthTokens(newAccessToken, newRefreshToken || refreshToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        setAuthTokens(null, null);
        return Promise.reject(refreshError);
      }
    }

    if (error.response) {
      console.error(`[API Error] ${error.response.status}: ${error.response.data?.message || 'Unknown error'}`);
      
      // Handle 401 Unauthorized
      if (error.response.status === 401) {
        // Token expired or invalid - will be handled by AuthContext
      }
    } else if (error.request) {
      console.error('[API Error] No response received');
    } else {
      console.error('[API Error]', error.message);
    }
    return Promise.reject(error);
  }
);

// ==========================================
// API ENDPOINTS
// ==========================================

// Auth
export const authApi = {
  login: (email: string, password: string, twoFactorCode?: string) =>
    api.post('/auth/login', {
      email,
      password,
      ...(twoFactorCode ? { twoFactorCode } : {}),
    }),
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    persona: string;
    womanSelfAttested: boolean;
    dateOfBirth: string;
  }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
};

// Jobs
export const jobsApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/jobs', { params }),
  get: (id: string) => api.get(`/jobs/${id}`),
  apply: (id: string, data: { coverLetter?: string; resumeUrl?: string }) =>
    api.post(`/jobs/${id}/apply`, data),
  save: (id: string) => api.post(`/jobs/${id}/save`),
  unsave: (id: string) => api.delete(`/jobs/${id}/save`),
};

// User
//
// The profile is PATCHed (user.routes.ts has no PUT /me, so Edit Profile
// could never save), and the member's applications and saved jobs live under
// /jobs/me on the server, not /users/me. Only the fields the route whitelists
// are typed here; `avatar` is not one of them, so a photo is changed on the web.
export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  headline?: string;
  bio?: string;
  city?: string;
  state?: string;
  country?: string;
  currentJobTitle?: string;
  currentCompany?: string;
  timezone?: string;
}

export const userApi = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data: ProfileUpdate) => api.patch('/users/me', data),
  getApplications: () => api.get('/jobs/me/applications'),
  getSavedJobs: () => api.get('/jobs/me/saved'),
};

// Notifications
//
// Read receipts are PATCHes on the server. A grouped row ("Ana and 3 others
// liked your post") carries every member's id in `ids`, and /read-many clears
// them in one call.
export const notificationsApi = {
  list: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    api.get('/notifications', { params }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markManyRead: (ids: string[]) => api.patch('/notifications/read-many', { ids }),
  markAllRead: () => api.patch('/notifications/read-all'),
  registerPushToken: (token: string) => api.post('/notifications/push-token', { token, provider: 'expo' }),
};

/** A job as the list, saved-jobs and applications routes return it. */
export interface JobSummary {
  id: string;
  title: string;
  slug?: string;
  city?: string | null;
  state?: string | null;
  isRemote: boolean;
  salaryMin?: number | null;
  salaryMax?: number | null;
  type: string;
  organization?: { id?: string; name: string; logo?: string | null } | null;
  hasApplied?: boolean;
  /** Present on GET /jobs/me/saved. */
  savedAt?: string;
}

/** One row of GET /jobs/me/applications: the application with its job. */
export interface JobApplication {
  id: string;
  status: string;
  appliedAt: string;
  updatedAt?: string;
  job: JobSummary;
}

// Posts/Feed
//
// The feed is GET /posts/feed; GET /posts does not exist (POST /posts creates
// a post), which is why the Home tab was empty.
export const postsApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get('/posts/feed', { params }),
  get: (id: string) => api.get(`/posts/${id}`),
  create: (data: { content: string; type?: string }) =>
    api.post('/posts', data),
  like: (id: string) => api.post(`/posts/${id}/like`),
  unlike: (id: string) => api.delete(`/posts/${id}/like`),
  comment: (id: string, content: string) => api.post(`/posts/${id}/comments`, { content }),
};

// Messages
export const messagesApi = {
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (conversationId: string) =>
    api.get(`/messages/conversations/${conversationId}/messages`),
  send: (conversationId: string, content: string) =>
    api.post(`/messages/conversations/${conversationId}/messages`, { content }),
  startConversation: (userId: string) =>
    api.post('/messages/conversations', { userId }),
};

/** The web app, for links that open a page rather than call the API. */
export const WEB_URL: string = Constants.expoConfig?.extra?.webUrl || API_URL.replace(/\/api\/?$/, '').replace('://api.', '://');

/** A page on the web app, for the "opens on the web" rows and buttons. */
export const webUrl = (path: string): string => `${WEB_URL}${path.startsWith('/') ? path : `/${path}`}`;

export interface FeedPost {
  id: string;
  content: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  isLiked?: boolean;
  author: { id?: string; displayName: string; avatar?: string | null; headline?: string | null };
}

export interface PostComment {
  id: string;
  content: string;
  createdAt: string;
  likeCount?: number;
  isLiked?: boolean;
  author: { id?: string; displayName: string; avatar?: string | null };
  replies?: PostComment[];
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  privacy?: string;
  memberCount: number;
  isMember: boolean;
}

export interface SafetySettings {
  isSafeMode: boolean;
  hideFromSearch: boolean;
  allowMessages: boolean;
  safeExitEnabled: boolean;
  safeExitUrl?: string | null;
  panicButtonEnabled: boolean;
  activityLogEnabled: boolean;
  disguisedAppIcon: boolean;
  notificationsSafe: boolean;
  // email is optional here because contacts saved before the form required
  // one still come back without it, and the safety screen has to be able to
  // tell the member that those contacts cannot be reached. The panic alert is
  // an email and nothing else (server/src/services/dv-safe.service.ts).
  emergencyContacts: Array<{ id: string; name: string; phone: string; email?: string; relationship: string; notifyOnPanic?: boolean }>;
}

export interface Mentor {
  id: string;
  userId: string;
  specializations?: string[] | null;
  yearsExperience?: number | null;
  hourlyRate?: number | string | null;
  isAvailable?: boolean;
  rating?: number | string | null;
  bio?: string | null;
  user?: { id?: string; displayName?: string | null; avatar?: string | null; headline?: string | null; bio?: string | null };
}

export interface Course {
  id: string;
  title: string;
  description: string;
  type?: string | null;
  durationMonths?: number | null;
  studyMode?: string[] | null;
  slug?: string;
  providerName?: string | null;
  cost?: number | null;
  organization?: { id: string; name: string; logo?: string | null } | null;
}

export const groupsApi = {
  list: (params?: { q?: string }) => api.get('/groups', { params }),
  get: (id: string) => api.get(`/groups/${id}`),
  join: (id: string) => api.post(`/groups/${id}/join`),
  leave: (id: string) => api.post(`/groups/${id}/leave`),
  posts: (id: string) => api.get(`/groups/${id}/posts`),
  post: (id: string, content: string) => api.post(`/groups/${id}/posts`, { content }),
};

export const safetyApi = {
  settings: () => api.get('/safety/dv/settings'),
  update: (updates: Partial<Omit<SafetySettings, 'emergencyContacts'>>) => api.put('/safety/dv/settings', updates),
  enableSafeMode: () => api.post('/safety/dv/safe-mode'),
  panic: () => api.post('/safety/dv/panic'),
  // email is required here, although the server will take a contact without
  // one: the panic alert is an email and nothing else, so a contact saved
  // without an address is a contact the button can never reach. The screen
  // used to send name, phone and relationship only, which made every contact
  // added on a phone permanently unreachable.
  addContact: (contact: { name: string; phone: string; email: string; relationship: string; notifyOnPanic?: boolean }) =>
    api.post('/safety/dv/emergency-contacts', contact),
  removeContact: (contactId: string) => api.delete(`/safety/dv/emergency-contacts/${contactId}`),
};

export const mentorsApi = {
  list: (params?: { search?: string; specialization?: string; available?: boolean; page?: number; limit?: number }) =>
    api.get('/mentors', { params }),
  get: (mentorId: string) => api.get(`/mentors/${mentorId}`),
  book: (mentorId: string, data: { scheduledAt: string; durationMinutes?: number; note?: string }) =>
    api.post(`/mentors/${mentorId}/book`, data),
  sessions: () => api.get('/mentors/sessions'),
};

export const coursesApi = {
  list: (params?: { search?: string; type?: string; page?: number; limit?: number }) => api.get('/courses', { params }),
  mine: () => api.get('/courses/me'),
  enrol: (courseId: string) => api.post(`/courses/${courseId}/enroll`),
  // The course with its outline (lessons locked unless enrolled or preview).
  get: (idOrSlug: string) => api.get(`/courses/${idOrSlug}`),
  // Every lesson's content and the learner's progress; enrolled learners only.
  classroom: (courseId: string) => api.get(`/courses/${courseId}/classroom`),
  completeLesson: (courseId: string, lessonId: string) => api.post(`/courses/${courseId}/lessons/${lessonId}/complete`),
};

export const billingApi = {
  pricing: (region: string) => api.get('/payments/pricing', { params: { region } }),
  subscription: () => api.get('/subscriptions/me'),
};
