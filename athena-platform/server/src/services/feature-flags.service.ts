import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';

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
