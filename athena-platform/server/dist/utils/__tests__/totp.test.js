"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const totp_1 = require("../totp");
describe('totp utilities', () => {
    it('verifies a known RFC 6238 SHA1 token with 6 digits', () => {
        const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
        expect((0, totp_1.verifyTotpCode)('287082', secret, 59_000)).toBe(true);
        expect((0, totp_1.verifyTotpCode)('000000', secret, 59_000)).toBe(false);
    });
    it('normalizes user-entered codes and builds otpauth URLs', () => {
        expect((0, totp_1.normalizeTotpCode)('123 456')).toBe('123456');
        expect((0, totp_1.normalizeTotpCode)('abc123')).toBeNull();
        const url = (0, totp_1.buildTotpAuthUrl)({
            issuer: 'ATHENA',
            accountName: 'user@example.com',
            secret: 'ABCDEF234567',
        });
        expect(url).toContain('otpauth://totp/ATHENA%3Auser%40example.com');
        expect(url).toContain('secret=ABCDEF234567');
    });
});
//# sourceMappingURL=totp.test.js.map