/**
 * The service shape `GET /api/skills-marketplace/services` actually returns.
 *
 * The previous interface was written against a Fiverr-shaped mock: it declared
 * `seller: {firstName, lastName, avatarUrl, level, completedOrders}`, an
 * `images` gallery, a `subcategory` and `ordersInQueue`. None of those columns
 * exist. `SkillService` has a `provider` relation selected as
 * `{id, displayName, avatar, headline}`, an `hourlyRate` in whole dollars, a
 * `packages` JSON array, `tags`, `rating`, `reviewCount` and `completedCount`.
 *
 * Prices are AUD: the platform bills Australian providers, and the old card
 * formatted every rate as USD.
 */

/** Exactly `enum ServiceCategory` in schema.prisma. */
export const SERVICE_CATEGORIES = [
  'PROFESSIONAL',
  'CREATIVE',
  'TECHNICAL',
  'COACHING',
  'TEACHING',
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

/** The enum value goes to the server; the label goes on screen. */
export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  PROFESSIONAL: 'Professional services',
  CREATIVE: 'Creative',
  TECHNICAL: 'Technical',
  COACHING: 'Coaching',
  TEACHING: 'Teaching',
};

export function categoryLabel(category: string): string {
  return (
    CATEGORY_LABELS[category as ServiceCategory] ??
    category.charAt(0) + category.slice(1).toLowerCase()
  );
}

export interface ServicePackage {
  name: string;
  description?: string;
  price: number;
  deliveryDays: number;
  revisions?: number;
  features?: string[];
}

export interface ServiceProvider {
  id: string;
  displayName?: string | null;
  avatar?: string | null;
  headline?: string | null;
}

export interface SkillService {
  id: string;
  title: string;
  description: string;
  category: ServiceCategory | string;
  status?: string;
  /** Whole dollars per hour. */
  hourlyRate: number;
  minimumHours?: number;
  isAvailable?: boolean;
  completedCount?: number;
  /** Null until the service has been reviewed at least once. */
  rating?: number | null;
  reviewCount?: number;
  tags?: string[];
  /** Free-form JSON; validated by `readPackages` before use. */
  packages?: unknown;
  createdAt: string;

  provider?: ServiceProvider | null;

  /** Added by the server for a signed-in viewer; absent when signed out. */
  isFavorite?: boolean;
}

/**
 * `packages` is a Json column, so it can be null, an object, or an array of
 * anything. Only well-formed entries survive — a malformed one would otherwise
 * put NaN through the price maths.
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
        features: Array.isArray(obj.features)
          ? obj.features.filter((f): f is string => typeof f === 'string')
          : undefined,
      },
    ];
  });
}

export function formatAud(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * What the buyer pays to start: the cheapest package if there are any,
 * otherwise the hourly rate times the provider's minimum booking.
 */
export function startingPrice(service: SkillService): { amount: number; unit: string } | null {
  const packages = readPackages(service.packages);
  if (packages.length > 0) {
    return { amount: Math.min(...packages.map((p) => p.price)), unit: 'package' };
  }
  if (service.hourlyRate > 0) {
    const hours = service.minimumHours && service.minimumHours > 1 ? service.minimumHours : 1;
    return {
      amount: service.hourlyRate * hours,
      unit: hours > 1 ? `${hours} hr minimum` : 'hour',
    };
  }
  return null;
}

export function quickestDelivery(service: SkillService): number | null {
  const packages = readPackages(service.packages);
  if (packages.length === 0) return null;
  const days = packages.map((p) => p.deliveryDays).filter((d) => d > 0);
  return days.length ? Math.min(...days) : null;
}

export function providerName(service: SkillService): string {
  return service.provider?.displayName?.trim() || 'ATHENA member';
}

/** Initials for the avatar fallback, from a display name of any word count. */
export function providerInitials(service: SkillService): string {
  const name = providerName(service);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'A';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
