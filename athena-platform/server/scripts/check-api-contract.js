#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Fails when the client calls an API route the server does not serve.
 *
 * Why this exists: as of 2026-08-24 an audit found 44 calls in the client's API
 * helper layer that pointed at routes which had never been built, or which used
 * the wrong verb, or whose literal path was registered *after* a `/:id` route
 * and so could only ever reach the wrong handler. None of them were reachable
 * from the UI yet, which is exactly why they went unnoticed — they would have
 * surfaced as runtime 404s the first time a feature was wired up.
 *
 * This walks both sides statically and compares them:
 *   - server: `app.use('/api/x', yRoutes)` in index.ts, joined to the
 *     `router.<verb>('<path>')` calls in each mounted route file.
 *   - client: `api.<verb>('<path>')` calls anywhere under client/src.
 *
 * Three failure classes are reported separately, because the fixes differ:
 *
 *   MISSING       No route matches at all. Either build the route, or point the
 *                 client at one that exists.
 *   SHADOWED      A literal path ("/video/trending") is only matched by a
 *                 parameterised route ("/video/:id"), so Express hands it to
 *                 the id handler and it 404s as "not found". Move the literal
 *                 route above the `/:id` one in its route file.
 *   WRONG_VERB    The path exists but not for that method.
 *
 * Usage:
 *   node scripts/check-api-contract.js                # exits 1 on any finding
 *   node scripts/check-api-contract.js --list         # print the whole contract
 *   node scripts/check-api-contract.js --unreachable  # server routes no client
 *                                                     # call reaches (report only)
 *
 * Known-good exceptions live in ALLOWED below, each with a reason.
 */

const fs = require('fs');
const path = require('path');

const SERVER_SRC = path.resolve(__dirname, '..', 'src');
const CLIENT_SRC = path.resolve(__dirname, '..', '..', 'client', 'src');

// Calls that look broken to the static walk but are correct in practice.
// Keep each entry justified — an unexplained entry is a bug in waiting.
const ALLOWED = new Map([
  [
    'POST /api/media/upload/video',
    'Matches POST /api/media/upload/:type. "video" is a real key in FILE_CONFIGS, ' +
      'so the parameterised route is the intended handler, not a shadowing accident.',
  ],
]);

function fail(message) {
  console.error(`\n  check-api-contract: ${message}\n`);
  process.exit(2);
}

// ---------------------------------------------------------------- server side

function readMounts(indexSrc) {
  const imports = new Map();
  for (const m of indexSrc.matchAll(/import\s+(\w+)\s+from\s+'\.\/routes\/([\w.-]+)'/g)) {
    imports.set(m[1], m[2]);
  }

  const mounts = [];
  // Only top-level `app.use('/api/...', someRoutes)` mounts; middleware such as
  // rate limiters is bound to a path with no router and is skipped.
  for (const m of indexSrc.matchAll(/^\s*app\.use\(\s*'(\/api\/[^']*)'\s*,\s*(\w+)\s*\)/gm)) {
    const file = imports.get(m[2]);
    if (file) mounts.push({ prefix: m[1].replace(/\/$/, ''), file });
  }
  return mounts;
}

function collectServerRoutes() {
  const indexPath = path.join(SERVER_SRC, 'index.ts');
  if (!fs.existsSync(indexPath)) fail(`cannot find ${indexPath}`);

  const mounts = readMounts(fs.readFileSync(indexPath, 'utf8'));
  if (mounts.length === 0) fail('parsed zero route mounts from index.ts — the parser is stale');

  const routes = [];
  for (const { prefix, file } of mounts) {
    const routePath = path.join(SERVER_SRC, 'routes', `${file}.ts`);
    if (!fs.existsSync(routePath)) continue;

    const src = fs.readFileSync(routePath, 'utf8');
    // `router.get(` / `router.post(` etc., with the path as the first argument.
    // Registration order within the file is preserved, which is what makes the
    // shadowing check meaningful.
    for (const m of src.matchAll(
      /router\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]*)['"`]/g
    )) {
      const full = prefix + (m[2] === '/' ? '' : m[2]);
      routes.push({
        method: m[1].toUpperCase(),
        segments: full.split('/').filter(Boolean),
        raw: full,
        file,
      });
    }
  }
  return routes;
}

// ---------------------------------------------------------------- client side

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const PARAM = '*PARAM*';

// A path segment is either a literal or an interpolation. Interpolations glued
// to the end of a segment (`/api/jobs${queryString}`) are query-string builders,
// not path parameters, so the match stops before them; only a `${...}` that
// follows a slash becomes a parameter.
const SEGMENT = String.raw`(?:[A-Za-z0-9._~-]+|\$\{[^{}\`]*\})`;
const FETCH_PATH = new RegExp(String.raw`/api/${SEGMENT}(?:/${SEGMENT})*`, 'g');

// Which verb a `fetch` uses. `method:` lives in the options object *after* the
// URL, so it is read from this call's own argument list — bounded at the first
// `);` so a later call's method cannot leak backwards into this one.
//
// Falling back to the enclosing `export async function GET/POST/...` covers the
// Next route handlers that omit an explicit method, since a handler is named
// after the verb it serves. Absent both, fetch itself defaults to GET.
function verbForFetch(src, offset, args) {
  const own = args.split(');')[0].match(/method:\s*['"](get|post|put|patch|delete)['"]/i);
  if (own) return own[1].toUpperCase();

  const before = src.slice(0, offset);
  const handlers = [...before.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)];
  if (handlers.length > 0) return handlers[handlers.length - 1][1];

  return 'GET';
}

function normalisePath(raw) {
  return raw
    .replace(/\$\{[^{}`]*\}/g, PARAM)
    .split('?')[0]
    .replace(/\/+$/, '');
}

function collectClientCalls() {
  if (!fs.existsSync(CLIENT_SRC)) fail(`cannot find ${CLIENT_SRC}`);

  const calls = new Map();

  const record = (key, file) => {
    if (!calls.has(key)) calls.set(key, new Set());
    calls.get(key).add(path.relative(CLIENT_SRC, file).split(path.sep).join('/'));
  };

  for (const file of walk(CLIENT_SRC)) {
    const src = fs.readFileSync(file, 'utf8');

    // 1. The axios helper: `api.get('/posts/feed')`, path relative to /api.
    for (const m of src.matchAll(
      /\bapi\s*\.\s*(get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*([`'"])([^`'"]*)\2/g
    )) {
      const raw = m[3];
      if (!raw.startsWith('/')) continue; // absolute URLs are not our contract
      record(`${m[1].toUpperCase()} ${normalisePath(`/api${raw}`)}`, file);
    }

    // 2. The Next route handlers under app/api, which proxy to the backend with
    //    `fetch(`${API_URL}/api/...`)`. These carry the full /api prefix and are
    //    just as much part of the contract as the axios calls.
    for (const m of src.matchAll(/\bfetch\s*\(/g)) {
      const args = src.slice(m.index, m.index + 600);
      const pathMatch = args.match(FETCH_PATH);
      if (!pathMatch) continue;
      record(`${verbForFetch(src, m.index, args)} ${normalisePath(pathMatch[0])}`, file);
    }
  }
  return calls;
}

// ------------------------------------------------------------------- matching

// Mirrors how Express resolves: same segment count, and each server segment is
// either a literal that matches exactly or a `:param` that matches anything.
// A client-side template param cannot satisfy a server literal.
function classify(method, segments, serverRoutes) {
  const exact = [];
  const viaParam = [];
  const wrongVerb = [];

  for (const route of serverRoutes) {
    if (route.segments.length !== segments.length) continue;

    let matches = true;
    let usedParam = false;

    for (let i = 0; i < segments.length; i++) {
      const s = route.segments[i];
      const c = segments[i];

      if (s.startsWith(':')) {
        if (c !== PARAM) usedParam = true;
        continue;
      }
      if (c === PARAM || s !== c) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;

    if (route.method !== method) wrongVerb.push(route);
    else if (usedParam) viaParam.push(route);
    else exact.push(route);
  }

  return { exact, viaParam, wrongVerb };
}

// ---------------------------------------------------------------------- main

// Route groups no client helper is expected to reach: called by external
// systems, by operators, or by infrastructure rather than by the app.
const NON_CLIENT_PREFIXES = [
  '/api/webhooks', // payment providers and other third parties call these
  '/api/admin', // operator tooling, not the member-facing client
  '/api/status', // health and uptime probes
  '/api/compliance', // regulator-facing exports
  '/api/gdpr', // data-subject request tooling
];

// The reverse of the main check: server routes that no client call can reach.
// Reported, never enforced — an unreachable route is often perfectly correct
// (a webhook, an operator endpoint, or a capability the UI has not caught up
// with yet). The point is to make the list visible rather than to fail on it.
function reportUnreachable(serverRoutes, clientCalls) {
  const reachable = new Set();

  for (const key of clientCalls.keys()) {
    const [method, routePath] = key.split(' ');
    const { exact, viaParam } = classify(method, routePath.split('/').filter(Boolean), serverRoutes);
    for (const route of [...exact, ...viaParam]) reachable.add(`${route.method} ${route.raw}`);
  }

  const byFile = new Map();
  let skipped = 0;

  for (const route of serverRoutes) {
    const id = `${route.method} ${route.raw}`;
    if (reachable.has(id)) continue;
    if (NON_CLIENT_PREFIXES.some((p) => route.raw.startsWith(p))) {
      skipped += 1;
      continue;
    }
    if (!byFile.has(route.file)) byFile.set(route.file, []);
    byFile.get(route.file).push(id);
  }

  const total = [...byFile.values()].reduce((n, list) => n + list.length, 0);

  console.log(
    `Server routes with no client caller: ${total}` +
      ` (excluding ${skipped} under ${NON_CLIENT_PREFIXES.join(', ')})\n`
  );

  for (const file of [...byFile.keys()].sort()) {
    const routes = byFile.get(file).sort();
    console.log(`${file}  (${routes.length})`);
    for (const id of routes) console.log(`    ${id}`);
    console.log('');
  }

  console.log(
    'These are not failures. Reaching one needs a client helper; leaving it ' +
      'unreachable is right when nothing in the UI should call it.'
  );
}

function main() {
  const listOnly = process.argv.includes('--list');
  const unreachable = process.argv.includes('--unreachable');

  const serverRoutes = collectServerRoutes();
  const clientCalls = collectClientCalls();

  if (listOnly) {
    for (const route of serverRoutes.slice().sort((a, b) => a.raw.localeCompare(b.raw))) {
      console.log(`${route.method.padEnd(6)} ${route.raw}   (${route.file})`);
    }
    console.log(`\n${serverRoutes.length} server routes, ${clientCalls.size} client call sites`);
    return;
  }

  if (unreachable) {
    reportUnreachable(serverRoutes, clientCalls);
    return;
  }

  const missing = [];
  const shadowed = [];
  const wrongVerb = [];
  const staleAllowances = new Set(ALLOWED.keys());

  for (const [key, files] of [...clientCalls].sort()) {
    const [method, routePath] = key.split(' ');
    const result = classify(method, routePath.split('/').filter(Boolean), serverRoutes);

    if (result.exact.length > 0) continue;

    if (ALLOWED.has(key)) {
      staleAllowances.delete(key);
      continue;
    }

    const finding = { key, files: [...files], result };
    if (result.viaParam.length > 0) shadowed.push(finding);
    else if (result.wrongVerb.length > 0) wrongVerb.push(finding);
    else missing.push(finding);
  }

  const report = (title, findings, describe) => {
    if (findings.length === 0) return;
    console.error(`\n${title} (${findings.length})`);
    for (const f of findings) {
      console.error(`  ${f.key}${describe ? `   ${describe(f)}` : ''}`);
      console.error(`      called from: ${f.files.join(', ')}`);
    }
  };

  report('MISSING — no server route matches', missing);
  report(
    'SHADOWED — only a :param route matches, so this reaches the wrong handler',
    shadowed,
    (f) => `[matched by ${f.result.viaParam.map((r) => `${r.method} ${r.raw}`).join(' | ')}]`
  );
  report(
    'WRONG_VERB — the path exists, but not for this method',
    wrongVerb,
    (f) => `[server has ${f.result.wrongVerb.map((r) => `${r.method} ${r.raw}`).join(' | ')}]`
  );

  // An allowance that no longer corresponds to a real call is dead weight and
  // would silently excuse a future regression on that same path.
  if (staleAllowances.size > 0) {
    console.error(`\nSTALE ALLOWANCES — remove these from ALLOWED (${staleAllowances.size})`);
    for (const key of staleAllowances) console.error(`  ${key}`);
  }

  const total = missing.length + shadowed.length + wrongVerb.length + staleAllowances.size;

  if (total > 0) {
    console.error(
      `\n${total} API contract problem(s). ` +
        `Checked ${clientCalls.size} client call sites against ${serverRoutes.length} server routes.\n`
    );
    process.exit(1);
  }

  console.log(
    `API contract OK — ${clientCalls.size} client call sites all resolve ` +
      `against ${serverRoutes.length} server routes.`
  );
}

main();
