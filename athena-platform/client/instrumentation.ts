/**
 * The shortest PROXY_SHARED_SECRET this host will run with. The API holds its
 * copy to the same length (server/src/utils/env.ts); a shorter value is one a
 * stranger could guess and then send as any visitor's address.
 */
const MIN_PROXY_SECRET_LENGTH = 32;

/**
 * Refuses to serve in production without the secret the API uses to believe
 * a visitor's address.
 *
 * Every browser call reaches the API through this host's route handlers, from
 * this host's own addresses. With the secret, the handlers forward the
 * visitor's real address and the API believes it (app/api/proxy-identity.ts).
 * Without it the API cannot tell a web request from any other caller at this
 * address, so every member shares one login budget, the lockout after failed
 * sign-ins keys on this host and locks everyone out together, and new-device
 * alerts never fire. The API already refuses to boot without the secret; this
 * host used to start without it and say nothing, which is how the two could
 * disagree for as long as nobody looked.
 *
 * Next.js does not call register() during `next build`, so this cannot fail a
 * build by itself. On Netlify the build runs scripts/check-web-env.js first,
 * which fails the build instead, so a deploy missing the secret never replaces
 * the one that is serving.
 */
function assertProxySecretConfigured(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const secret = process.env.PROXY_SHARED_SECRET?.trim() ?? '';
  if (secret.length >= MIN_PROXY_SECRET_LENGTH) return;
  throw new Error(
    'PROXY_SHARED_SECRET must be set on the web host (at least 32 characters, the same value as the API): ' +
      'without it every member shares one login budget, the lockout keys on this host, and new-device alerts never fire.'
  );
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    assertProxySecretConfigured();

    const Sentry = await import('@sentry/nextjs');

    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: process.env.NODE_ENV === 'production',
      tracesSampleRate: 0.1,
      ignoreErrors: [
        'Network request failed',
        'Failed to fetch',
        'Load failed',
      ],
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const Sentry = await import('@sentry/nextjs');

    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: process.env.NODE_ENV === 'production',
      tracesSampleRate: 0.1,
    });
  }
}
