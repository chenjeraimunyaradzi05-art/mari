/**
 * Working through feedback: the list, newest first, and a status per item
 * (new, seen, done). Nothing is deleted; done is the end state.
 */

import { Router, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
const adminOnly: RequestHandler[] = [authenticate, requireRole('ADMIN')];

const STATUSES = ['NEW', 'SEEN', 'DONE'] as const;
type Status = (typeof STATUSES)[number];

/** GET /api/admin/feedback?status=&category= */
router.get('/', ...adminOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' && (STATUSES as readonly string[]).includes(req.query.status) ? (req.query.status as Status) : undefined;
    const category = typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined;
    const [items, counts] = await Promise.all([
      prisma.feedback.findMany({
        where: { ...(status ? { status } : {}), ...(category ? { category: category as never } : {}) },
        include: { user: { select: { id: true, firstName: true, lastName: true, displayName: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.feedback.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    res.json({
      success: true,
      data: items,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
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
    const existing = await prisma.feedback.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) throw new ApiError(404, 'No such feedback');
    const updated = await prisma.feedback.update({ where: { id: existing.id }, data: { status } });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
