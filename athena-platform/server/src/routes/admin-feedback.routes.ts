/**
 * Working through feedback: the list, newest first, and a status per item
 * (new, seen, done). Nothing is deleted; done is the end state.
 */

import { Router, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { recordAdminAction } from '../services/admin-audit.service';

const router = Router();
const adminOnly: RequestHandler[] = [authenticate, requireRole('ADMIN')];

const STATUSES = ['NEW', 'SEEN', 'DONE'] as const;
type Status = (typeof STATUSES)[number];

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function positiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, max) : fallback;
}

/**
 * GET /api/admin/feedback?status=&category=&page=&limit=
 *
 * Paged. It used to return the newest 500 and stop, beside status counts taken
 * over the whole table, so past 500 items the oldest disappeared from the list
 * without a word while the counts still included them — "new · 612" over a list
 * that could never show more than 500 of anything.
 */
router.get('/', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' && (STATUSES as readonly string[]).includes(req.query.status) ? (req.query.status as Status) : undefined;
    const category = typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined;
    const page = positiveInt(req.query.page, 1, 100_000);
    const limit = positiveInt(req.query.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const where = { ...(status ? { status } : {}), ...(category ? { category: category as never } : {}) };
    const [items, total, counts] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: { user: { select: { id: true, firstName: true, lastName: true, displayName: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.feedback.count({ where }),
      prisma.feedback.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    res.json({
      success: true,
      data: items,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/admin/feedback/:id { status } */
router.patch('/:id', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = req.body?.status;
    if (!(STATUSES as readonly string[]).includes(status)) throw new ApiError(400, 'status must be NEW, SEEN or DONE');
    const existing = await prisma.feedback.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, userId: true } });
    if (!existing) throw new ApiError(404, 'No such feedback');
    const updated = await prisma.feedback.update({ where: { id: existing.id }, data: { status } });

    // Feedback is often the first place a member reports something going
    // wrong for her, so who marked it done is worth knowing.
    await recordAdminAction(req, 'FEEDBACK_UPDATED', {
      resourceType: 'Feedback',
      resourceId: existing.id,
      targetUserId: existing.userId,
      previousStatus: existing.status,
      status: updated.status,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
