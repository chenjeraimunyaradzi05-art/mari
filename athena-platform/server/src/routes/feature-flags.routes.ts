import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest, optionalAuth, requireRole } from '../middleware/auth';
import {
  listFeatureFlags,
  getFeatureFlagByKey,
  upsertFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  getActiveFeatureFlagsForUser,
} from '../services/feature-flags.service';

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
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const flag = await upsertFeatureFlag({
      key: req.body.key,
      name: req.body.name,
      description: req.body.description,
      enabled: req.body.enabled,
      rolloutPercentage: req.body.rolloutPercentage,
      allowList: req.body.allowList,
      denyList: req.body.denyList,
      tags: req.body.tags,
      metadata: req.body.metadata,
      createdById: req.user?.id,
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
    const flag = await updateFeatureFlag(req.params.key, {
      name: req.body.name,
      description: req.body.description,
      enabled: req.body.enabled,
      rolloutPercentage: req.body.rolloutPercentage,
      allowList: req.body.allowList,
      denyList: req.body.denyList,
      tags: req.body.tags,
      metadata: req.body.metadata,
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
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
