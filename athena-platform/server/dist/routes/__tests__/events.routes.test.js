"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const globals_1 = require("@jest/globals");
globals_1.jest.mock('../../utils/prisma', () => ({
    prisma: {
        event: {
            findMany: globals_1.jest.fn(),
            findUnique: globals_1.jest.fn(),
        },
        eventRegistration: {
            upsert: globals_1.jest.fn(),
            delete: globals_1.jest.fn(),
        },
        eventSave: {
            upsert: globals_1.jest.fn(),
            delete: globals_1.jest.fn(),
        },
    },
}));
globals_1.jest.mock('../../middleware/auth', () => ({
    authenticate: (req, _res, next) => {
        req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
        next();
    },
    optionalAuth: (req, _res, next) => {
        if (req.headers['x-test-auth'] === '1') {
            req.user = { id: 'user-123', role: 'USER', email: 'user@athena.com' };
        }
        next();
    },
    requireRole: (..._roles) => (_req, __res, next) => next(),
    requirePremium: (_req, _res, next) => next(),
}));
globals_1.jest.mock('../../utils/logger', () => ({
    logger: {
        debug: globals_1.jest.fn(),
        info: globals_1.jest.fn(),
        warn: globals_1.jest.fn(),
        error: globals_1.jest.fn(),
    },
}));
const index_1 = require("../../index");
const prisma_1 = require("../../utils/prisma");
const prisma = prisma_1.prisma;
(0, globals_1.describe)('Events routes (Prisma-backed)', () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.it)('GET /api/events returns events with computed attendees', async () => {
        prisma.event.findMany.mockResolvedValue([
            {
                id: 'e1',
                title: 'Panel',
                description: 'Desc',
                type: 'WEBINAR',
                format: 'VIRTUAL',
                date: new Date('2026-01-20T00:00:00.000Z'),
                startTime: '10:00 AM',
                endTime: '11:00 AM',
                location: null,
                link: 'https://x',
                image: 'https://img',
                hostName: 'Host',
                hostTitle: 'Title',
                hostAvatar: 'https://ava',
                baseAttendees: 10,
                maxAttendees: 100,
                price: 0,
                tags: ['Tech'],
                _count: { registrations: 3 },
            },
        ]);
        const res = await (0, supertest_1.default)(index_1.app).get('/api/events?type=all').expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data).toHaveLength(1);
        (0, globals_1.expect)(res.body.data[0].type).toBe('webinar');
        (0, globals_1.expect)(res.body.data[0].format).toBe('virtual');
        (0, globals_1.expect)(res.body.data[0].attendees).toBe(13);
        (0, globals_1.expect)(res.body.data[0].isRegistered).toBe(false);
        (0, globals_1.expect)(res.body.data[0].isSaved).toBe(false);
    });
    (0, globals_1.it)('POST /api/events/:id/register upserts registration and returns isRegistered=true', async () => {
        // First getEventView (ensure exists)
        prisma.event.findUnique
            .mockResolvedValueOnce({
            id: 'e1',
            title: 'Panel',
            description: 'Desc',
            type: 'WEBINAR',
            format: 'VIRTUAL',
            date: new Date('2026-01-20T00:00:00.000Z'),
            startTime: '10:00 AM',
            endTime: '11:00 AM',
            image: 'https://img',
            hostName: 'Host',
            hostTitle: 'Title',
            hostAvatar: 'https://ava',
            baseAttendees: 0,
            price: 0,
            tags: [],
            _count: { registrations: 0 },
        })
            // Second getEventView (after upsert, user-scoped include)
            .mockResolvedValueOnce({
            id: 'e1',
            title: 'Panel',
            description: 'Desc',
            type: 'WEBINAR',
            format: 'VIRTUAL',
            date: new Date('2026-01-20T00:00:00.000Z'),
            startTime: '10:00 AM',
            endTime: '11:00 AM',
            image: 'https://img',
            hostName: 'Host',
            hostTitle: 'Title',
            hostAvatar: 'https://ava',
            baseAttendees: 0,
            price: 0,
            tags: [],
            _count: { registrations: 1 },
            registrations: [{ id: 'er_1' }],
            saves: [],
        });
        prisma.eventRegistration.upsert.mockResolvedValue({ id: 'er_1' });
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/events/e1/register')
            .set('x-test-auth', '1')
            .send({})
            .expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data.isRegistered).toBe(true);
        (0, globals_1.expect)(prisma.eventRegistration.upsert).toHaveBeenCalled();
    });
    (0, globals_1.it)('POST /api/events/:id/save upserts save and returns isSaved=true', async () => {
        prisma.event.findUnique
            .mockResolvedValueOnce({
            id: 'e1',
            title: 'Panel',
            description: 'Desc',
            type: 'WEBINAR',
            format: 'VIRTUAL',
            date: new Date('2026-01-20T00:00:00.000Z'),
            startTime: '10:00 AM',
            endTime: '11:00 AM',
            image: 'https://img',
            hostName: 'Host',
            hostTitle: 'Title',
            hostAvatar: 'https://ava',
            baseAttendees: 0,
            price: 0,
            tags: [],
            _count: { registrations: 0 },
        })
            .mockResolvedValueOnce({
            id: 'e1',
            title: 'Panel',
            description: 'Desc',
            type: 'WEBINAR',
            format: 'VIRTUAL',
            date: new Date('2026-01-20T00:00:00.000Z'),
            startTime: '10:00 AM',
            endTime: '11:00 AM',
            image: 'https://img',
            hostName: 'Host',
            hostTitle: 'Title',
            hostAvatar: 'https://ava',
            baseAttendees: 0,
            price: 0,
            tags: [],
            _count: { registrations: 0 },
            registrations: [],
            saves: [{ id: 'es_1' }],
        });
        prisma.eventSave.upsert.mockResolvedValue({ id: 'es_1' });
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/events/e1/save')
            .set('x-test-auth', '1')
            .send({})
            .expect(200);
        (0, globals_1.expect)(res.body.success).toBe(true);
        (0, globals_1.expect)(res.body.data.isSaved).toBe(true);
        (0, globals_1.expect)(prisma.eventSave.upsert).toHaveBeenCalled();
    });
});
//# sourceMappingURL=events.routes.test.js.map