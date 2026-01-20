/**
 * API Service
 * Axios instance configured for ATHENA backend
 */
import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:4000/api';

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
let refreshPromise: Promise<{ accessToken: string; refreshToken?: string }> | null = null;

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

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_URL}/auth/refresh`, { refreshToken })
            .then((response) => response.data?.data)
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
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; firstName: string; lastName: string; persona: string }) =>
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
export const userApi = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data: any) => api.put('/users/me', data),
  getApplications: () => api.get('/users/me/applications'),
  getSavedJobs: () => api.get('/users/me/saved-jobs'),
};

// Notifications
export const notificationsApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get('/notifications', { params }),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  registerPushToken: (token: string) => api.post('/notifications/push-token', { token, provider: 'expo' }),
};

// Posts/Feed
export const postsApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get('/posts', { params }),
  get: (id: string) => api.get(`/posts/${id}`),
  create: (data: { content: string; type?: string }) =>
    api.post('/posts', data),
  like: (id: string) => api.post(`/posts/${id}/like`),
  unlike: (id: string) => api.delete(`/posts/${id}/like`),
};

// Messages
export const messagesApi = {
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (conversationId: string) =>
    api.get(`/messages/conversations/${conversationId}`),
  send: (conversationId: string, content: string) =>
    api.post(`/messages/conversations/${conversationId}`, { content }),
  startConversation: (userId: string) =>
    api.post('/messages/conversations', { userId }),
};
