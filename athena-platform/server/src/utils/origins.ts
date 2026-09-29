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

const NETLIFY_SITE_HOST = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.netlify\.app$/i;

/**
 * The Netlify site names this deployment's own front end is served from,
 * read from the front-end URLs the operator configured (CLIENT_URL first).
 * A custom domain names no Netlify site, so a deployment that only has one
 * admits no preview origins at all.
 */
export function ownNetlifySiteNames(): string[] {
  const names = new Set<string>();
  for (const configured of [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NETLIFY_URL,
    process.env.URL,
  ]) {
    if (!configured) continue;
    try {
      // A deploy URL (prefix--site) does not match: the name has to come
      // from the site's own address, not from one of its deploys.
      const match = NETLIFY_SITE_HOST.exec(new URL(configured).hostname);
      if (match) names.add(match[1].toLowerCase());
    } catch {
      // Not a URL; it names no site.
    }
  }
  return Array.from(names);
}

/**
 * A deploy preview, branch deploy or deploy permalink of this deployment's
 * own site: deploy-preview-12--athena-empress.netlify.app and the like.
 *
 * The rule used to be any https://<anything>.netlify.app, which with the
 * preview flag on gave every free Netlify site on the internet credentialed
 * CORS against this API: a page anyone could publish in a minute could read
 * a signed-in member's messages with her cookie. Netlify separates a deploy's
 * prefix from its site with "--" and does not issue site names containing
 * it, so "<prefix>--<our site>" is ours; the prefix itself may not contain
 * "--" either.
 */
function isOwnNetlifyPreview(origin: string): boolean {
  const sites = ownNetlifySiteNames();
  if (sites.length === 0) return false;
  let host: string;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.port || url.origin !== origin) return false;
    host = url.hostname.toLowerCase();
  } catch {
    return false;
  }
  const preview = /^(deploy-preview-\d+|[a-z0-9]+(?:-[a-z0-9]+)*)--([a-z0-9]+(?:-[a-z0-9]+)*)\.netlify\.app$/.exec(host);
  return Boolean(preview && sites.includes(preview[2]));
}

export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (arePreviewOriginsEnabled() && isOwnNetlifyPreview(origin)) {
    return true;
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
