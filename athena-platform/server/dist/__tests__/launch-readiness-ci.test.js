"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validate_launch_readiness_1 = require("../scripts/validate-launch-readiness");
describe('validateLaunchReadinessDocs', () => {
    it('verifies the launch readiness route and worker env configuration are present', () => {
        const result = (0, validate_launch_readiness_1.validateLaunchReadinessDocs)();
        expect(result.ok).toBe(true);
        expect(result.checks).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'launch-readiness-route' }),
            expect.objectContaining({ name: 'worker-env-config' }),
            expect.objectContaining({ name: 'dedicated-worker-startup' }),
            expect.objectContaining({ name: 'production-worker-env-template' }),
        ]));
    });
});
//# sourceMappingURL=launch-readiness-ci.test.js.map