import { Router } from 'express';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { prisma } from '../utils/prisma';
import { decoratePosts } from '../services/post-decoration.service';
import { assertContentAllowed } from '../services/moderation.service';
import { enrichPostLinkPreview } from '../services/link-preview.service';
import { resolveMentionedUserIds } from '../utils/mentions';
import { actorDisplayName, notifySocial, socialLinks } from '../utils/social-notifications';
import { CONTENT_LIMITS, normalizeMediaUrls, normalizeUserText } from '../utils/contentSafety';
import { postLimiter } from '../middleware/socialLimits';
import { sendNotification } from '../services/socket.service';
import { logger } from '../utils/logger';

const router = Router();

type GroupPrivacy = 'public' | 'private';
type GroupRole = 'admin' | 'moderator' | 'member';
type DbGroupRole = 'ADMIN' | 'MODERATOR' | 'MEMBER';
type JoinRequestStatus = 'pending' | 'approved' | 'denied';

const GROUP_NAME_MAX = 100;
const GROUP_DESCRIPTION_MAX = 2000;
/** A declined request stays declined for this long before Join re-opens it. */
const DENIED_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

/** Banned rows stay in GroupMember so the ban outlives leaving; they are not members. */
const ACTIVE_MEMBER = { isBanned: false } as const;

/**
 * Group notifications are a courtesy on top of a write that has already
 * happened, so they are never awaited into the response (the same rule as
 * notifySocial). A failed row is logged and the request still succeeds.
 */
function notifyQuietly(data: Parameters<typeof sendNotification>[0]): void {
  void sendNotification(data).catch((error) => {
    logger.warn('Group notification failed', {
      userId: data.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/** Everyone who can act on a join request: the group's admins and moderators. */
async function notifyGroupStaff(groupId: string, data: Omit<Parameters<typeof sendNotification>[0], 'userId'>): Promise<void> {
  const staff = await (prisma as any).groupMember.findMany({
    where: { groupId, role: { in: ['ADMIN', 'MODERATOR'] }, ...ACTIVE_MEMBER },
    select: { userId: true },
  });
  for (const member of staff || []) {
    notifyQuietly({ ...data, userId: member.userId });
  }
}

function dbPrivacyFromParam(privacy: GroupPrivacy): 'PUBLIC' | 'PRIVATE' {
  return privacy === 'private' ? 'PRIVATE' : 'PUBLIC';
}

function apiPrivacyFromDb(privacy: string): GroupPrivacy {
  return String(privacy).toUpperCase() === 'PRIVATE' ? 'private' : 'public';
}

function apiRoleFromDb(role: string): GroupRole {
  switch (String(role).toUpperCase()) {
    case 'ADMIN':
      return 'admin';
    case 'MODERATOR':
      return 'moderator';
    default:
      return 'member';
  }
}

function isDbAdmin(role: any): boolean {
  return String(role).toUpperCase() === 'ADMIN';
}

function isDbModeratorOrAdmin(role: any): boolean {
  const r = String(role).toUpperCase();
  return r === 'ADMIN' || r === 'MODERATOR';
}

/**
 * The viewer's GroupMember row, banned or not. A banned row is kept on
 * purpose (so Join keeps refusing after Leave), which is why the callers that
 * mean "is she a member" go through getMembershipRole instead.
 */
async function getMembership(groupId: string, userId: string): Promise<{ role: DbGroupRole; isBanned: boolean } | null> {
  const membership = await (prisma as any).groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true, isBanned: true },
  });
  if (!membership) return null;
  return { role: membership.role, isBanned: membership.isBanned === true };
}

/** The viewer's role, or null when she is not a member. A banned row counts as no membership. */
async function getMembershipRole(groupId: string, userId: string): Promise<DbGroupRole | null> {
  const membership = await getMembership(groupId, userId);
  if (!membership || membership.isBanned) return null;
  return membership.role ?? null;
}

async function getJoinRequestForUser(groupId: string, userId: string) {
  return await (prisma as any).groupJoinRequest.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
}

function apiJoinRequestStatus(status: unknown): JoinRequestStatus | null {
  switch (String(status ?? '').toUpperCase()) {
    case 'PENDING':
      return 'pending';
    case 'APPROVED':
      return 'approved';
    case 'DENIED':
      return 'denied';
    default:
      return null;
  }
}

/**
 * What the viewer is told about a group. `joinRequestStatus` is only set for
 * a non-member, so the page and the list cards can say "Requested" rather
 * than showing Join again; `adminCount` only for an admin, who needs to know
 * whether she is the last one before she leaves.
 */
async function getGroupView(groupId: string, userId?: string) {
  const include: any = {
    _count: { select: { members: { where: ACTIVE_MEMBER } } },
  };
  if (userId) {
    include.members = {
      where: { userId },
      select: { role: true, isBanned: true },
    };
    include.joinRequests = {
      where: { userId },
      select: { status: true },
    };
  }

  const group = await (prisma as any).group.findUnique({
    where: { id: groupId },
    include,
  });

  if (!group) throw new ApiError(404, 'Group not found');

  const membership = userId ? group.members?.[0] : null;
  const membershipRole = membership && !membership.isBanned ? membership.role : null;
  const joinRequestStatus = !membershipRole && userId ? apiJoinRequestStatus(group.joinRequests?.[0]?.status) : null;

  let adminCount: number | undefined;
  if (membershipRole && isDbAdmin(membershipRole)) {
    adminCount = await (prisma as any).groupMember.count({ where: { groupId: group.id, role: 'ADMIN', ...ACTIVE_MEMBER } });
  }

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    privacy: apiPrivacyFromDb(group.privacy),
    createdBy: group.createdById,
    createdAt: (group.createdAt as Date).toISOString?.() ?? group.createdAt,
    memberCount: group._count?.members ?? 0,
    isMember: !!membershipRole,
    role: membershipRole ? apiRoleFromDb(membershipRole) : null,
    joinRequestStatus,
    allowMemberInvites: group.allowMemberInvites !== false,
    ...(adminCount !== undefined ? { adminCount } : {}),
  };
}

async function ensureGroup(groupId: string) {
  const group = await (prisma as any).group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiError(404, 'Group not found');
  return group;
}

async function ensureVisibleGroup(groupId: string, viewerRole?: string) {
  const group = await ensureGroup(groupId);
  if (group.isHidden && String(viewerRole).toUpperCase() !== 'ADMIN') {
    throw new ApiError(404, 'Group not found');
  }
  return group;
}

/**
 * GET /api/groups
 */
router.get('/', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const where: any = {
      ...(req.user ? {} : { privacy: 'PUBLIC' }),
      ...(String(req.user?.role).toUpperCase() === 'ADMIN' ? {} : { isHidden: false }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const include: any = { _count: { select: { members: { where: ACTIVE_MEMBER } } } };
    if (req.user?.id) {
      include.members = { where: { userId: req.user.id }, select: { role: true, isBanned: true } };
      // So a card can say "Requested" instead of offering Join a second time.
      include.joinRequests = { where: { userId: req.user.id }, select: { status: true } };
    }

    const groups = await (prisma as any).group.findMany({
      where,
      include,
      orderBy: [{ isPinned: 'desc' }, { isFeatured: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });

    const visible = (groups || []).map((g: any) => {
      const membership = req.user?.id ? g.members?.[0] : null;
      const membershipRole = membership && !membership.isBanned ? membership.role : null;
      return {
        id: g.id,
        name: g.name,
        description: g.description,
        privacy: apiPrivacyFromDb(g.privacy),
        createdBy: g.createdById,
        createdAt: (g.createdAt as Date).toISOString?.() ?? g.createdAt,
        memberCount: g._count?.members ?? 0,
        isMember: !!membershipRole,
        role: membershipRole ? apiRoleFromDb(membershipRole) : null,
        joinRequestStatus: !membershipRole && req.user?.id ? apiJoinRequestStatus(g.joinRequests?.[0]?.status) : null,
      };
    });

    res.json({ success: true, data: visible });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/groups
 */
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const privacy: GroupPrivacy = req.body?.privacy === 'private' ? 'private' : 'public';

    if (!name || name.length < 3) throw new ApiError(400, 'Group name is required');
    if (!description) throw new ApiError(400, 'Group description is required');

    const group = await (prisma as any).group.create({
      data: {
        name,
        description,
        privacy: dbPrivacyFromParam(privacy),
        createdBy: { connect: { id: req.user!.id } },
      },
    });

    // Creator becomes admin
    await (prisma as any).groupMember.create({
      data: {
        groupId: group.id,
        userId: req.user!.id,
        role: 'ADMIN',
      },
    });

    res.status(201).json({ success: true, data: await getGroupView(group.id, req.user!.id) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/groups/:id
 */
router.get('/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const group = await ensureVisibleGroup(req.params.id, req.user?.role);
    if (apiPrivacyFromDb(group.privacy) === 'private' && !req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    res.json({ success: true, data: await getGroupView(group.id, req.user?.id) });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/groups/:id
 * A group's own admins tend its name, description and privacy. Featuring,
 * pinning and hiding stay with the operator console (admin.routes.ts).
 */
router.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const group = await ensureVisibleGroup(req.params.id, req.user?.role);
    const actorRole = await getMembershipRole(group.id, req.user!.id);
    if (!isDbAdmin(actorRole)) throw new ApiError(403, 'Only group admins can change the group');

    const data: { name?: string; description?: string; privacy?: 'PUBLIC' | 'PRIVATE' } = {};
    if (req.body?.name !== undefined) {
      const name = normalizeUserText(req.body.name, { field: 'name', maxLength: GROUP_NAME_MAX });
      if (name.length < 3) throw new ApiError(400, 'Group name is required');
      data.name = name;
    }
    if (req.body?.description !== undefined) {
      data.description = normalizeUserText(req.body.description, { field: 'description', maxLength: GROUP_DESCRIPTION_MAX });
    }
    if (req.body?.privacy !== undefined) {
      if (req.body.privacy !== 'public' && req.body.privacy !== 'private') throw new ApiError(400, 'Invalid privacy');
      data.privacy = dbPrivacyFromParam(req.body.privacy);
    }
    if (Object.keys(data).length === 0) throw new ApiError(400, 'Nothing to change');

    await (prisma as any).group.update({ where: { id: group.id }, data });
    logger.info('Group updated by its admin', { groupId: group.id, actorId: req.user!.id, fields: Object.keys(data) });

    res.json({ success: true, data: await getGroupView(group.id, req.user!.id) });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/groups/:id
 * Closes the group. Members, join requests and posts cascade with it; the
 * chat's Conversation row (keyed by the group id) is cleared here because
 * nothing else links it to the group.
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const group = await ensureVisibleGroup(req.params.id, req.user?.role);
    const actorRole = await getMembershipRole(group.id, req.user!.id);
    if (!isDbAdmin(actorRole)) throw new ApiError(403, 'Only group admins can close the group');

    await (prisma as any).group.delete({ where: { id: group.id } });
    try {
      await (prisma as any).conversation.deleteMany({ where: { id: group.id } });
    } catch (error) {
      // The group is already gone; an orphaned chat row is not worth failing over.
      logger.warn('Group chat conversation was not removed with its group', {
        groupId: group.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    logger.info('Group closed by its admin', { groupId: group.id, actorId: req.user!.id });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/groups/:id/join
 */
router.post('/:id/join', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const group = await ensureVisibleGroup(req.params.id, req.user?.role);

    const membership = await getMembership(group.id, req.user!.id);
    // A ban outlives leaving: the row is kept so this refuses after Leave too.
    if (membership?.isBanned) throw new ApiError(403, 'You cannot join this group');

    // If already a member, keep existing behavior.
    if (membership) {
      return res.json({ success: true, data: await getGroupView(group.id, req.user!.id) });
    }

    // Private groups require approval.
    if (String(group.privacy).toUpperCase() === 'PRIVATE') {
      const existing = await getJoinRequestForUser(group.id, req.user!.id);
      if (existing && String(existing.status).toUpperCase() === 'PENDING') {
        return res.status(202).json({ success: true, data: { status: 'pending' } });
      }
      // A declined request is not quietly re-opened by pressing Join again.
      if (existing && String(existing.status).toUpperCase() === 'DENIED' && existing.reviewedAt) {
        const reopensAt = new Date(existing.reviewedAt).getTime() + DENIED_COOLDOWN_MS;
        if (reopensAt > Date.now()) {
          const when = new Date(reopensAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' });
          throw new ApiError(400, `Your last request wasn't approved. You can ask again from ${when}.`);
        }
      }

      const request = await (prisma as any).groupJoinRequest.upsert({
        where: { groupId_userId: { groupId: group.id, userId: req.user!.id } },
        update: { status: 'PENDING', reviewedAt: null, reviewedById: null },
        create: { groupId: group.id, userId: req.user!.id, status: 'PENDING' },
      });

      // The admins hear about it now rather than when they next open the group.
      const requesterId = req.user!.id;
      void actorDisplayName(requesterId)
        .then((name) =>
          notifyGroupStaff(group.id, {
            type: 'SYSTEM',
            title: 'Someone asked to join',
            message: `${name} asked to join ${group.name}`,
            link: `/dashboard/groups/${group.id}?tab=requests`,
          })
        )
        .catch((error) => {
          logger.warn('Join-request notification failed', { groupId: group.id, error: error instanceof Error ? error.message : String(error) });
        });

      return res.status(202).json({
        success: true,
        data: {
          status: String(request.status).toLowerCase(),
        },
      });
    }

    await (prisma as any).groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: req.user!.id } },
      update: {},
      create: { groupId: group.id, userId: req.user!.id, role: 'MEMBER' },
    });

    res.json({ success: true, data: await getGroupView(group.id, req.user!.id) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/groups/:id/join-request
 * User-facing: view my join-request status for this group
 */
router.get('/:id/join-request', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const group = await ensureVisibleGroup(req.params.id, req.user?.role);

    // If already a member, join request is not applicable.
    const existingRole = await getMembershipRole(group.id, req.user!.id);
    if (existingRole) {
      return res.json({ success: true, data: { status: 'member' } });
    }

    const reqRow = await getJoinRequestForUser(group.id, req.user!.id);
    if (!reqRow) {
      return res.json({ success: true, data: { status: 'none' } });
    }

    res.json({
      success: true,
      data: {
        id: reqRow.id,
        status: String(reqRow.status).toLowerCase(),
        createdAt: (reqRow.createdAt as Date).toISOString?.() ?? reqRow.createdAt,
        reviewedAt: (reqRow.reviewedAt as Date | null)?.toISOString?.() ?? reqRow.reviewedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/groups/:id/join-request
 * User-facing: cancel my pending join request
 */
router.delete('/:id/join-request', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const group = await ensureVisibleGroup(req.params.id, req.user?.role);

    const reqRow = await getJoinRequestForUser(group.id, req.user!.id);
    if (!reqRow) {
      return res.json({ success: true, data: { status: 'none' } });
    }

    if (String(reqRow.status).toUpperCase() !== 'PENDING') {
      throw new ApiError(400, 'Only pending join requests can be cancelled');
    }

    await (prisma as any).groupJoinRequest.delete({ where: { id: reqRow.id } });
    res.json({ success: true, data: { status: 'cancelled' } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/groups/:id/join-requests
 * Moderation: group ADMIN/MODERATOR
 */
router.get('/:id/join-requests', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const group = await ensureVisibleGroup(req.params.id, req.user?.role);
    const actorRole = await getMembershipRole(group.id, req.user!.id);
    if (!isDbModeratorOrAdmin(actorRole)) throw new ApiError(403, 'Insufficient permissions');

    // The inbox shows who is asking, not a bare id.
    const requests = await (prisma as any).groupJoinRequest.findMany({
      where: { groupId: group.id, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        groupId: true,
        userId: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true, displayName: true, avatar: true, headline: true } },
      },
    });

    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
});

async function updateJoinRequestStatus(opts: {
  groupId: string;
  requestId: string;
  reviewerId: string;
  status: 'APPROVED' | 'DENIED';
}) {
  const { groupId, requestId, reviewerId, status } = opts;
  return await (prisma as any).$transaction(async (tx: any) => {
    const reqRow = await tx.groupJoinRequest.findUnique({ where: { id: requestId } });
    if (!reqRow || reqRow.groupId !== groupId) throw new ApiError(404, 'Join request not found');

    const updated = await tx.groupJoinRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
      select: { id: true, groupId: true, userId: true, status: true },
    });

    if (status === 'APPROVED') {
      await tx.groupMember.upsert({
        where: { groupId_userId: { groupId, userId: updated.userId } },
        update: {},
        create: { groupId, userId: updated.userId, role: 'MEMBER' },
      });
    }

    return updated;
  });
}

/**
 * POST /api/groups/:id/join-requests/:requestId/approve
 * Moderation: group ADMIN/MODERATOR
 */
router.post('/:id/join-requests/:requestId/approve', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const group = await ensureVisibleGroup(req.params.id, req.user?.role);
    const actorRole = await getMembershipRole(group.id, req.user!.id);
    if (!isDbModeratorOrAdmin(actorRole)) throw new ApiError(403, 'Insufficient permissions');

    const updated = await updateJoinRequestStatus({
      groupId: group.id,
      requestId: req.params.requestId,
      reviewerId: req.user!.id,
      status: 'APPROVED',
    });

    notifyQuietly({
      userId: updated.userId,
      type: 'SYSTEM',
      title: "You're in",
      message: `Your request to join ${group.name} was approved.`,
      link: `/dashboard/groups/${group.id}`,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/groups/:id/join-requests/:requestId/deny
 * Moderation: group ADMIN/MODERATOR
 */
router.post('/:id/join-requests/:requestId/deny', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const group = await ensureVisibleGroup(req.params.id, req.user?.role);
    const actorRole = await getMembershipRole(group.id, req.user!.id);
    if (!isDbModeratorOrAdmin(actorRole)) throw new ApiError(403, 'Insufficient permissions');

    const updated = await updateJoinRequestStatus({
      groupId: group.id,
      requestId: req.params.requestId,
      reviewerId: req.user!.id,
      status: 'DENIED',
    });

    // Told gently, and told at all: silence left her pressing Join again.
    notifyQuietly({
      userId: updated.userId,
      type: 'SYSTEM',
      title: 'About your request',
      message: `Your request to join ${group.name} wasn't approved this time.`,
      link: `/dashboard/groups/${group.id}`,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/groups/:id/leave
 * The last admin cannot walk out on a group that still has members: nobody
 * would be left to admit, remove or edit anything. She promotes someone
 * first, or closes the group if she is the only one in it.
 */
router.post('/:id/leave', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const group = await ensureVisibleGroup(req.params.id, req.user?.role);
    const membership = await getMembership(group.id, req.user!.id);

    // Not a member: nothing to do. Banned: the row stays, so the ban holds.
    if (!membership || membership.isBanned) {
      return res.json({ success: true, data: await getGroupView(group.id, req.user!.id) });
    }

    if (isDbAdmin(membership.role)) {
      const others = await (prisma as any).groupMember.count({
        where: { groupId: group.id, userId: { not: req.user!.id }, ...ACTIVE_MEMBER },
      });
      if (others > 0) {
        const adminCount = await (prisma as any).groupMember.count({ where: { groupId: group.id, role: 'ADMIN', ...ACTIVE_MEMBER } });
        if (adminCount <= 1) throw new ApiError(400, 'Make someone else an admin before you leave');
      }
    }

    try {
      await (prisma as any).groupMember.delete({
        where: { groupId_userId: { groupId: group.id, userId: req.user!.id } },
      });
    } catch (err: any) {
      if (err?.code !== 'P2025') throw err;
    }

    res.json({ success: true, data: await getGroupView(group.id, req.user!.id) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/groups/:id/posts
 */
// Group posts are Post rows with groupId, so they carry reactions, comments,
// mentions, media, polls and insights like any other post. They are listed
// here and nowhere else; a private group's posts are for its members.

const GROUP_POST_AUTHOR = {
  author: {
    select: { id: true, firstName: true, lastName: true, displayName: true, avatar: true, headline: true },
  },
};

async function assertCanReadGroupPosts(group: any, req: AuthRequest) {
  const isAdmin = String(req.user?.role || '').toUpperCase() === 'ADMIN';
  if (apiPrivacyFromDb(group.privacy) !== 'private' || isAdmin) return;
  if (!req.user) throw new ApiError(401, 'Authentication required');
  const role = await getMembershipRole(group.id, req.user.id);
  if (!role) throw new ApiError(403, 'Join the group to see its posts');
}

router.get('/:id/posts', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const group = await ensureVisibleGroup(req.params.id, req.user?.role);
    await assertCanReadGroupPosts(group, req);

    const posts = await prisma.post.findMany({
      where: { groupId: group.id, isHidden: false },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: GROUP_POST_AUTHOR,
    });
    res.json({ success: true, data: await decoratePosts(posts, req.user?.id) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/groups/:id/posts
 */
router.post('/:id/posts', authenticate, postLimiter, async (req: AuthRequest, res, next) => {
  try {
    const group = await ensureVisibleGroup(req.params.id, req.user?.role);
    const member = await (prisma as any).groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: req.user!.id } },
      select: { id: true, isBanned: true, isMuted: true, mutedUntil: true },
    });
    if (!member || member.isBanned) throw new ApiError(403, 'Join the group to post');
    if (member.isMuted && (!member.mutedUntil || new Date(member.mutedUntil).getTime() > Date.now())) {
      throw new ApiError(403, 'You are muted in this group');
    }

    const content = normalizeUserText(req.body?.content, { field: 'content', maxLength: CONTENT_LIMITS.post });
    const mediaUrls = normalizeMediaUrls(req.body?.mediaUrls) ?? [];
    const mediaAlt = Array.isArray(req.body?.mediaAlt)
      ? req.body.mediaAlt.slice(0, mediaUrls.length).map((a: unknown) => (typeof a === 'string' ? a.trim().slice(0, 300) : ''))
      : undefined;
    await assertContentAllowed(content, { kind: 'post', userId: req.user!.id });
    const mentionedUserIds = (await resolveMentionedUserIds(content)).filter((id) => id !== req.user!.id);

    const post = await prisma.post.create({
      data: {
        groupId: group.id,
        authorId: req.user!.id,
        content,
        type: mediaUrls.length ? (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(mediaUrls[0])) ? 'VIDEO' : 'IMAGE') : 'TEXT',
        mediaUrls,
        ...(mediaAlt && mediaAlt.some((a: string) => a) ? { mediaAlt } : {}),
        isPublic: true,
        isSensitive: req.body?.isSensitive === true,
        mentionedUserIds,
      },
      include: GROUP_POST_AUTHOR,
    });

    for (const userId of mentionedUserIds) {
      await notifySocial({
        recipientId: userId,
        actorId: req.user!.id,
        type: 'MENTION',
        title: 'You were mentioned',
        message: (name) => `${name} mentioned you in ${group.name}`,
        link: socialLinks.post(post.id),
      });
    }
    enrichPostLinkPreview(post.id, content);

    res.status(201).json({ success: true, data: (await decoratePosts([post], req.user!.id))[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/groups/:id/posts/:postId
 * The author, or a group admin or moderator.
 */
router.delete('/:id/posts/:postId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const group = await ensureVisibleGroup(req.params.id, req.user?.role);
    const post = await prisma.post.findUnique({
      where: { id: req.params.postId },
      select: { id: true, groupId: true, authorId: true },
    });
    if (!post || post.groupId !== group.id) throw new ApiError(404, 'Post not found');

    const actorRole = await getMembershipRole(group.id, req.user!.id);
    const isAuthor = post.authorId === req.user!.id;
    if (!isAuthor && !isDbModeratorOrAdmin(actorRole)) {
      throw new ApiError(403, 'Insufficient permissions');
    }

    await prisma.post.delete({ where: { id: post.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/groups/:id/members/:userId
 * Moderation: group ADMIN/MODERATOR can remove members (admins only can remove admins)
 *
 * This is the handler that serves the path. group-chat.routes.ts declared the
 * same DELETE for `groupChatService.removeMember`, but this router is mounted
 * first (index.ts) and responds without next(), so that one never ran and
 * its "you were removed" notification was never sent. The notification is
 * sent from here now; the other declaration is retired with a note.
 */
router.delete('/:id/members/:userId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const group = await ensureVisibleGroup(req.params.id, req.user?.role);
    const actorRole = await getMembershipRole(group.id, req.user!.id);
    if (!isDbModeratorOrAdmin(actorRole)) throw new ApiError(403, 'Insufficient permissions');

    const targetMembership = await (prisma as any).groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: req.params.userId } },
      select: { role: true },
    });
    if (!targetMembership) throw new ApiError(404, 'Member not found');

    if (isDbAdmin(targetMembership.role) && !isDbAdmin(actorRole)) {
      throw new ApiError(403, 'Only admins can remove admins');
    }

    if (isDbAdmin(targetMembership.role)) {
      const adminCount = await (prisma as any).groupMember.count({ where: { groupId: group.id, role: 'ADMIN', ...ACTIVE_MEMBER } });
      if (adminCount <= 1) throw new ApiError(400, 'Group must have at least one admin');
    }

    try {
      await (prisma as any).groupMember.delete({
        where: { groupId_userId: { groupId: group.id, userId: req.params.userId } },
      });
    } catch (err: any) {
      if (err?.code !== 'P2025') throw err;
    }

    if (req.params.userId !== req.user!.id) {
      notifyQuietly({
        userId: req.params.userId,
        type: 'SYSTEM',
        title: 'Removed from a group',
        message: `You were removed from ${group.name}.`,
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * ## Retired: PATCH /api/groups/:id/members/:userId
 *
 * This file used to declare a second role-change handler on this path
 * (ADMIN only, lowercase 'admin' | 'moderator' | 'member' body, with a
 * last-admin guard). Nothing in the app called it: the Members tab changes
 * roles through `PATCH /api/groups/:groupId/members/:userId/role` in
 * group-chat.routes.ts, which takes the uppercase GroupRole and goes through
 * `groupChatService.updateMemberRole`. Two handlers with two contracts for
 * one job meant whoever touched roles next would fix one and not the other,
 * so the guard was moved into the service and this declaration was dropped.
 * Add role rules to `updateMemberRole`, not here.
 */

export default router;
