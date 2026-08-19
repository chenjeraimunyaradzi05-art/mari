#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'athena-platform', 'client');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeBin = process.execPath;

function readFirst(env, ...keys) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return '';
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || clientDir,
    env: options.env || process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    console.error(`[netlify-build] Failed to start ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function withDatabaseAliases(env) {
  const nextEnv = { ...env };
  const databaseUrl = readFirst(
    nextEnv,
    'DATABASE_URL',
    'NETLIFY_DB_URL',
    'NETLIFY_DATABASE_URL',
    'NEON_DATABASE_URL'
  );
  const directDatabaseUrl = readFirst(
    nextEnv,
    'DIRECT_DATABASE_URL',
    'DATABASE_DIRECT_URL',
    'DIRECT_URL',
    'NEON_DIRECT_DATABASE_URL'
  );

  if (!nextEnv.DATABASE_URL && databaseUrl) {
    nextEnv.DATABASE_URL = databaseUrl;
    console.log('[netlify-build] DATABASE_URL resolved from Netlify/Neon environment.');
  }

  if (!nextEnv.DIRECT_DATABASE_URL && (directDatabaseUrl || databaseUrl)) {
    nextEnv.DIRECT_DATABASE_URL = directDatabaseUrl || databaseUrl;
    console.log('[netlify-build] DIRECT_DATABASE_URL resolved for Prisma tooling.');
  }

  return nextEnv;
}

function maybeSyncNeonSecrets(env) {
  const hasSyncEnv =
    env.NETLIFY_AUTH_TOKEN &&
    env.NETLIFY_SITE_ID &&
    env.NEON_DATABASE_URL &&
    env.NEON_DIRECT_DATABASE_URL;

  if (!hasSyncEnv || env.NETLIFY_SKIP_NEON_SYNC === '1') {
    return;
  }

  console.log('[netlify-build] Syncing Neon secrets to Netlify before build.');
  run(nodeBin, [path.join(rootDir, 'scripts', 'netlify-link-neon.mjs')], {
    cwd: rootDir,
    env,
  });
}

const buildEnv = withDatabaseAliases(process.env);

maybeSyncNeonSecrets(buildEnv);
run(npmBin, ['ci', '--legacy-peer-deps'], { env: buildEnv });
run(npmBin, ['run', 'build'], { env: buildEnv });
