import { REGION_CONFIG, RegionKey } from '../config/regions';

type UserRegionLike = {
  region?: RegionKey | string | null;
  preferredCurrency?: string | null;
  preferredLocale?: string | null;
  timezone?: string | null;
};

export function normalizeRegion(region?: string | null): RegionKey {
  const normalized = (region || '').toUpperCase();
  if (normalized === 'US') return 'US';
  if (normalized === 'UK' || normalized === 'GB') return 'UK';
  if (normalized === 'EU') return 'EU';
  if (normalized === 'SEA') return 'SEA';
  if (normalized === 'MEA') return 'MEA';
  if (normalized === 'ROW') return 'ROW';
  if (['JP', 'KR', 'IN', 'BR', 'MX', 'LATAM', 'GLOBAL'].includes(normalized)) return 'ROW';
  return 'ANZ';
}

export function getRegionConfig(region?: string | null) {
  return REGION_CONFIG[normalizeRegion(region)];
}

export function getCurrencyForUser(user?: UserRegionLike | null): string {
  if (user?.preferredCurrency) {
    return user.preferredCurrency.toUpperCase();
  }
  return getRegionConfig(user?.region || null).defaultCurrency;
}

export function getLocaleForUser(user?: UserRegionLike | null): string {
  if (user?.preferredLocale) {
    return user.preferredLocale;
  }
  return getRegionConfig(user?.region || null).defaultLocale;
}

export function getTimezoneForUser(user?: UserRegionLike | null): string {
  if (user?.timezone) {
    return user.timezone;
  }
  return 'Australia/Sydney';
}
