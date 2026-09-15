/**
 * What the API needs to know about the visitor behind a proxied request.
 *
 * The route handlers under app/api fetch the API from the web host's own
 * addresses, so without help the API would see every visitor as that host:
 * one shared rate-limit budget for the whole site, a login lockout keyed on
 * the wrong address, and new-device alerts that compare the wrong browser.
 *
 * This forwards the browser's user agent and language as they are, and the
 * visitor's address together with the shared secret the API checks before
 * believing it (PROXY_SHARED_SECRET on both sides). Without the secret the
 * address is not sent at all; a guess would only be ignored.
 *
 * Server-only: the secret must never reach a client bundle. It lives under
 * app/api, which Next.js only ever runs on the server.
 */

export const PROXY_SECRET_HEADER = 'x-athena-proxy-secret';
export const PROXY_CLIENT_IP_HEADER = 'x-athena-client-ip';

export type HeaderReader = { get(name: string): string | null };

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
// Hex groups with at most one "::", optionally ending in a dotted IPv4.
const IPV6 = /^(?=.*:)[0-9a-f:.]{2,45}$/i;

function isIp(value: string): boolean {
  if (IPV4.test(value)) return true;
  if (!IPV6.test(value)) return false;
  const doubleColons = value.split('::').length - 1;
  return doubleColons <= 1 && !/:{3,}/.test(value);
}

/**
 * The visitor's address as the platform in front of us reports it. Netlify
 * names it outright; other hosts leave the first entry of X-Forwarded-For.
 */
export function clientIpFrom(headers: HeaderReader): string | null {
  const candidates = [
    headers.get('x-nf-client-connection-ip'),
    headers.get('x-forwarded-for')?.split(',')[0],
    headers.get('x-real-ip'),
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && isIp(value)) return value;
  }
  return null;
}

/** Headers to add to a request forwarded to the API on the visitor's behalf. */
export function proxyIdentityHeaders(
  headers: HeaderReader,
  secret: string | undefined = process.env.PROXY_SHARED_SECRET
): Record<string, string> {
  const out: Record<string, string> = {};

  const userAgent = headers.get('user-agent')?.trim();
  if (userAgent) out['user-agent'] = userAgent.slice(0, 512);

  const language = headers.get('accept-language')?.trim();
  if (language) out['accept-language'] = language.slice(0, 256);

  const trimmedSecret = secret?.trim();
  const ip = clientIpFrom(headers);
  if (trimmedSecret && ip) {
    out[PROXY_SECRET_HEADER] = trimmedSecret;
    out[PROXY_CLIENT_IP_HEADER] = ip;
  }

  return out;
}
