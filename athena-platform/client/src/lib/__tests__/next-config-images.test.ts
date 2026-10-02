/**
 * @jest-environment node
 */

/**
 * next/image refuses a remote host it has not been told about. Avatars and
 * company logos come from wherever the API's CDN_URL points, which is the
 * owner's own domain, so the build reads it from NEXT_PUBLIC_MEDIA_HOST. Without
 * it every avatar on the feed would be answered with a refusal by
 * /_next/image in production.
 */

type Pattern = { protocol: string; hostname: string; port?: string };

function patternsWith(mediaHost: string | undefined): Pattern[] {
  const previous = process.env.NEXT_PUBLIC_MEDIA_HOST;
  if (mediaHost === undefined) delete process.env.NEXT_PUBLIC_MEDIA_HOST;
  else process.env.NEXT_PUBLIC_MEDIA_HOST = mediaHost;

  let patterns: Pattern[] = [];
  try {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- next.config.js is CommonJS, read fresh for each environment
      patterns = require('../../../next.config.js').images.remotePatterns;
    });
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_MEDIA_HOST;
    else process.env.NEXT_PUBLIC_MEDIA_HOST = previous;
  }
  return patterns;
}

const hosts = (patterns: Pattern[]) => patterns.map((pattern) => pattern.hostname);

describe('next/image remote hosts', () => {
  it('keeps the hosts it already trusted, and adds nothing when no media host is set', () => {
    const patterns = patternsWith(undefined);

    expect(hosts(patterns)).toEqual(
      expect.arrayContaining(['athena-media.s3.amazonaws.com', 'athena-media.s3.ap-southeast-2.amazonaws.com', '*.cloudfront.net', 'images.unsplash.com'])
    );
    expect(hosts(patterns)).not.toContain('cdn.athena.example');
  });

  it('adds the media host when one is set, as a host name', () => {
    expect(patternsWith('cdn.athena.example')).toContainEqual({ protocol: 'https', hostname: 'cdn.athena.example' });
  });

  it('accepts the URL the API was given as CDN_URL, trailing slash and all', () => {
    expect(patternsWith('https://cdn.athena.example/')).toContainEqual({ protocol: 'https', hostname: 'cdn.athena.example' });
    expect(patternsWith('https://athena-uploads-prod.s3.ap-southeast-2.amazonaws.com/avatars')).toContainEqual({
      protocol: 'https',
      hostname: 'athena-uploads-prod.s3.ap-southeast-2.amazonaws.com',
    });
  });

  it('takes several, separated by commas', () => {
    const patterns = patternsWith('cdn.athena.example, media.athena.example');
    expect(hosts(patterns)).toEqual(expect.arrayContaining(['cdn.athena.example', 'media.athena.example']));
  });

  it('refuses anything that is not a plain host name, and never produces a plain-http entry', () => {
    const before = patternsWith(undefined).length;
    const patterns = patternsWith('javascript:alert(1), cdn.athena.example:8443, , ex ample.org, -bad.org');

    expect(patterns).toHaveLength(before);
    expect(patterns.filter((pattern) => pattern.hostname === 'localhost' && pattern.protocol === 'http')).toHaveLength(1);
    expect(patternsWith('cdn.athena.example').every((pattern) => pattern.protocol === 'https' || pattern.hostname === 'localhost')).toBe(true);
  });
});
