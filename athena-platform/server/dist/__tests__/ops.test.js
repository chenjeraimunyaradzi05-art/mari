"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
// Ensure we don't require auth for metrics in this test suite
delete process.env.METRICS_TOKEN;
const index_1 = require("../index");
describe('ops endpoints', () => {
    it('GET /health returns 200', async () => {
        await (0, supertest_1.default)(index_1.app).get('/health').expect(200);
    });
    it('GET /livez returns 200', async () => {
        await (0, supertest_1.default)(index_1.app).get('/livez').expect(200);
    });
    it('GET /metrics returns 200 and includes http_requests_total', async () => {
        const res = await (0, supertest_1.default)(index_1.app).get('/metrics').expect(200);
        expect(res.text).toContain('http_requests_total');
    });
});
//# sourceMappingURL=ops.test.js.map