import { api } from './api';

// ============================================
// VIDEO FEED API
// ============================================
export const videoApi = {
  // Get personalized video feed
  getFeed: (params?: { page?: number; limit?: number; category?: string }) =>
    api.get('/video/feed', { params }),

  // Get single video
  getVideo: (id: string) => api.get(`/video/${id}`),

  // Upload video with metadata
  upload: (formData: FormData, onProgress?: (progress: number) => void) =>
    api.post('/video/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    }),

  // Create new video post
  create: (data: {
    title: string;
    description?: string;
    videoUrl: string;
    thumbnailUrl?: string;
    duration: number;
    category?: string;
    tags?: string[];
    visibility?: 'public' | 'followers' | 'private';
  }) => api.post('/video', data),

  // Like a video
  like: (id: string) => api.post(`/video/${id}/like`),

  // Unlike a video
  unlike: (id: string) => api.delete(`/video/${id}/like`),

  // Bookmark/save a video
  bookmark: (id: string) => api.post(`/video/${id}/bookmark`),

  // Remove bookmark
  unbookmark: (id: string) => api.delete(`/video/${id}/bookmark`),

  // Get video comments
  getComments: (id: string, params?: { page?: number; limit?: number }) =>
    api.get(`/video/${id}/comments`, { params }),

  // Add comment
  addComment: (id: string, content: string) =>
    api.post(`/video/${id}/comments`, { content }),

  // Share video
  share: (id: string, platform?: string) =>
    api.post(`/video/${id}/share`, { platform }),

  // Report video
  report: (id: string, reason: string) =>
    api.post(`/video/${id}/report`, { reason }),

  // Track view
  trackView: (id: string, watchDuration: number) =>
    api.post(`/video/${id}/view`, { watchDuration }),

  // Get trending videos
  getTrending: (params?: { period?: 'day' | 'week' | 'month' }) =>
    api.get('/video/trending', { params }),

  // Get videos by category
  getByCategory: (category: string, params?: { page?: number; limit?: number }) =>
    api.get(`/video/category/${category}`, { params }),

  // Get user's videos
  getUserVideos: (userId: string, params?: { page?: number; limit?: number }) =>
    api.get(`/video/user/${userId}`, { params }),

  // Get bookmarked videos
  getBookmarked: (params?: { page?: number; limit?: number }) =>
    api.get('/video/bookmarked', { params }),

  // Delete video
  delete: (id: string) => api.delete(`/video/${id}`),
};

// ============================================
// CHANNELS API
// ============================================
export const channelApi = {
  // Get user's channels
  getMyChannels: () => api.get('/channels'),

  // Get channel by ID
  getChannel: (id: string) => api.get(`/channels/${id}`),

  // Create new channel
  create: (data: {
    name: string;
    description?: string;
    type: 'public' | 'private' | 'direct';
    icon?: string;
    memberIds?: string[];
  }) => api.post('/channels', data),

  // Update channel
  update: (id: string, data: { name?: string; description?: string; icon?: string }) =>
    api.patch(`/channels/${id}`, data),

  // Delete channel
  delete: (id: string) => api.delete(`/channels/${id}`),

  // Get channel messages
  getMessages: (id: string, params?: { page?: number; limit?: number; before?: string }) =>
    api.get(`/channels/${id}/messages`, { params }),

  // Send message to channel
  sendMessage: (id: string, data: { content: string; attachments?: string[] }) =>
    api.post(`/channels/${id}/messages`, data),

  // Edit message
  editMessage: (channelId: string, messageId: string, content: string) =>
    api.patch(`/channels/${channelId}/messages/${messageId}`, { content }),

  // Delete message
  deleteMessage: (channelId: string, messageId: string) =>
    api.delete(`/channels/${channelId}/messages/${messageId}`),

  // Add reaction to message
  addReaction: (channelId: string, messageId: string, emoji: string) =>
    api.post(`/channels/${channelId}/messages/${messageId}/reactions`, { emoji }),

  // Remove reaction
  removeReaction: (channelId: string, messageId: string, emoji: string) =>
    api.delete(`/channels/${channelId}/messages/${messageId}/reactions/${emoji}`),

  // Get channel members
  getMembers: (id: string) => api.get(`/channels/${id}/members`),

  // Add member to channel
  addMember: (id: string, userId: string) =>
    api.post(`/channels/${id}/members`, { userId }),

  // Remove member
  removeMember: (id: string, userId: string) =>
    api.delete(`/channels/${id}/members/${userId}`),

  // Leave channel
  leave: (id: string) => api.post(`/channels/${id}/leave`),

  // Mark channel as read
  markRead: (id: string) => api.post(`/channels/${id}/read`),

  // Search messages in channel
  searchMessages: (id: string, query: string) =>
    api.get(`/channels/${id}/search`, { params: { q: query } }),

  // Get pinned messages
  getPinnedMessages: (id: string) => api.get(`/channels/${id}/pinned`),

  // Pin message
  pinMessage: (channelId: string, messageId: string) =>
    api.post(`/channels/${channelId}/messages/${messageId}/pin`),

  // Unpin message
  unpinMessage: (channelId: string, messageId: string) =>
    api.delete(`/channels/${channelId}/messages/${messageId}/pin`),

  // Get unread counts
  getUnreadCounts: () => api.get('/channels/unread'),

  // Start typing indicator
  startTyping: (id: string) => api.post(`/channels/${id}/typing`),

  // Discover public channels
  discover: (params?: { category?: string; search?: string }) =>
    api.get('/channels/discover', { params }),

  // Join public channel
  join: (id: string) => api.post(`/channels/${id}/join`),
};

// ============================================
// APPRENTICESHIPS API
// ============================================
export const apprenticeshipApi = {
  // Get all apprenticeships
  getAll: (params?: {
    page?: number;
    limit?: number;
    industry?: string;
    level?: string;
    location?: string;
    remote?: boolean;
    search?: string;
  }) => api.get('/apprenticeships', { params }),

  // Get single apprenticeship
  getById: (id: string) => api.get(`/apprenticeships/${id}`),

  // Get featured apprenticeships
  getFeatured: () => api.get('/apprenticeships/featured'),

  // Apply for apprenticeship
  apply: (id: string, data: {
    coverLetter?: string;
    resumeUrl?: string;
    portfolioUrl?: string;
    availableStartDate?: string;
    answers?: Record<string, string>;
  }) => api.post(`/apprenticeships/${id}/apply`, data),

  // Get my applications
  getMyApplications: (params?: { status?: string }) =>
    api.get('/apprenticeships/applications/me', { params }),

  // Get application status
  getApplicationStatus: (id: string) =>
    api.get(`/apprenticeships/applications/${id}`),

  // Withdraw application
  withdrawApplication: (id: string) =>
    api.delete(`/apprenticeships/applications/${id}`),

  // Bookmark apprenticeship
  bookmark: (id: string) => api.post(`/apprenticeships/${id}/bookmark`),

  // Remove bookmark
  unbookmark: (id: string) => api.delete(`/apprenticeships/${id}/bookmark`),

  // Get bookmarked
  getBookmarked: () => api.get('/apprenticeships/bookmarked'),

  // Get recommended apprenticeships
  getRecommended: () => api.get('/apprenticeships/recommended'),

  // Get apprenticeship categories/industries
  getCategories: () => api.get('/apprenticeships/categories'),

  // Track progress (for active apprentices)
  getProgress: (id: string) => api.get(`/apprenticeships/${id}/progress`),

  // Submit milestone
  submitMilestone: (apprenticeshipId: string, milestoneId: string, data: {
    notes?: string;
    attachments?: string[];
  }) => api.post(`/apprenticeships/${apprenticeshipId}/milestones/${milestoneId}/submit`, data),

  // Get certificate
  getCertificate: (id: string) => api.get(`/apprenticeships/${id}/certificate`),
};

// ============================================
// SKILLS MARKETPLACE API
// ============================================
export const skillsMarketplaceApi = {
  // Get all services/gigs
  getServices: (params?: {
    page?: number;
    limit?: number;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    rating?: number;
    deliveryTime?: string;
    search?: string;
  }) => api.get('/skills-marketplace/services', { params }),

  // Get single service
  getService: (id: string) => api.get(`/skills-marketplace/services/${id}`),

  // Create service listing
  createService: (data: {
    title: string;
    description: string;
    category: string;
    subcategory?: string;
    packages: Array<{
      name: string;
      description: string;
      price: number;
      deliveryDays: number;
      revisions?: number;
      features: string[];
    }>;
    tags?: string[];
    images?: string[];
    faqs?: Array<{ question: string; answer: string }>;
  }) => api.post('/skills-marketplace/services', data),

  // Update service
  updateService: (id: string, data: any) =>
    api.patch(`/skills-marketplace/services/${id}`, data),

  // Delete service
  deleteService: (id: string) => api.delete(`/skills-marketplace/services/${id}`),

  // Get my services
  getMyServices: () => api.get('/skills-marketplace/services/me'),

  // Get seller profile
  getSellerProfile: (userId: string) =>
    api.get(`/skills-marketplace/sellers/${userId}`),

  // Get categories
  getCategories: () => api.get('/skills-marketplace/categories'),

  // Place order
  placeOrder: (serviceId: string, data: {
    packageIndex: number;
    requirements?: string;
    attachments?: string[];
  }) => api.post(`/skills-marketplace/services/${serviceId}/order`, data),

  // Get my orders (as buyer)
  getMyOrders: (params?: { status?: string }) =>
    api.get('/skills-marketplace/orders/me', { params }),

  // Get orders received (as seller)
  getReceivedOrders: (params?: { status?: string }) =>
    api.get('/skills-marketplace/orders/received', { params }),

  // Get order details
  getOrder: (id: string) => api.get(`/skills-marketplace/orders/${id}`),

  // Accept order (seller)
  acceptOrder: (id: string) => api.post(`/skills-marketplace/orders/${id}/accept`),

  // Deliver order (seller)
  deliverOrder: (id: string, data: { message: string; attachments?: string[] }) =>
    api.post(`/skills-marketplace/orders/${id}/deliver`, data),

  // Request revision (buyer)
  requestRevision: (id: string, reason: string) =>
    api.post(`/skills-marketplace/orders/${id}/revision`, { reason }),

  // Complete order (buyer)
  completeOrder: (id: string) => api.post(`/skills-marketplace/orders/${id}/complete`),

  // Cancel order
  cancelOrder: (id: string, reason: string) =>
    api.post(`/skills-marketplace/orders/${id}/cancel`, { reason }),

  // Leave review
  leaveReview: (orderId: string, data: {
    rating: number;
    review: string;
    communicationRating?: number;
    serviceRating?: number;
    recommendRating?: number;
  }) => api.post(`/skills-marketplace/orders/${orderId}/review`, data),

  // Get reviews for service
  getServiceReviews: (serviceId: string, params?: { page?: number; limit?: number }) =>
    api.get(`/skills-marketplace/services/${serviceId}/reviews`, { params }),

  // Favorite service
  favoriteService: (id: string) => api.post(`/skills-marketplace/services/${id}/favorite`),

  // Unfavorite service
  unfavoriteService: (id: string) => api.delete(`/skills-marketplace/services/${id}/favorite`),

  // Get favorites
  getFavorites: () => api.get('/skills-marketplace/favorites'),

  // Send custom request
  sendCustomRequest: (data: {
    title: string;
    description: string;
    category: string;
    budget: { min: number; max: number };
    deliveryDays: number;
    attachments?: string[];
  }) => api.post('/skills-marketplace/requests', data),

  // Get custom requests (for sellers)
  getCustomRequests: (params?: { category?: string }) =>
    api.get('/skills-marketplace/requests', { params }),

  // Submit proposal for request
  submitProposal: (requestId: string, data: {
    message: string;
    price: number;
    deliveryDays: number;
  }) => api.post(`/skills-marketplace/requests/${requestId}/proposal`, data),
};

export default {
  video: videoApi,
  channels: channelApi,
  apprenticeships: apprenticeshipApi,
  skillsMarketplace: skillsMarketplaceApi,
};
