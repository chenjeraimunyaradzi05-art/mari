#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Launch smoke test script.
 *
 * Usage:
 *   node scripts/smoke-test.js
 *   node scripts/smoke-test.js --base https://api.your-domain.com
 */

function getArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

const baseUrl = (getArg('base', process.env.SMOKE_TEST_BASE_URL || process.env.APP_URL || 'http://localhost:5000') || '').replace(/\/$/, '');

const checks = [
  { name: 'Health', path: '/health' },
  { name: 'Liveness', path: '/livez' },
  { name: 'Readiness', path: '/readyz' },
  { name: 'Compliance Region', path: '/api/compliance/region/GB' },
  { name: 'Legal Documents', path: '/api/compliance/legal-documents?region=UK' },
];

async function runCheck(check) {
  const url = `${baseUrl}${check.path}`;
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const elapsedMs = Date.now() - startedAt;
    const ok = response.status >= 200 && response.status < 300;

    return {
      name: check.name,
      url,
      status: response.status,
      ok,
      elapsedMs,
    };
  } catch (error) {
    return {
      name: check.name,
      url,
      status: 0,
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main() {
  console.log(`Running smoke checks against: ${baseUrl}`);

  const results = [];
  for (const check of checks) {
    // Run sequentially to keep logs deterministic for launch operators.
    // eslint-disable-next-line no-await-in-loop
    const result = await runCheck(check);
    results.push(result);

    if (result.ok) {
      console.log(`✅ ${result.name}: ${result.status} (${result.elapsedMs}ms)`);
    } else {
      const suffix = result.error ? ` - ${result.error}` : '';
      console.log(`❌ ${result.name}: ${result.status} (${result.elapsedMs}ms)${suffix}`);
    }
  }

  const failed = results.filter((result) => !result.ok);

  if (failed.length > 0) {
    console.error('\nSmoke test failed. Unhealthy endpoints:');
    for (const item of failed) {
      console.error(` - ${item.name}: ${item.url}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nAll smoke checks passed.');
}

main().catch((error) => {
  console.error('Smoke test execution failed:', error);
  process.exitCode = 1;
});
