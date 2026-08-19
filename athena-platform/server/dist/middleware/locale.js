"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localeMiddleware = localeMiddleware;
const i18n_service_1 = require("../services/i18n.service");
const DEFAULT_LOCALE = 'en';
function normalizeLocale(locale) {
    if (!locale)
        return DEFAULT_LOCALE;
    const value = Array.isArray(locale) ? locale[0] : locale;
    if (!value)
        return DEFAULT_LOCALE;
    const normalized = value.trim();
    if (!normalized)
        return DEFAULT_LOCALE;
    if (i18n_service_1.SUPPORTED_LOCALES.includes(normalized)) {
        return normalized;
    }
    const base = normalized.split('-')[0];
    if (i18n_service_1.SUPPORTED_LOCALES.includes(base)) {
        return base;
    }
    return DEFAULT_LOCALE;
}
function parseAcceptLanguage(header) {
    if (!header)
        return DEFAULT_LOCALE;
    const candidates = header
        .split(',')
        .map((part) => part.trim().split(';')[0])
        .filter(Boolean);
    for (const candidate of candidates) {
        const resolved = normalizeLocale(candidate);
        if (resolved !== DEFAULT_LOCALE || candidate.startsWith('en')) {
            return resolved;
        }
    }
    return DEFAULT_LOCALE;
}
function localeMiddleware(req, _res, next) {
    const queryLocale = req.query.locale;
    const headerLocale = req.headers['x-locale'];
    const acceptLanguage = req.headers['accept-language'];
    const resolved = queryLocale
        ? normalizeLocale(queryLocale)
        : headerLocale
            ? normalizeLocale(headerLocale)
            : parseAcceptLanguage(acceptLanguage);
    req.locale = resolved;
    next();
}
//# sourceMappingURL=locale.js.map