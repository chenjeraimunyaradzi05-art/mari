import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest, optionalAuth, requireRole } from '../middleware/auth';
import {
  listFeatureFlags,
  getFeatureFlagByKey,
  upsertFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  getActiveFeatureFlagsForUser,
} from '../services/feature-flags.service';
import { recordAdminAction } from '../services/admin-audit.service';

const router = Router();

/**
 * GET /feature-flags/active
 * Returns active flags for the current user (or anonymous)
 */
router.get('/active', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const result = await getActiveFeatureFlagsForUser(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Admin-only routes
router.use(authenticate);
router.use(requireRole('ADMIN'));

/**
 * GET /feature-flags
 * List all feature flags
 */
router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const flags = await listFeatureFlags();
    res.json({ flags });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /feature-flags/:key
 * Get a specific feature flag
 */
router.get('/:key', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const flag = await getFeatureFlagByKey(req.params.key);
    if (!flag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }
    res.json(flag);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /feature-flags
 * Create or update a feature flag
 */
const flagKey = z.string().trim().regex(/^[a-z0-9][a-z0-9_.-]{1,79}$/i, 'A flag key is letters, digits, dots, dashes and underscores');
const idList = z.array(z.string().trim().min(1).max(120)).max(500);
const flagFields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  enabled: z.boolean().optional(),
  rolloutPercentage: z.coerce.number().min(0).max(100).optional(),
  allowList: idList.optional(),
  denyList: idList.optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  // Free-form, but bounded: a flag's notes, not a place to store documents.
  metadata: z.record(z.unknown()).nullable().optional().refine((m) => !m || JSON.stringify(m).length <= 4000, 'metadata is limited to 4000 characters'),
};
const createFlagSchema = z.object({ key: flagKey, ...flagFields });
const updateFlagSchema = z.object({ ...flagFields, name: flagFields.name.optional() });

function parseFlag<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input');
  }
  return parsed.data;
}

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parseFlag(createFlagSchema, req.body);
    const flag = await upsertFeatureFlag({ ...data, description: data.description ?? undefined, createdById: req.user?.id });

    // A flag is how a feature reaches some members and not others, so who
    // turned one on, and for whom, is part of the record.
    await recordAdminAction(req, 'FEATURE_FLAG_CREATED', {
      resourceType: 'FeatureFlag',
      resourceId: flag.key,
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage,
      allowListSize: flag.allowList.length,
      denyListSize: flag.denyList.length,
    });

    res.status(201).json(flag);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /feature-flags/:key
 * Update a feature flag
 */
router.patch('/:key', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = parseFlag(updateFlagSchema, req.body);
    const flag = await updateFeatureFlag(req.params.key, { ...data, description: data.description ?? undefined });

    await recordAdminAction(req, 'FEATURE_FLAG_UPDATED', {
      resourceType: 'FeatureFlag',
      resourceId: flag.key,
      changedFields: Object.keys(data),
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage,
      allowListSize: flag.allowList.length,
      denyListSize: flag.denyList.length,
    });

    res.json(flag);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /feature-flags/:key
 * Delete a feature flag
 */
router.delete('/:key', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await deleteFeatureFlag(req.params.key);

    await recordAdminAction(req, 'FEATURE_FLAG_DELETED', {
      resourceType: 'FeatureFlag',
      resourceId: req.params.key,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
