import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

type FeatureFlagRecord = {
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  allowList: string[];
  denyList: string[];
  tags: string[];
  metadata: Record<string, unknown> | null;
};

const prismaClient = prisma as typeof prisma & { featureFlag: any };

export interface FeatureFlagInput {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  allowList?: string[];
  denyList?: string[];
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  createdById?: string | null;
}

export interface FeatureFlagUpdate {
  name?: string;
  description?: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  allowList?: string[];
  denyList?: string[];
  tags?: string[];
  metadata?: Record<string, unknown> | null;
}

const clampPercentage = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const hashToBucket = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
};

export function evaluateFeatureFlag(
  flag: {
    enabled: boolean;
    rolloutPercentage: number;
    allowList: string[];
    denyList: string[];
    key: string;
  },
  userId?: string
) {
  if (!flag.enabled) return false;

  if (userId) {
    if (flag.denyList?.includes(userId)) return false;
    if (flag.allowList?.includes(userId)) return true;
  }

  const rollout = clampPercentage(flag.rolloutPercentage || 0);
  if (rollout <= 0) return false;
  if (rollout >= 100) return true;

  if (!userId) return false;

  const bucket = hashToBucket(`${userId}:${flag.key}`);
  return bucket < rollout;
}

export async function listFeatureFlags() {
  return prismaClient.featureFlag.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function getFeatureFlagByKey(key: string) {
  return prismaClient.featureFlag.findUnique({
    where: { key },
  });
}

export async function upsertFeatureFlag(data: FeatureFlagInput) {
  const rollout = data.rolloutPercentage ?? 100;

  return prismaClient.featureFlag.upsert({
    where: { key: data.key },
    create: {
      key: data.key,
      name: data.name,
      description: data.description,
      enabled: data.enabled ?? false,
      rolloutPercentage: clampPercentage(rollout),
      allowList: data.allowList || [],
      denyList: data.denyList || [],
      tags: data.tags || [],
      metadata: data.metadata === undefined ? undefined : data.metadata,
      createdById: data.createdById ?? undefined,
    },
    update: {
      name: data.name,
      description: data.description,
      enabled: data.enabled,
      rolloutPercentage: clampPercentage(rollout),
      allowList: data.allowList,
      denyList: data.denyList,
      tags: data.tags,
      metadata: data.metadata === undefined ? undefined : data.metadata,
    },
  });
}

export async function updateFeatureFlag(key: string, data: FeatureFlagUpdate) {
  const existing = await prismaClient.featureFlag.findUnique({ where: { key } });
  if (!existing) {
    throw new ApiError(404, 'Feature flag not found');
  }

  return prismaClient.featureFlag.update({
    where: { key },
    data: {
      name: data.name,
      description: data.description,
      enabled: data.enabled,
      rolloutPercentage: data.rolloutPercentage !== undefined
        ? clampPercentage(data.rolloutPercentage)
        : undefined,
      allowList: data.allowList,
      denyList: data.denyList,
      tags: data.tags,
      metadata: data.metadata === undefined ? undefined : data.metadata,
    },
  });
}

export async function deleteFeatureFlag(key: string) {
  const existing = await prismaClient.featureFlag.findUnique({ where: { key } });
  if (!existing) {
    throw new ApiError(404, 'Feature flag not found');
  }

  await prismaClient.featureFlag.delete({ where: { key } });
  return { success: true };
}

export async function getActiveFeatureFlagsForUser(userId?: string) {
  const flags = (await prismaClient.featureFlag.findMany({
    where: { enabled: true },
  })) as FeatureFlagRecord[];

  const active = flags.filter((flag) =>
    evaluateFeatureFlag(
      {
        enabled: flag.enabled,
        rolloutPercentage: flag.rolloutPercentage,
        allowList: flag.allowList || [],
        denyList: flag.denyList || [],
        key: flag.key,
      },
      userId
    )
  );

  return {
    flags: active.map((flag) => ({
      key: flag.key,
      name: flag.name,
      description: flag.description,
      rolloutPercentage: flag.rolloutPercentage,
      tags: flag.tags,
      metadata: flag.metadata,
    })),
  };
}

// ===========================================
// MAINTENANCE MODE
// ===========================================

/**
 * Maintenance mode rides on the feature flag table rather than a table of its
 * own: the launch runbook, the admin console, the request gate in index.ts and
 * the client's /maintenance page then all read one row instead of four ideas of
 * whether the platform is open. The key is fixed because those callers look it
 * up by name.
 */
export const MAINTENANCE_FLAG_KEY = 'maintenance_mode';

export const DEFAULT_MAINTENANCE_MESSAGE =
  'ATHENA is temporarily unavailable while we carry out maintenance. Please check back shortly.';

// Every API request consults the gate, so an uncached read would add a query per
// request. Five seconds is short enough that clearing maintenance during an
// incident takes effect before an operator can refresh the page.
const MAINTENANCE_CACHE_TTL_MS = 5_000;

export interface MaintenanceState {
  enabled: boolean;
  message: string;
  startedAt: string | null;
  endsAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface MaintenanceStateInput {
  enabled: boolean;
  message?: string | null;
  endsAt?: Date | null;
  actorId?: string | null;
}

const MAINTENANCE_OFF: MaintenanceState = {
  enabled: false,
  message: DEFAULT_MAINTENANCE_MESSAGE,
  startedAt: null,
  endsAt: null,
  updatedBy: null,
  updatedAt: null,
};

let maintenanceCache: { state: MaintenanceState; expiresAt: number } | null = null;

const asIsoOrNull = (value: unknown): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function toMaintenanceState(flag: FeatureFlagRecord | null): MaintenanceState {
  if (!flag) return MAINTENANCE_OFF;

  const metadata = (flag.metadata || {}) as Record<string, unknown>;
  const message = typeof metadata.message === 'string' && metadata.message.trim()
    ? metadata.message.trim()
    : DEFAULT_MAINTENANCE_MESSAGE;

  return {
    enabled: Boolean(flag.enabled),
    message,
    startedAt: asIsoOrNull(metadata.startedAt),
    endsAt: asIsoOrNull(metadata.endsAt),
    updatedBy: typeof metadata.updatedBy === 'string' ? metadata.updatedBy : null,
    updatedAt: asIsoOrNull(metadata.updatedAt),
  };
}

/**
 * Read the current maintenance state. Pass `fresh` from the admin console, where
 * an operator who just toggled the switch must not be shown a cached answer.
 */
export async function getMaintenanceState(options?: { fresh?: boolean }): Promise<MaintenanceState> {
  if (!options?.fresh && maintenanceCache && maintenanceCache.expiresAt > Date.now()) {
    return maintenanceCache.state;
  }

  try {
    const flag = (await prismaClient.featureFlag.findUnique({
      where: { key: MAINTENANCE_FLAG_KEY },
    })) as FeatureFlagRecord | null;

    const state = toMaintenanceState(flag);
    maintenanceCache = { state, expiresAt: Date.now() + MAINTENANCE_CACHE_TTL_MS };
    return state;
  } catch (error) {
    // The gate calls this on every request. If the flag cannot be read the
    // platform is already in trouble, and answering "closed" would lock out the
    // operator trying to fix it, so fail open — and cache that answer for the
    // usual TTL rather than re-querying a database that is already struggling.
    logger.warn('Could not read maintenance state; treating the platform as open', {
      error: error instanceof Error ? error.message : String(error),
    });
    maintenanceCache = { state: MAINTENANCE_OFF, expiresAt: Date.now() + MAINTENANCE_CACHE_TTL_MS };
    return MAINTENANCE_OFF;
  }
}

/**
 * Turn maintenance mode on or off.
 *
 * `startedAt` is stamped only on the transition into maintenance so that
 * re-posting a new banner message part-way through an incident does not reset
 * how long the platform has been down.
 */
export async function setMaintenanceState(input: MaintenanceStateInput): Promise<MaintenanceState> {
  const current = await getMaintenanceState({ fresh: true });
  const now = new Date();

  const message = typeof input.message === 'string' && input.message.trim()
    ? input.message.trim()
    : current.enabled && input.enabled
      ? current.message
      : DEFAULT_MAINTENANCE_MESSAGE;

  const startedAt = input.enabled
    ? current.enabled && current.startedAt
      ? current.startedAt
      : now.toISOString()
    : null;

  const metadata = {
    message,
    startedAt,
    endsAt: input.enabled ? asIsoOrNull(input.endsAt) : null,
    updatedBy: input.actorId ?? null,
    updatedAt: now.toISOString(),
  };

  const flag = (await upsertFeatureFlag({
    key: MAINTENANCE_FLAG_KEY,
    name: 'Maintenance mode',
    description: 'Serves 503 to member traffic while operators deploy or roll back.',
    enabled: input.enabled,
    // Maintenance is all-or-nothing: a percentage rollout of "the site is down"
    // would leave some members served and some not, which is worse than either.
    rolloutPercentage: 100,
    tags: ['ops', 'maintenance'],
    metadata,
    createdById: input.actorId ?? null,
  })) as FeatureFlagRecord;

  const state = toMaintenanceState(flag);
  maintenanceCache = { state, expiresAt: Date.now() + MAINTENANCE_CACHE_TTL_MS };
  return state;
}

/**
 * Drop the cached state. Used by tests and by any code path that changes the
 * flag row without going through setMaintenanceState.
 */
export function resetMaintenanceCache(): void {
  maintenanceCache = null;
}
