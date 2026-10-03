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
 *   node scripts/check-env.js ../../render.yaml           # blueprint mode
 *   node scripts/check-env.js --names-only                # never prints values
 *
 * Values are never printed. Only names appear in the output.
 *
 * Blueprint mode, and why CI uses it rather than an env file: this check was
 * written and then never wired into a pipeline, so the drift it exists to catch
 * was the drift actually present. It could not be wired to an env file, because
 * the only env file in the repository is `.env.production.template` and a
 * template cannot hold a real SENDGRID_API_KEY — every run of it would report
 * MISSING or PLACEHOLDER and the build would be permanently red for the one
 * reason nobody can fix. `render.yaml` is the file that does hold the answer:
 * it declares every name production will be given, and says of each whether
 * Render generates it, derives it from another service, or asks the operator
 * for it. Names are the half that drifts; the values were never the point. So a
 * variable added to src/ without being added to the blueprint fails the build,
 * and CI still reads no secret to do it.
 */

const fs = require('fs');
const path = require('path');

const SERVER_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(SERVER_ROOT, 'src');
const HEALTH_ROUTES = path.join(SRC, 'routes', 'health.routes.ts');
const ENV_RULES = path.join(SRC, 'utils', 'env.ts');

/**
 * The names src/utils/env.ts refuses to boot without, read from that file.
 *
 * The list below mirrors the readiness endpoint, which reports; env.ts is what
 * stops the process, and the two had drifted. PROXY_SHARED_SECRET and API_URL
 * became boot requirements there and were never added to render.yaml, so a
 * service created from the blueprint would have exited at start with nothing
 * in CI to say it would. Reading the rules from env.ts itself, rather than
 * keeping a third copy here, is what stops that recurring: a name that becomes
 * required at boot is required of the blueprint in the same commit.
 */
function namesRequiredAtBoot() {
  const text = fs.readFileSync(ENV_RULES, 'utf8');
  const names = [];
  for (const m of text.matchAll(/name:\s*'([A-Z][A-Z0-9_]*)',\s*required:\s*true\b/g)) names.push(m[1]);
  if (names.length === 0) fail(`found no required variables in ${ENV_RULES}; its rule format changed (update this script)`);
  return names;
}

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
  ['SENDGRID_FROM_EMAIL'],
  ['STRIPE_SECRET_KEY'],
  ['STRIPE_WEBHOOK_SECRET'],
  // The second Stripe endpoint, the one listening on connected accounts. Without
  // its secret every payout.paid, payout.failed and account.updated event is
  // refused, so a withdrawal that bounced is never heard about and a seller whose
  // account Stripe stopped paying is never told. /health/launch-readiness fails in
  // production for the same reason.
  ['STRIPE_CONNECT_WEBHOOK_SECRET'],
  ['STRIPE_PRICE_CAREER'],
  ['STRIPE_PRICE_PROFESSIONAL'],
  ['STRIPE_PRICE_ENTREPRENEUR'],
  ['STRIPE_PRICE_CREATOR'],
  // Who ATHENA is on an invoice. No default exists for any of them, and no
  // invoice document is produced until all four are set (invoice.service
  // supplierReadiness); the GST registration date is optional and not here.
  ['ATHENA_LEGAL_NAME'],
  ['ATHENA_ABN'],
  ['ATHENA_BILLING_ADDRESS'],
  ['ATHENA_BILLING_EMAIL'],
  ['S3_BUCKET'],
  ['AWS_REGION'],
  ['AWS_ACCESS_KEY_ID'],
  ['AWS_SECRET_ACCESS_KEY'],
  ['AI_OPENAI_API_KEY', 'OPENAI_API_KEY'],
  // ML_SERVICE_URL is deliberately not here. It used to be, and it made the
  // platform impossible to report ready: the service cannot start without
  // trained artefacts, none exist in this repository, and its only real
  // consumer — the feed re-ranker — already degrades to the unranked feed when
  // it is absent. Requiring the URL of a service that cannot run is a gate that
  // can never pass. See docs/runbooks/ML-SERVICE.md for what turning it on
  // would actually take.
  ['REDIS_URL'],
];

// Values production must never be given, whatever the file says: a switch that
// makes the platform report success it has not earned. src/utils/env.ts refuses to
// start with ALLOW_STRIPE_SIMULATION on in production; this says so before the
// deploy, from the file that would have carried it there.
const FORBIDDEN_IN_PRODUCTION = [
  {
    name: 'ALLOW_STRIPE_SIMULATION',
    value: 'true',
    because: 'it lets a business registration be marked paid with no charge, and no production deployment may simulate a payment',
  },
];

// Required only when the matching switch is on.
const CONDITIONAL = [
  // WORKER_ALLOW_SIMULATION and VIDEO_PROCESSING_ALLOW_SIMULATION are the two
  // names canSimulateWorker() in services/workers.service.ts reads. This rule
  // used to name VIDEO_ALLOW_SIMULATION instead, which no worker reads, so it
  // excused a deployment that would still have thrown on every reel and
  // demanded a URL from one that would not.
  {
    when: (env) =>
      env.ENABLE_WORKERS === 'true' &&
      env.WORKER_ALLOW_SIMULATION !== 'true' &&
      env.VIDEO_PROCESSING_ALLOW_SIMULATION !== 'true',
    names: ['VIDEO_PROCESSOR_URL'],
    because: 'ENABLE_WORKERS=true and neither worker simulation flag is set, so the video worker calls an external transcoder',
  },
  { when: (env) => env.OPENSEARCH_ENABLED === 'true', names: ['OPENSEARCH_NODE'], because: 'OPENSEARCH_ENABLED=true' },
  // MALWARE_SCAN_REQUIRED unset means "documents" in production, and a résumé
  // or a document is refused when it cannot be scanned (services/malware-scan.service),
  // so a deployment that does not say `off` has to say where the scanner is.
  {
    when: (env) => String(env.MALWARE_SCAN_REQUIRED ?? '').trim().toLowerCase() !== 'off',
    names: ['CLAMAV_HOST'],
    because: 'MALWARE_SCAN_REQUIRED is not "off", so résumés and documents are refused until a scanner answers',
  },
];

const PLACEHOLDER_VALUES = new Set([
  '', 'changeme', 'change_me', 'secret', 'your-secret', 'your_secret', 'not_configured',
  'sk_test_not_configured', 'price_xxxxx', 'xxx', 'todo', 'replace_me', 'change_this_to_a_secure_random_string_min_32_chars',
  // What server/.env.example and .env.production.template ship, so a copied
  // example is caught here rather than discovered when the API refuses to boot.
  'generate-with-openssl-rand-hex-32',
  'your-super-secret-jwt-key-change-in-production',
  'noreply@athena.com',
  'noreply@your-domain.com',
]);

// Names whose value has to be random, not merely present. Mirrors the rules in
// src/utils/secret-strength.ts (length, placeholder words, a repeating
// pattern); this script runs before the build and cannot import TypeScript,
// so src/utils/__tests__/env.test.ts holds the two to the same answers.
const SECRET_MIN_LENGTH = { JWT_SECRET: 32, PROXY_SHARED_SECRET: 32, BANNED_IDENTITY_HASH_KEY: 32, DV_ENCRYPTION_KEY: 64 };
const PLACEHOLDER_FRAGMENTS = [
  'change', 'your-', 'your_', 'placeholder', 'example', 'replace', 'insert', 'generate', 'openssl',
  'dev-only', 'not-for-prod', 'not_for_prod', 'not_configured',
];
const PLACEHOLDER_WHOLE_VALUES = new Set(['secret', 'password', 'changeme', 'change_me', 'todo', 'xxx', 'test', 'development']);

function isShortPatternRepeated(value) {
  for (let period = 1; period <= 16; period += 1) {
    let repeats = true;
    for (let index = period; index < value.length; index += 1) {
      if (value[index] !== value[index % period]) {
        repeats = false;
        break;
      }
    }
    if (repeats) return true;
  }
  return false;
}

/** Why a value cannot be trusted as a secret, or null. Same rules as secretWeakness() in src/utils/secret-strength.ts. */
function secretWeakness(value, minLength = 32) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return 'not set';
  if (trimmed.length < minLength) return `shorter than ${minLength} characters`;
  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_WHOLE_VALUES.has(lower) || PLACEHOLDER_FRAGMENTS.some((fragment) => lower.includes(fragment))) {
    return 'a placeholder from an example file';
  }
  if (new Set(trimmed).size < 8 || isShortPatternRepeated(trimmed)) return 'made of a repeating pattern, not random';
  return null;
}

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

/**
 * The env var names a Render blueprint declares, and the literal values it sets.
 *
 * Scanned line by line rather than parsed with a YAML library on purpose: this
 * script has no dependencies and runs before `npm ci` in any pipeline that
 * wants it, and `render.yaml` has one shape — a flat `envVars:` list of
 * `- key: NAME` entries, each followed by `value:`, `sync: false`,
 * `generateValue: true` or a `fromService:` block. A key whose value Render
 * supplies is recorded as declared-without-a-literal, which is the honest
 * reading: production will have it, this file does not know what it is.
 */
function parseBlueprintFile(file) {
  const env = {};
  const text = fs.readFileSync(file, 'utf8');
  let currentKey = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const keyMatch = /^-\s*key:\s*(.+)$/.exec(line);
    if (keyMatch) {
      currentKey = unquote(keyMatch[1]);
      // Declared. A literal on a following line replaces this; a `sync: false`
      // or `generateValue: true` leaves it as the marker below, which every
      // caller reads as "set, but this file does not hold the value".
      env[currentKey] = SUPPLIED_BY_HOST;
      continue;
    }

    if (!currentKey) continue;

    const valueMatch = /^value:\s*(.*)$/.exec(line);
    if (valueMatch) {
      env[currentKey] = unquote(valueMatch[1]);
      currentKey = null;
      continue;
    }

    // A new list item that is not a key ends the entry we were reading.
    if (line.startsWith('- ')) currentKey = null;
  }

  return env;
}

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Stands for "declared in the blueprint, value supplied by the host". It is a
 * string no operator would type, so a real env file cannot collide with it, and
 * it is deliberately not in PLACEHOLDER_VALUES: a `sync: false` entry is a
 * correct, finished declaration, not an unfilled blank.
 */
const SUPPLIED_BY_HOST = '<supplied-by-host>';

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
    // Helpers that take the variable's name and read process.env[name]
    // themselves: quotaFromEnv('AI_CHAT_FREE_WINDOW_SECONDS',
    // 'AI_CHAT_FREE_MAX_REQUESTS', ...) in ai.routes.ts, positiveIntFromEnv in
    // ai-budget.service.ts. Without this every name they read was reported
    // OBSOLETE, which is the one finding that tempts someone to delete a
    // setting that works.
    for (const m of text.matchAll(/\b[A-Za-z_]\w*FromEnv\(([^)]*)\)/g)) {
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

  const blueprint = /\.ya?ml$/i.test(file);
  const env = blueprint ? parseBlueprintFile(file) : parseEnvFile(file);
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
  // A value that is present and typed is not the same as one that is random. A
  // blueprint entry the host fills in is not judged: this file does not hold it.
  for (const [name, minLength] of Object.entries(SECRET_MIN_LENGTH)) {
    const value = env[name];
    if (value === undefined || value === '' || value === SUPPLIED_BY_HOST) continue;
    if (PLACEHOLDER_VALUES.has(String(value).trim().toLowerCase())) continue; // already reported above
    const weakness = secretWeakness(value, minLength);
    if (weakness) placeholders.push(`${name} (${weakness})`);
  }
  const forbidden = [];
  for (const rule of FORBIDDEN_IN_PRODUCTION) {
    if (String(env[rule.name] ?? '').trim().toLowerCase() === rule.value) {
      forbidden.push(`${rule.name}=${rule.value} (${rule.because})`);
    }
  }
  const alreadyRequired = new Set(REQUIRED_IN_PRODUCTION.flat());
  for (const name of namesRequiredAtBoot()) {
    if (alreadyRequired.has(name)) continue;
    if (env[name] === undefined || env[name] === '') missing.push(`${name} (the process refuses to start without it: src/utils/env.ts)`);
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

  console.log(`check-env: ${path.relative(process.cwd(), file) || file}${blueprint ? ' (blueprint: names only)' : ''}`);
  console.log(
    `  ${Object.keys(env).length} variables ${blueprint ? 'declared' : 'set'} · ${read.size} names read by src/`
  );

  if (missing.length) {
    console.log(`\n  MISSING (required in production, not ${blueprint ? 'declared' : 'set'}):`);
    for (const name of missing) console.log(`    - ${name}`);
  }
  if (placeholders.length) {
    console.log(`\n  PLACEHOLDER (set to a value that is not real):`);
    for (const name of placeholders) console.log(`    - ${name}`);
  }
  if (forbidden.length) {
    console.log(`\n  FORBIDDEN (set to a value production must never have):`);
    for (const name of forbidden) console.log(`    - ${name}`);
  }
  if (obsolete.length) {
    console.log(`\n  OBSOLETE (set, but nothing in src/ reads it):`);
    for (const name of obsolete) console.log(`    - ${name}`);
  }
  if (!missing.length && !placeholders.length && !forbidden.length && !obsolete.length) {
    console.log('\n  OK: every required variable is set and every variable is read.');
  }

  if (missing.length || placeholders.length || forbidden.length) process.exitCode = 1;
}

// Run as a script, and importable for the test that keeps secretWeakness()
// equal to its TypeScript twin.
if (require.main === module) main();
module.exports = { secretWeakness };
