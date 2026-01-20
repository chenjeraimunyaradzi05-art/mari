"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const prisma_1 = require("../utils/prisma");
const router = (0, express_1.Router)();
function dbPrivacyFromParam(privacy) {
    return privacy === 'private' ? 'PRIVATE' : 'PUBLIC';
}
function apiPrivacyFromDb(privacy) {
    return String(privacy).toUpperCase() === 'PRIVATE' ? 'private' : 'public';
}
function apiRoleFromDb(role) {
    switch (String(role).toUpperCase()) {
        case 'ADMIN':
            return 'admin';
        case 'MODERATOR':
            return 'moderator';
        default:
            return 'member';
    }
}
function isDbAdmin(role) {
    return String(role).toUpperCase() === 'ADMIN';
}
function isDbModeratorOrAdmin(role) {
    const r = String(role).toUpperCase();
    return r === 'ADMIN' || r === 'MODERATOR';
}
function dbRoleFromParam(role) {
    switch (role) {
        case 'admin':
            return 'ADMIN';
        case 'moderator':
            return 'MODERATOR';
        default:
            return 'MEMBER';
    }
}
async function getMembershipRole(groupId, userId) {
    const membership = await prisma_1.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
        select: { role: true },
    });
    return membership?.role ?? null;
}
async function getJoinRequestForUser(groupId, userId) {
    return await prisma_1.prisma.groupJoinRequest.findUnique({
        where: { groupId_userId: { groupId, userId } },
    });
}
async function getGroupView(groupId, userId) {
    const include = {
        _count: { select: { members: true } },
    };
    if (userId) {
        include.members = {
            where: { userId },
            select: { role: true },
        };
    }
    const group = await prisma_1.prisma.group.findUnique({
        where: { id: groupId },
        include,
    });
    if (!group)
        throw new errorHandler_1.ApiError(404, 'Group not found');
    const membershipRole = userId ? group.members?.[0]?.role : null;
    return {
        id: group.id,
        name: group.name,
        description: group.description,
        privacy: apiPrivacyFromDb(group.privacy),
        createdBy: group.createdById,
        createdAt: group.createdAt.toISOString?.() ?? group.createdAt,
        memberCount: group._count?.members ?? 0,
        isMember: !!membershipRole,
        role: membershipRole ? apiRoleFromDb(membershipRole) : null,
    };
}
async function ensureGroup(groupId) {
    const group = await prisma_1.prisma.group.findUnique({ where: { id: groupId } });
    if (!group)
        throw new errorHandler_1.ApiError(404, 'Group not found');
    return group;
}
async function ensureVisibleGroup(groupId, viewerRole) {
    const group = await ensureGroup(groupId);
    if (group.isHidden && String(viewerRole).toUpperCase() !== 'ADMIN') {
        throw new errorHandler_1.ApiError(404, 'Group not found');
    }
    return group;
}
/**
 * GET /api/groups
 */
router.get('/', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
        const where = {
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
        const include = { _count: { select: { members: true } } };
        if (req.user?.id) {
            include.members = { where: { userId: req.user.id }, select: { role: true } };
        }
        const groups = await prisma_1.prisma.group.findMany({
            where,
            include,
            orderBy: [{ isPinned: 'desc' }, { isFeatured: 'desc' }, { createdAt: 'desc' }],
            take: 50,
        });
        const visible = (groups || []).map((g) => {
            const membershipRole = req.user?.id ? g.members?.[0]?.role : null;
            return {
                id: g.id,
                name: g.name,
                description: g.description,
                privacy: apiPrivacyFromDb(g.privacy),
                createdBy: g.createdById,
                createdAt: g.createdAt.toISOString?.() ?? g.createdAt,
                memberCount: g._count?.members ?? 0,
                isMember: !!membershipRole,
                role: membershipRole ? apiRoleFromDb(membershipRole) : null,
            };
        });
        res.json({ success: true, data: visible });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/groups
 */
router.post('/', auth_1.authenticate, async (req, res, next) => {
    try {
        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
        const privacy = req.body?.privacy === 'private' ? 'private' : 'public';
        if (!name || name.length < 3)
            throw new errorHandler_1.ApiError(400, 'Group name is required');
        if (!description)
            throw new errorHandler_1.ApiError(400, 'Group description is required');
        const group = await prisma_1.prisma.group.create({
            data: {
                name,
                description,
                privacy: dbPrivacyFromParam(privacy),
                createdBy: { connect: { id: req.user.id } },
            },
        });
        // Creator becomes admin
        await prisma_1.prisma.groupMember.create({
            data: {
                groupId: group.id,
                userId: req.user.id,
                role: 'ADMIN',
            },
        });
        res.status(201).json({ success: true, data: await getGroupView(group.id, req.user.id) });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/groups/:id
 */
router.get('/:id', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const group = await ensureVisibleGroup(req.params.id, req.user?.role);
        if (apiPrivacyFromDb(group.privacy) === 'private' && !req.user) {
            throw new errorHandler_1.ApiError(401, 'Authentication required');
        }
        res.json({ success: true, data: await getGroupView(group.id, req.user?.id) });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/groups/:id/join
 */
router.post('/:id/join', auth_1.authenticate, async (req, res, next) => {
    try {
        const group = await ensureVisibleGroup(req.params.id, req.user?.role);
        // If already a member, keep existing behavior.
        const existingRole = await getMembershipRole(group.id, req.user.id);
        if (existingRole) {
            return res.json({ success: true, data: await getGroupView(group.id, req.user.id) });
        }
        // Private groups require approval.
        if (String(group.privacy).toUpperCase() === 'PRIVATE') {
            const request = await prisma_1.prisma.groupJoinRequest.upsert({
                where: { groupId_userId: { groupId: group.id, userId: req.user.id } },
                update: { status: 'PENDING', reviewedAt: null, reviewedById: null },
                create: { groupId: group.id, userId: req.user.id, status: 'PENDING' },
            });
            return res.status(202).json({
                success: true,
                data: {
                    status: String(request.status).toLowerCase(),
                },
            });
        }
        await prisma_1.prisma.groupMember.upsert({
            where: { groupId_userId: { groupId: group.id, userId: req.user.id } },
            update: {},
            create: { groupId: group.id, userId: req.user.id, role: 'MEMBER' },
        });
        res.json({ success: true, data: await getGroupView(group.id, req.user.id) });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/groups/:id/join-request
 * User-facing: view my join-request status for this group
 */
router.get('/:id/join-request', auth_1.authenticate, async (req, res, next) => {
    try {
        const group = await ensureVisibleGroup(req.params.id, req.user?.role);
        // If already a member, join request is not applicable.
        const existingRole = await getMembershipRole(group.id, req.user.id);
        if (existingRole) {
            return res.json({ success: true, data: { status: 'member' } });
        }
        const reqRow = await getJoinRequestForUser(group.id, req.user.id);
        if (!reqRow) {
            return res.json({ success: true, data: { status: 'none' } });
        }
        res.json({
            success: true,
            data: {
                id: reqRow.id,
                status: String(reqRow.status).toLowerCase(),
                createdAt: reqRow.createdAt.toISOString?.() ?? reqRow.createdAt,
                reviewedAt: reqRow.reviewedAt?.toISOString?.() ?? reqRow.reviewedAt,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * DELETE /api/groups/:id/join-request
 * User-facing: cancel my pending join request
 */
router.delete('/:id/join-request', auth_1.authenticate, async (req, res, next) => {
    try {
        const group = await ensureVisibleGroup(req.params.id, req.user?.role);
        const reqRow = await getJoinRequestForUser(group.id, req.user.id);
        if (!reqRow) {
            return res.json({ success: true, data: { status: 'none' } });
        }
        if (String(reqRow.status).toUpperCase() !== 'PENDING') {
            throw new errorHandler_1.ApiError(400, 'Only pending join requests can be cancelled');
        }
        await prisma_1.prisma.groupJoinRequest.delete({ where: { id: reqRow.id } });
        res.json({ success: true, data: { status: 'cancelled' } });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/groups/:id/join-requests
 * Moderation: group ADMIN/MODERATOR
 */
router.get('/:id/join-requests', auth_1.authenticate, async (req, res, next) => {
    try {
        const group = await ensureVisibleGroup(req.params.id, req.user?.role);
        const actorRole = await getMembershipRole(group.id, req.user.id);
        if (!isDbModeratorOrAdmin(actorRole))
            throw new errorHandler_1.ApiError(403, 'Insufficient permissions');
        const requests = await prisma_1.prisma.groupJoinRequest.findMany({
            where: { groupId: group.id, status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
            take: 100,
            select: {
                id: true,
                groupId: true,
                userId: true,
                status: true,
                createdAt: true,
            },
        });
        res.json({ success: true, data: requests });
    }
    catch (err) {
        next(err);
    }
});
async function updateJoinRequestStatus(opts) {
    const { groupId, requestId, reviewerId, status } = opts;
    return await prisma_1.prisma.$transaction(async (tx) => {
        const reqRow = await tx.groupJoinRequest.findUnique({ where: { id: requestId } });
        if (!reqRow || reqRow.groupId !== groupId)
            throw new errorHandler_1.ApiError(404, 'Join request not found');
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
router.post('/:id/join-requests/:requestId/approve', auth_1.authenticate, async (req, res, next) => {
    try {
        const group = await ensureVisibleGroup(req.params.id, req.user?.role);
        const actorRole = await getMembershipRole(group.id, req.user.id);
        if (!isDbModeratorOrAdmin(actorRole))
            throw new errorHandler_1.ApiError(403, 'Insufficient permissions');
        const updated = await updateJoinRequestStatus({
            groupId: group.id,
            requestId: req.params.requestId,
            reviewerId: req.user.id,
            status: 'APPROVED',
        });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/groups/:id/join-requests/:requestId/deny
 * Moderation: group ADMIN/MODERATOR
 */
router.post('/:id/join-requests/:requestId/deny', auth_1.authenticate, async (req, res, next) => {
    try {
        const group = await ensureVisibleGroup(req.params.id, req.user?.role);
        const actorRole = await getMembershipRole(group.id, req.user.id);
        if (!isDbModeratorOrAdmin(actorRole))
            throw new errorHandler_1.ApiError(403, 'Insufficient permissions');
        const updated = await updateJoinRequestStatus({
            groupId: group.id,
            requestId: req.params.requestId,
            reviewerId: req.user.id,
            status: 'DENIED',
        });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/groups/:id/leave
 */
router.post('/:id/leave', auth_1.authenticate, async (req, res, next) => {
    try {
        const group = await ensureVisibleGroup(req.params.id, req.user?.role);
        try {
            await prisma_1.prisma.groupMember.delete({
                where: { groupId_userId: { groupId: group.id, userId: req.user.id } },
            });
        }
        catch (err) {
            if (err?.code !== 'P2025')
                throw err;
        }
        res.json({ success: true, data: await getGroupView(group.id, req.user.id) });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/groups/:id/posts
 */
router.get('/:id/posts', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const group = await ensureVisibleGroup(req.params.id, req.user?.role);
        if (apiPrivacyFromDb(group.privacy) === 'private' && !req.user) {
            throw new errorHandler_1.ApiError(401, 'Authentication required');
        }
        const posts = await prisma_1.prisma.groupPost.findMany({
            where: { groupId: group.id },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        res.json({ success: true, data: posts });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/groups/:id/posts
 */
router.post('/:id/posts', auth_1.authenticate, async (req, res, next) => {
    try {
        const group = await ensureVisibleGroup(req.params.id, req.user?.role);
        const member = await prisma_1.prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId: group.id, userId: req.user.id } },
            select: { id: true },
        });
        if (!member)
            throw new errorHandler_1.ApiError(403, 'Join the group to post');
        const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
        if (!content)
            throw new errorHandler_1.ApiError(400, 'Content is required');
        const post = await prisma_1.prisma.groupPost.create({
            data: {
                groupId: group.id,
                authorId: req.user.id,
                content,
            },
        });
        res.status(201).json({ success: true, data: post });
    }
    catch (err) {
        next(err);
    }
});
/**
 * DELETE /api/groups/:id/posts/:postId
 * Moderation: only group ADMIN/MODERATOR
 */
router.delete('/:id/posts/:postId', auth_1.authenticate, async (req, res, next) => {
    try {
        const group = await ensureVisibleGroup(req.params.id, req.user?.role);
        const post = await prisma_1.prisma.groupPost.findUnique({
            where: { id: req.params.postId },
            select: { id: true, groupId: true, authorId: true },
        });
        if (!post || post.groupId !== group.id)
            throw new errorHandler_1.ApiError(404, 'Post not found');
        const actorRole = await getMembershipRole(group.id, req.user.id);
        const isAuthor = post.authorId === req.user.id;
        if (!isAuthor && !isDbModeratorOrAdmin(actorRole)) {
            throw new errorHandler_1.ApiError(403, 'Insufficient permissions');
        }
        await prisma_1.prisma.groupPost.delete({ where: { id: post.id } });
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
/**
 * DELETE /api/groups/:id/members/:userId
 * Moderation: group ADMIN/MODERATOR can remove members (admins only can remove admins)
 */
router.delete('/:id/members/:userId', auth_1.authenticate, async (req, res, next) => {
    try {
        const group = await ensureVisibleGroup(req.params.id, req.user?.role);
        const actorRole = await getMembershipRole(group.id, req.user.id);
        if (!isDbModeratorOrAdmin(actorRole))
            throw new errorHandler_1.ApiError(403, 'Insufficient permissions');
        const targetMembership = await prisma_1.prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId: group.id, userId: req.params.userId } },
            select: { role: true },
        });
        if (!targetMembership)
            throw new errorHandler_1.ApiError(404, 'Member not found');
        if (isDbAdmin(targetMembership.role) && !isDbAdmin(actorRole)) {
            throw new errorHandler_1.ApiError(403, 'Only admins can remove admins');
        }
        if (isDbAdmin(targetMembership.role)) {
            const adminCount = await prisma_1.prisma.groupMember.count({ where: { groupId: group.id, role: 'ADMIN' } });
            if (adminCount <= 1)
                throw new errorHandler_1.ApiError(400, 'Group must have at least one admin');
        }
        try {
            await prisma_1.prisma.groupMember.delete({
                where: { groupId_userId: { groupId: group.id, userId: req.params.userId } },
            });
        }
        catch (err) {
            if (err?.code !== 'P2025')
                throw err;
        }
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
/**
 * PATCH /api/groups/:id/members/:userId
 * Role management: group ADMIN only
 */
router.patch('/:id/members/:userId', auth_1.authenticate, async (req, res, next) => {
    try {
        const group = await ensureVisibleGroup(req.params.id, req.user?.role);
        const actorRole = await getMembershipRole(group.id, req.user.id);
        if (!isDbAdmin(actorRole))
            throw new errorHandler_1.ApiError(403, 'Only group admins can manage roles');
        const roleParam = req.body?.role === 'admin' || req.body?.role === 'moderator' || req.body?.role === 'member'
            ? req.body.role
            : null;
        if (!roleParam)
            throw new errorHandler_1.ApiError(400, 'Invalid role');
        const newRole = dbRoleFromParam(roleParam);
        const existing = await prisma_1.prisma.groupMember.findUnique({
            where: { groupId_userId: { groupId: group.id, userId: req.params.userId } },
            select: { role: true },
        });
        if (!existing)
            throw new errorHandler_1.ApiError(404, 'Member not found');
        if (isDbAdmin(existing.role) && newRole !== 'ADMIN') {
            const adminCount = await prisma_1.prisma.groupMember.count({ where: { groupId: group.id, role: 'ADMIN' } });
            if (adminCount <= 1)
                throw new errorHandler_1.ApiError(400, 'Group must have at least one admin');
        }
        const member = await prisma_1.prisma.groupMember.update({
            where: { groupId_userId: { groupId: group.id, userId: req.params.userId } },
            data: { role: newRole },
            select: { groupId: true, userId: true, role: true },
        });
        res.json({ success: true, data: member });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=group.routes.js.map