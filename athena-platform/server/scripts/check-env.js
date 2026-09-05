#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Compares an environment file against what the server actually reads.
 *
 * Why this exists: the production environment drifted from the code without
 * anything noticing. The env file on the host named STRIPE_PRICE_STARTER,
 * OPENSEARCH_URL and SES settings; the code reads STRIPE_PRICE_CAREER,
 * OPENSEARCH_NODE and SENDGRID_API_KEY. Nothing failed at boot; features
 * quietly ran in their "not configured" branch. The launch-readiness endpoint
 * reports this too, but only once the server is running on that host. This
 * runs anywhere, against any file, before a deploy.
 *
 * Three findings:
 *
 *   MISSING    A variable the code requires in production (per the
 *              launch-readiness checks in src/routes/health.routes.ts) that the
 *              file does not set.
 *   OBSOLETE   A variable the file sets that no code under src/ reads. Usually
 *              a renamed key: the old name lingers, the new one is missing.
 *   PLACEHOLDER A required variable set to a value that is clearly not real.
 *
 * Usage:
 *   node scripts/check-env.js [path/to/.env.production]   # exits 1 on MISSING
 *   node scripts/check-env.js --names-only                # never prints values
 *
 * Values are never printed. Only names appear in the output.
 */

const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(SERVER_ROOT, 'src');
const HEALTH_ROUTES = path.join(SRC, 'routes', 'health.routes.ts');

// What production needs, mirroring the launch-readiness checks. Each name is
// verified below to still appear in health.routes.ts, so this list cannot
// quietly drift from the endpoint it mirrors. Entries with alternatives pass
// when any one of them is set.
const REQUIRED_IN_PRODUCTION = [
  ['DATABASE_URL'],
  ['CLIENT_URL', 'FRONTEND_URL'],
  ['ALLOWED_ORIGINS'],
  ['JWT_SECRET'],
  ['DV_ENCRYPTION_KEY'],
  ['METRICS_TOKEN'],
  ['HEALTH_DIAGNOSTICS_TOKEN', 'DEBUG_SECRET'],
  ['SENDGRID_API_KEY'],
  ['STRIPE_SECRET_KEY'],
  ['STRIPE_WEBHOOK_SECRET'],
  ['STRIPE_PRICE_CAREER'],
  ['STRIPE_PRICE_PROFESSIONAL'],
  ['STRIPE_PRICE_ENTREPRENEUR'],
  ['STRIPE_PRICE_CREATOR'],
  ['S3_BUCKET'],
  ['AWS_REGION'],
  ['AWS_ACCESS_KEY_ID'],
  ['AWS_SECRET_ACCESS_KEY'],
  ['AI_OPENAI_API_KEY', 'OPENAI_API_KEY'],
  ['ML_SERVICE_URL'],
  ['REDIS_URL'],
];

// Required only when the matching switch is on.
const CONDITIONAL = [
  { when: (env) => env.ENABLE_WORKERS === 'true' && env.VIDEO_ALLOW_SIMULATION !== 'true' && env.WORKER_ALLOW_SIMULATION !== 'true', names: ['VIDEO_PROCESSOR_URL'], because: 'ENABLE_WORKERS=true without video simulation' },
  { when: (env) => env.OPENSEARCH_ENABLED === 'true', names: ['OPENSEARCH_NODE'], because: 'OPENSEARCH_ENABLED=true' },
];

const PLACEHOLDER_VALUES = new Set([
  '', 'changeme', 'change_me', 'secret', 'your-secret', 'your_secret', 'not_configured',
  'sk_test_not_configured', 'price_xxxxx', 'xxx', 'todo', 'replace_me', 'change_this_to_a_secure_random_string_min_32_chars',
]);

function fail(message) {
  console.error(`\n  check-env: ${message}\n`);
  process.exit(2);
}

function parseEnvFile(file) {
  const env = {};
  const text = fs.readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.(ts|js)$/.test(entry.name) && !/\.test\.(ts|js)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Every process.env.NAME the server reads, plus names it reads dynamically by prefix. */
function namesReadByCode() {
  const names = new Set();
  for (const file of walk(SRC)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) names.add(m[1]);
    for (const m of text.matchAll(/process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g)) names.add(m[1]);
    for (const m of text.matchAll(/isConfiguredEnv\(['"]([A-Z][A-Z0-9_]*)['"]\)/g)) names.add(m[1]);
    for (const m of text.matchAll(/envCheck\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g)) names.add(m[1]);
    for (const m of text.matchAll(/anyEnvCheck\([^)]*?\[([^\]]+)\]/g)) {
      for (const n of m[1].matchAll(/['"]([A-Z][A-Z0-9_]*)['"]/g)) names.add(n[1]);
    }
  }
  return names;
}

// Names the code reads by pattern rather than by literal, so a suffix match
// counts as read: per-currency Stripe prices, per-feature simulation flags.
const DYNAMIC_PREFIXES = ['STRIPE_PRICE_', 'NEXT_PUBLIC_'];
const DYNAMIC_SUFFIXES = ['_ALLOW_SIMULATION'];
// Set by hosts and tooling, not by us.
const HOST_PROVIDED = new Set(['PORT', 'NODE_ENV', 'HOME', 'PATH', 'PWD', 'TZ', 'CI']);

function isReadDynamically(name) {
  return DYNAMIC_PREFIXES.some((p) => name.startsWith(p)) || DYNAMIC_SUFFIXES.some((s) => name.endsWith(s));
}

function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => !a.startsWith('--'));
  const file = path.resolve(fileArg || path.join(SERVER_ROOT, '.env.production'));
  if (!fs.existsSync(file)) fail(`no such file: ${file}`);
  if (!fs.existsSync(HEALTH_ROUTES)) fail(`cannot find ${HEALTH_ROUTES}`);

  const health = fs.readFileSync(HEALTH_ROUTES, 'utf8');
  const stale = REQUIRED_IN_PRODUCTION.flat().filter((name) => !health.includes(`'${name}'`));
  if (stale.length) fail(`REQUIRED_IN_PRODUCTION names the readiness route no longer checks: ${stale.join(', ')} (update this script)`);

  const env = parseEnvFile(file);
  const read = namesReadByCode();

  const missing = [];
  const placeholders = [];
  for (const group of REQUIRED_IN_PRODUCTION) {
    const set = group.filter((name) => env[name] !== undefined && env[name] !== '');
    if (set.length === 0) {
      missing.push(group.join(' or '));
      continue;
    }
    if (set.every((name) => PLACEHOLDER_VALUES.has(String(env[name]).trim().toLowerCase()))) placeholders.push(group.join(' or '));
  }
  for (const rule of CONDITIONAL) {
    if (!rule.when(env)) continue;
    for (const name of rule.names) {
      if (!env[name]) missing.push(`${name} (because ${rule.because})`);
    }
  }

  const obsolete = Object.keys(env)
    .filter((name) => !read.has(name) && !isReadDynamically(name) && !HOST_PROVIDED.has(name))
    .sort();

  console.log(`check-env: ${path.relative(process.cwd(), file) || file}`);
  console.log(`  ${Object.keys(env).length} variables set · ${read.size} names read by src/`);

  if (missing.length) {
    console.log(`\n  MISSING (required in production, not set):`);
    for (const name of missing) console.log(`    - ${name}`);
  }
  if (placeholders.length) {
    console.log(`\n  PLACEHOLDER (set to a value that is not real):`);
    for (const name of placeholders) console.log(`    - ${name}`);
  }
  if (obsolete.length) {
    console.log(`\n  OBSOLETE (set, but nothing in src/ reads it):`);
    for (const name of obsolete) console.log(`    - ${name}`);
  }
  if (!missing.length && !placeholders.length && !obsolete.length) {
    console.log('\n  OK: every required variable is set and every variable is read.');
  }

  if (missing.length || placeholders.length) process.exitCode = 1;
}

main();
