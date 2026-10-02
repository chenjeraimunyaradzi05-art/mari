/**
 * API Service
 * Axios instance configured for ATHENA backend
 */
import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';
import { ageGateRefusalOf, type AgeGateRefusal } from '../utils/ageGate';

// app.config.js sets extra.apiUrl from the build profile's API_URL with /api
// already appended (every server mount is under /api). The localhost fallback
// is only reached when the config layer is absent, such as in Jest.
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:5000/api';

export function unwrapApiData<T>(payload: any): T {
  return (payload?.data ?? payload) as T;
}

/**
 * Tells the server this is the phone app and not a browser.
 *
 * A browser keeps its refresh token in an HttpOnly cookie, which this app has no
 * jar for, so the server never put one in a sign-in response and this app could
 * not refresh: every expired access token ended in a sign-out. A client that
 * says it is native is handed the refresh token in the response body and sends
 * it back in the body of /auth/refresh (server/src/routes/auth.routes.ts,
 * NATIVE_CLIENT_HEADER). It has to be on the refresh call as well as on sign-in,
 * and that call is made with plain axios, so the headers are shared.
 */
export const NATIVE_CLIENT_HEADERS = { 'X-Athena-Client': 'mobile' } as const;

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    ...NATIVE_CLIENT_HEADERS,
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
  // Sent signed out, with her password: a 401 here is a wrong password, not
  // an expired session, and refreshing would swallow the reason.
  '/auth/suspension-appeal',
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

/**
 * Listeners for a session that cannot be recovered.
 *
 * Clearing the tokens below only empties this module: the copies in
 * SecureStore survive, and AuthContext goes on holding a `user`, so the app
 * kept rendering the signed-in navigator while every single request answered
 * 401. The member saw her own app with nothing in it — no feed, no messages,
 * no safety settings — and no sign-in screen to get back through, until she
 * force-quit and reopened, at which point checkAuth finally threw the stale
 * tokens away. This is the channel the interceptor uses to tell the rest of
 * the app that the session is gone, so the sign-in screen appears at the
 * moment the session ends rather than on the next cold start.
 */
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export const onSessionExpired = (listener: SessionExpiredListener): (() => void) => {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
};

/**
 * Listeners for a write the server refused on the minimum age.
 *
 * An account with no date of birth is refused every write
 * (DATE_OF_BIRTH_REQUIRED), and one whose date is under the minimum is refused
 * the same way (MINIMUM_AGE_NOT_MET). The phone had no handling for either, so
 * the member saw whichever button she pressed fail and nothing about why. The
 * interceptor announces the refusal here and the prompt mounted at the root
 * (components/AgeGatePrompt.tsx) asks for the date, or says there is nothing
 * she can do and where to write. The request still fails for its caller.
 */
type AgeGateRefusalListener = (refusal: AgeGateRefusal) => void;
const ageGateRefusalListeners = new Set<AgeGateRefusalListener>();

export const onAgeGateRefusal = (listener: AgeGateRefusalListener): (() => void) => {
  ageGateRefusalListeners.add(listener);
  return () => {
    ageGateRefusalListeners.delete(listener);
  };
};

const notifyAgeGateRefusal = (refusal: AgeGateRefusal) => {
  for (const listener of Array.from(ageGateRefusalListeners)) {
    try {
      listener(refusal);
    } catch (error) {
      console.warn('[API] An age-gate listener threw:', error instanceof Error ? error.message : error);
    }
  }
};

/**
 * Listeners for a refresh that rotated the tokens.
 *
 * The server retires a refresh token the moment it is used, so the copy this
 * app keeps in SecureStore is dead the instant a refresh succeeds. Only the
 * copies in memory were being replaced, and the next cold start restored the
 * retired token from SecureStore: the server read that as a replay of a stolen
 * token and revoked every session the member had, on every device. AuthContext
 * subscribes here and writes the new pair; the interceptor waits for the write
 * before it replays the failed request, so the stored token is never behind the
 * one in use.
 */
export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string | null;
}
type TokensRefreshedListener = (tokens: RefreshedTokens) => void | Promise<void>;
const tokensRefreshedListeners = new Set<TokensRefreshedListener>();

export const onTokensRefreshed = (listener: TokensRefreshedListener): (() => void) => {
  tokensRefreshedListeners.add(listener);
  return () => {
    tokensRefreshedListeners.delete(listener);
  };
};

const notifyTokensRefreshed = async (tokens: RefreshedTokens): Promise<void> => {
  const outcomes = await Promise.allSettled(
    Array.from(tokensRefreshedListeners).map(async (listener) => listener(tokens))
  );
  for (const outcome of outcomes) {
    if (outcome.status === 'rejected') {
      // The tokens in memory are good; only the saved copy is behind. The next
      // refresh saves again, and checkAuth drops a stale copy on launch.
      console.warn(
        '[API] Saving the refreshed tokens failed:',
        outcome.reason instanceof Error ? outcome.reason.message : outcome.reason
      );
    }
  }
};

/**
 * Whether a failed refresh means the session is over. Only an answer from the
 * server does: a refusal (400, 401, 403) or a 409, which here means the token
 * was rotated by a request whose answer never reached this phone, so the new
 * one is lost and retrying the old one would only burn every session. A phone
 * that is offline, a request that timed out, a 429 and a 5xx say nothing about
 * the session, and signing her out for a dropped signal in a lift would be a
 * sign-out for nothing; the call fails and her tokens stay.
 */
const refreshEndedTheSession = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) return true; // 'No refresh token', 'Refresh failed': nothing left to try
  const status = error.response?.status;
  return status === 400 || status === 401 || status === 403 || status === 409;
};

const notifySessionExpired = () => {
  // A copy, so a listener that unsubscribes itself while being called does
  // not mutate the set mid-iteration.
  for (const listener of Array.from(sessionExpiredListeners)) {
    try {
      listener();
    } catch (error) {
      // A listener that throws must not stop the others from hearing that
      // the session ended; one of them is what signs her out.
      console.warn('[API] A session-expired listener threw:', error instanceof Error ? error.message : error);
    }
  }
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
            .post(`${API_URL}/auth/refresh`, { refreshToken }, { headers: NATIVE_CLIENT_HEADERS, timeout: 10000 })
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
        // The old refresh token is dead on the server now; save the new pair
        // before anything else can ask for another refresh.
        await notifyTokensRefreshed({ accessToken: newAccessToken, refreshToken: newRefreshToken || null });
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        if (!refreshEndedTheSession(refreshError)) {
          return Promise.reject(refreshError);
        }
        // The refresh is the last thing standing between her and a signed-out
        // app, so when it fails the session really is over. Announce it before
        // rejecting: the subscriber in AuthContext is what clears SecureStore,
        // drops the socket and puts the sign-in screen back.
        const wasSignedIn = Boolean(authToken || refreshToken);
        setAuthTokens(null, null);
        if (wasSignedIn) notifySessionExpired();
        return Promise.reject(refreshError);
      }
    }

    const ageRefusal = ageGateRefusalOf(error);
    if (ageRefusal) notifyAgeGateRefusal(ageRefusal);

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
  // A suspended account cannot sign in, so it cannot reach the appeals API
  // behind sign-in either. This route takes the address and password she has
  // just typed as proof the account is hers, files the appeal for a person to
  // decide, and issues no session.
  suspensionAppeal: (email: string, password: string, reason: string) =>
    api.post('/auth/suspension-appeal', { email, password, reason }),
  // Registration opens no session, so an email that never came, or a link that
  // expired, leaves a new member unable to sign in. Both of these answer the
  // same for every address and say nothing about whether there is an account.
  resendVerification: (email: string) => api.post('/auth/resend-verification', { email }),
  // The way back for a member who locked her own account and lost the email.
  requestUnlock: (email: string) => api.post('/auth/request-unlock', { email }),
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
  // Paged: the server answers at most 100 threads a page, with
  // pagination { page, limit, total, pages, hasMore } and unreadTotal across
  // every thread, not only the ones on this page.
  getConversations: (params?: { page?: number; limit?: number }) =>
    api.get('/messages/conversations', params ? { params } : undefined),
  getMessages: (conversationId: string) =>
    api.get(`/messages/conversations/${conversationId}/messages`),
  send: (conversationId: string, content: string) =>
    api.post(`/messages/conversations/${conversationId}/messages`, { content }),
  startConversation: (userId: string) =>
    api.post('/messages/conversations', { userId }),
  // Only the person who was asked decides a message request. Accepting opens the
  // thread; declining closes it to the other person for good.
  acceptRequest: (conversationId: string) => api.post(`/messages/conversations/${conversationId}/request/accept`),
  declineRequest: (conversationId: string) => api.post(`/messages/conversations/${conversationId}/request/decline`),
};

// Reporting and blocking another member from inside a thread. These are the
// member-facing safety routes, not the domestic-violence settings in safetyApi.
// A report of a message keeps a copy of it on the server, so unsending it
// afterwards does not take the evidence with it.
export const memberSafetyApi = {
  report: (data: { targetType: 'message' | 'user'; targetId: string; reason: string; details?: string }) =>
    api.post('/safety/reports', data),
  block: (blockedUserId: string) => api.post('/safety/blocks', { blockedUserId }),
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

/** Product feedback, as the help centre's form sends it. The server attaches her account. */
export type FeedbackCategory = 'BUG' | 'IDEA' | 'PRAISE' | 'OTHER';

export const feedbackApi = {
  send: (data: { message: string; category: FeedbackCategory; page?: string }) => api.post('/feedback', data),
};

// Sign-in and devices: the sessions behind her account, and the password that
// opens them. Changing the password ends every other session on the server.
export const sessionsApi = {
  list: () => api.get('/auth/sessions'),
  revoke: (sessionId: string) => api.delete(`/auth/sessions/${sessionId}`),
  signOutEverywhere: () => api.post('/auth/logout-all'),
  // Beyond signing out everywhere: every session ends and nobody can sign in,
  // with the password or Google or Facebook, until she unlocks the account
  // from the link the server emails her.
  lockAccount: () => api.post('/auth/lock'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

export const billingApi = {
  pricing: (region: string) => api.get('/payments/pricing', { params: { region } }),
  subscription: () => api.get('/subscriptions/me'),
};
