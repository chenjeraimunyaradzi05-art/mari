"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const TEST_USER = {
    id: 'user_test_1',
    email: 'test.user@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'USER',
    persona: 'EARLY_CAREER',
    referralCode: 'REFTEST1',
};
const REGISTER_EMAIL = 'new.user@example.com';
jest.mock('../utils/email', () => ({
    sendVerificationEmail: jest.fn(async () => true),
    sendPasswordResetEmail: jest.fn(async () => true),
    sendWelcomeEmail: jest.fn(async () => true),
}));
jest.mock('../utils/password', () => ({
    hashPassword: jest.fn(async () => 'hashed-password'),
    comparePassword: jest.fn(async () => true),
}));
jest.mock('../utils/jwt', () => {
    const actual = jest.requireActual('../utils/jwt');
    return {
        ...actual,
        verifyToken: jest.fn(() => ({
            userId: TEST_USER.id,
            email: TEST_USER.email,
            role: TEST_USER.role,
            persona: TEST_USER.persona,
        })),
    };
});
jest.mock('../utils/prisma', () => {
    const SESSION = {
        id: 'sess_test_1',
        userId: TEST_USER.id,
        refreshToken: 'refresh_token_test_1',
    };
    const prisma = {
        user: {
            findUnique: jest.fn(async ({ where }) => {
                if (where?.email) {
                    const email = String(where.email).toLowerCase();
                    if (email === TEST_USER.email) {
                        return {
                            ...TEST_USER,
                            passwordHash: 'hashed-password',
                            avatar: null,
                        };
                    }
                    return null;
                }
                if (where?.referralCode)
                    return null;
                if (where?.id) {
                    if (where.id === TEST_USER.id) {
                        return {
                            id: TEST_USER.id,
                            email: TEST_USER.email,
                            role: TEST_USER.role,
                            persona: TEST_USER.persona,
                        };
                    }
                    return null;
                }
                return null;
            }),
            create: jest.fn(async () => ({
                id: TEST_USER.id,
                email: REGISTER_EMAIL,
                firstName: TEST_USER.firstName,
                lastName: TEST_USER.lastName,
                role: TEST_USER.role,
                persona: TEST_USER.persona,
                referralCode: TEST_USER.referralCode,
            })),
            update: jest.fn(async () => ({})),
        },
        verificationToken: {
            create: jest.fn(async () => ({})),
            deleteMany: jest.fn(async () => ({})),
            findFirst: jest.fn(async () => null),
        },
        session: {
            create: jest.fn(async () => ({})),
            deleteMany: jest.fn(async () => ({ count: 0 })),
            findFirst: jest.fn(async ({ where }) => {
                if (where?.refreshToken && where?.userId) {
                    if (where.refreshToken === SESSION.refreshToken && where.userId === SESSION.userId) {
                        return SESSION;
                    }
                }
                return null;
            }),
            update: jest.fn(async () => ({})),
        },
        referral: {
            create: jest.fn(async () => ({})),
        },
        notification: {
            create: jest.fn(async () => ({})),
        },
        subscription: {
            findUnique: jest.fn(async () => null),
        },
        $queryRaw: jest.fn(async () => 1),
        $disconnect: jest.fn(async () => undefined),
    };
    return { prisma };
});
// Import after mocks are declared
const index_1 = require("../index");
describe('auth endpoints (happy path, mocked prisma)', () => {
    it('POST /api/auth/register returns 201 and tokens', async () => {
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/auth/register')
            .send({
            email: 'NEW.USER@EXAMPLE.COM',
            password: 'Password123',
            firstName: 'Test',
            lastName: 'User',
        })
            .expect(201);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body?.data?.user?.email).toBe('new.user@example.com');
        expect(typeof res.body?.data?.accessToken).toBe('string');
        expect(res.body.data.accessToken.length).toBeGreaterThan(10);
        expect(typeof res.body?.data?.refreshToken).toBe('string');
        expect(res.body.data.refreshToken.length).toBeGreaterThan(10);
    });
    it('POST /api/auth/login returns 200 and tokens', async () => {
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/auth/login')
            .send({
            email: TEST_USER.email,
            password: 'Password123',
        })
            .expect(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body?.data?.user?.id).toBe(TEST_USER.id);
        expect(res.body?.data?.user?.email).toBe(TEST_USER.email);
        expect(typeof res.body?.data?.accessToken).toBe('string');
        expect(res.body.data.accessToken.length).toBeGreaterThan(10);
        expect(typeof res.body?.data?.refreshToken).toBe('string');
        expect(res.body.data.refreshToken.length).toBeGreaterThan(10);
    });
    it('POST /api/auth/refresh returns 200 and new tokens for a valid session', async () => {
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/auth/refresh')
            .send({ refreshToken: 'refresh_token_test_1' })
            .expect(200);
        expect(res.body).toHaveProperty('success', true);
        expect(typeof res.body?.data?.accessToken).toBe('string');
        expect(res.body.data.accessToken.length).toBeGreaterThan(10);
        expect(typeof res.body?.data?.refreshToken).toBe('string');
        expect(res.body.data.refreshToken.length).toBeGreaterThan(10);
    });
    it('POST /api/auth/register allows empty persona and defaults', async () => {
        const res = await (0, supertest_1.default)(index_1.app)
            .post('/api/auth/register')
            .send({
            email: 'empty.persona@example.com',
            password: 'Password123',
            firstName: 'Empty',
            lastName: 'Persona',
            persona: '',
        })
            .expect(201);
        expect(res.body).toHaveProperty('success', true);
        expect(typeof res.body?.data?.accessToken).toBe('string');
        expect(typeof res.body?.data?.refreshToken).toBe('string');
    });
});
//# sourceMappingURL=auth.happy.test.js.map