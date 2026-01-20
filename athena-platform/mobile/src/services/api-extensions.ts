/**
 * Video API Extensions for Mobile
 * Super App video feed endpoints
 */
import { api } from './api';

export interface VideoPost {
  id: string;
  authorId: string;
  author: {
    id: string;
    displayName: string;
    avatar: string | null;
  };
  videoUrl: string;
  thumbnailUrl: string | null;
  title: string;
  description: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  isLiked: boolean;
  tags: string[];
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: 'public' | 'private' | 'direct';
  memberCount: number;
  avatar: string | null;
  unreadCount: number;
  lastMessage: {
    content: string;
    authorName: string;
    createdAt: string;
  } | null;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  authorId: string;
  author: {
    id: string;
    displayName: string;
    avatar: string | null;
  };
  content: string;
  type: 'text' | 'image' | 'video' | 'system';
  createdAt: string;
  isOwn: boolean;
}

export interface Apprenticeship {
  id: string;
  title: string;
  organization: {
    id: string;
    name: string;
    logo: string | null;
  };
  location: string;
  type: 'full-time' | 'part-time';
  duration: string;
  salary: string | null;
  description: string;
  requirements: string[];
  industry: string;
  postedAt: string;
}

export interface MarketplaceService {
  id: string;
  title: string;
  provider: {
    id: string;
    displayName: string;
    avatar: string | null;
    rating: number;
  };
  category: string;
  price: number;
  pricingType: 'fixed' | 'hourly';
  description: string;
  deliveryTime: string;
  rating: number;
  reviewCount: number;
  thumbnailUrl: string | null;
}

// ==========================================
// VIDEO API
// ==========================================
export const videoApi = {
  getFeed: (params?: { page?: number; limit?: number; category?: string }) =>
    api.get<{ data: { videos: VideoPost[]; hasMore: boolean } }>('/videos/feed', { params }),
  
  getVideo: (id: string) =>
    api.get<{ data: VideoPost }>(`/videos/${id}`),
  
  likeVideo: (id: string) =>
    api.post(`/videos/${id}/like`),
  
  unlikeVideo: (id: string) =>
    api.delete(`/videos/${id}/like`),
  
  shareVideo: (id: string, targetType: 'channel' | 'user', targetId: string) =>
    api.post(`/videos/${id}/share`, { targetType, targetId }),
  
  getComments: (id: string, params?: { page?: number }) =>
    api.get(`/videos/${id}/comments`, { params }),
  
  addComment: (id: string, content: string) =>
    api.post(`/videos/${id}/comments`, { content }),
  
  recordView: (id: string, watchTime: number) =>
    api.post(`/videos/${id}/view`, { watchTime }),
  
  getTrending: (params?: { limit?: number }) =>
    api.get<{ data: { videos: VideoPost[] } }>('/videos/trending', { params }),
  
  getByCategory: (category: string, params?: { page?: number }) =>
    api.get<{ data: { videos: VideoPost[] } }>(`/videos/category/${category}`, { params }),
};

// ==========================================
// CHANNEL / CHAT API
// ==========================================
export const channelApi = {
  getChannels: () =>
    api.get<{ data: { channels: Channel[] } }>('/channels'),
  
  getChannel: (id: string) =>
    api.get<{ data: Channel }>(`/channels/${id}`),
  
  createChannel: (data: { name: string; description?: string; type: 'public' | 'private' }) =>
    api.post<{ data: Channel }>('/channels', data),
  
  joinChannel: (id: string) =>
    api.post(`/channels/${id}/join`),
  
  leaveChannel: (id: string) =>
    api.post(`/channels/${id}/leave`),
  
  getMessages: (channelId: string, params?: { page?: number; before?: string }) =>
    api.get<{ data: { messages: ChannelMessage[]; hasMore: boolean } }>(
      `/channels/${channelId}/messages`, { params }
    ),
  
  sendMessage: (channelId: string, content: string, type: 'text' | 'image' = 'text') =>
    api.post<{ data: ChannelMessage }>(
      `/channels/${channelId}/messages`, { content, type }
    ),
  
  searchChannels: (query: string) =>
    api.get<{ data: { channels: Channel[] } }>('/channels/search', { params: { q: query } }),
  
  getMembers: (channelId: string) =>
    api.get(`/channels/${channelId}/members`),
};

// ==========================================
// APPRENTICESHIP API
// ==========================================
export const apprenticeshipApi = {
  getList: (params?: { 
    page?: number; 
    industry?: string; 
    location?: string;
    type?: string;
  }) =>
    api.get<{ data: { apprenticeships: Apprenticeship[]; total: number } }>(
      '/apprenticeships', { params }
    ),
  
  getDetail: (id: string) =>
    api.get<{ data: Apprenticeship }>(`/apprenticeships/${id}`),
  
  apply: (id: string, data: { coverLetter: string; resumeUrl?: string }) =>
    api.post(`/apprenticeships/${id}/apply`, data),
  
  getApplications: () =>
    api.get('/apprenticeships/my-applications'),
  
  saveApprenticeship: (id: string) =>
    api.post(`/apprenticeships/${id}/save`),
  
  unsaveApprenticeship: (id: string) =>
    api.delete(`/apprenticeships/${id}/save`),
};

// ==========================================
// SKILLS MARKETPLACE API
// ==========================================
export const skillsMarketplaceApi = {
  getServices: (params?: {
    page?: number;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: 'rating' | 'price' | 'reviews';
  }) =>
    api.get<{ data: { services: MarketplaceService[]; total: number } }>(
      '/skills-marketplace/services', { params }
    ),
  
  getService: (id: string) =>
    api.get<{ data: MarketplaceService }>(`/skills-marketplace/services/${id}`),
  
  createOrder: (serviceId: string, data: { requirements: string; budget?: number }) =>
    api.post(`/skills-marketplace/services/${serviceId}/order`, data),
  
  getMyOrders: () =>
    api.get('/skills-marketplace/my-orders'),
  
  getCategories: () =>
    api.get<{ data: { categories: string[] } }>('/skills-marketplace/categories'),
  
  getReviews: (serviceId: string, params?: { page?: number }) =>
    api.get(`/skills-marketplace/services/${serviceId}/reviews`, { params }),
};
