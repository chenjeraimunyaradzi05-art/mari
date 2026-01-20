"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
// Keep metrics endpoint open in tests
delete process.env.METRICS_TOKEN;
const index_1 = require("../index");
describe('auth endpoints (validation-only)', () => {
    it('POST /api/auth/register returns 400 for invalid payload', async () => {
        await (0, supertest_1.default)(index_1.app)
            .post('/api/auth/register')
            .send({ email: 'not-an-email' })
            .expect(400);
    });
    it('POST /api/auth/login returns 400 for invalid payload', async () => {
        await (0, supertest_1.default)(index_1.app)
            .post('/api/auth/login')
            .send({ email: 'not-an-email', password: '' })
            .expect(400);
    });
    it('POST /api/auth/refresh returns 400 when refreshToken is missing', async () => {
        await (0, supertest_1.default)(index_1.app)
            .post('/api/auth/refresh')
            .send({})
            .expect(400);
    });
    it('POST /api/auth/logout returns 401 without Authorization header', async () => {
        await (0, supertest_1.default)(index_1.app)
            .post('/api/auth/logout')
            .send({})
            .expect(401);
    });
});
//# sourceMappingURL=auth.test.js.map