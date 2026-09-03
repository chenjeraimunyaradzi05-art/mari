#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Fails when documentation cites a file that is not in the repository.
 *
 * Why this exists: the markdown in this repo is used as a map — runbooks point
 * at the route file to edit, audits point at the component they found, setup
 * guides point at the script to run. A citation that has rotted sends the next
 * reader to a path that does not exist, and there is nothing in a build that
 * would ever notice. Documentation is the one artefact here with no compiler.
 *
 * What counts as a citation:
 *   - markdown links and images, `[text](path)` and `![alt](path)`
 *   - reference-style link definitions, `[id]: path`
 *   - inline code that looks like a path, `` `athena-platform/server/src/x.ts` ``
 *
 * Only *file* citations are checked. A target is considered a file path when it
 * carries a known extension or ends in a slash; anything else is a URL, an
 * anchor, an application route or prose, and is skipped. Inline code must also
 * contain a slash, because a bare `package.json` in a monorepo names nothing in
 * particular.
 *
 * Existence is decided against `git ls-files`, not the filesystem. Two reasons:
 * the git index is case-sensitive on every platform, so a citation that works on
 * a Windows checkout and 404s on Linux is caught here rather than in CI; and a
 * file that exists locally but was never committed is broken for every other
 * reader, which is exactly the failure this is meant to find.
 *
 * A target resolves if it is found relative to the citing document, relative to
 * the repository root, or as the tail of a tracked path. All three
 * conventions are in use here — an audit table lists `studios/x/Y.tsx` against a
 * base named in its own heading, a runbook cites `src/routes/z.ts` meaning the
 * server package — and reporting those as missing files would bury the citations
 * that name something which genuinely does not exist.
 *
 * Usage:
 *   node scripts/check-doc-references.js                   # exits 1 on a new break
 *   node scripts/check-doc-references.js --all             # also list known ones
 *   node scripts/check-doc-references.js --update-baseline # re-record the known set
 *
 * There is a large inherited backlog, so the known set is recorded in
 * doc-references-baseline.json and only new breakages fail. Burn the list down;
 * do not add to it.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BASELINE_PATH = path.join(__dirname, 'doc-references-baseline.json');

function fail(message) {
  console.error(`\n  check-doc-references: ${message}\n`);
  process.exit(2);
}

// ------------------------------------------------------------------ the index

function trackedFiles() {
  let out;
  try {
    out = execFileSync('git', ['ls-files', '-z'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    fail(`cannot run git in ${REPO_ROOT}`);
  }

  const files = out.split('\0').filter(Boolean);
  if (files.length === 0) fail('git ls-files returned nothing — is this a checkout?');
  return files;
}

// Every tracked path plus every directory on the way to one, so a citation can
// point at a folder as well as a file. `byLastSegment` groups those same paths
// by their final segment, which is what makes the tail lookup cheap.
function buildIndex(files) {
  const paths = new Set();
  for (const file of files) {
    paths.add(file);
    let dir = path.posix.dirname(file);
    while (dir && dir !== '.' && !paths.has(dir)) {
      paths.add(dir);
      dir = path.posix.dirname(dir);
    }
  }

  const byLastSegment = new Map();
  for (const p of paths) {
    const segment = p.slice(p.lastIndexOf('/') + 1);
    if (!byLastSegment.has(segment)) byLastSegment.set(segment, []);
    byLastSegment.get(segment).push(p);
  }

  return { paths, byLastSegment };
}

// ---------------------------------------------------------------- extraction

// Extensions that make a target unambiguously a file. Deliberately limited to
// what this repo actually contains: adding one that no document cites only
// widens the surface for false positives.
const FILE_EXTENSION =
  /\.(tsx?|jsx?|mjs|cjs|json|md|ya?ml|prisma|sql|sh|ps1|toml|css|scss|html|env|txt|png|jpg|svg|pdf|lock|cfg|ini|conf|Dockerfile)$/i;

// Things that are not repository paths, whatever else they look like.
const NOT_A_PATH = [
  /^[a-z][a-z0-9+.-]*:/i, // http:, https:, mailto:, tel:, data:
  /^#/, // in-page anchor
  /\s/, // prose that happened to sit in brackets
  /[*?<>{}$|]/, // globs, placeholders, shell fragments
  /^~/, // a home directory, not ours
  // A path into an installed dependency. node_modules is ignored by git, so
  // nothing under it can ever be in the index; a document pointing a reader at
  // a dependency's own docs is citing the package, not this repository.
  /(^|\/)node_modules\//,
];

// Strips the parts of a citation that are not the path: an anchor, a query, a
// `:42` line reference, and any sentence punctuation that ran into the link.
function cleanTarget(raw) {
  return raw
    .trim()
    .replace(/^<|>$/g, '')
    .split('#')[0]
    .split('?')[0]
    .replace(/:L?\d+(-L?\d+)?$/, '')
    .replace(/[.,;:)\]]+$/, '');
}

function looksLikeFilePath(target) {
  if (!target) return false;
  if (NOT_A_PATH.some((re) => re.test(target))) return false;
  return FILE_EXTENSION.test(target) || target.endsWith('/');
}

// Fenced blocks are samples, not citations: they hold shell transcripts, config
// snippets and output, none of which describe where something lives.
function stripFencedCode(src) {
  return src.replace(/^```[\s\S]*?^```/gm, (block) => block.replace(/[^\n]/g, ' '));
}

function citationsIn(src) {
  const scannable = stripFencedCode(src);
  const found = [];

  const record = (raw, offset) => {
    const target = cleanTarget(raw);
    if (!looksLikeFilePath(target)) return;
    found.push({ target, line: scannable.slice(0, offset).split('\n').length });
  };

  // `[text](target)` and `![alt](target)`, with an optional "title" after it.
  for (const m of scannable.matchAll(/!?\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    record(m[1], m.index);
  }

  // Reference-style definitions: `[id]: target` at the start of a line.
  for (const m of scannable.matchAll(/^\s*\[[^\]\n]+\]:\s*(\S+)/gm)) {
    record(m[1], m.index);
  }

  // Inline code. A slash is required: `package.json` on its own names nothing
  // in particular in a repo with five of them.
  for (const m of scannable.matchAll(/`([^`\n]+)`/g)) {
    if (!m[1].includes('/')) continue;
    record(m[1], m.index);
  }

  return found;
}

// ---------------------------------------------------------------- resolution

const trimSlashes = (p) => p.replace(/\/+$/, '');

// A doc may cite its neighbour relatively, name a path from the repository root,
// or give a path rooted at a package it named in prose. A citation is broken
// only when none of the three reads.
function resolves(target, docFile, index) {
  const candidates = [];

  if (target.startsWith('/')) {
    candidates.push(target.slice(1));
  } else {
    candidates.push(path.posix.normalize(path.posix.join(path.posix.dirname(docFile), target)));
    candidates.push(path.posix.normalize(target));
  }

  for (const candidate of candidates) {
    const normalised = trimSlashes(candidate);
    if (normalised === '' || normalised.startsWith('..')) continue;
    if (index.paths.has(normalised)) return true;
  }

  const tail = trimSlashes(target);
  const segment = tail.slice(tail.lastIndexOf('/') + 1);
  return (index.byLastSegment.get(segment) || []).some((p) => p.endsWith(`/${tail}`));
}

// -------------------------------------------------------------------- baseline

const keyOf = (finding) => `${finding.file}|${finding.target}`;

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return new Set();
  try {
    return new Set(JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).known || []);
  } catch {
    fail(`${path.basename(BASELINE_PATH)} is not valid JSON`);
  }
}

function writeBaseline(findings) {
  const payload = {
    comment:
      'Broken documentation references, recorded so CI fails only on new ones. ' +
      'Burn this list down; do not add to it. Regenerate with: ' +
      'node scripts/check-doc-references.js --update-baseline',
    generated: new Date().toISOString().slice(0, 10),
    count: findings.length,
    known: findings.map(keyOf).sort(),
  };
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Baseline written: ${findings.length} known breakages recorded.`);
}

// ------------------------------------------------------------------------ main

function print(findings, stream = console.error) {
  for (const f of findings) {
    stream(`  ${f.file}:${f.line}`);
    stream(`      ${f.target}`);
  }
}

function main() {
  const files = trackedFiles();
  const index = buildIndex(files);
  const docs = files.filter((f) => f.endsWith('.md'));

  if (docs.length === 0) fail('found no tracked markdown — the file filter is stale');

  const findings = [];
  let checked = 0;

  for (const doc of docs) {
    const absolute = path.join(REPO_ROOT, doc);
    if (!fs.existsSync(absolute)) continue; // tracked but not checked out

    for (const citation of citationsIn(fs.readFileSync(absolute, 'utf8'))) {
      checked += 1;
      if (resolves(citation.target, doc, index)) continue;
      findings.push({ file: doc, line: citation.line, target: citation.target });
    }
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  if (process.argv.includes('--update-baseline')) {
    writeBaseline(findings);
    return;
  }

  const baseline = loadBaseline();
  const seen = new Set(findings.map(keyOf));

  const newFindings = findings.filter((f) => !baseline.has(keyOf(f)));
  const knownCount = findings.length - newFindings.length;
  const fixed = [...baseline].filter((k) => !seen.has(k));

  if (newFindings.length > 0) {
    console.error(
      `\nDocumentation cites ${newFindings.length} path(s) that are not in the repository:\n`
    );
    print(newFindings);
    console.error(
      '\nPoint each citation at where the file actually lives, or drop the claim.' +
        '\nIf the file is real but was never committed, commit it.\n'
    );
    process.exit(1);
  }

  if (process.argv.includes('--all') && knownCount > 0) {
    console.log(`Known broken references still outstanding (${knownCount}):`);
    print(
      findings.filter((f) => baseline.has(keyOf(f))),
      console.log
    );
    console.log('');
  }

  console.log(
    `No new broken documentation references — ${checked} citations across ${docs.length} files.`
  );
  if (knownCount > 0) {
    console.log(`  ${knownCount} known breakages still outstanding (baseline); --all to list.`);
  }
  if (fixed.length > 0) {
    console.log(
      `  ${fixed.length} baseline entries no longer occur — run --update-baseline to drop them.`
    );
  }
}

main();
