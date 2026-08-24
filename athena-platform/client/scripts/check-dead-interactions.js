#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Fails when a component the user can actually reach contains an interaction
 * that does nothing.
 *
 * Why this exists: this codebase has repeatedly shipped UI that looks finished
 * and is wired to nothing — `onClick={() => {}}`, `href="#"`, a handler that
 * only logs. docs/UNREFERENCED-UI-COMPONENTS.md catalogues the ones sitting in
 * components no route renders, which are harmless until mounted. This checks
 * the other set: files reachable from a Next entry point, where a dead handler
 * is a button a real person can press for no result.
 *
 * Reachability is computed from every app/ entry file (page/layout/template/
 * error/loading/not-found/default) by following local imports transitively.
 * `@/` and relative specifiers are resolved against the real filesystem;
 * node_modules is ignored.
 *
 * The reachable set is enforced. Unreachable findings are printed as context
 * only — they are the documented backlog, not a build failure.
 *
 * Usage:
 *   node scripts/check-dead-interactions.js           # exits 1 on a reachable finding
 *   node scripts/check-dead-interactions.js --all     # also list unreachable ones
 *   node scripts/check-dead-interactions.js --reach   # print the reachable set
 *
 * No dependencies, so CI can run it without installing the client.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const APP = path.join(SRC, 'app');

const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
const ENTRY_FILE = /^(page|layout|template|error|loading|not-found|default)\.(tsx|ts|jsx|js)$/;

function fail(message) {
  console.error(`\n  check-dead-interactions: ${message}\n`);
  process.exit(2);
}

// ------------------------------------------------------------------ resolving

function resolveSpecifier(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // a package, not our code

  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  for (const ext of EXTENSIONS) {
    const candidate = path.join(base, `index${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// Static imports, re-exports and dynamic import() all count as reachability.
function localImportsOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const found = [];
  for (const m of src.matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
    const resolved = resolveSpecifier(m[1], file);
    if (resolved) found.push(resolved);
  }
  return found;
}

function walk(dir, predicate, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (predicate(entry.name)) out.push(full);
  }
  return out;
}

function computeReachable() {
  if (!fs.existsSync(APP)) fail(`cannot find ${APP}`);

  const entries = walk(APP, (name) => ENTRY_FILE.test(name));
  if (entries.length === 0) fail('found no app/ entry files — the entry pattern is stale');

  const reachable = new Set();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    for (const dep of localImportsOf(file)) {
      if (!reachable.has(dep)) queue.push(dep);
    }
  }
  return { entries, reachable };
}

// ------------------------------------------------------------------- patterns

// Each pattern describes an interactive prop wired to something inert. Kept
// deliberately narrow: a false positive here blocks a build, and the cost of
// missing one is only that it stays as findable as it was before.
const PATTERNS = [
  ['empty handler', /\bon[A-Z]\w*\s*=\s*\{\s*\(\s*[^)]*\)\s*=>\s*\{\s*\}\s*\}/g],
  ['handler returning nothing', /\bon[A-Z]\w*\s*=\s*\{\s*\(\s*\)\s*=>\s*(?:null|undefined|void 0)\s*\}/g],
  ['log-only handler', /\bon[A-Z]\w*\s*=\s*\{\s*\(\s*[^)]*\)\s*=>\s*console\.\w+\(/g],
  ['alert-only handler', /\bon[A-Z]\w*\s*=\s*\{\s*\(\s*[^)]*\)\s*=>\s*alert\(/g],
  ['placeholder link', /href\s*=\s*(?:["']#["']|\{\s*["']#["']\s*\})/g],
  ['not-implemented notice', /(?:toast|alert)\s*[.(][^\n]{0,80}?(coming soon|not implemented|not yet available)/gi],
];

function scan(files) {
  const findings = [];
  for (const file of files) {
    if (!/\.(tsx|jsx)$/.test(file)) continue; // markup only
    const src = fs.readFileSync(file, 'utf8');
    const lines = src.split('\n');

    for (const [label, pattern] of PATTERNS) {
      for (const match of src.matchAll(pattern)) {
        const line = src.slice(0, match.index).split('\n').length;
        findings.push({
          file: path.relative(SRC, file).split(path.sep).join('/'),
          line,
          label,
          text: (lines[line - 1] || '').trim().slice(0, 120),
        });
      }
    }
  }
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

function print(findings) {
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  [${f.label}]`);
    console.error(`      ${f.text}`);
  }
}

// ----------------------------------------------------------------------- main

function main() {
  const { entries, reachable } = computeReachable();

  if (process.argv.includes('--reach')) {
    for (const file of [...reachable].sort()) {
      console.log(path.relative(SRC, file).split(path.sep).join('/'));
    }
    console.log(`\n${entries.length} entry files, ${reachable.size} reachable modules`);
    return;
  }

  const allFiles = walk(SRC, (name) => /\.(tsx|jsx)$/.test(name));
  const unreachableFiles = allFiles.filter((f) => !reachable.has(f));

  const reachableFindings = scan([...reachable]);
  const unreachableFindings = scan(unreachableFiles);

  if (process.argv.includes('--all') && unreachableFindings.length > 0) {
    console.log(
      `Dead interactions in components no route renders (${unreachableFindings.length}) — ` +
        'not failures, see docs/UNREFERENCED-UI-COMPONENTS.md:'
    );
    print(unreachableFindings);
    console.log('');
  }

  if (reachableFindings.length > 0) {
    console.error(
      `\nDead interactions in components the user can reach (${reachableFindings.length}).` +
        '\nThese are controls a real person can operate for no result:\n'
    );
    print(reachableFindings);
    console.error(
      `\nChecked ${reachable.size} reachable modules from ${entries.length} entry files.\n`
    );
    process.exit(1);
  }

  console.log(
    `No dead interactions in reachable UI — ${reachable.size} modules from ` +
      `${entries.length} entry files. ` +
      `(${unreachableFindings.length} in unmounted components; --all to list.)`
  );
}

main();
