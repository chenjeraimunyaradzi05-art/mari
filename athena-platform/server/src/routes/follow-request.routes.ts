/**
 * Follow requests, for members who approve who follows them.
 *
 *   GET    /api/users/me/follow-requests              pending requests to follow you
 *   GET    /api/users/me/follow-requests/count
 *   POST   /api/users/me/follow-requests/:id/accept   they follow you from now on
 *   POST   /api/users/me/follow-requests/:id/decline
 *
 * The request itself is made by POST /api/users/:id/follow, which turns into
 * a request when the target approves followers; DELETE /:id/follow withdraws
 * it. Mounted ahead of user.routes.
 */

import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { notifySocial, socialLinks } from '../utils/social-notifications';

const router = Router();

const REQUESTER_SELECT = {
  requester: {
    select: { id: true, firstName: true, lastName: true, displayName: true, avatar: true, headline: true },
  },
};

function requestView(row: {
  id: string;
  createdAt: Date;
  requester: { id: string; firstName: string | null; lastName: string | null; displayName: string | null; avatar: string | null; headline: string | null };
}) {
  const name =
    row.requester.displayName?.trim() ||
    [row.requester.firstName, row.requester.lastName].filter(Boolean).join(' ').trim() ||
    'Member';
  return {
    id: row.id,
    createdAt: row.createdAt,
    requester: { id: row.requester.id, name, avatar: row.requester.avatar, headline: row.requester.headline },
  };
}

router.get('/me/follow-requests', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const rows = await prisma.followRequest.findMany({
      where: { targetId: req.user!.id, status: 'PENDING' },
      include: REQUESTER_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: rows.map(requestView) });
  } catch (error) {
    next(error);
  }
});

router.get('/me/follow-requests/count', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const count = await prisma.followRequest.count({ where: { targetId: req.user!.id, status: 'PENDING' } });
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

async function loadPending(id: string, targetId: string) {
  const row = await prisma.followRequest.findUnique({ where: { id }, include: REQUESTER_SELECT });
  if (!row || row.targetId !== targetId || row.status !== 'PENDING') {
    throw new ApiError(404, 'Follow request not found');
  }
  return row;
}

router.post('/me/follow-requests/:id/accept', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const request = await loadPending(req.params.id, req.user!.id);

    await prisma.$transaction([
      prisma.follow.upsert({
        where: { followerId_followingId: { followerId: request.requesterId, followingId: req.user!.id } },
        update: {},
        create: { followerId: request.requesterId, followingId: req.user!.id },
      }),
      prisma.followRequest.update({ where: { id: request.id }, data: { status: 'ACCEPTED' } }),
    ]);

    await notifySocial({
      recipientId: request.requesterId,
      actorId: req.user!.id,
      type: 'FOLLOW',
      title: 'Follow request accepted',
      message: (name) => `${name} accepted your request to follow them`,
      link: socialLinks.profile(req.user!.id),
    });

    res.json({ success: true, message: 'Request accepted', data: requestView(request) });
  } catch (error) {
    next(error);
  }
});

router.post('/me/follow-requests/:id/decline', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const request = await loadPending(req.params.id, req.user!.id);
    await prisma.followRequest.update({ where: { id: request.id }, data: { status: 'DECLINED' } });
    // Quietly: the requester is not told, the way declining works elsewhere.
    res.json({ success: true, message: 'Request declined' });
  } catch (error) {
    next(error);
  }
});

export default router;
