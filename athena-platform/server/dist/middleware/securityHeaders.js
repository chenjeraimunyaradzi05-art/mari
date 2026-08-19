"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityHeaders = securityHeaders;
const origins_1 = require("../utils/origins");
/**
 * Security Headers Middleware
 * Implements OWASP best practices for HTTP security headers
 */
function securityHeaders(req, res, next) {
    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    // HSTS (HTTP Strict Transport Security)
    // Forces HTTPS for 1 year, includes subdomains
    if (isProduction) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    // X-Content-Type-Options: prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // X-Frame-Options: prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // X-XSS-Protection: legacy XSS filter (mostly deprecated, but good for defense-in-depth)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Cross-origin isolation posture for modern browsers while preserving auth popups.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    // Referrer-Policy: control how much referrer info is shared
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions-Policy (formerly Feature-Policy): restrict APIs
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');
    // Content Security Policy (CSP)
    // Prevent XSS by controlling where resources can be loaded from
    const connectOrigins = Array.from(new Set([frontendUrl, ...(0, origins_1.getAllowedOrigins)()])).join(' ');
    const devCspDirectives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        `connect-src 'self' ${connectOrigins} wss: ws:`,
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "media-src 'self' blob: https:",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ];
    const prodCspDirectives = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        `connect-src 'self' ${connectOrigins} wss:`,
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "media-src 'self' blob: https:",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ];
    res.setHeader('Content-Security-Policy', (isProduction ? prodCspDirectives : devCspDirectives).join('; '));
    // Expect-CT: Certificate Transparency
    if (isProduction) {
        res.setHeader('Expect-CT', 'max-age=86400, enforce');
    }
    next();
}
//# sourceMappingURL=securityHeaders.js.map