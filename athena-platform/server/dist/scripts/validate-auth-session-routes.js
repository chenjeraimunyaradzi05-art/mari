"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAuthSessionRoutes = validateAuthSessionRoutes;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function validateAuthSessionRoutes() {
    const root = path_1.default.resolve(__dirname, '..', '..');
    const routeFile = path_1.default.join(root, 'src', 'routes', 'auth.routes.ts');
    const content = fs_1.default.existsSync(routeFile) ? fs_1.default.readFileSync(routeFile, 'utf8') : '';
    const checks = [
        {
            name: 'change-password-route',
            ok: /router\.post\(\s*['"]\/change-password/.test(content) &&
                content.includes('Current password is incorrect') &&
                content.includes('revokedAt: new Date()'),
            details: 'Change-password route should verify current password and revoke other sessions',
        },
        {
            name: 'session-revoke-route',
            ok: /router\.delete\(\s*['"]\/sessions\/:sessionId/.test(content) &&
                content.includes('Session revoked') &&
                content.includes('sessionService.revokeSession(session.id)'),
            details: 'Session revocation route should revoke a specific active session',
        },
    ];
    return {
        ok: checks.every((check) => check.ok),
        checks,
    };
}
if (require.main === module) {
    const result = validateAuthSessionRoutes();
    for (const check of result.checks) {
        const status = check.ok ? 'PASS' : 'FAIL';
        console.log(`${status} ${check.name}: ${check.details || ''}`.trim());
    }
    if (!result.ok) {
        process.exitCode = 1;
    }
}
//# sourceMappingURL=validate-auth-session-routes.js.map