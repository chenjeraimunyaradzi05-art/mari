/**
 * Which files are public and which are not, as the code addresses them and as
 * the bucket answers for them.
 *
 * Every upload used to be handed back as `${CDN_URL}/key`, résumés included, so
 * a CDN put in front of the whole bucket would have published every résumé to
 * anyone holding the address, and nothing could say whether it had. Private
 * folders are now addressed at the bucket, and checkMediaExposure asks the
 * bucket and the CDN from the outside, the way a stranger would.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

type Sent = { name: string; input: Record<string, unknown> };
const sent: Sent[] = [];
const mockSend = jest.fn<(command: { constructor: { name: string }; input: Record<string, unknown> }) => Promise<unknown>>();

jest.mock('@aws-sdk/client-s3', () => {
  class Command {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class PutObjectCommand extends Command {}
  class DeleteObjectCommand extends Command {}
  class HeadBucketCommand extends Command {}
  class S3Client {
    send(command: never) {
      return mockSend(command);
    }
  }
  return { PutObjectCommand, DeleteObjectCommand, HeadBucketCommand, S3Client };
});

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const PROBE_TEXT = 'ATHENA media exposure check. Safe to delete.';

/** The module under test, loaded after the environment is set, because it reads CDN_URL and the bucket name once. */
function load(env: Record<string, string | undefined>): typeof import('../media-storage') {
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  let loaded!: typeof import('../media-storage');
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh copy per environment
    loaded = require('../media-storage');
  });
  return loaded;
}

const ORIGINAL_ENV = { ...process.env };
const WITH_CDN = {
  AWS_ACCESS_KEY_ID: 'AKIAABCDEFGHIJKLMNOP',
  AWS_SECRET_ACCESS_KEY: 'x'.repeat(40),
  S3_BUCKET: 'athena-uploads-prod',
  AWS_REGION: 'ap-southeast-2',
  CDN_URL: 'https://cdn.athena.example/',
  NODE_ENV: 'production',
  API_URL: 'https://api.athena.example',
};

describe('how stored files are addressed', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('addresses a public file through the CDN and a private one at the bucket', () => {
    const storage = load(WITH_CDN);

    expect(storage.mediaUrlForKey('avatars/u1/a.webp')).toBe('https://cdn.athena.example/avatars/u1/a.webp');
    expect(storage.mediaUrlForKey('videos/u1/v.mp4')).toBe('https://cdn.athena.example/videos/u1/v.mp4');
    expect(storage.mediaUrlForKey('resumes/u1/cv.pdf')).toBe(
      'https://athena-uploads-prod.s3.ap-southeast-2.amazonaws.com/resumes/u1/cv.pdf'
    );
    expect(storage.mediaUrlForKey('documents/u1/deed.docx')).toBe(
      'https://athena-uploads-prod.s3.ap-southeast-2.amazonaws.com/documents/u1/deed.docx'
    );
  });

  it('recognises a private key whatever slashes it arrives with, and a look-alike folder as public', () => {
    const storage = load(WITH_CDN);

    expect(storage.isPrivateMediaKey('/resumes/u1/cv.pdf')).toBe(true);
    expect(storage.isPrivateMediaKey('resumes\\u1\\cv.pdf')).toBe(true);
    expect(storage.isPrivateMediaKey('resumes-backup/u1/cv.pdf')).toBe(false);
    expect(storage.isPrivateMediaKey('avatars/resumes/a.webp')).toBe(false);
  });

  it('keeps the key at the end of the URL, which is what the readers of a résumé row look for', () => {
    const storage = load(WITH_CDN);
    const key = 'resumes/u1/7f3a.pdf';
    expect(storage.mediaUrlForKey(key).endsWith(`/${key}`)).toBe(true);
  });

  it('stores a résumé-folder file and hands back the bucket address, never the CDN’s', async () => {
    const storage = load(WITH_CDN);

    const url = await storage.storeBuffer('resumes/u1/cv.pdf', Buffer.from('%PDF'), 'application/pdf');

    expect(url).not.toContain('cdn.athena.example');
    expect(url).toBe('https://athena-uploads-prod.s3.ap-southeast-2.amazonaws.com/resumes/u1/cv.pdf');
  });

  it('keeps the public address a bucket’s own when no CDN is set', () => {
    const storage = load({ ...WITH_CDN, CDN_URL: undefined });
    expect(storage.mediaUrlForKey('avatars/u1/a.webp')).toBe('https://athena-uploads-prod.s3.amazonaws.com/avatars/u1/a.webp');
  });
});

describe('checkMediaExposure', () => {
  beforeEach(() => {
    sent.length = 0;
    mockSend.mockReset();
    mockSend.mockImplementation(async (command) => {
      sent.push({ name: command.constructor.name, input: command.input });
      return {};
    });
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  /** An anonymous fetch that answers per address: the probe's text, an error page, or a refusal. */
  function strangerFetch(readableAt: (url: string) => 'probe' | 'html' | 'refused' | 'down') {
    return jest.fn(async (url: string | URL | Request) => {
      const answer = readableAt(String(url));
      if (answer === 'down') throw new Error('connect ETIMEDOUT');
      if (answer === 'refused') return new Response('<Error>AccessDenied</Error>', { status: 403 });
      if (answer === 'html') return new Response('<html>Sign in to continue</html>', { status: 200 });
      return new Response(PROBE_TEXT, { status: 200 });
    }) as unknown as typeof fetch;
  }

  const isPrivateAddress = (url: string) => url.includes('/resumes/');

  it('is fine when the public probe is readable and the private one is not, and removes both probes', async () => {
    const storage = load(WITH_CDN);
    const fetchImpl = strangerFetch((url) => (isPrivateAddress(url) ? 'refused' : 'probe'));

    const result = await storage.checkMediaExposure({ fetchImpl });

    expect(result.status).toBe('ok');
    expect(result.problems).toEqual([]);

    const puts = sent.filter((call) => call.name === 'PutObjectCommand').map((call) => String(call.input.Key));
    const deletes = sent.filter((call) => call.name === 'DeleteObjectCommand').map((call) => String(call.input.Key));
    expect(puts).toHaveLength(2);
    expect(puts.some((key) => key.startsWith('avatars/_exposure-check/'))).toBe(true);
    expect(puts.some((key) => key.startsWith('resumes/_exposure-check/'))).toBe(true);
    expect(deletes.sort()).toEqual([...puts].sort());
  });

  it('asks the way a stranger would: no credentials and no cookie', async () => {
    const storage = load(WITH_CDN);
    const fetchImpl = strangerFetch((url) => (isPrivateAddress(url) ? 'refused' : 'probe'));

    await storage.checkMediaExposure({ fetchImpl });

    for (const call of (fetchImpl as unknown as jest.Mock).mock.calls) {
      const init = call[1] as RequestInit | undefined;
      expect(init?.headers).toBeUndefined();
      expect(init?.credentials).toBeUndefined();
      expect(init?.redirect).toBe('manual');
    }
    // The public probe at its CDN address, the private one at the CDN and at the bucket.
    const asked = (fetchImpl as unknown as jest.Mock).mock.calls.map((call) => String(call[0]));
    expect(asked.filter((url) => url.startsWith('https://cdn.athena.example/avatars/'))).toHaveLength(1);
    expect(asked.filter((url) => url.startsWith('https://cdn.athena.example/resumes/'))).toHaveLength(1);
    expect(asked.filter((url) => url.startsWith('https://athena-uploads-prod.s3.ap-southeast-2.amazonaws.com/resumes/'))).toHaveLength(1);
  });

  it('reports exposed when the CDN serves a private probe, and names where', async () => {
    const storage = load(WITH_CDN);
    const fetchImpl = strangerFetch((url) => (url.startsWith('https://cdn.athena.example/') ? 'probe' : 'refused'));

    const result = await storage.checkMediaExposure({ fetchImpl });

    expect(result.status).toBe('exposed');
    expect(result.detail).toContain('https://cdn.athena.example/resumes/_exposure-check/<probe>.txt');
    expect(result.detail).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    // Still cleaned up.
    expect(sent.filter((call) => call.name === 'DeleteObjectCommand')).toHaveLength(2);
  });

  it('reports exposed when the bucket itself is public, even with a CDN that is not', async () => {
    const storage = load(WITH_CDN);
    const fetchImpl = strangerFetch((url) => (url.includes('.amazonaws.com/resumes/') ? 'probe' : url.includes('/resumes/') ? 'refused' : 'probe'));

    const result = await storage.checkMediaExposure({ fetchImpl });

    expect(result.status).toBe('exposed');
    expect(result.detail).toContain('athena-uploads-prod.s3.ap-southeast-2.amazonaws.com/resumes/');
  });

  it('reports public files that cannot be read, which is a bucket kept fully private with no CDN', async () => {
    const storage = load({ ...WITH_CDN, CDN_URL: undefined });
    const fetchImpl = strangerFetch(() => 'refused');

    const result = await storage.checkMediaExposure({ fetchImpl });

    expect(result.status).toBe('public_unreadable');
    expect(result.detail).toMatch(/Avatars, covers, post pictures and reels will not load/);
  });

  it('does not count an error page with a 200 as the file being readable', async () => {
    const storage = load(WITH_CDN);
    const fetchImpl = strangerFetch((url) => (isPrivateAddress(url) ? 'html' : 'probe'));

    const result = await storage.checkMediaExposure({ fetchImpl });

    expect(result.status).toBe('ok');
  });

  it('is unverified, not fine, when the private address cannot be reached at all', async () => {
    const storage = load(WITH_CDN);
    // The public probe reads, the private ones time out: nothing says they are safe.
    const fetchImpl = strangerFetch((url) => (isPrivateAddress(url) ? 'down' : 'probe'));

    const result = await storage.checkMediaExposure({ fetchImpl });

    expect(result.status).toBe('unverified');
    expect(result.detail).toMatch(/No answer from/);
    expect(result.detail).toContain('/resumes/_exposure-check/<probe>.txt');
    expect(result.detail).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(sent.filter((call) => call.name === 'DeleteObjectCommand')).toHaveLength(2);
  });

  it('is unverified, not "public files unreadable", when the public address cannot be reached', async () => {
    const storage = load(WITH_CDN);
    const fetchImpl = strangerFetch((url) => (isPrivateAddress(url) ? 'refused' : 'down'));

    const result = await storage.checkMediaExposure({ fetchImpl });

    expect(result.status).toBe('unverified');
    expect(result.detail).not.toMatch(/will not load/);
  });

  it('still reports exposed when one private address answers and the other cannot be reached', async () => {
    const storage = load(WITH_CDN);
    const fetchImpl = strangerFetch((url) =>
      url.startsWith('https://cdn.athena.example/resumes/') ? 'probe' : url.includes('.amazonaws.com/resumes/') ? 'down' : 'probe'
    );

    const result = await storage.checkMediaExposure({ fetchImpl });

    expect(result.status).toBe('exposed');
  });

  it('with no CDN set, checks the one address once and still finds an exposed private folder', async () => {
    const storage = load({ ...WITH_CDN, CDN_URL: undefined });
    const fetchImpl = strangerFetch(() => 'probe');

    const result = await storage.checkMediaExposure({ fetchImpl });

    expect(result.status).toBe('exposed');
    const privateAsks = (fetchImpl as unknown as jest.Mock).mock.calls.filter((call) => String(call[0]).includes('/resumes/'));
    expect(privateAsks.length).toBe(2);
  });

  it('is unverified, never fine, when the probe cannot be written', async () => {
    const storage = load(WITH_CDN);
    mockSend.mockImplementation(async (command) => {
      sent.push({ name: command.constructor.name, input: command.input });
      if (command.constructor.name === 'PutObjectCommand') throw new Error('AccessDenied');
      return {};
    });
    const fetchImpl = strangerFetch(() => 'probe');

    const result = await storage.checkMediaExposure({ fetchImpl });

    expect(result.status).toBe('unverified');
    expect(result.detail).toMatch(/AccessDenied/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('removes the first probe when the second cannot be written', async () => {
    const storage = load(WITH_CDN);
    let puts = 0;
    mockSend.mockImplementation(async (command) => {
      sent.push({ name: command.constructor.name, input: command.input });
      if (command.constructor.name === 'PutObjectCommand' && ++puts === 2) throw new Error('SlowDown');
      return {};
    });

    const result = await storage.checkMediaExposure({ fetchImpl: strangerFetch(() => 'probe') });

    expect(result.status).toBe('unverified');
    expect(sent.filter((call) => call.name === 'DeleteObjectCommand')).toHaveLength(1);
  });

  it('keeps its verdict when a probe cannot be deleted afterwards', async () => {
    const storage = load(WITH_CDN);
    mockSend.mockImplementation(async (command) => {
      sent.push({ name: command.constructor.name, input: command.input });
      if (command.constructor.name === 'DeleteObjectCommand') throw new Error('AccessDenied');
      return {};
    });

    const result = await storage.checkMediaExposure({ fetchImpl: strangerFetch((url) => (isPrivateAddress(url) ? 'refused' : 'probe')) });

    expect(result.status).toBe('ok');
  });

  it('says it does not apply when there is no bucket, and touches nothing', async () => {
    const storage = load({ ...WITH_CDN, AWS_ACCESS_KEY_ID: undefined, AWS_SECRET_ACCESS_KEY: undefined });
    const fetchImpl = strangerFetch(() => 'probe');

    const result = await storage.checkMediaExposure({ fetchImpl });

    expect(result.status).toBe('not_applicable');
    expect(mockSend).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
