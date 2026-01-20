import { RegionKey } from '../config/regions';
type UserRegionLike = {
    region?: RegionKey | string | null;
    preferredCurrency?: string | null;
    preferredLocale?: string | null;
    timezone?: string | null;
};
export declare function normalizeRegion(region?: string | null): RegionKey;
export declare function getRegionConfig(region?: string | null): import("../config/regions").RegionConfig;
export declare function getCurrencyForUser(user?: UserRegionLike | null): string;
export declare function getLocaleForUser(user?: UserRegionLike | null): string;
export declare function getTimezoneForUser(user?: UserRegionLike | null): string;
export {};
//# sourceMappingURL=region.d.ts.map