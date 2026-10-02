#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Fails a Netlify build that would deploy a web host unable to serve.
 *
 * instrumentation.ts refuses to serve in production without
 * PROXY_SHARED_SECRET, because without it the API cannot tell one member's
 * request from another's: one login budget for the whole site, a lockout that
 * locks everyone out together, and no new-device alerts. That refusal happens
 * when the first request reaches the new deploy, which is too late: the deploy
 * is already live, and every dynamic page answers with an error. Failing here
 * instead keeps the deploy that is serving now, and names the variable.
 *
 * It runs only where Netlify builds (NETLIFY=true, set by Netlify's own build
 * and by `netlify deploy --build`). A developer's `npm run build` and the CI
 * build are not deploys and are not checked; CI's `next start` gets a secret
 * of its own for the same reason instrumentation.ts wants one.
 *
 * The variable must be visible to builds as well as to functions. Netlify
 * gives a new variable every scope by default; if it was narrowed to
 * Functions, this build cannot see it and says so, which is the one false
 * alarm it can raise. Widen the scope, or add Builds, and redeploy.
 *
 * It also says, without failing the build, when the error tracker is connected
 * but cannot read the code: a NEXT_PUBLIC_SENTRY_DSN with no SENTRY_AUTH_TOKEN
 * (or no SENTRY_ORG and SENTRY_PROJECT) means errors will arrive, but pointing
 * at minified lines, because the build has no credential to upload source maps.
 * That is a degraded state rather than a broken deploy, so it is a warning.
 *
 * Values are never printed.
 *
 * Usage: node scripts/check-web-env.js   # exits 1 on a Netlify build without the secret
 */

const MIN_PROXY_SECRET_LENGTH = 32;

/**
 * Lines to print when Sentry is switched on but source maps cannot be
 * uploaded; empty when all is well or when Sentry is not in use at all.
 */
function sourceMapWarning(env) {
  const present = (name) => (env[name] || '').trim().length > 0;
  if (!present('NEXT_PUBLIC_SENTRY_DSN')) return [];

  const missing = ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT'].filter((name) => !present(name));
  if (missing.length === 0) return [];

  return [
    '',
    `  check-web-env: warning: NEXT_PUBLIC_SENTRY_DSN is set but ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not visible to this build.`,
    '  Errors will still be reported, but they will point at minified code, because the build cannot upload',
    '  source maps without them. Add the missing variable(s) in Netlify (Environment variables, Builds scope;',
    '  SENTRY_AUTH_TOKEN is a Sentry organisation token and is a secret), then deploy again.',
    '',
  ];
}

function main() {
  if (process.env.NETLIFY !== 'true') {
    console.log('check-web-env: not a Netlify build; nothing to check.');
    return;
  }

  const warning = sourceMapWarning(process.env);
  if (warning.length > 0) console.warn(warning.join('\n'));

  const secret = (process.env.PROXY_SHARED_SECRET || '').trim();
  if (secret.length >= MIN_PROXY_SECRET_LENGTH) {
    console.log('check-web-env: PROXY_SHARED_SECRET is set.');
    return;
  }

  const context = process.env.CONTEXT || 'unknown';
  console.error(
    [
      '',
      `  check-web-env: PROXY_SHARED_SECRET is ${secret ? `shorter than ${MIN_PROXY_SECRET_LENGTH} characters` : 'not set'} for this build (context: ${context}).`,
      '',
      '  The web host refuses to serve in production without it (instrumentation.ts), so this deploy',
      '  would answer every dynamic page with an error. The build is stopped here instead, and the',
      '  deploy that is serving now stays live.',
      '',
      '  Set it in Netlify: Site configuration > Environment variables > PROXY_SHARED_SECRET,',
      `  the same value as the API's, at least ${MIN_PROXY_SECRET_LENGTH} characters (openssl rand -hex 32),`,
      '  with the Builds and Functions scopes, for every deploy context you publish. Then deploy again.',
      '',
    ].join('\n')
  );
  process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { sourceMapWarning };
