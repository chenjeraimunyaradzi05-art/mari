import { api, postApi, safetyApi } from './api';

// ============================================
// VIDEO FEED API
// ============================================
export const videoApi = {
  // Get personalized video feed
  // Cursor-paginated. `feed` selects the explore tab (for-you default, plus
  // 'following' and 'trending'); `type` filters by VideoType.
  getFeed: (params?: {
    limit?: number;
    cursor?: string;
    feed?: string;
    type?: string;
    // A topic slice: the homepage circles and a tapped #tag open the feed
    // filtered to one hashtag.
    hashtag?: string;
  }) => api.get('/video/feed', { params }),

  // Get single video
  getVideo: (id: string) => api.get(`/video/${id}`),

  // Create new video post. The fields mirror the Video model: topics are
  // `hashtags`, and the closest thing to a category is the VideoType `type`.
  create: (data: {
    title?: string;
    description?: string;
    videoUrl: string;
    thumbnailUrl?: string;
    duration?: number;
    type?: 'REEL' | 'STORY' | 'TUTORIAL' | 'CAREER_STORY' | 'MENTOR_TIP' | 'LIVE_REPLAY';
    aspectRatio?: string;
    hashtags?: string[];
    mentionedUserIds?: string[];
    location?: string;
  }) => api.post('/video', data),

  // Like a video
  like: (id: string) => api.post(`/video/${id}/like`),

  // Unlike a video
  unlike: (id: string) => api.delete(`/video/${id}/like`),

  // Bookmark/save a video
  bookmark: (id: string) => api.post(`/video/${id}/save`),

  // Remove bookmark
  unbookmark: (id: string) => api.delete(`/video/${id}/save`),

  // Get video comments
  getComments: (id: string, params?: { page?: number; limit?: number }) =>
    api.get(`/video/${id}/comments`, { params }),

  // Add a comment, or a reply when parentId names the comment being answered.
  addComment: (id: string, content: string, parentId?: string) =>
    api.post(`/video/${id}/comments`, parentId ? { content, parentId } : { content }),

  // Creator only: pin (or unpin) a top-level comment to the head of the thread.
  pinComment: (id: string, commentId: string) =>
    api.patch(`/video/${id}/comments/${commentId}/pin`),

  // The comment's author, the reel's creator, or an admin.
  deleteComment: (id: string, commentId: string) =>
    api.delete(`/video/${id}/comments/${commentId}`),

  // Share video
  share: (id: string, data: { title: string; url: string; description?: string; message?: string }) =>
    postApi.shareToFeed({
      ...data,
      entityType: 'video',
      entityId: id,
    }),

  // Report video. Reports go through the one safety pipeline rather than a
  // parallel per-module endpoint, so they pick up trust scoring and the
  // moderation queue for free.
  report: (id: string, reason: string, details?: string) =>
    safetyApi.createReport({ targetType: 'video', targetId: id, reason, details }),

  // Track view. The server requires completionPct alongside watchDuration.
  trackView: (id: string, watchDuration: number, completionPct: number, source?: string) =>
    api.post(`/video/${id}/view`, { watchDuration, completionPct, source }),

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
  leave: (id: string) => api.delete(`/channels/${id}/leave`),

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

  // Typing indicator. Clients holding a live socket should emit
  // `channels:typing` instead; this is the HTTP-only fallback.
  startTyping: (id: string) => api.post(`/channels/${id}/typing`, {}),

  stopTyping: (id: string) => api.post(`/channels/${id}/typing`, { stopped: true }),

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
  // Param names match what apprenticeship.routes.ts actually reads. It has no
  // `industry` or `location`: the training package is `framework` and the
  // place is `city`, and `level` must be an ApprenticeshipLevel enum value.
  getAll: (params?: {
    page?: number;
    limit?: number;
    framework?: string;
    level?: string;
    city?: string;
    country?: string;
    remote?: boolean;
    search?: string;
    status?: string;
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

  // The competencies defined for an apprenticeship, in order.
  getMilestones: (id: string) => api.get(`/apprenticeships/${id}/milestones`),

  // Provider-only: define a competency on their own apprenticeship.
  createMilestone: (id: string, data: {
    title: string;
    description?: string;
    orderIndex: number;
    competencyCode?: string;
  }) => api.post(`/apprenticeships/${id}/milestones`, data),

  // Track progress. Only available once the placement is ACCEPTED — progress is
  // tracked against the application, so merely having applied returns 403.
  getProgress: (id: string) => api.get(`/apprenticeships/${id}/progress`),

  // Submit milestone. Resubmitting after a rejection replaces the evidence and
  // clears the previous review; an approved milestone cannot be reopened.
  submitMilestone: (apprenticeshipId: string, milestoneId: string, data: {
    notes?: string;
    attachments?: string[];
  }) => api.post(`/apprenticeships/${apprenticeshipId}/milestones/${milestoneId}/submit`, data),

  // Provider-only: sign a submission off or send it back.
  reviewSubmission: (submissionId: string, data: {
    status: 'APPROVED' | 'REJECTED';
    reviewNotes?: string;
  }) => api.patch(`/apprenticeships/milestones/submissions/${submissionId}`, data),

  // Record of completion, issued once every milestone is approved. 409s while
  // any are outstanding. This is an ATHENA record, not an AQF qualification.
  getCertificate: (id: string) => api.get(`/apprenticeships/${id}/certificate`),
};

// ============================================
// SKILLS MARKETPLACE API
// ============================================
export const skillsMarketplaceApi = {
  // Get all services/gigs
  // Param names match what skills-marketplace.routes.ts actually reads. The
  // route has no deliveryTime or rating filter, and prices are minRate/maxRate.
  getServices: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    minRate?: number;
    maxRate?: number;
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

  // Archives the listing rather than destroying it — orders, bookings and
  // reviews hang off the service and would cascade away with it.
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

  // Leave review. Only a completed order can be reviewed, and only by its
  // buyer. ServiceReview stores a single 1-5 rating, so there are no separate
  // communication/service/recommend dimensions to send.
  leaveReview: (orderId: string, data: { rating: number; review?: string }) =>
    api.post(`/skills-marketplace/orders/${orderId}/review`, data),

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
    category: 'PROFESSIONAL' | 'CREATIVE' | 'TECHNICAL' | 'COACHING' | 'TEACHING';
    budget: { min: number; max: number };
    deliveryDays: number;
    attachments?: string[];
  }) => api.post('/skills-marketplace/requests', data),

  // Browse open requests to pitch on. Excludes the caller's own briefs and
  // carries `myProposal` so the UI knows whether they have already pitched.
  getCustomRequests: (params?: { category?: string; page?: number; limit?: number }) =>
    api.get('/skills-marketplace/requests', { params }),

  // The caller's own briefs, with a proposal count on each.
  getMyRequests: () => api.get('/skills-marketplace/requests/me'),

  // The buyer sees every proposal; a provider sees only their own.
  getCustomRequest: (id: string) => api.get(`/skills-marketplace/requests/${id}`),

  // Submit proposal for request. Pitching again revises the existing proposal.
  submitProposal: (requestId: string, data: {
    message: string;
    price: number;
    deliveryDays: number;
  }) => api.post(`/skills-marketplace/requests/${requestId}/proposal`, data),

  // Buyer picks a winner: the rest are declined and the brief stops taking pitches.
  acceptProposal: (requestId: string, proposalId: string) =>
    api.post(`/skills-marketplace/requests/${requestId}/proposals/${proposalId}/accept`),

  closeRequest: (requestId: string) =>
    api.post(`/skills-marketplace/requests/${requestId}/close`),
};

export default {
  video: videoApi,
  channels: channelApi,
  apprenticeships: apprenticeshipApi,
  skillsMarketplace: skillsMarketplaceApi,
};
