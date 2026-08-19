import { buildTotpAuthUrl, normalizeTotpCode, verifyTotpCode } from '../totp';

describe('totp utilities', () => {
  it('verifies a known RFC 6238 SHA1 token with 6 digits', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    expect(verifyTotpCode('287082', secret, 59_000)).toBe(true);
    expect(verifyTotpCode('000000', secret, 59_000)).toBe(false);
  });

  it('normalizes user-entered codes and builds otpauth URLs', () => {
    expect(normalizeTotpCode('123 456')).toBe('123456');
    expect(normalizeTotpCode('abc123')).toBeNull();

    const url = buildTotpAuthUrl({
      issuer: 'ATHENA',
      accountName: 'user@example.com',
      secret: 'ABCDEF234567',
    });

    expect(url).toContain('otpauth://totp/ATHENA%3Auser%40example.com');
    expect(url).toContain('secret=ABCDEF234567');
  });
});
