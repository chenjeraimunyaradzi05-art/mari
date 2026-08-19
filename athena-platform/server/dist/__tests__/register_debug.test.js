"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const CREATED_USER = {
    id: 'user_register_debug_1',
    email: 'debug.user@example.com',
    firstName: 'Debug',
    lastName: 'User',
    role: 'USER',
    persona: 'MID_CAREER',
    referralCode: 'ATHENA42',
};
jest.mock('../utils/email', () => ({
    sendVerificationEmail: jest.fn(async () => true),
    sendPasswordResetEmail: jest.fn(async () => true),
    sendWelcomeEmail: jest.fn(async () => true),
}));
jest.mock('../utils/password', () => ({
    hashPassword: jest.fn(async () => 'hashed-password'),
    comparePassword: jest.fn(async () => true),
}));
jest.mock('../utils/prisma', () => {
    const prisma = {
        user: {
            findUnique: jest.fn(async ({ where }) => {
                if (where?.email)
                    return null;
                if (where?.referralCode)
                    return null;
                return null;
            }),
            create: jest.fn(async ({ data }) => ({
                ...CREATED_USER,
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
                persona: data.persona,
            })),
            update: jest.fn(async () => ({})),
        },
        inviteCode: {
            findFirst: jest.fn(async ({ where }) => ({
                id: 'invite_debug_1',
                code: where.code,
                usesCount: 0,
                maxUses: 1,
                isActive: true,
            })),
            updateMany: jest.fn(async () => ({ count: 1 })),
        },
        verificationToken: {
            create: jest.fn(async () => ({})),
            deleteMany: jest.fn(async () => ({})),
            findFirst: jest.fn(async () => null),
        },
        session: {
            create: jest.fn(async () => ({})),
            findFirst: jest.fn(async () => null),
            update: jest.fn(async () => ({})),
            deleteMany: jest.fn(async () => ({ count: 0 })),
        },
        referral: {
            create: jest.fn(async () => ({})),
            findFirst: jest.fn(async () => null),
            update: jest.fn(async () => ({})),
        },
        notification: {
            create: jest.fn(async () => ({})),
        },
        subscription: {
            findUnique: jest.fn(async () => null),
        },
        $queryRaw: jest.fn(async () => 1),
        $disconnect: jest.fn(async () => undefined),
        $transaction: jest.fn(async (operationsOrCallback) => {
            if (typeof operationsOrCallback === 'function') {
                return operationsOrCallback(prisma);
            }
            return operationsOrCallback;
        }),
    };
    return { prisma };
});
const index_1 = require("../index");
const prisma_1 = require("../utils/prisma");
function getSetCookieHeader(res) {
    const header = res.headers['set-cookie'];
    if (Array.isArray(header)) {
        return header.join(';');
    }
    return header || '';
}
describe('registration flow (mocked prisma)', () => {
    it('registers a new user with a normalized email and invite code without a live database', async () => {
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/auth/register')
            .send({
            email: 'DEBUG.USER@EXAMPLE.COM',
            password: 'Password123!',
            firstName: 'Debug',
            lastName: 'User',
            persona: 'mid_career',
            womanSelfAttested: true,
            inviteCode: 'athena-2026',
        })
            .expect(201);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body?.data?.user?.email).toBe('debug.user@example.com');
        expect(res.body?.data?.user?.persona).toBe('MID_CAREER');
        expect(res.body?.data?.verificationRequired).toBe(true);
        expect(res.body?.data?.accessToken).toBeUndefined();
        expect(getSetCookieHeader(res)).not.toContain('refreshToken=');
        expect(prisma_1.prisma.user.findUnique).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { email: 'debug.user@example.com' } }));
        expect(prisma_1.prisma.inviteCode.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ code: 'ATHENA-2026', isActive: true }),
        }));
        expect(prisma_1.prisma.inviteCode.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: expect.objectContaining({ id: 'invite_debug_1', isActive: true }),
            data: expect.objectContaining({
                usesCount: { increment: 1 },
            }),
        }));
        expect(prisma_1.prisma.inviteCode.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
            where: expect.objectContaining({ id: 'invite_debug_1', usesCount: { gte: 1 } }),
            data: { isActive: false },
        }));
        expect(prisma_1.prisma.verificationToken.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                token: expect.stringMatching(/^[a-f0-9]{64}$/),
            }),
        }));
        expect(prisma_1.prisma.session.create).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=register_debug.test.js.map