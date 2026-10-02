/**
 * @jest-environment node
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS build script with no type declarations
const { sourceMapWarning } = require('../../scripts/check-web-env') as {
  sourceMapWarning: (env: Record<string, string | undefined>) => string[];
};

/**
 * A DSN with no way to upload source maps still reports errors, but every
 * stack trace points into minified code. That is worth saying at build time,
 * and not worth failing a deploy over.
 */
describe('check-web-env source map warning', () => {
  it('says nothing when Sentry is not in use', () => {
    expect(sourceMapWarning({})).toEqual([]);
    expect(sourceMapWarning({ SENTRY_AUTH_TOKEN: 'x' })).toEqual([]);
  });

  it('says nothing when the DSN comes with everything the build needs', () => {
    expect(
      sourceMapWarning({
        NEXT_PUBLIC_SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1',
        SENTRY_AUTH_TOKEN: 'sntrys_x',
        SENTRY_ORG: 'athena',
        SENTRY_PROJECT: 'web',
      })
    ).toEqual([]);
  });

  it('names the missing token when only the DSN is set, without printing a value', () => {
    const lines = sourceMapWarning({
      NEXT_PUBLIC_SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1',
      SENTRY_ORG: 'athena',
      SENTRY_PROJECT: 'web',
    }).join('\n');

    expect(lines).toContain('SENTRY_AUTH_TOKEN is not visible');
    expect(lines).not.toContain('SENTRY_ORG');
    expect(lines).not.toContain('key@o1');
  });

  it('names every missing variable, and treats blank as missing', () => {
    const lines = sourceMapWarning({ NEXT_PUBLIC_SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1', SENTRY_ORG: '   ' }).join('\n');
    expect(lines).toContain('SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT are not visible');
  });
});
