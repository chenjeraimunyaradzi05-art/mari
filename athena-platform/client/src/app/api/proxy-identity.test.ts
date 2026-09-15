import { clientIpFrom, proxyIdentityHeaders, PROXY_CLIENT_IP_HEADER, PROXY_SECRET_HEADER } from './proxy-identity';

const headers = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
});

describe('clientIpFrom', () => {
  it("prefers the platform's own header, then the first forwarded hop", () => {
    expect(clientIpFrom(headers({ 'x-nf-client-connection-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' }))).toBe('203.0.113.7');
    expect(clientIpFrom(headers({ 'x-forwarded-for': '198.51.100.1, 10.0.0.2' }))).toBe('198.51.100.1');
    expect(clientIpFrom(headers({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1');
  });

  it('ignores anything that is not an address', () => {
    expect(clientIpFrom(headers({ 'x-forwarded-for': 'evil.example' }))).toBeNull();
    expect(clientIpFrom(headers({ 'x-forwarded-for': '999.1.1.1' }))).toBeNull();
    expect(clientIpFrom(headers({ 'x-nf-client-connection-ip': ' ' }))).toBeNull();
    expect(clientIpFrom(headers({}))).toBeNull();
  });
});

describe('proxyIdentityHeaders', () => {
  it('forwards the browser identity and, with a secret, the visitor address', () => {
    const out = proxyIdentityHeaders(
      headers({ 'user-agent': 'Mozilla/5.0 Test', 'accept-language': 'en-AU', 'x-forwarded-for': '203.0.113.7' }),
      'shared-secret'
    );
    expect(out).toEqual({
      'user-agent': 'Mozilla/5.0 Test',
      'accept-language': 'en-AU',
      [PROXY_SECRET_HEADER]: 'shared-secret',
      [PROXY_CLIENT_IP_HEADER]: '203.0.113.7',
    });
  });

  it('sends no address without a secret, and no secret without an address', () => {
    const noSecret = proxyIdentityHeaders(headers({ 'x-forwarded-for': '203.0.113.7' }), undefined);
    expect(noSecret[PROXY_SECRET_HEADER]).toBeUndefined();
    expect(noSecret[PROXY_CLIENT_IP_HEADER]).toBeUndefined();

    const noAddress = proxyIdentityHeaders(headers({ 'user-agent': 'x' }), 'shared-secret');
    expect(noAddress[PROXY_SECRET_HEADER]).toBeUndefined();
    expect(noAddress).toEqual({ 'user-agent': 'x' });
  });
});
