/**
 * Super-app helpers: video, community channels, apprenticeships and the
 * skills marketplace.
 *
 * Every helper names the path and verb the server actually serves (the route
 * files under server/src/routes are the source of truth), and
 * server/scripts/check-api-contract.js walks this file, so a helper that
 * drifts from a route fails that check instead of 404ing on a phone. The
 * interfaces are the rows those routes return: list routes answer
 * `{ success, data: [...], pagination? }`, so a screen reads them with
 * unwrapApiData and gets the array. The old shapes here (`data.videos`,
 * `data.channels`, `provider.rating`, `deliveryTime`) described a mock server
 * that never existed, which is why the tabs rendered empty.
 */
import { api } from './api';

// ==========================================
// VIDEO
// ==========================================

export interface VideoPost {
  id: string;
  authorId: string;
  author: { id: string; displayName: string | null; avatar: string | null; headline?: string | null };
  videoUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  description: string | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  /** The viewer's own state, attached by the server for a signed-in member. */
  isLiked: boolean;
  isSaved: boolean;
  hashtags: string[];
  createdAt: string;
}

/** The explore tabs. The default (no `feed`) is the newest reels. */
export type VideoFeedKind = 'following' | 'trending';

export const videoApi = {
  // Cursor-paginated: the response carries `nextCursor`, null at the end.
  getFeed: (params?: { limit?: number; cursor?: string; feed?: VideoFeedKind; type?: string; hashtag?: string }) =>
    api.get('/video/feed', { params }),

  getVideo: (id: string) => api.get(`/video/${id}`),

  likeVideo: (id: string) => api.post(`/video/${id}/like`),

  unlikeVideo: (id: string) => api.delete(`/video/${id}/like`),

  saveVideo: (id: string) => api.post(`/video/${id}/save`),

  unsaveVideo: (id: string) => api.delete(`/video/${id}/save`),

  getComments: (id: string, params?: { page?: number; limit?: number }) =>
    api.get(`/video/${id}/comments`, { params }),

  addComment: (id: string, content: string) => api.post(`/video/${id}/comments`, { content }),

  // The server wants how long was watched and how far through, not a bare
  // watch time.
  recordView: (id: string, watchDuration: number, completionPct: number) =>
    api.post(`/video/${id}/view`, { watchDuration, completionPct, source: 'mobile' }),

  getTrending: (params?: { period?: 'day' | 'week' | 'month'; limit?: number }) =>
    api.get('/video/trending', { params }),

  getByCategory: (category: string, params?: { page?: number; limit?: number }) =>
    api.get(`/video/category/${category}`, { params }),
};

// ==========================================
// COMMUNITY CHANNELS
// ==========================================

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  /** A ChannelType enum value such as COMMUNITY_CHANNEL. */
  type: string;
  isPublic: boolean;
  allowReplies: boolean;
  memberCount: number;
  messageCount: number;
  avatarUrl: string | null;
  ownerId: string;
  owner?: { id: string; displayName: string | null; avatar: string | null };
  createdAt: string;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  mediaUrls?: unknown;
  isPinned?: boolean;
  createdAt: string;
  author: { id: string; displayName: string | null; avatar: string | null };
  reactions?: Array<{ emoji: string; count: number; hasReacted: boolean }>;
}

export const channelApi = {
  // Public channels plus the ones the member belongs to.
  getChannels: (params?: { page?: number; limit?: number; search?: string; type?: string }) =>
    api.get('/channels', { params }),

  // Public channels the member has not joined. This is the search route;
  // /channels/search never existed and fell through to the id handler.
  discover: (params?: { search?: string; category?: string; page?: number; limit?: number }) =>
    api.get('/channels/discover', { params }),

  getChannel: (id: string) => api.get(`/channels/${id}`),

  // A channel made from the phone is a community channel its members can
  // post in; broadcast channels (employer, mentor, creator) are set up on the
  // web where the extra options live.
  createChannel: (data: { name: string; description?: string; isPublic: boolean }) =>
    api.post('/channels', { type: 'COMMUNITY_CHANNEL', allowReplies: true, ...data }),

  // Idempotent on the server: joining again answers "Already joined".
  joinChannel: (id: string) => api.post(`/channels/${id}/join`),

  leaveChannel: (id: string) => api.delete(`/channels/${id}/leave`),

  // Newest first, paginated.
  getMessages: (channelId: string, params?: { page?: number; limit?: number }) =>
    api.get(`/channels/${channelId}/messages`, { params }),

  sendMessage: (channelId: string, content: string) =>
    api.post(`/channels/${channelId}/messages`, { content }),

  getMembers: (channelId: string) => api.get(`/channels/${channelId}/members`),
};

// ==========================================
// APPRENTICESHIPS
// ==========================================

export interface Apprenticeship {
  id: string;
  title: string;
  slug: string;
  description: string;
  /** The training package, e.g. "Electrotechnology". */
  framework: string;
  /** An ApprenticeshipLevel enum value such as CERTIFICATE_III. */
  level: string;
  durationMonths: number;
  wageMin: number | null;
  wageMax: number | null;
  city: string | null;
  state: string | null;
  country: string;
  isRemote: boolean;
  positions: number;
  positionsFilled?: number;
  status: string;
  startDate: string | null;
  applicationDeadline: string | null;
  publishedAt: string | null;
  createdAt: string;
  rto: { id: string; name: string; logo: string | null } | null;
  hostEmployer: { id: string; name: string; logo: string | null } | null;
  /** Attached for a signed-in viewer. */
  isBookmarked?: boolean;
}

export interface ApprenticeshipFramework {
  name: string;
  count: number;
}

export interface ApprenticeshipApplication {
  id: string;
  status: string;
  submittedAt: string;
  apprenticeship: { id: string; title: string; slug: string; status: string };
}

export const apprenticeshipApi = {
  // Param names are what apprenticeship.routes.ts reads: there is no
  // `industry` or `location`; the training package is `framework` and the
  // place is `city`.
  getList: (params?: {
    page?: number;
    limit?: number;
    framework?: string;
    level?: string;
    city?: string;
    remote?: boolean;
    search?: string;
  }) => api.get('/apprenticeships', { params }),

  // The open listings' frameworks and levels, each with a count.
  getCategories: () => api.get('/apprenticeships/categories'),

  getDetail: (id: string) => api.get(`/apprenticeships/${id}`),

  apply: (id: string, data: { coverLetter?: string; resumeUrl?: string }) =>
    api.post(`/apprenticeships/${id}/apply`, data),

  getApplications: () => api.get('/apprenticeships/applications/me'),

  bookmark: (id: string) => api.post(`/apprenticeships/${id}/bookmark`),

  unbookmark: (id: string) => api.delete(`/apprenticeships/${id}/bookmark`),
};

/** "CERTIFICATE_III" reads as "Certificate III" on a card. */
export function apprenticeshipLevelLabel(level: string): string {
  const [kind, numeral] = level.split('_');
  const word = kind.charAt(0) + kind.slice(1).toLowerCase();
  return numeral ? `${word} ${numeral}` : word;
}

// ==========================================
// SKILLS MARKETPLACE
// ==========================================

/** Exactly `enum ServiceCategory` in schema.prisma, with the label shown on screen. */
export const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  PROFESSIONAL: 'Professional services',
  CREATIVE: 'Creative',
  TECHNICAL: 'Technical',
  COACHING: 'Coaching',
  TEACHING: 'Teaching',
};

export function categoryLabel(category: string): string {
  return SERVICE_CATEGORY_LABELS[category] ?? category.charAt(0) + category.slice(1).toLowerCase();
}

export interface ServicePackage {
  name: string;
  description?: string;
  price: number;
  deliveryDays: number;
  revisions?: number;
  features?: string[];
}

export interface MarketplaceService {
  id: string;
  title: string;
  description: string;
  category: string;
  status?: string;
  /** Whole Australian dollars per hour. */
  hourlyRate: number;
  minimumHours?: number;
  isAvailable?: boolean;
  completedCount?: number;
  /** Null until the service has its first review. */
  rating: number | null;
  reviewCount: number;
  tags?: string[];
  /** A Json column: validated by readPackages before use. */
  packages?: unknown;
  createdAt: string;
  provider: { id: string; displayName: string | null; avatar: string | null; headline?: string | null } | null;
  /** Attached for a signed-in viewer. */
  isFavorite?: boolean;
}

export interface ServiceCategoryCount {
  category: string;
  count: number;
}

export interface ServiceReview {
  id: string;
  rating: number;
  content: string | null;
  response: string | null;
  createdAt: string;
  client: { id: string; displayName: string | null; avatar: string | null };
}

export interface ServiceOrder {
  id: string;
  packageIndex: number;
  packageName: string | null;
  requirements: string | null;
  /** A ServiceOrderStatus enum value. */
  status: string;
  /** Whole Australian dollars. */
  totalAmount: number;
  deliveryDays: number | null;
  dueAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  createdAt: string;
  service: { id: string; title: string; provider: { id: string; displayName: string | null; avatar: string | null } };
  escrow: { status: string; amount: number; currency: string } | null;
}

/**
 * `packages` is a Json column, so it can be null, an object, or an array of
 * anything. Only well-formed entries survive, so a malformed one cannot put
 * NaN through the price maths.
 */
export function readPackages(value: unknown): ServicePackage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const obj = item as Record<string, unknown>;
    const price = Number(obj.price);
    const deliveryDays = Number(obj.deliveryDays);
    if (!Number.isFinite(price)) return [];
    return [
      {
        name: typeof obj.name === 'string' ? obj.name : 'Package',
        description: typeof obj.description === 'string' ? obj.description : undefined,
        price,
        deliveryDays: Number.isFinite(deliveryDays) ? deliveryDays : 0,
        revisions: Number.isFinite(Number(obj.revisions)) ? Number(obj.revisions) : undefined,
        features: Array.isArray(obj.features) ? obj.features.filter((f): f is string => typeof f === 'string') : undefined,
      },
    ];
  });
}

export function formatAud(amount: number): string {
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `$${Math.round(amount)}`;
  }
}

/**
 * What a buyer pays to start: the cheapest package if there are any,
 * otherwise the hourly rate times the provider's minimum booking.
 */
export function startingPrice(service: MarketplaceService): { amount: number; unit: string } | null {
  const packages = readPackages(service.packages);
  if (packages.length > 0) {
    return { amount: Math.min(...packages.map((p) => p.price)), unit: 'package' };
  }
  if (service.hourlyRate > 0) {
    const hours = service.minimumHours && service.minimumHours > 1 ? service.minimumHours : 1;
    return { amount: service.hourlyRate * hours, unit: hours > 1 ? `${hours} hr minimum` : 'hour' };
  }
  return null;
}

export function providerName(service: { provider?: { displayName?: string | null } | null }): string {
  return service.provider?.displayName?.trim() || 'ATHENA member';
}

export const skillsMarketplaceApi = {
  // Param names are what skills-marketplace.routes.ts reads: prices filter on
  // the hourly rate as minRate/maxRate, and there is no sort parameter (the
  // server orders by rating, then newest).
  getServices: (params?: { page?: number; limit?: number; search?: string; category?: string; minRate?: number; maxRate?: number }) =>
    api.get('/skills-marketplace/services', { params }),

  getService: (id: string) => api.get(`/skills-marketplace/services/${id}`),

  // Every category with how many live services it has.
  getCategories: () => api.get('/skills-marketplace/categories'),

  getReviews: (serviceId: string, params?: { page?: number; limit?: number }) =>
    api.get(`/skills-marketplace/services/${serviceId}/reviews`, { params }),

  favourite: (id: string) => api.post(`/skills-marketplace/services/${id}/favorite`),

  unfavourite: (id: string) => api.delete(`/skills-marketplace/services/${id}/favorite`),

  getFavourites: () => api.get('/skills-marketplace/favorites'),

  // Opens an order whose card hold must then be authorised on the web, which
  // is why the app sends a buyer to the web listing instead of calling this.
  // Kept so the contract check sees the real body shape.
  placeOrder: (serviceId: string, data: { packageIndex: number; requirements?: string }) =>
    api.post(`/skills-marketplace/services/${serviceId}/order`, data),

  getMyOrders: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/skills-marketplace/orders/me', { params }),

  getOrder: (id: string) => api.get(`/skills-marketplace/orders/${id}`),
};

/** "REVISION_REQUESTED" reads as "Revision requested" on a card. */
export function orderStatusLabel(status: string): string {
  const words = status.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
