"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const index_1 = __importDefault(require("../index"));
const prisma_1 = require("../utils/prisma");
describe('Registration Debug', () => {
    const email = `test_debug_${Date.now()}@example.com`;
    afterAll(async () => {
        // Clean up
        try {
            await prisma_1.prisma.user.delete({ where: { email } }).catch(() => { });
        }
        catch (e) { }
        await prisma_1.prisma.$disconnect();
    });
    it('should register a new user successfully', async () => {
        const res = await (0, supertest_1.default)(index_1.default)
            .post('/api/auth/register')
            .send({
            email,
            password: 'Password123!',
            firstName: 'Test',
            lastName: 'User',
            persona: 'EARLY_CAREER'
        });
        if (res.status !== 201) {
            console.error('Registration failed:', JSON.stringify(res.body, null, 2));
        }
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });
});
//# sourceMappingURL=register_debug.test.js.map