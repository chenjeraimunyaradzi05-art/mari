"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validate_auth_session_routes_1 = require("../scripts/validate-auth-session-routes");
describe('validateAuthSessionRoutes', () => {
    it('verifies change-password and session-revocation routes are present', () => {
        const result = (0, validate_auth_session_routes_1.validateAuthSessionRoutes)();
        expect(result.ok).toBe(true);
        expect(result.checks).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'change-password-route' }),
            expect.objectContaining({ name: 'session-revoke-route' }),
        ]));
    });
});
//# sourceMappingURL=auth-session-gate.test.js.map