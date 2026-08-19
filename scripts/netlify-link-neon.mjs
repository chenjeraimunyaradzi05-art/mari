#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'athena-platform', 'client');
const shouldDeploy = process.argv.includes('--deploy');
const context = process.env.NETLIFY_DEPLOY_CONTEXT || 'production';
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function readFirst(...keys) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}

function requireEnv(key, value, hint) {
  if (value) return;
  console.error(`[netlify-link-neon] Missing ${key}. ${hint}`);
  process.exitCode = 1;
}

function isNeonUrl(value) {
  try {
    return new URL(value).hostname.endsWith('.neon.tech');
  } catch {
    return value.includes('.neon.tech');
  }
}

function warnIfNeonUrlLooksUnsafe(key, value) {
  if (!value || !isNeonUrl(value)) return;

  const url = new URL(value);
  if (url.searchParams.get('sslmode') !== 'require') {
    console.warn(`[netlify-link-neon] Warning: ${key} should include sslmode=require.`);
  }
  if (key === 'DATABASE_URL' && !url.hostname.includes('-pooler.')) {
    console.warn('[netlify-link-neon] Warning: DATABASE_URL should use the pooled Neon hostname containing "-pooler".');
  }
}

function runNetlify(args, options = {}) {
  const result = spawnSync(npxBin, ['--yes', 'netlify-cli', ...args], {
    cwd: options.cwd || rootDir,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function setNetlifyEnv({ key, value, scopes, secret = false }) {
  const siteId = readFirst('NETLIFY_SITE_ID');
  const authToken = readFirst('NETLIFY_AUTH_TOKEN');
  const filter = readFirst('NETLIFY_FILTER');
  const args = [
    'env:set',
    key,
    value,
    '--context',
    context,
    '--scope',
    ...scopes,
    '--site',
    siteId,
    '--auth',
    authToken,
    '--force',
  ];

  if (secret) {
    args.push('--secret');
  }

  if (filter) {
    args.push('--filter', filter);
  }

  console.log(`[netlify-link-neon] Setting ${key} for ${context} (${scopes.join(', ')})${secret ? ' as a secret' : ''}.`);
  runNetlify(args);
}

const siteId = readFirst('NETLIFY_SITE_ID');
const authToken = readFirst('NETLIFY_AUTH_TOKEN');
const databaseUrl = readFirst('NEON_DATABASE_URL', 'DATABASE_URL');
const directDatabaseUrl = readFirst('NEON_DIRECT_DATABASE_URL', 'DIRECT_DATABASE_URL', 'DATABASE_DIRECT_URL', 'DIRECT_URL');
const apiUrl = readFirst('NEXT_PUBLIC_API_URL', 'API_URL', 'BACKEND_URL');
const appUrl = readFirst('NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL', 'URL');
const socketUrl = readFirst('NEXT_PUBLIC_SOCKET_URL');
const googleClientId = readFirst('NEXT_PUBLIC_GOOGLE_CLIENT_ID');
const facebookAppId = readFirst('NEXT_PUBLIC_FACEBOOK_APP_ID');
const stripePublishableKey = readFirst('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_STRIPE_KEY');

requireEnv('NETLIFY_SITE_ID', siteId, 'Set it to the Netlify Project/Site ID.');
requireEnv('NETLIFY_AUTH_TOKEN', authToken, 'Create a Netlify personal access token and export it before running this script.');
requireEnv('DATABASE_URL', databaseUrl, 'Set NEON_DATABASE_URL or DATABASE_URL to the pooled Neon connection string.');
requireEnv('DIRECT_DATABASE_URL', directDatabaseUrl, 'Set NEON_DIRECT_DATABASE_URL or DIRECT_DATABASE_URL to the direct Neon connection string.');

if (process.exitCode) {
  process.exit(process.exitCode);
}

warnIfNeonUrlLooksUnsafe('DATABASE_URL', databaseUrl);
warnIfNeonUrlLooksUnsafe('DIRECT_DATABASE_URL', directDatabaseUrl);

const envVars = [
  {
    key: 'DATABASE_URL',
    value: databaseUrl,
    scopes: ['builds', 'functions'],
    secret: true,
  },
  {
    key: 'DIRECT_DATABASE_URL',
    value: directDatabaseUrl,
    scopes: ['builds', 'functions'],
    secret: true,
  },
  apiUrl
    ? { key: 'NEXT_PUBLIC_API_URL', value: apiUrl, scopes: ['builds'] }
    : null,
  appUrl
    ? { key: 'NEXT_PUBLIC_APP_URL', value: appUrl, scopes: ['builds'] }
    : null,
  socketUrl
    ? { key: 'NEXT_PUBLIC_SOCKET_URL', value: socketUrl, scopes: ['builds', 'functions'] }
    : null,
  googleClientId
    ? { key: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID', value: googleClientId, scopes: ['builds'] }
    : null,
  facebookAppId
    ? { key: 'NEXT_PUBLIC_FACEBOOK_APP_ID', value: facebookAppId, scopes: ['builds'] }
    : null,
  stripePublishableKey
    ? { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', value: stripePublishableKey, scopes: ['builds'] }
    : null,
].filter(Boolean);

for (const envVar of envVars) {
  setNetlifyEnv(envVar);
}

console.log('[netlify-link-neon] Netlify environment is linked to Neon.');

if (shouldDeploy) {
  if (!existsSync(path.join(clientDir, 'netlify.toml'))) {
    console.error('[netlify-link-neon] Cannot deploy: athena-platform/client/netlify.toml was not found.');
    process.exit(1);
  }

  console.log('[netlify-link-neon] Starting production Netlify deploy.');
  runNetlify(['deploy', '--prod', '--build', '--site', siteId, '--auth', authToken], {
    cwd: clientDir,
  });
}
