#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Stops three kinds of debt in server/src from growing, one file at a time.
 *
 * Why this exists. The audit found them all at once and found nothing in CI
 * that would ever notice a fourth, fifth or thousandth instance:
 *
 *   req-user-assertions        `req.user!`. The assertion turns off the one
 *                              compiler check that would catch a handler
 *                              registered with optionalAuth, or none, reading a
 *                              member who is not there. About a thousand of
 *                              them, in files that mix optionalAuth with the
 *                              assertion.
 *   any-types                  `any` written as a type (`: any`, `as any`,
 *                              `any[]`, `Record<string, any>`). ESLint's
 *                              no-explicit-any is off in .eslintrc.cjs, and
 *                              its comment says why: switched on, it printed
 *                              2,532 lines and drowned every other warning. It
 *                              also says it can come back "when it can be
 *                              scoped to newly written code", which is what
 *                              this is.
 *   hand-rolled-page-limits    `parseInt(req.query.limit)`, or Number() or
 *                              parseFloat() of it, with no ceiling around it.
 *                              The page size reaches `take`, so `?limit=1000000`
 *                              asks the database for a million rows and
 *                              `?limit=-5` reads from the end. On a platform
 *                              whose directories and profiles are readable
 *                              without an account, every unclamped limit is a
 *                              way to take a whole table in one request. The
 *                              shared helpers in utils/pagination.ts
 *                              (clampLimit, parsePagination) are the way to
 *                              read a limit; a read that sits inside Math.min,
 *                              Math.max or a clamp-named function already has a
 *                              bound and is not counted.
 *   unvalidated-route-handlers Handlers in a *.routes.ts file that imports
 *                              neither zod nor express-validator, and so checks
 *                              its input, if at all, with hand-written ifs.
 *                              That is how `POST /api/payments/payout` came to
 *                              check that `amount` was truthy but never that it
 *                              was a positive number.
 *
 * None of this is fixed here: the fixes are in the route and service files,
 * and there are thousands of them. What this does is make the number go one
 * way. The count for every file is recorded in debt-ratchet-baseline.json. A
 * file whose count rises above its recorded number, or a new file with any,
 * fails the check and is named. A file whose count falls is reported, and
 * `--update-baseline` locks the lower number in, so the ground gained cannot
 * be given back. It works like check-doc-references.js and its baseline.
 *
 * What is counted is read from the TypeScript syntax tree, not from text, so a
 * comment or a string that mentions `req.user!` or `any` is not counted, and
 * neither is a test file (anything under __tests__ or named *.test.ts).
 *
 * Usage:
 *   node scripts/check-debt-ratchet.js                    # exits 1 if anything grew
 *   node scripts/check-debt-ratchet.js --update-baseline  # record the current counts
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SERVER_ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(SERVER_ROOT, 'src');
const BASELINE_PATH = path.join(__dirname, 'debt-ratchet-baseline.json');

const METRICS = {
  'req-user-assertions': 'req.user! non-null assertions',
  'any-types': '`any` written as a type',
  'unvalidated-route-handlers': 'route handlers in files that import neither zod nor express-validator',
  'hand-rolled-page-limits': 'page sizes read from the query string with no ceiling (use clampLimit)',
};

const VALIDATORS = new Set(['zod', 'express-validator']);
const HTTP_VERBS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all']);
// Every route file registers on an Express Router named `router`; a sub-router
// named `adminRouter` or the app itself would count too. A cache or an HTTP
// client with a .get('/...') of its own is not a route and is not counted.
const ROUTER_NAME = /^(router|app|[A-Za-z]+Router)$/;

// What reads a number out of text. A page size that goes through one of these
// and nothing else is whatever the caller typed.
const NUMBER_READERS = new Set(['parseInt', 'parseFloat', 'Number', 'Number.parseInt', 'Number.parseFloat']);
// `req.query.limit`, `query.limit`, `req.query['limit']`, and the same for the
// other names a page size goes by; or, for a route that destructured its query,
// the bare name (`parseInt(limit as string)`).
const QUERY_PAGE_SIZE = /\bquery(?:\.|\s*\[\s*['"])(?:limit|pageSize|per_?page)\b/;
const BARE_PAGE_SIZE = /^(?:limit|pageSize)(?:\s+as\s+[\w.]+)?$/;
// A call that puts a bound on whatever is inside it.
const BOUNDING_CALL = /^(?:Math\.min|Math\.max|(?:\w+\.)?(?:clamp\w*|bound\w*|parseLimit|parsePaging|parsePagination))$/;

function readsPageSize(node) {
  const callee = node.expression.getText();
  if (!NUMBER_READERS.has(callee)) return false;
  const [first] = node.arguments;
  if (!first) return false;
  const text = first.getText().trim();
  return QUERY_PAGE_SIZE.test(text) || BARE_PAGE_SIZE.test(text);
}

/** Whether the read sits inside Math.min, Math.max or a clamp, within the same expression. */
function isBounded(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isCallExpression(parent) && BOUNDING_CALL.test(parent.expression.getText())) return true;
    if (
      ts.isVariableDeclaration(parent) ||
      ts.isExpressionStatement(parent) ||
      ts.isReturnStatement(parent) ||
      ts.isBlock(parent)
    ) {
      return false;
    }
  }
  return false;
}

function isTestFile(relativePath) {
  return relativePath.split('/').includes('__tests__') || /\.test\.ts$/.test(relativePath);
}

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.ts$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * The three counts for one file's source. `fileName` decides only whether the
 * route-handler count applies (a *.routes.ts file) and how the parser treats
 * the text.
 */
function countDebt(fileName, text) {
  const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const counts = {
    'req-user-assertions': 0,
    'any-types': 0,
    'unvalidated-route-handlers': 0,
    'hand-rolled-page-limits': 0,
  };
  const isRouteFile = /\.routes\.ts$/.test(fileName);
  let routeHandlers = 0;
  let validated = false;

  const visit = (node) => {
    // Only in a route file, where a query string arrives: a service that is
    // handed a `limit` has been given it by something that read it.
    if (isRouteFile && ts.isCallExpression(node) && readsPageSize(node) && !isBounded(node)) {
      counts['hand-rolled-page-limits'] += 1;
    }
    if (ts.isNonNullExpression(node)) {
      const inner = node.expression;
      if (
        ts.isPropertyAccessExpression(inner) &&
        inner.name.text === 'user' &&
        ts.isIdentifier(inner.expression) &&
        inner.expression.text === 'req'
      ) {
        counts['req-user-assertions'] += 1;
      }
    } else if (node.kind === ts.SyntaxKind.AnyKeyword) {
      counts['any-types'] += 1;
    } else if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (VALIDATORS.has(node.moduleSpecifier.text)) validated = true;
    } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const [first] = node.arguments;
      if (
        HTTP_VERBS.has(node.expression.name.text) &&
        ts.isIdentifier(node.expression.expression) &&
        ROUTER_NAME.test(node.expression.expression.text) &&
        first &&
        (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) &&
        first.text.startsWith('/')
      ) {
        routeHandlers += 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (/\.routes\.ts$/.test(fileName) && !validated) counts['unvalidated-route-handlers'] = routeHandlers;
  return counts;
}

/** { metric: { 'src/relative/path.ts': count } }, with files at zero left out. */
function measure(srcRoot = SRC_ROOT) {
  const result = Object.fromEntries(Object.keys(METRICS).map((metric) => [metric, {}]));
  for (const file of sourceFiles(srcRoot)) {
    const relative = path.relative(path.dirname(srcRoot), file).split(path.sep).join('/');
    if (isTestFile(relative)) continue;
    const counts = countDebt(file, fs.readFileSync(file, 'utf8'));
    for (const metric of Object.keys(METRICS)) {
      if (counts[metric] > 0) result[metric][relative] = counts[metric];
    }
  }
  for (const metric of Object.keys(result)) {
    result[metric] = Object.fromEntries(Object.entries(result[metric]).sort(([a], [b]) => a.localeCompare(b)));
  }
  return result;
}

/** What grew and what shrank, per metric, against the recorded counts. */
function compare(current, baseline) {
  const grew = [];
  const shrank = [];
  for (const metric of Object.keys(METRICS)) {
    const now = current[metric] || {};
    const before = (baseline && baseline[metric]) || {};
    for (const file of new Set([...Object.keys(now), ...Object.keys(before)])) {
      const was = before[file] || 0;
      const is = now[file] || 0;
      if (is > was) grew.push({ metric, file, was, is });
      else if (is < was) shrank.push({ metric, file, was, is });
    }
  }
  return { grew, shrank };
}

const total = (byFile) => Object.values(byFile).reduce((sum, n) => sum + n, 0);

function main() {
  const current = measure();

  if (process.argv.includes('--update-baseline')) {
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
    for (const [metric, label] of Object.entries(METRICS)) {
      console.log(`${String(total(current[metric])).padStart(6)}  ${label}`);
    }
    console.log(`\nRecorded in ${path.relative(SERVER_ROOT, BASELINE_PATH)}.`);
    return;
  }

  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`No baseline at ${path.relative(SERVER_ROOT, BASELINE_PATH)}. Run with --update-baseline once.`);
    process.exit(2);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const { grew, shrank } = compare(current, baseline);

  for (const [metric, label] of Object.entries(METRICS)) {
    const now = total(current[metric]);
    const before = total(baseline[metric] || {});
    const change = now === before ? '' : ` (was ${before})`;
    console.log(`${String(now).padStart(6)}  ${label}${change}`);
  }

  if (shrank.length > 0) {
    console.log(`\nDown in ${shrank.length} place(s). Lock it in with --update-baseline so it cannot creep back:`);
    for (const { metric, file, was, is } of shrank) console.log(`  ${file}  ${metric}: ${was} -> ${is}`);
  }

  if (grew.length > 0) {
    console.error(`\nMore debt than the baseline allows, in ${grew.length} place(s):`);
    for (const { metric, file, was, is } of grew) console.error(`  ${file}  ${metric}: ${was} -> ${is}`);
    console.error(
      '\nWrite the new code without it: narrow req.user with a check (or use the typed request the route' +
        ' already has) instead of `!`; name the type instead of `any`; validate the body with zod or' +
        ' express-validator. If the rise is a file moving or being split, with no new instances, run' +
        ' --update-baseline and say so in the commit.'
    );
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { countDebt, compare, measure, isTestFile, METRICS };
