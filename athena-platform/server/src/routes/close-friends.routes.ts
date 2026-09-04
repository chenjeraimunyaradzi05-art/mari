/**
 * Close friends: the short list a member shares some stories with only.
 *
 *   GET    /api/users/me/close-friends        the list, with a few people to pick from
 *   POST   /api/users/me/close-friends/:id    add someone (idempotent)
 *   DELETE /api/users/me/close-friends/:id    remove them
 *
 * Nobody is told they were added or removed. Mounted ahead of user.routes.
 */

import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const MAX_CLOSE_FRIENDS = 200;

const PERSON_SELECT = { id: true, firstName: true, lastName: true, displayName: true, avatar: true, headline: true };

type Person = { id: string; firstName: string | null; lastName: string | null; displayName: string | null; avatar: string | null; headline: string | null };

function personView(user: Person) {
  return {
    id: user.id,
    name: user.displayName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'Member',
    avatar: user.avatar,
    headline: user.headline,
  };
}

router.get('/me/close-friends', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const [friends, following] = await Promise.all([
      prisma.closeFriend.findMany({
        where: { userId },
        include: { friend: { select: PERSON_SELECT } },
        orderBy: { createdAt: 'desc' },
      }),
      // People you follow are the natural candidates.
      prisma.follow.findMany({
        where: { followerId: userId },
        include: { following: { select: PERSON_SELECT } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    const chosen = new Set(friends.map((f) => f.friendId));
    res.json({
      success: true,
      data: {
        friends: friends.map((f) => personView(f.friend)),
        suggestions: following.filter((f) => !chosen.has(f.followingId)).map((f) => personView(f.following)),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/me/close-friends/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const friendId = req.params.id;
    if (friendId === userId) {
      throw new ApiError(400, 'You are already your own closest friend');
    }
    const friend = await prisma.user.findUnique({ where: { id: friendId }, select: PERSON_SELECT });
    if (!friend) {
      throw new ApiError(404, 'Member not found');
    }
    const count = await prisma.closeFriend.count({ where: { userId } });
    if (count >= MAX_CLOSE_FRIENDS) {
      throw new ApiError(400, `Close friends holds up to ${MAX_CLOSE_FRIENDS} people`);
    }
    await prisma.closeFriend.upsert({
      where: { userId_friendId: { userId, friendId } },
      update: {},
      create: { userId, friendId },
    });
    res.status(201).json({ success: true, message: 'Added to close friends', data: personView(friend) });
  } catch (error) {
    next(error);
  }
});

router.delete('/me/close-friends/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await prisma.closeFriend.deleteMany({ where: { userId: req.user!.id, friendId: req.params.id } });
    res.json({ success: true, message: 'Removed from close friends' });
  } catch (error) {
    next(error);
  }
});

export default router;
