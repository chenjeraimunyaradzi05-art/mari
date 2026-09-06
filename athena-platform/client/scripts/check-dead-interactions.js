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

// ------------------------------------------------ buttons with no handler

// An `onClick={() => {}}` is easy to spot. A <Button> with no handler *at all*
// is the same bug and was previously invisible, so it is detected here — but
// only after ruling out every legitimate way a button gets its behaviour from
// somewhere other than its own onClick.

// Attributes that mean this button does something.
const WIRED_ATTRS = [
  /\bon(?:Click|MouseDown|PointerDown|KeyDown|Submit)\b/,
  /\btype\s*=\s*(?:["']submit["']|\{\s*["']submit["']\s*\})/,
  // `asChild` hands rendering to a child that carries the behaviour.
  /\basChild\b/,
  // A spread can carry onClick; assuming it does is the safe direction.
  /\{\s*\.\.\./,
  // Link-like buttons navigate rather than handle a click.
  /\bhref\b/,
  // A visibly disabled control is honest about doing nothing. This codebase
  // uses `disabled title="… not connected yet"` deliberately.
  /\bdisabled\b/,
];

// Wrappers whose own job is to open something when the child is clicked, so the
// child needs no handler. TooltipTrigger is deliberately absent: a tooltip only
// shows text on hover, so a Button inside one still needs its own onClick.
const ACTION_TRIGGER =
  /<(?:Dialog|Sheet|Popover|DropdownMenu|AlertDialog|Collapsible|Menubar|ContextMenu|HoverCard|Select|Tabs|Accordion)[A-Za-z]*Trigger\b[^>]*\basChild\b/;

// Reads a JSX opening tag from `<` to its matching `>`, ignoring any `>` that
// sits inside a string or an expression container.
function readOpeningTag(src, start) {
  let depth = 0;
  let quote = null;

  for (let i = start; i < src.length && i < start + 4000; i++) {
    const ch = src[i];

    if (quote) {
      if (ch === quote && src[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') { depth++; continue; }
    if (ch === '}') { depth--; continue; }
    if (ch === '>' && depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

// Whether the offset sits inside a <form> element, where a button with no
// explicit type submits by default and is therefore wired.
function insideForm(src, offset) {
  const before = src.slice(0, offset);
  const opens = (before.match(/<form\b/g) || []).length;
  const closes = (before.match(/<\/form>/g) || []).length;
  return opens > closes;
}

function findUnhandledButtons(src, file, lines) {
  const findings = [];

  for (const m of src.matchAll(/<(Button|button)(?=[\s/>])/g)) {
    // A "<button>" inside a comment is prose about buttons, not a button.
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const linePrefix = src.slice(lineStart, m.index).trimStart();
    if (linePrefix.startsWith('//') || linePrefix.startsWith('*')) continue;
    const tag = readOpeningTag(src, m.index);
    if (!tag) continue;

    if (WIRED_ATTRS.some((re) => re.test(tag))) continue;
    if (insideForm(src, m.index)) continue;

    // Look back a few lines for a wrapper that supplies the behaviour.
    const lineNo = src.slice(0, m.index).split('\n').length;
    const context = lines.slice(Math.max(0, lineNo - 4), lineNo - 1).join('\n');
    if (ACTION_TRIGGER.test(context)) continue;
    if (/<Link\b/.test(context)) continue;

    findings.push({
      file: path.relative(SRC, file).split(path.sep).join('/'),
      line: lineNo,
      label: 'button with no handler',
      text: (lines[lineNo - 1] || '').trim().slice(0, 120),
    });
  }

  return findings;
}

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

    findings.push(...findUnhandledButtons(src, file, lines));
  }
  return findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

function print(findings, stream = console.error) {
  for (const f of findings) {
    stream(`  ${f.file}:${f.line}  [${f.label}]`);
    stream(`      ${f.text}`);
  }
}

// ------------------------------------------------------------------ baseline

// Adding the "button with no handler" rule surfaced 51 pre-existing findings.
// Gating on the total would either fail the build indefinitely or force the
// rule to be disabled, so the known set is recorded and only *new* findings
// fail. Keyed on file + label + the source line rather than line number, so
// unrelated edits above a finding do not silently re-admit it.
const BASELINE_PATH = path.join(__dirname, 'dead-interactions-baseline.json');

const keyOf = (f) => `${f.file}|${f.label}|${f.text.replace(/\s+/g, ' ')}`;

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return new Set();
  try {
    const parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    return new Set(parsed.known ?? []);
  } catch {
    fail(`${path.basename(BASELINE_PATH)} is not valid JSON`);
  }
}

function writeBaseline(findings) {
  const payload = {
    // eslint-disable-next-line max-len
    comment:
      'Known dead interactions, recorded so CI fails only on new ones. Burn this list down; do not add to it. Regenerate with: node scripts/check-dead-interactions.js --update-baseline',
    generated: new Date().toISOString().slice(0, 10),
    count: findings.length,
    known: findings.map(keyOf).sort(),
  };
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Baseline written: ${findings.length} known findings recorded.`);
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

  if (process.argv.includes('--update-baseline')) {
    writeBaseline(reachableFindings);
    return;
  }

  const baseline = loadBaseline();
  const seen = new Set(reachableFindings.map(keyOf));

  const newFindings = reachableFindings.filter((f) => !baseline.has(keyOf(f)));
  const knownCount = reachableFindings.length - newFindings.length;
  const fixed = [...baseline].filter((k) => !seen.has(k));

  if (newFindings.length > 0) {
    console.error(
      `\nNew dead interactions in components the user can reach (${newFindings.length}).` +
        '\nThese are controls a real person can operate for no result:\n'
    );
    print(newFindings);
    console.error(
      '\nIf a control legitimately gets its behaviour elsewhere — a form submit, an' +
        '\nasChild trigger, a Link wrapper — wire it or say so in the markup rather' +
        '\nthan adding it to the baseline.\n'
    );
    process.exit(1);
  }

  if (process.argv.includes('--all') && knownCount > 0) {
    console.log(`Known dead interactions still outstanding (${knownCount}):`);
    print(
      reachableFindings.filter((f) => baseline.has(keyOf(f))),
      console.log
    );
    console.log('');
  }

  console.log(
    `No new dead interactions — ${reachable.size} modules from ${entries.length} entry files.`
  );
  if (knownCount > 0) {
    console.log(
      `  ${knownCount} known findings still outstanding (baseline); --all to list.`
    );
  }
  if (fixed.length > 0) {
    console.log(
      `  ${fixed.length} baseline entries no longer occur — run --update-baseline to drop them.`
    );
  }
  if (unreachableFindings.length > 0) {
    console.log(`  ${unreachableFindings.length} in unmounted components.`);
  }
}

main();
