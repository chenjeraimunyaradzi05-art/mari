const DEFAULT_PUBLIC_APP_URL = 'https://athena-empress.netlify.app';
const DEFAULT_BACKEND_API_URL = 'https://api.athena.app';

const STATIC_PUBLIC_ENV = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  NEXT_PUBLIC_ENABLE_DEMO_FALLBACKS: process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACKS,
  NEXT_PUBLIC_ENABLE_PUBLIC_FALLBACKS: process.env.NEXT_PUBLIC_ENABLE_PUBLIC_FALLBACKS,
} as const;

function normalizeUrl(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, '');
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`.replace(/\/$/, '');
  }

  if (/^(localhost|127(?:\.\d{1,3}){3})(:\d+)?$/i.test(trimmed)) {
    return `http://${trimmed}`.replace(/\/$/, '');
  }

  return `https://${trimmed}`.replace(/\/$/, '');
}

function readServerEnv(key: string): string | null {
  if (typeof window !== 'undefined') {
    return null;
  }

  return normalizeUrl(process.env[key]);
}

function readPublicEnv(key: keyof typeof STATIC_PUBLIC_ENV): string | null {
  return normalizeUrl(STATIC_PUBLIC_ENV[key]);
}

function readFirst(keys: string[]): string | null {
  for (const key of keys) {
    const serverValue = readServerEnv(key);
    if (serverValue) {
      return serverValue;
    }

    if (key in STATIC_PUBLIC_ENV) {
      const publicValue = readPublicEnv(key as keyof typeof STATIC_PUBLIC_ENV);
      if (publicValue) {
        return publicValue;
      }
    }
  }

  return null;
}

function isProductionLike(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getAppSiteUrl(): string {
  if (typeof window !== 'undefined') {
    return normalizeUrl(window.location.origin) ?? DEFAULT_PUBLIC_APP_URL;
  }

  return (
    readFirst([
      'URL',
      'DEPLOY_PRIME_URL',
      'SITE_URL',
      'NEXT_PUBLIC_APP_URL',
      'NEXT_PUBLIC_SITE_URL',
    ]) ?? (isProductionLike() ? DEFAULT_PUBLIC_APP_URL : 'http://localhost:3000')
  );
}

export function getBackendApiUrl(): string {
  return (
    readFirst([
      'API_URL',
      'BACKEND_URL',
      'NEXT_PRIVATE_API_URL',
      'DEPLOY_URL',
      'NEXT_PUBLIC_API_URL',
    ]) ?? (isProductionLike() ? DEFAULT_BACKEND_API_URL : 'http://localhost:5000')
  );
}

export function getSocketOrigin(): string {
  return readFirst(['NEXT_PUBLIC_SOCKET_URL', 'NEXT_PUBLIC_WS_URL']) ?? getBackendApiUrl();
}

export function arePublicFallbacksEnabled(): boolean {
  const publicValue =
    STATIC_PUBLIC_ENV.NEXT_PUBLIC_ENABLE_PUBLIC_FALLBACKS ||
    STATIC_PUBLIC_ENV.NEXT_PUBLIC_ENABLE_DEMO_FALLBACKS;

  if (publicValue === 'true') {
    return true;
  }

  if (typeof window === 'undefined') {
    return process.env.ATHENA_ENABLE_PUBLIC_FALLBACKS === 'true';
  }

  return false;
}

export const APP_SITE_URL = getAppSiteUrl();
export const BACKEND_API_URL = getBackendApiUrl();
export const SOCKET_ORIGIN = getSocketOrigin();
