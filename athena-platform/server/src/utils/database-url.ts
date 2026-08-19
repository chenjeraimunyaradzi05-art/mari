type EnvLike = Record<string, string | undefined>;

const DATABASE_URL_KEYS = [
  'DATABASE_URL',
  'NETLIFY_DB_URL',
  'NETLIFY_DATABASE_URL',
  'NEON_DATABASE_URL',
] as const;

const DIRECT_DATABASE_URL_KEYS = [
  'DIRECT_DATABASE_URL',
  'DATABASE_DIRECT_URL',
  'DIRECT_URL',
  'NEON_DIRECT_DATABASE_URL',
] as const;

type DatabaseUrlSource =
  | (typeof DATABASE_URL_KEYS)[number]
  | (typeof DIRECT_DATABASE_URL_KEYS)[number]
  | 'derived';

type NeonUrlMode = 'pooled' | 'direct';

export interface ResolvedDatabaseUrls {
  databaseUrl?: string;
  databaseUrlSource?: DatabaseUrlSource;
  directDatabaseUrl?: string;
  directDatabaseUrlSource?: DatabaseUrlSource;
  directDatabaseUrlWasDerived: boolean;
}

function readFirst(env: EnvLike, keys: readonly string[]) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) {
      return { key, value };
    }
  }

  return null;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isPostgresConnectionString(value: string): boolean {
  return value.startsWith('postgres://') || value.startsWith('postgresql://');
}

export function isNeonConnectionString(value: string): boolean {
  const url = parseUrl(value);
  return url ? url.hostname.endsWith('.neon.tech') : value.includes('.neon.tech');
}

function normalizeNeonUrl(value: string, mode?: NeonUrlMode): string {
  const url = parseUrl(value);
  if (!url || !url.hostname.endsWith('.neon.tech')) {
    return value;
  }

  const isPooledHost = url.hostname.includes('-pooler.');
  const urlMode = mode ?? (isPooledHost ? 'pooled' : 'direct');

  url.searchParams.set('sslmode', 'require');

  if (!url.searchParams.has('channel_binding')) {
    url.searchParams.set('channel_binding', 'require');
  }

  if (!url.searchParams.has('connect_timeout')) {
    url.searchParams.set('connect_timeout', '15');
  }

  if (urlMode === 'pooled') {
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '15');
    }
  } else {
    url.searchParams.delete('pool_timeout');
  }

  return url.toString();
}

export function deriveDirectDatabaseUrl(databaseUrl?: string | null): string | undefined {
  if (!databaseUrl) {
    return undefined;
  }

  const url = parseUrl(databaseUrl);
  if (!url) {
    return databaseUrl;
  }

  if (url.hostname.endsWith('.neon.tech') && url.hostname.includes('-pooler.')) {
    url.hostname = url.hostname.replace('-pooler.', '.');
    return normalizeNeonUrl(url.toString(), 'direct');
  }

  return normalizeNeonUrl(databaseUrl, 'direct');
}

export function resolveDatabaseUrls(env: EnvLike = process.env): ResolvedDatabaseUrls {
  const database = readFirst(env, DATABASE_URL_KEYS);
  const direct = readFirst(env, DIRECT_DATABASE_URL_KEYS);
  const databaseUrl = database ? normalizeNeonUrl(database.value) : undefined;
  const directDatabaseUrl = direct ? normalizeNeonUrl(direct.value, 'direct') : undefined;
  const derivedDirectUrl = directDatabaseUrl ? undefined : deriveDirectDatabaseUrl(databaseUrl);

  return {
    databaseUrl,
    databaseUrlSource: database?.key as DatabaseUrlSource | undefined,
    directDatabaseUrl: directDatabaseUrl || derivedDirectUrl,
    directDatabaseUrlSource: direct
      ? (direct.key as DatabaseUrlSource)
      : derivedDirectUrl
        ? 'derived'
        : undefined,
    directDatabaseUrlWasDerived: Boolean(!directDatabaseUrl && derivedDirectUrl),
  };
}

export function applyDatabaseUrlDefaults(env: EnvLike = process.env): ResolvedDatabaseUrls {
  const resolved = resolveDatabaseUrls(env);

  if (resolved.databaseUrl) {
    env.DATABASE_URL = resolved.databaseUrl;
  }

  if (resolved.directDatabaseUrl) {
    env.DIRECT_DATABASE_URL = resolved.directDatabaseUrl;
    if (resolved.directDatabaseUrlWasDerived) {
      env.ATHENA_DIRECT_DATABASE_URL_DERIVED = 'true';
    }
  }

  return resolved;
}
