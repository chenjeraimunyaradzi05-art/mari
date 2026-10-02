#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Stops two kinds of unchecked input from growing, one route file at a time.
 *
 *   unvalidated-input-routes   A POST, PUT, PATCH or DELETE handler that reads
 *                              `req.body` or `req.query` and shows no sign of
 *                              having checked what it read.
 *   unclamped-list-routes      A handler that reads a list size from the query
 *                              string (`limit`, `pageSize`, `perPage`, `take`)
 *                              and shows no sign of bounding it.
 *
 * Why this exists. The audit counted 668 mutating handlers across 84 route
 * files, 455 of them reading a body, and found three ways a route can claim to
 * validate and not: no check at all, a hand-written `typeof` ladder, and an
 * express-validator chain that is declared in the route's argument list and
 * never read (`validationResult(req)` is what turns a chain into a 400; without
 * it the chain does nothing, and `PATCH /api/users/me/profile` handed its raw
 * body to Prisma behind one). Nothing in CI would have noticed the next one.
 *
 * The count for every file is recorded in route-validation-baseline.json. A
 * file whose count rises above its recorded number, or a new file with any,
 * fails the check and is named. A file whose count falls is reported, and
 * `--update-baseline` locks the lower number in. It works like
 * check-debt-ratchet.js, which this is the narrower sibling of.
 *
 * What counts as a sign of checking, found by reading the syntax tree and
 * never the text (a comment that says "validate" is not a check):
 *
 *   - a call to the shared middleware: zodBody, zodQuery, zodParams or parseWith
 *     (src/middleware/validate.ts), or to parseStrict (utils/request-schema.ts);
 *   - a call to `validationResult`, which is what reads an express-validator
 *     chain, or to any function this same file defines that does so or parses
 *     with a zod schema (`parse(schema, req.body)`, `failOnErrors(req)`);
 *   - a `.parse(...)` or `.safeParse(...)` call on a schema in the handler;
 *   - a comment `// validated: <reason>` on or just above the route, for a
 *     handler whose body is read and checked somewhere this walk cannot see
 *     (a service that parses it). The reason is the point: a reader of the
 *     route sees where the checking is.
 *
 * and, for a list size, any of those or a call to a clamp: parsePagination,
 * clampLimit, a local parseLimit and its kin, or a Math.min and a Math.max together
 * (a Math.min alone leaves a negative size, which Prisma reads as "from the end").
 *
 * This is a floor and not a proof. A schema that accepts anything passes it.
 * What it stops is the route with no schema, and the chain nobody reads.
 *
 * Usage:
 *   node scripts/check-route-validation.js                    # exits 1 if anything grew
 *   node scripts/check-route-validation.js --update-baseline  # record the current counts
 *   node scripts/check-route-validation.js --list             # print every offending route
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SERVER_ROOT = path.resolve(__dirname, '..');
const ROUTES_ROOT = path.join(SERVER_ROOT, 'src', 'routes');
const BASELINE_PATH = path.join(__dirname, 'route-validation-baseline.json');

const METRICS = {
  'unvalidated-input-routes': 'mutating routes that read a body or query and check neither',
  'unclamped-list-routes': 'list routes that read a size from the query and do not bound it',
};

const VERBS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const MUTATING = new Set(['post', 'put', 'patch', 'delete']);
const ROUTER_NAME = /^(router|app|[A-Za-z]+Router)$/;

/** Calls that are themselves the check, by name. */
const VALIDATION_CALLS = new Set([
  'zodBody',
  'zodQuery',
  'zodParams',
  'validationResult',
  'parseStrict',
  'parseWith',
  'parseOr400',
  // The zod parsers the host-safety and housing-provider services export for their
  // own routes (services/host-safety.service.ts, services/housing-provider.service.ts).
  'parseHostInput',
  'parseProviderInput',
]);
/** Property calls (`schema.parse(x)`) that are the check. */
const VALIDATION_METHODS = new Set(['parse', 'safeParse', 'parseAsync', 'safeParseAsync']);
/** Calls that bound a list size, by name. */
const CLAMP_CALLS = /^(parsePagination|clampLimit|clampPage|parse(Bounded)?(Limit|Integer|Paging|Page)|pageParam|positiveInt|boundedInt|cataloguePage|listPage)$/;
/** Query keys that size a page. */
const SIZE_KEYS = new Set(['limit', 'pageSize', 'perPage', 'take']);

// On the same line as the colon: a bare `// validated:` followed by code is not a reason.
const MARKER = /\/\/[ \t]*validated:[ \t]*\S/;

function isTestFile(relativePath) {
  return relativePath.split('/').includes('__tests__') || /\.test\.ts$/.test(relativePath);
}

function routeFiles(dir = ROUTES_ROOT) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') out.push(...routeFiles(full));
    } else if (/\.routes\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

const literalText = (node) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;

/** `req` or `request`, bare or behind an `as` cast or parentheses. */
function isRequestExpression(node) {
  let current = node;
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current)) {
    current = current.expression;
  }
  return ts.isIdentifier(current) && (current.text === 'req' || current.text === 'request');
}

/** True for `req.<member>`, however `req` is cast. */
function isRequestMember(node, member) {
  return ts.isPropertyAccessExpression(node) && node.name.text === member && isRequestExpression(node.expression);
}

/** True for `req.query.<one of keys>`, or a destructuring of `req.query` that names one. */
function readsSizeKey(node) {
  if (ts.isPropertyAccessExpression(node) && SIZE_KEYS.has(node.name.text) && isRequestMember(node.expression, 'query')) {
    return true;
  }
  if (ts.isElementAccessExpression(node) && isRequestMember(node.expression, 'query')) {
    return ts.isStringLiteral(node.argumentExpression) && SIZE_KEYS.has(node.argumentExpression.text);
  }
  if (
    ts.isVariableDeclaration(node) &&
    ts.isObjectBindingPattern(node.name) &&
    node.initializer &&
    (isRequestMember(node.initializer, 'query') ||
      (ts.isAsExpression(node.initializer) && isRequestMember(node.initializer.expression, 'query')))
  ) {
    return node.name.elements.some((element) => {
      const property = element.propertyName || element.name;
      return ts.isIdentifier(property) && SIZE_KEYS.has(property.text);
    });
  }
  return false;
}

/** Built-ins and libraries whose `parse` reads text and says nothing about whether it was what a route should accept. */
const NOT_SCHEMAS = new Set(['JSON', 'Date', 'path', 'URL', 'Number', 'qs', 'querystring', 'url']);

/** `schema.parse(x)`: a method named parse on anything but those, which only read text. */
const isSchemaParse = (call) =>
  ts.isPropertyAccessExpression(call.expression) &&
  VALIDATION_METHODS.has(call.expression.name.text) &&
  !(ts.isIdentifier(call.expression.expression) && NOT_SCHEMAS.has(call.expression.expression.text));

const calleeName = (call) => {
  if (ts.isIdentifier(call.expression)) return call.expression.text;
  if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
  return null;
};

/** Functions declared at the top level of this file, by name, for resolving a handler that is a name. */
function localFunctions(sourceFile) {
  const functions = new Map();
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      functions.set(statement.name.text, statement);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        let value = declaration.initializer;
        while (ts.isParenthesizedExpression(value) || ts.isAsExpression(value)) value = value.expression;
        if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) functions.set(declaration.name.text, value);
      }
    }
  }
  return functions;
}

/**
 * The names of this file's own functions that do the checking: they call a zod
 * parse or read an express-validator chain. A call to one of them is a check.
 * Found to a fixed point, so a helper that calls a helper counts too.
 */
function localValidators(functions) {
  const validators = new Set();
  const checks = (node) => {
    let found = false;
    const visit = (child) => {
      if (found) return;
      if (ts.isCallExpression(child)) {
        const name = calleeName(child);
        const isMethod = ts.isPropertyAccessExpression(child.expression);
        if ((name && !isMethod && (VALIDATION_CALLS.has(name) || validators.has(name))) || isSchemaParse(child)) {
          found = true;
          return;
        }
      }
      ts.forEachChild(child, visit);
    };
    visit(node);
    return found;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, node] of functions) {
      if (!validators.has(name) && checks(node)) {
        validators.add(name);
        changed = true;
      }
    }
  }
  return validators;
}

/** Whether `node` contains a check, by the list in the header. */
function hasValidation(node, validators) {
  let found = false;
  const visit = (child) => {
    if (found) return;
    if (ts.isCallExpression(child)) {
      const name = calleeName(child);
      const isMethod = ts.isPropertyAccessExpression(child.expression);
      if ((name && !isMethod && (VALIDATION_CALLS.has(name) || validators.has(name))) || isSchemaParse(child)) {
        found = true;
        return;
      }
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

/**
 * A hand-written clamp has two sides. `Math.min(parseInt(limit) || 20, 100)`
 * stops a million and lets `-1000000` through, and Prisma reads a negative
 * `take` as "from the end", so it is a million rows asked for the other way
 * round. A `Math.min` therefore counts only beside a `Math.max` in the same
 * place; clampLimit, parsePagination and the local parse helpers do both.
 */
function hasClamp(node, validators) {
  if (hasValidation(node, validators)) return true;
  let found = false;
  let sawMin = false;
  let sawMax = false;
  const visit = (child) => {
    if (found) return;
    if (ts.isCallExpression(child)) {
      const name = calleeName(child);
      if (name && CLAMP_CALLS.test(name)) {
        found = true;
        return;
      }
      if (
        ts.isPropertyAccessExpression(child.expression) &&
        ts.isIdentifier(child.expression.expression) &&
        child.expression.expression.text === 'Math'
      ) {
        if (child.expression.name.text === 'min') sawMin = true;
        if (child.expression.name.text === 'max') sawMax = true;
      }
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found || (sawMin && sawMax);
}

function readsInput(node, includeQuery) {
  let found = false;
  const visit = (child) => {
    if (found) return;
    if (isRequestMember(child, 'body') || (includeQuery && isRequestMember(child, 'query'))) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function readsSize(node) {
  let found = false;
  const visit = (child) => {
    if (found) return;
    if (readsSizeKey(child)) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

/**
 * Every route a file registers, with what was found about its input.
 * { verb, path, line, readsInput, validated, readsSize, clamped, marked }
 */
function analyseRouteFile(fileName, text) {
  const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const functions = localFunctions(sourceFile);
  const validators = localValidators(functions);
  const routes = [];

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      VERBS.has(node.expression.name.text) &&
      ts.isIdentifier(node.expression.expression) &&
      ROUTER_NAME.test(node.expression.expression.text)
    ) {
      const [first, ...rest] = node.arguments;
      const routePath = literalText(first);
      if (routePath !== null && routePath.startsWith('/')) {
        const verb = node.expression.name.text;
        // The route's own arguments, and the body of the local function named
        // as its handler, which is how `router.post('/x', authenticate, createX)`
        // hides it. Only the last argument is the handler: a middleware that
        // reads the query to scope a request (an organisation id, say) is not
        // the route reading its input.
        const regions = [...rest];
        const handler = rest[rest.length - 1];
        if (handler && ts.isIdentifier(handler) && functions.has(handler.text)) regions.push(functions.get(handler.text));
        const region = { regions };
        const covers = (check) => regions.some((part) => check(part));
        const mutating = MUTATING.has(verb);

        const fullText = text.slice(node.getFullStart(), node.end);
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        routes.push({
          verb,
          path: routePath,
          line: line + 1,
          mutating,
          readsInput: mutating && covers((part) => readsInput(part, true)),
          validated: covers((part) => hasValidation(part, validators)),
          readsSize: covers((part) => readsSize(part)),
          clamped: covers((part) => hasClamp(part, validators)),
          marked: MARKER.test(fullText),
          region,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return routes.map(({ region, ...route }) => route);
}

/** The two counts for one file's source. */
function countUnchecked(fileName, text) {
  const routes = analyseRouteFile(fileName, text);
  return {
    'unvalidated-input-routes': routes.filter((r) => r.readsInput && !r.validated && !r.marked).length,
    'unclamped-list-routes': routes.filter((r) => r.readsSize && !r.clamped && !r.marked).length,
  };
}

/** { metric: { 'src/relative/path.ts': count } }, with files at zero left out. */
function measure(routesRoot = ROUTES_ROOT) {
  const result = Object.fromEntries(Object.keys(METRICS).map((metric) => [metric, {}]));
  for (const file of routeFiles(routesRoot)) {
    const relative = path.relative(path.join(routesRoot, '..', '..'), file).split(path.sep).join('/');
    if (isTestFile(relative)) continue;
    const counts = countUnchecked(file, fs.readFileSync(file, 'utf8'));
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

function listOffenders() {
  for (const file of routeFiles()) {
    const relative = path.relative(SERVER_ROOT, file).split(path.sep).join('/');
    for (const route of analyseRouteFile(file, fs.readFileSync(file, 'utf8'))) {
      if (route.marked) continue;
      if (route.readsInput && !route.validated) console.log(`${relative}:${route.line}  ${route.verb.toUpperCase()} ${route.path}  reads input, unchecked`);
      if (route.readsSize && !route.clamped) console.log(`${relative}:${route.line}  ${route.verb.toUpperCase()} ${route.path}  list size unbounded`);
    }
  }
}

function main() {
  if (process.argv.includes('--list')) {
    listOffenders();
    return;
  }

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
    console.error(`\nMore unchecked input than the baseline allows, in ${grew.length} place(s):`);
    for (const { metric, file, was, is } of grew) console.error(`  ${file}  ${metric}: ${was} -> ${is}`);
    console.error(
      '\nCheck the input where the route reads it: zodBody(schema) or zodQuery(schema) from' +
        ' src/middleware/validate.ts, a `.parse(...)` of a zod schema, or `validationResult(req)` after an' +
        ' express-validator chain (a chain nobody reads does nothing). Bound a list size with' +
        ' parsePagination or clampLimit from src/utils/pagination.ts. If the checking is real but happens in' +
        ' a service this walk cannot see, say where with `// validated: <reason>` on the route.' +
        ' `node scripts/check-route-validation.js --list` names every route still counted.'
    );
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { analyseRouteFile, countUnchecked, compare, measure, isTestFile, METRICS };
