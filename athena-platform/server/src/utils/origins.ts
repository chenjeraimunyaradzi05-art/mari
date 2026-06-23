export function getAllowedOrigins(): string[] {
  const configuredOrigins = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.URL,
  ].filter((origin): origin is string => Boolean(origin));

  const localDevOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
  ].filter((origin): origin is string => Boolean(origin));

  const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const platformOrigins = [process.env.NETLIFY_URL, process.env.DEPLOY_URL, process.env.DEPLOY_PRIME_URL].filter(
    (origin): origin is string => Boolean(origin)
  );

  return Array.from(
    new Set([
      ...envOrigins,
      ...platformOrigins,
      ...configuredOrigins,
      ...(process.env.NODE_ENV === 'production' ? [] : localDevOrigins),
    ])
  );
}

export function arePreviewOriginsEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.CORS_ALLOW_PREVIEW_ORIGINS === 'true';
}

export function isCorsOriginAllowed(origin: string | undefined): boolean {
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

export function getTrustedOriginFromHeaders(headers: {
  origin?: string | string[];
  referer?: string | string[];
}): string | undefined {
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
  } catch {
    return undefined;
  }
}
