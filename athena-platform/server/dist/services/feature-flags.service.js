"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateFeatureFlag = evaluateFeatureFlag;
exports.listFeatureFlags = listFeatureFlags;
exports.getFeatureFlagByKey = getFeatureFlagByKey;
exports.upsertFeatureFlag = upsertFeatureFlag;
exports.updateFeatureFlag = updateFeatureFlag;
exports.deleteFeatureFlag = deleteFeatureFlag;
exports.getActiveFeatureFlagsForUser = getActiveFeatureFlagsForUser;
const prisma_1 = require("../utils/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const prismaClient = prisma_1.prisma;
const clampPercentage = (value) => Math.max(0, Math.min(100, Math.round(value)));
const hashToBucket = (input) => {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
        hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash % 100;
};
function evaluateFeatureFlag(flag, userId) {
    if (!flag.enabled)
        return false;
    if (userId) {
        if (flag.denyList?.includes(userId))
            return false;
        if (flag.allowList?.includes(userId))
            return true;
    }
    const rollout = clampPercentage(flag.rolloutPercentage || 0);
    if (rollout <= 0)
        return false;
    if (rollout >= 100)
        return true;
    if (!userId)
        return false;
    const bucket = hashToBucket(`${userId}:${flag.key}`);
    return bucket < rollout;
}
async function listFeatureFlags() {
    return prismaClient.featureFlag.findMany({
        orderBy: { createdAt: 'desc' },
    });
}
async function getFeatureFlagByKey(key) {
    return prismaClient.featureFlag.findUnique({
        where: { key },
    });
}
async function upsertFeatureFlag(data) {
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
async function updateFeatureFlag(key, data) {
    const existing = await prismaClient.featureFlag.findUnique({ where: { key } });
    if (!existing) {
        throw new errorHandler_1.ApiError(404, 'Feature flag not found');
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
async function deleteFeatureFlag(key) {
    const existing = await prismaClient.featureFlag.findUnique({ where: { key } });
    if (!existing) {
        throw new errorHandler_1.ApiError(404, 'Feature flag not found');
    }
    await prismaClient.featureFlag.delete({ where: { key } });
    return { success: true };
}
async function getActiveFeatureFlagsForUser(userId) {
    const flags = (await prismaClient.featureFlag.findMany({
        where: { enabled: true },
    }));
    const active = flags.filter((flag) => evaluateFeatureFlag({
        enabled: flag.enabled,
        rolloutPercentage: flag.rolloutPercentage,
        allowList: flag.allowList || [],
        denyList: flag.denyList || [],
        key: flag.key,
    }, userId));
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
//# sourceMappingURL=feature-flags.service.js.map