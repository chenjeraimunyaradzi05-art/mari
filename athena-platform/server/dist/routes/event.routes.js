"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const prisma_1 = require("../utils/prisma");
const router = (0, express_1.Router)();
function dbEventTypeFromParam(type) {
    const t = String(type || '').toLowerCase();
    switch (t) {
        case 'webinar':
            return 'WEBINAR';
        case 'workshop':
            return 'WORKSHOP';
        case 'networking':
            return 'NETWORKING';
        case 'conference':
            return 'CONFERENCE';
        case 'meetup':
            return 'MEETUP';
        default:
            return null;
    }
}
function apiEventTypeFromDb(type) {
    switch (String(type).toUpperCase()) {
        case 'WORKSHOP':
            return 'workshop';
        case 'NETWORKING':
            return 'networking';
        case 'CONFERENCE':
            return 'conference';
        case 'MEETUP':
            return 'meetup';
        default:
            return 'webinar';
    }
}
function dbEventFormatFromParam(format) {
    const f = String(format).toLowerCase();
    if (f === 'in-person')
        return 'IN_PERSON';
    if (f === 'hybrid')
        return 'HYBRID';
    return 'VIRTUAL';
}
function apiEventFormatFromDb(format) {
    const f = String(format).toUpperCase();
    if (f === 'IN_PERSON')
        return 'in-person';
    if (f === 'HYBRID')
        return 'hybrid';
    return 'virtual';
}
function eventView(dbEvent, userId) {
    const isRegistered = userId ? (dbEvent.registrations?.length || 0) > 0 : false;
    const isSaved = userId ? (dbEvent.saves?.length || 0) > 0 : false;
    const regCount = dbEvent._count?.registrations ?? 0;
    return {
        id: dbEvent.id,
        title: dbEvent.title,
        description: dbEvent.description,
        type: apiEventTypeFromDb(dbEvent.type),
        format: apiEventFormatFromDb(dbEvent.format),
        date: dbEvent.date.toISOString?.() ?? dbEvent.date,
        startTime: dbEvent.startTime,
        endTime: dbEvent.endTime,
        location: dbEvent.location,
        link: dbEvent.link,
        image: dbEvent.image,
        host: {
            name: dbEvent.hostName,
            title: dbEvent.hostTitle,
            avatar: dbEvent.hostAvatar,
        },
        attendees: (dbEvent.baseAttendees ?? 0) + regCount,
        maxAttendees: dbEvent.maxAttendees,
        price: dbEvent.price ?? 0,
        tags: Array.isArray(dbEvent.tags) ? dbEvent.tags : [],
        isRegistered,
        isSaved,
    };
}
async function getEventView(eventId, userId, viewerRole) {
    const include = {
        _count: { select: { registrations: true } },
    };
    if (userId) {
        include.registrations = { where: { userId }, select: { id: true } };
        include.saves = { where: { userId }, select: { id: true } };
    }
    const event = await prisma_1.prisma.event.findUnique({ where: { id: eventId }, include });
    if (!event)
        throw new errorHandler_1.ApiError(404, 'Event not found');
    if (event.isHidden && String(viewerRole).toUpperCase() !== 'ADMIN') {
        throw new errorHandler_1.ApiError(404, 'Event not found');
    }
    return eventView(event, userId);
}
/**
 * GET /api/events
 * Query params: type, q
 */
router.get('/', auth_1.optionalAuth, async (req, res, next) => {
    try {
        const type = typeof req.query.type === 'string' ? req.query.type : 'all';
        const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
        const dbType = type === 'all' ? null : dbEventTypeFromParam(type);
        const where = {
            ...(String(req.user?.role).toUpperCase() === 'ADMIN' ? {} : { isHidden: false }),
            ...(dbType ? { type: dbType } : {}),
            ...(q
                ? {
                    OR: [
                        { title: { contains: q, mode: 'insensitive' } },
                        { description: { contains: q, mode: 'insensitive' } },
                        // Best-effort tag match when q equals a tag.
                        { tags: { has: q } },
                    ],
                }
                : {}),
        };
        const include = { _count: { select: { registrations: true } } };
        if (req.user?.id) {
            include.registrations = { where: { userId: req.user.id }, select: { id: true } };
            include.saves = { where: { userId: req.user.id }, select: { id: true } };
        }
        const events = await prisma_1.prisma.event.findMany({
            where,
            include,
            orderBy: [{ isPinned: 'desc' }, { isFeatured: 'desc' }, { date: 'asc' }],
            take: 100,
        });
        res.json({ success: true, data: (events || []).map((e) => eventView(e, req.user?.id)) });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /api/events/:id
 */
router.get('/:id', auth_1.optionalAuth, async (req, res, next) => {
    try {
        res.json({ success: true, data: await getEventView(req.params.id, req.user?.id, req.user?.role) });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/events/:id/register
 */
router.post('/:id/register', auth_1.authenticate, async (req, res, next) => {
    try {
        // Ensure event exists
        await getEventView(req.params.id, undefined, req.user?.role);
        await prisma_1.prisma.eventRegistration.upsert({
            where: { eventId_userId: { eventId: req.params.id, userId: req.user.id } },
            update: {},
            create: { eventId: req.params.id, userId: req.user.id },
        });
        res.json({ success: true, data: await getEventView(req.params.id, req.user.id, req.user?.role) });
    }
    catch (err) {
        next(err);
    }
});
/**
 * DELETE /api/events/:id/register
 */
router.delete('/:id/register', auth_1.authenticate, async (req, res, next) => {
    try {
        // Ensure event exists
        await getEventView(req.params.id, undefined, req.user?.role);
        try {
            await prisma_1.prisma.eventRegistration.delete({
                where: { eventId_userId: { eventId: req.params.id, userId: req.user.id } },
            });
        }
        catch (err) {
            if (err?.code !== 'P2025')
                throw err;
        }
        res.json({ success: true, data: await getEventView(req.params.id, req.user.id, req.user?.role) });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/events/:id/save
 */
router.post('/:id/save', auth_1.authenticate, async (req, res, next) => {
    try {
        // Ensure event exists
        await getEventView(req.params.id, undefined, req.user?.role);
        await prisma_1.prisma.eventSave.upsert({
            where: { eventId_userId: { eventId: req.params.id, userId: req.user.id } },
            update: {},
            create: { eventId: req.params.id, userId: req.user.id },
        });
        res.json({ success: true, data: await getEventView(req.params.id, req.user.id, req.user?.role) });
    }
    catch (err) {
        next(err);
    }
});
/**
 * DELETE /api/events/:id/save
 */
router.delete('/:id/save', auth_1.authenticate, async (req, res, next) => {
    try {
        // Ensure event exists
        await getEventView(req.params.id, undefined, req.user?.role);
        try {
            await prisma_1.prisma.eventSave.delete({
                where: { eventId_userId: { eventId: req.params.id, userId: req.user.id } },
            });
        }
        catch (err) {
            if (err?.code !== 'P2025')
                throw err;
        }
        res.json({ success: true, data: await getEventView(req.params.id, req.user.id, req.user?.role) });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=event.routes.js.map