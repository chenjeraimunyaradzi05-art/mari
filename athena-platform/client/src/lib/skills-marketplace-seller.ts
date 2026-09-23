/**
 * The selling half of the skills marketplace.
 *
 * `skillsMarketplaceApi.createService` in api-extensions.ts was written against
 * a Fiverr-shaped body — subcategory, images, faqs, and packages in place of a
 * rate — that `POST /api/skills-marketplace/services` has never accepted; any
 * call would have 400'd on the missing `hourlyRate`. Nothing ever called it, so
 * nobody found out. These helpers are typed against what the route validates,
 * so the seller screens cannot drift from the server again.
 *
 * Money is whole Australian dollars throughout, because that is what the
 * `hourlyRate` column stores and what the order route multiplies by 100 before
 * handing it to Stripe.
 */

import { api } from './api';

export const SERVICE_CATEGORY_VALUES = [
  'PROFESSIONAL',
  'CREATIVE',
  'TECHNICAL',
  'COACHING',
  'TEACHING',
] as const;

export type SellerServiceCategory = (typeof SERVICE_CATEGORY_VALUES)[number];

export type SellerServiceStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

/** A fixed-scope piece of work, as `POST /services/:id/order` prices it. */
export interface SellerPackage {
  name: string;
  description?: string;
  /** Whole dollars. */
  price: number;
  deliveryDays: number;
  revisions?: number;
  features?: string[];
}

export interface SellerServiceInput {
  title: string;
  description: string;
  category: SellerServiceCategory;
  /** Whole dollars per hour, at least 1. */
  hourlyRate: number;
  minimumHours?: number;
  isAvailable?: boolean;
  tags?: string[];
  packages?: SellerPackage[];
}

/** The same fields, all optional, plus the status only an edit can set. */
export type SellerServiceUpdate = Partial<SellerServiceInput> & {
  status?: SellerServiceStatus;
};

/** A row of `GET /services/me`, which includes paused and archived listings. */
export interface SellerService {
  id: string;
  providerId: string;
  title: string;
  description: string;
  category: string;
  status: SellerServiceStatus;
  hourlyRate: number;
  minimumHours: number;
  isAvailable: boolean;
  completedCount: number;
  rating: number | null;
  reviewCount: number;
  tags: string[];
  packages: unknown;
  createdAt: string;
  _count?: {
    orders: number;
    bookings: number;
    reviews: number;
    favorites: number;
  };
}

export const sellerApi = {
  listMine: () => api.get<{ data: SellerService[] }>('/skills-marketplace/services/me'),

  get: (id: string) => api.get<{ data: SellerService }>(`/skills-marketplace/services/${id}`),

  create: (data: SellerServiceInput) =>
    api.post<{ data: SellerService }>('/skills-marketplace/services', data),

  update: (id: string, data: SellerServiceUpdate) =>
    api.patch<{ data: SellerService }>(`/skills-marketplace/services/${id}`, data),

  /**
   * Archives rather than deletes: orders, bookings and reviews hang off the
   * listing and would cascade away with it.
   */
  archive: (id: string) =>
    api.delete<{ data: SellerService }>(`/skills-marketplace/services/${id}`),
};
