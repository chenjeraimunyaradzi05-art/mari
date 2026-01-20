"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRegion = normalizeRegion;
exports.getRegionConfig = getRegionConfig;
exports.getCurrencyForUser = getCurrencyForUser;
exports.getLocaleForUser = getLocaleForUser;
exports.getTimezoneForUser = getTimezoneForUser;
const regions_1 = require("../config/regions");
function normalizeRegion(region) {
    const normalized = (region || '').toUpperCase();
    if (normalized === 'US')
        return 'US';
    if (normalized === 'UK' || normalized === 'GB')
        return 'UK';
    if (normalized === 'EU')
        return 'EU';
    if (normalized === 'SEA')
        return 'SEA';
    if (normalized === 'MEA')
        return 'MEA';
    if (normalized === 'ROW')
        return 'ROW';
    if (['JP', 'KR', 'IN', 'BR', 'MX', 'LATAM', 'GLOBAL'].includes(normalized))
        return 'ROW';
    return 'ANZ';
}
function getRegionConfig(region) {
    return regions_1.REGION_CONFIG[normalizeRegion(region)];
}
function getCurrencyForUser(user) {
    if (user?.preferredCurrency) {
        return user.preferredCurrency.toUpperCase();
    }
    return getRegionConfig(user?.region || null).defaultCurrency;
}
function getLocaleForUser(user) {
    if (user?.preferredLocale) {
        return user.preferredLocale;
    }
    return getRegionConfig(user?.region || null).defaultLocale;
}
function getTimezoneForUser(user) {
    if (user?.timezone) {
        return user.timezone;
    }
    return 'Australia/Sydney';
}
//# sourceMappingURL=region.js.map