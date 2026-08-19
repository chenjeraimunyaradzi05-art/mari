"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const origins_1 = require("../utils/origins");
// Ensure we don't require auth for metrics in this test suite
delete process.env.METRICS_TOKEN;
const index_1 = require("../index");
describe('ops endpoints', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalMetricsToken = process.env.METRICS_TOKEN;
    const originalDiagnosticsToken = process.env.HEALTH_DIAGNOSTICS_TOKEN;
    const originalDebugSecret = process.env.DEBUG_SECRET;
    const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
    const originalClientUrl = process.env.CLIENT_URL;
    const originalFrontendUrl = process.env.FRONTEND_URL;
    const originalNetlifyUrl = process.env.NETLIFY_URL;
    const originalDeployUrl = process.env.DEPLOY_URL;
    const originalCorsAllowPreviewOrigins = process.env.CORS_ALLOW_PREVIEW_ORIGINS;
    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalMetricsToken === undefined) {
            delete process.env.METRICS_TOKEN;
        }
        else {
            process.env.METRICS_TOKEN = originalMetricsToken;
        }
        if (originalDiagnosticsToken === undefined) {
            delete process.env.HEALTH_DIAGNOSTICS_TOKEN;
        }
        else {
            process.env.HEALTH_DIAGNOSTICS_TOKEN = originalDiagnosticsToken;
        }
        if (originalDebugSecret === undefined) {
            delete process.env.DEBUG_SECRET;
        }
        else {
            process.env.DEBUG_SECRET = originalDebugSecret;
        }
        if (originalAllowedOrigins === undefined) {
            delete process.env.ALLOWED_ORIGINS;
        }
        else {
            process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
        }
        if (originalClientUrl === undefined) {
            delete process.env.CLIENT_URL;
        }
        else {
            process.env.CLIENT_URL = originalClientUrl;
        }
        if (originalFrontendUrl === undefined) {
            delete process.env.FRONTEND_URL;
        }
        else {
            process.env.FRONTEND_URL = originalFrontendUrl;
        }
        if (originalNetlifyUrl === undefined) {
            delete process.env.NETLIFY_URL;
        }
        else {
            process.env.NETLIFY_URL = originalNetlifyUrl;
        }
        if (originalDeployUrl === undefined) {
            delete process.env.DEPLOY_URL;
        }
        else {
            process.env.DEPLOY_URL = originalDeployUrl;
        }
        if (originalCorsAllowPreviewOrigins === undefined) {
            delete process.env.CORS_ALLOW_PREVIEW_ORIGINS;
        }
        else {
            process.env.CORS_ALLOW_PREVIEW_ORIGINS = originalCorsAllowPreviewOrigins;
        }
    });
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
    it('GET /metrics returns 404 in production when no token is configured', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.METRICS_TOKEN;
        await (0, supertest_1.default)(index_1.app).get('/metrics').expect(404);
    });
    it('GET /health/auth-diag returns 404 in production without diagnostics access', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.METRICS_TOKEN;
        delete process.env.HEALTH_DIAGNOSTICS_TOKEN;
        delete process.env.DEBUG_SECRET;
        await (0, supertest_1.default)(index_1.app).get('/health/auth-diag').expect(404);
    });
    it('rejects preview deployment origins in production unless explicitly enabled', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.CORS_ALLOW_PREVIEW_ORIGINS;
        delete process.env.ALLOWED_ORIGINS;
        delete process.env.NETLIFY_URL;
        delete process.env.DEPLOY_URL;
        expect((0, origins_1.isCorsOriginAllowed)('https://preview-demo.netlify.app')).toBe(false);
        expect((0, origins_1.isCorsOriginAllowed)('https://api-preview.athena.example')).toBe(false);
    });
    it('allows explicitly configured production origins', () => {
        process.env.NODE_ENV = 'production';
        process.env.ALLOWED_ORIGINS = 'https://app.athena.example';
        process.env.NETLIFY_URL = 'https://athena.netlify.app';
        expect((0, origins_1.isCorsOriginAllowed)('https://app.athena.example')).toBe(true);
        expect((0, origins_1.isCorsOriginAllowed)('https://athena.netlify.app')).toBe(true);
    });
    it('allows configured frontend URLs in production', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.ALLOWED_ORIGINS;
        process.env.CLIENT_URL = 'https://phenomenal-paprenjak-3b6ed6.netlify.app';
        process.env.FRONTEND_URL = 'https://athena-empress.netlify.app';
        expect((0, origins_1.isCorsOriginAllowed)('https://phenomenal-paprenjak-3b6ed6.netlify.app')).toBe(true);
        expect((0, origins_1.isCorsOriginAllowed)('https://athena-empress.netlify.app')).toBe(true);
    });
});
//# sourceMappingURL=ops.test.js.map