/**
 * ATHENA Platform - Database Seeding Routes (non-production only)
 *
 * Exposes the content and admin seeders over HTTP for local development,
 * CI and demo environments.
 *
 * These endpoints write to the database, so they are gated by four
 * independent conditions and every one of them must hold:
 *
 *   1. NODE_ENV must not be 'production'  - hard block, no override exists
 *   2. ALLOW_DB_SEEDING must be 'true'    - off unless explicitly enabled
 *   3. SEED_API_TOKEN must be set, >= 32 chars
 *   4. Request must send a matching x-seed-token header (timing-safe compare)
 *
 * When any gate fails the router answers 404, so a misconfigured deployment
 * does not advertise that a seeding surface exists at all.
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { createRateLimiter } from '../middleware/rateLimiter';
import { seedContent } from '../services/seed/content.seed';
import { seedAdmin } from '../services/seed/admin.seed';

const router = Router();

const MIN_TOKEN_LENGTH = 32;

// ============================================================================
// GATES
// ============================================================================

function isProduction(): boolean {
  return (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
}

function seedingEnabled(): boolean {
  return !isProduction() && process.env.ALLOW_DB_SEEDING === 'true';
}

function configuredToken(): string | null {
  const token = process.env.SEED_API_TOKEN;
  return token && token.length >= MIN_TOKEN_LENGTH ? token : null;
}

/** Constant-time comparison that does not leak length through early return. */
function tokenMatches(supplied: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(supplied).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Answers 404 unless every gate passes. 404 rather than 401/403 so that a
 * disabled or misconfigured environment reveals nothing about this surface.
 */
function requireSeedingAccess(req: Request, res: Response, next: NextFunction): void {
  if (!seedingEnabled()) {
    if (isProduction()) {
      logger.warn('Blocked database seeding attempt in production', {
        path: req.path,
        ip: req.ip,
      });
    }
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const expected = configuredToken();
  if (!expected) {
    logger.error(
      `Seeding is enabled but SEED_API_TOKEN is missing or shorter than ${MIN_TOKEN_LENGTH} characters - refusing all seed requests.`
    );
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const supplied = req.get('x-seed-token');
  if (!supplied || !tokenMatches(supplied, expected)) {
    logger.warn('Rejected seed request with invalid token', { path: req.path, ip: req.ip });
    res.status(404).json({ error: 'Not found' });
    return;
  }

  next();
}

/** Seeding is expensive and destructive-ish; keep the door narrow. */
const seedLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `seed:${req.ip}`,
});

router.use(seedLimiter);
router.use(requireSeedingAccess);

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/admin/seed/status
 * Reports what is currently in the database, to check before and after seeding.
 */
router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [users, posts, videos, admins] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.video.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
    ]);

    res.json({
      environment: process.env.NODE_ENV ?? 'development',
      seedingEnabled: true,
      counts: { users, posts, videos, admins },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/seed/content
 * Seeds static posts (TEXT/IMAGE/ARTICLE) and videos. Idempotent - records use
 * deterministic ids, so repeated calls update rather than duplicate.
 */
router.post('/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Seeding content via admin seed route', { ip: req.ip });
    const summary = await seedContent(prisma, { verbose: false });

    res.json({
      message: 'Content seeded',
      ...summary,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('no users exist')) {
      res.status(409).json({
        error: 'No users to attribute content to. Seed users first (npm run db:seed).',
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/admin/seed/admin
 * Creates the administrator account.
 *
 * Body (all optional):
 *   email          - overrides ADMIN_EMAIL
 *   rotateExisting - reset the password if the account already exists
 *
 * A generated password is returned exactly once in the response body and is
 * not recoverable afterwards. Passwords are never accepted over this route -
 * set ADMIN_PASSWORD in the environment to choose your own.
 */
router.post('/admin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rotateExisting = req.body?.rotateExisting === true;
    const email = typeof req.body?.email === 'string' ? req.body.email : undefined;

    const result = await seedAdmin(prisma, { email, rotateExisting });

    logger.info('Admin account seeded via admin seed route', {
      ip: req.ip,
      email: result.email,
      created: result.created,
      rotated: rotateExisting,
    });

    res.json({
      message: result.created ? 'Admin account created' : 'Admin account already existed',
      email: result.email,
      created: result.created,
      ...(result.generatedPassword
        ? {
            password: result.generatedPassword,
            notice: 'Shown once and not stored - save it now.',
          }
        : {
            notice: result.created
              ? 'Password was taken from ADMIN_PASSWORD.'
              : 'Existing password left unchanged. Send rotateExisting: true to reset it.',
          }),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('ADMIN_PASSWORD must be')) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/admin/seed/all
 * Convenience: admin account followed by content.
 */
router.post('/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = await seedAdmin(prisma, { rotateExisting: req.body?.rotateExisting === true });
    const content = await seedContent(prisma, { verbose: false });

    res.json({
      message: 'Seed complete',
      admin: {
        email: admin.email,
        created: admin.created,
        ...(admin.generatedPassword
          ? { password: admin.generatedPassword, notice: 'Shown once and not stored - save it now.' }
          : {}),
      },
      content,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
