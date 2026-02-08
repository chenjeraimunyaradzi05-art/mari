import { Request, Response, NextFunction } from 'express';

/**
 * Security Headers Middleware
 * Implements OWASP best practices for HTTP security headers
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
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

  // Referrer-Policy: control how much referrer info is shared
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy (formerly Feature-Policy): restrict APIs
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  // Content Security Policy (CSP)
  // Prevent XSS by controlling where resources can be loaded from
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval required for TypeScript/Next.js HMR in dev
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${frontendUrl} wss: ws:`, // Allow WebSocket connections
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  if (isProduction) {
    // In production, strip unsafe tokens from directives but keep the directives themselves
    const prodCSP = cspDirectives
      .map((d) => d.replace(/'unsafe-inline'/g, '').replace(/'unsafe-eval'/g, '').replace(/\s{2,}/g, ' ').trim())
      .filter(Boolean)
      .join('; ');
    res.setHeader('Content-Security-Policy', prodCSP);
  } else {
    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  }

  // Expect-CT: Certificate Transparency
  if (isProduction) {
    res.setHeader('Expect-CT', 'max-age=86400, enforce');
  }

  next();
}
