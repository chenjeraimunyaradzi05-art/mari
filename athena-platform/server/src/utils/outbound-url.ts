/**
 * Fetching a URL a member gave us, without reaching anything of ours.
 *
 * This server sits on a network with things the internet cannot see: the
 * database, Redis, the ML service, a cloud metadata endpoint. A link in a
 * post, a video source, an image someone pastes: each is untrusted input
 * that names an address, and following it blindly would let a member make
 * this server fetch from inside its own network. Only public http(s) hosts
 * are fetched. Every redirect hop is checked again, because a public page
 * can answer with a 302 to a private one. Name resolution is checked once;
 * a name that changes its answer between the check and the fetch (DNS
 * rebinding) is the residual risk, narrowed by the short timeout.
 */

import dns from 'dns/promises';
import net from 'net';

/**
 * Addresses no member-supplied URL may point at: loopback, link-local
 * (cloud metadata lives there), the private ranges, carrier NAT,
 * benchmarking, multicast, reserved, and their IPv6 counterparts.
 */
export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (!net.isIPv6(address)) return true;
  const lower = address.toLowerCase();

  // An IPv4 address carried inside IPv6 is judged as that IPv4 address.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower) ?? /^64:ff9b::(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower);
  if (mapped) return isPrivateAddress(mapped[1]);
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }

  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb') ||
    lower.startsWith('ff')
  );
}

/** Whether a hostname names only public addresses. Resolves names once. */
export async function isFetchableHost(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) {
    return false;
  }
  const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (net.isIP(bare)) return !isPrivateAddress(bare);
  try {
    const records = await dns.lookup(bare, { all: true });
    return records.length > 0 && records.every((record) => !isPrivateAddress(record.address));
  } catch {
    return false;
  }
}

export interface FetchPublicOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** How many redirects to follow, each hop checked. Default 3. */
  maxRedirects?: number;
  method?: 'GET' | 'HEAD';
}

/**
 * Fetches a public http(s) URL, following at most a few redirects and
 * checking every hop against the private-host rules. Null when the URL, or
 * any hop, is not one this server will reach. Letting fetch follow
 * redirects itself would check only the first URL.
 */
export async function fetchPublic(url: string | URL, options: FetchPublicOptions = {}): Promise<Response | null> {
  let current: URL;
  try {
    current = new URL(String(url));
  } catch {
    return null;
  }
  const maxRedirects = options.maxRedirects ?? 3;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (!/^https?:$/.test(current.protocol)) return null;
    if (current.username || current.password) return null;
    if (!(await isFetchableHost(current.hostname))) return null;

    const response = await fetch(current.toString(), {
      method: options.method ?? 'GET',
      signal: options.signal,
      redirect: 'manual',
      headers: options.headers,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      response.body?.cancel().catch(() => {});
      if (!location) return null;
      try {
        current = new URL(location, current);
      } catch {
        return null;
      }
      continue;
    }
    return response;
  }
  return null;
}
