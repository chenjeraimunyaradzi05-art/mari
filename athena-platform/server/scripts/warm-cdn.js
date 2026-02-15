#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * CDN warm-up helper for launch.
 *
 * Usage:
 *   node scripts/warm-cdn.js
 *   node scripts/warm-cdn.js --base https://athena-empress.netlify.app
 *   node scripts/warm-cdn.js --paths /,/feed,/dashboard
 */

function getArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

const baseUrl = (getArg('base', process.env.CDN_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') || '').replace(/\/$/, '');
const defaultPaths = ['/', '/feed', '/dashboard', '/login', '/privacy', '/terms', '/_next/static'];
const rawPaths = getArg('paths', process.env.CDN_WARM_PATHS || defaultPaths.join(','));
const paths = rawPaths
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

async function warmPath(pathname) {
  const url = pathname.startsWith('http') ? pathname : `${baseUrl}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });

    return {
      url,
      status: response.status,
      ok: response.status >= 200 && response.status < 500,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      url,
      status: 0,
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main() {
  console.log(`Warming CDN/app routes for base: ${baseUrl}`);

  const failures = [];

  for (const pathname of paths) {
    // Sequential requests avoid a spike during warm-up.
    // eslint-disable-next-line no-await-in-loop
    const result = await warmPath(pathname);

    if (result.ok) {
      console.log(`✅ ${result.status} ${result.url} (${result.elapsedMs}ms)`);
    } else {
      failures.push(result);
      const suffix = result.error ? ` - ${result.error}` : '';
      console.log(`❌ ${result.status} ${result.url} (${result.elapsedMs}ms)${suffix}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\nCDN warm-up completed with ${failures.length} failure(s).`);
    process.exitCode = 1;
    return;
  }

  console.log('\nCDN warm-up completed successfully.');
}

main().catch((error) => {
  console.error('CDN warm-up failed:', error);
  process.exitCode = 1;
});
