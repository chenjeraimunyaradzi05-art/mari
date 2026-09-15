import { describe, expect, it, jest } from '@jest/globals';

// Hostnames here are made up, so name resolution is answered in the test.
jest.mock('dns/promises', () => {
  const api = {
    lookup: jest.fn(async (host: string) => {
      if (host === 'rebound.example') return [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }];
      if (host === 'nowhere.example') throw new Error('ENOTFOUND');
      return [{ address: '93.184.216.34', family: 4 }];
    }),
  };
  return { __esModule: true, default: api, ...api };
});

import { fetchPublic, isFetchableHost, isPrivateAddress } from '../outbound-url';

describe('isPrivateAddress', () => {
  it('names every range this server must not be sent to', () => {
    for (const address of [
      '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
      '100.64.0.1', '0.0.0.0', '192.0.0.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
      '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:7f00:1', '64:ff9b::10.0.0.1',
    ]) {
      expect({ address, private: isPrivateAddress(address) }).toEqual({ address, private: true });
    }
  });

  it('lets the public internet through', () => {
    for (const address of ['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:4700::1111', '::ffff:93.184.216.34']) {
      expect({ address, private: isPrivateAddress(address) }).toEqual({ address, private: false });
    }
  });

  it('treats anything that is not an address as private', () => {
    expect(isPrivateAddress('evil')).toBe(true);
    expect(isPrivateAddress('')).toBe(true);
  });
});

describe('isFetchableHost', () => {
  it('refuses the local names, literal private addresses and a name with any private answer', async () => {
    await expect(isFetchableHost('localhost')).resolves.toBe(false);
    await expect(isFetchableHost('db.internal')).resolves.toBe(false);
    await expect(isFetchableHost('printer.local')).resolves.toBe(false);
    await expect(isFetchableHost('169.254.169.254')).resolves.toBe(false);
    await expect(isFetchableHost('[::1]')).resolves.toBe(false);
    await expect(isFetchableHost('rebound.example')).resolves.toBe(false);
    await expect(isFetchableHost('nowhere.example')).resolves.toBe(false);
    await expect(isFetchableHost('')).resolves.toBe(false);
  });

  it('accepts a public name and a public address', async () => {
    await expect(isFetchableHost('example.com')).resolves.toBe(true);
    await expect(isFetchableHost('93.184.216.34')).resolves.toBe(true);
  });
});

describe('fetchPublic', () => {
  it('refuses schemes, credentials and private hosts without touching the network', async () => {
    const spy = jest.spyOn(globalThis, 'fetch');
    await expect(fetchPublic('ftp://example.com/x')).resolves.toBeNull();
    await expect(fetchPublic('javascript:alert(1)')).resolves.toBeNull();
    await expect(fetchPublic('https://user:pw@example.com/x')).resolves.toBeNull();
    await expect(fetchPublic('http://169.254.169.254/latest/meta-data')).resolves.toBeNull();
    await expect(fetchPublic('not a url')).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('checks every redirect hop and stops at one that turns inward', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === 'https://example.com/start') {
        return new Response(null, { status: 302, headers: { location: 'http://10.0.0.5/secret' } });
      }
      return new Response('ok', { status: 200 });
    });
    await expect(fetchPublic('https://example.com/start')).resolves.toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('follows a public redirect and gives up after the limit', async () => {
    let hops = 0;
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      hops += 1;
      return new Response(null, { status: 302, headers: { location: `https://example.com/${hops}` } });
    });
    await expect(fetchPublic('https://example.com/start', { maxRedirects: 2 })).resolves.toBeNull();
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();

    const ok = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/start')
        ? new Response(null, { status: 301, headers: { location: '/landed' } })
        : new Response('landed', { status: 200 })
    );
    const response = await fetchPublic('https://example.com/start');
    expect(response?.status).toBe(200);
    await expect(response!.text()).resolves.toBe('landed');
    ok.mockRestore();
  });
});
