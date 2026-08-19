"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllowedOrigins = getAllowedOrigins;
exports.arePreviewOriginsEnabled = arePreviewOriginsEnabled;
exports.isCorsOriginAllowed = isCorsOriginAllowed;
exports.getTrustedOriginFromHeaders = getTrustedOriginFromHeaders;
function getAllowedOrigins() {
    const configuredOrigins = [
        process.env.CLIENT_URL,
        process.env.FRONTEND_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.URL,
    ].filter((origin) => Boolean(origin));
    const localDevOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
    ].filter((origin) => Boolean(origin));
    const envOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    const platformOrigins = [process.env.NETLIFY_URL, process.env.DEPLOY_URL, process.env.DEPLOY_PRIME_URL].filter((origin) => Boolean(origin));
    return Array.from(new Set([
        ...envOrigins,
        ...platformOrigins,
        ...configuredOrigins,
        ...(process.env.NODE_ENV === 'production' ? [] : localDevOrigins),
    ]));
}
function arePreviewOriginsEnabled() {
    return process.env.NODE_ENV !== 'production' || process.env.CORS_ALLOW_PREVIEW_ORIGINS === 'true';
}
function isCorsOriginAllowed(origin) {
    if (!origin) {
        return true;
    }
    const allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.includes(origin)) {
        return true;
    }
    if (arePreviewOriginsEnabled()) {
        if (/^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(origin)) {
            return true;
        }
    }
    if (process.env.NODE_ENV !== 'production') {
        if (origin.match(/^https?:\/\/localhost(:\d+)?$/i) ||
            origin.match(/^https?:\/\/127\.0\.0\.1(:\d+)?$/i)) {
            return true;
        }
    }
    return false;
}
function getTrustedOriginFromHeaders(headers) {
    const rawOrigin = Array.isArray(headers.origin) ? headers.origin[0] : headers.origin;
    if (rawOrigin) {
        return rawOrigin;
    }
    const rawReferer = Array.isArray(headers.referer) ? headers.referer[0] : headers.referer;
    if (!rawReferer) {
        return undefined;
    }
    try {
        return new URL(rawReferer).origin;
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=origins.js.map