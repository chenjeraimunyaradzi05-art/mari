#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Fails when a route can be reached without `authenticate` and is not named,
 * with its reason, in src/config/public-routes.ts.
 *
 * Why this exists. `authenticate` is applied route by route (index.ts mounts
 * the routers bare), so no single place says which routes are open. The audit
 * read 1,185 handlers by hand to find out, and found the open ones were all
 * catalogues, calculators, sign-in steps, webhooks and probes. Nothing would
 * have noticed the 1,186th being registered without a guard.
 *
 * This is the fast half and needs no database or running app: it reads the
 * syntax tree, as check-api-contract.js reads the source text. It joins each
 * `app.use('/api/x', yRoutes)` in index.ts to the `router.<verb>(...)` calls in
 * that router's file, and counts a route as guarded when `authenticate` is
 * among the middleware in front of its handler, or in a `router.use(...)`
 * registered earlier in the same file (an array such as `adminOnly`, declared
 * in the file with `authenticate` in it, counts too). The other half,
 * src/__tests__/route-auth-coverage.test.ts, runs the real app and sends every
 * route that is not on the public list an anonymous request, so a guard this
 * walk cannot see (a custom middleware that refuses anonymous callers) is still
 * proved there. Where the two disagree, the test is right.
 *
 * Three failures, reported separately:
 *
 *   OPEN       A route with no authenticate that is not on the public list.
 *              Guard it, or, if it is meant to be open, add it to
 *              PUBLIC_ROUTES with the reason.
 *   STALE      A public-list entry that names a route no router registers.
 *   GUARDED    A public-list entry that names a route which does carry
 *              authenticate, so the list would describe it as open after it
 *              was closed.
 *
 * Usage:
 *   node scripts/check-route-auth.js          # exits 1 on any finding
 *   node scripts/check-route-auth.js --list   # print every route and its state
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SERVER_SRC = path.resolve(__dirname, '..', 'src');
const VERBS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const GUARD = 'authenticate';

function fail(message) {
  console.error(`\n  check-route-auth: ${message}\n`);
  process.exit(2);
}

function parse(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

const literalText = (node) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;

/** True when `authenticate` appears in this argument, not counting inside a function body. */
function mentionsGuard(node, localArrays) {
  if (ts.isIdentifier(node)) return node.text === GUARD || Boolean(localArrays.get(node.text));
  if (ts.isFunctionLike(node)) return false;
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && mentionsGuard(child, localArrays)) found = true;
  });
  return found;
}

/** Top-level `const x = [... authenticate ...]` in this file: x guards what it is spread into. */
function localGuardArrays(sourceFile) {
  const arrays = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer && ts.isArrayLiteralExpression(declaration.initializer)) {
        const guarded = declaration.initializer.elements.some(
          (element) => ts.isIdentifier(element) && element.text === GUARD
        );
        if (guarded) arrays.set(declaration.name.text, true);
      }
    }
  }
  return arrays;
}

/**
 * Every `<target>.<verb>('/path', ...middleware, handler)` in one file, in
 * registration order, with whether authenticate stands in front of it.
 * `target` is the Router variable (`router`) or, in index.ts, `app`.
 */
function routesIn(sourceFile, target) {
  const localArrays = localGuardArrays(sourceFile);
  const found = [];
  let guardedFromHere = false;

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === target
    ) {
      const name = node.expression.name.text;
      const args = node.arguments;
      if (name === 'use') {
        // router.use(authenticate) guards everything registered after it.
        // A path-scoped router.use('/x', authenticate) guards only /x, so it is not counted.
        if (args.length > 0 && !literalText(args[0]) && args.some((arg) => mentionsGuard(arg, localArrays))) {
          guardedFromHere = true;
        }
      } else if (VERBS.has(name)) {
        const routePath = literalText(args[0]);
        if (routePath !== null && routePath.startsWith('/')) {
          // The last argument is the handler; everything between is middleware.
          const middleware = Array.from(args).slice(1, -1);
          const guarded = guardedFromHere || middleware.some((arg) => mentionsGuard(arg, localArrays));
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          found.push({ method: name.toUpperCase(), path: routePath, guarded, line: line + 1 });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function readMounts(indexFile) {
  const sourceFile = parse(indexFile);
  const imports = new Map();
  const mounts = [];
  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith('./routes/') &&
      statement.importClause?.name
    ) {
      imports.set(statement.importClause.name.text, statement.moduleSpecifier.text.slice('./routes/'.length));
    }
  }
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'app' &&
      node.expression.name.text === 'use' &&
      node.arguments.length === 2 &&
      literalText(node.arguments[0]) !== null &&
      ts.isIdentifier(node.arguments[1]) &&
      imports.has(node.arguments[1].text)
    ) {
      mounts.push({ prefix: literalText(node.arguments[0]).replace(/\/$/, ''), file: imports.get(node.arguments[1].text) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { mounts, sourceFile };
}

/** The public list, read from the TypeScript source so the script and the test share one file. */
function readPublicRoutes() {
  const file = path.join(SERVER_SRC, 'config', 'public-routes.ts');
  if (!fs.existsSync(file)) fail(`cannot find ${file}`);
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const module = { exports: {} };
  new Function('module', 'exports', outputText)(module, module.exports);
  const routes = module.exports.PUBLIC_ROUTES;
  if (!Array.isArray(routes) || routes.length === 0) fail('src/config/public-routes.ts exports no PUBLIC_ROUTES');
  return routes;
}

const join = (prefix, routePath) => (prefix + (routePath === '/' ? '' : routePath)).replace(/\/+$/, '') || '/';

function collectRoutes() {
  const indexFile = path.join(SERVER_SRC, 'index.ts');
  if (!fs.existsSync(indexFile)) fail(`cannot find ${indexFile}`);

  const { mounts, sourceFile: indexSource } = readMounts(indexFile);
  if (mounts.length === 0) fail('parsed zero route mounts from index.ts: the parser is stale');

  const routes = [];
  // Routes registered on the app itself: probes, the crash-report beacon, the
  // maintenance state.
  for (const route of routesIn(indexSource, 'app')) {
    routes.push({ ...route, full: join('', route.path), source: 'index.ts' });
  }
  for (const { prefix, file } of mounts) {
    const routeFile = path.join(SERVER_SRC, 'routes', `${file}.ts`);
    if (!fs.existsSync(routeFile)) continue;
    for (const route of routesIn(parse(routeFile), 'router')) {
      routes.push({ ...route, full: join(prefix, route.path), source: `routes/${file}.ts` });
    }
  }
  return routes;
}

function main() {
  const routes = collectRoutes();
  if (routes.length < 500) fail(`parsed only ${routes.length} routes: the parser is stale`);

  const publicRoutes = readPublicRoutes();
  const keyOf = (method, p) => `${method} ${p}`;
  const publicKeys = new Set(publicRoutes.map((entry) => keyOf(entry.method, entry.path)));
  const known = new Map();
  for (const route of routes) {
    const key = keyOf(route.method, route.full);
    // A route registered twice (two routers on one prefix) is guarded only if every copy is.
    known.set(key, known.has(key) ? known.get(key) && route.guarded : route.guarded);
  }

  if (process.argv.includes('--list')) {
    for (const route of routes) {
      const state = route.guarded ? 'guarded' : publicKeys.has(keyOf(route.method, route.full)) ? 'public ' : 'OPEN   ';
      console.log(`${state}  ${route.method.padEnd(6)} ${route.full}  (${route.source}:${route.line})`);
    }
    return;
  }

  const open = [];
  const seen = new Set();
  for (const route of routes) {
    const key = keyOf(route.method, route.full);
    if (route.guarded || publicKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    open.push(`${key}  (${route.source}:${route.line})`);
  }
  const stale = [...publicKeys].filter((key) => !known.has(key));
  const guarded = [...publicKeys].filter((key) => known.get(key) === true);

  console.log(
    `${routes.length} routes read: ${known.size} distinct, ${publicKeys.size} on the public list, ${open.length} open and unlisted.`
  );

  if (open.length === 0 && stale.length === 0 && guarded.length === 0) return;

  if (open.length > 0) {
    console.error(`\nOPEN  ${open.length} route(s) an anonymous caller can reach, not on the public list:`);
    for (const line of open) console.error(`  ${line}`);
    console.error(
      '  Put authenticate in front of the handler. If the route is meant to be open, add it to PUBLIC_ROUTES in' +
        ' src/config/public-routes.ts with the reason.'
    );
  }
  if (stale.length > 0) {
    console.error(`\nSTALE  ${stale.length} public-list entr(ies) no router registers:`);
    for (const key of stale) console.error(`  ${key}`);
    console.error('  Remove them from src/config/public-routes.ts.');
  }
  if (guarded.length > 0) {
    console.error(`\nGUARDED  ${guarded.length} public-list entr(ies) that now carry authenticate:`);
    for (const key of guarded) console.error(`  ${key}`);
    console.error('  Remove them from src/config/public-routes.ts: the list must not call a closed route open.');
  }
  process.exit(1);
}

if (require.main === module) main();

module.exports = { routesIn, readMounts, collectRoutes, join };
