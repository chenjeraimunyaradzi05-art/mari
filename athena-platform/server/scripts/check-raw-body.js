#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Fails when a request body reaches the database, or an object a database call
 * is built from, as it arrived.
 *
 * Why this exists. `PATCH /api/users/me/profile` passed `req.body` to
 * `prisma.profile.upsert` as both `update` and `create`. Prisma reads more
 * into an object than its column list: a nested write on the `user` relation,
 * `{ "user": { "update": { "role": "SUPER_ADMIN" } } }`, rewrote the caller's
 * own account row, so any signed-in member could become an administrator
 * and switch off the two-factor check that guards administrators. The two
 * handlers beside it, `POST /me/experience` and `/me/education`, spread the
 * body after the owner, so a body `userId` planted an entry on someone else's
 * public profile. Nothing in CI would have noticed a fourth.
 *
 * What is refused, in src/routes and src/services (tests are not scanned):
 *
 *   update: req.body          create: req.body          data: req.body
 *   { ...req.body }           Object.assign(x, req.body)
 *   const { ...rest } = req.body
 *
 * (`req.body` is also matched as `request.body`, and `req.body.x` is fine: a
 * single named field is a value, not an object a database call can be handed.)
 * The fix is never to silence the check: read the body through a zod schema
 * that ends in `.strict()` (utils/request-schema parseStrict) or pick named
 * fields, then build the write from the result with the owner set last.
 *
 * It reads the TypeScript syntax tree, as check-debt-ratchet.js does, so a
 * comment or string that mentions `req.body` is not a hit. There is no
 * baseline: the count is zero and must stay zero.
 *
 * Usage:
 *   node scripts/check-raw-body.js
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const SERVER_ROOT = path.resolve(__dirname, '..');
const SCANNED = ['src/routes', 'src/services'].map((dir) => path.join(SERVER_ROOT, dir));

// The names a handler gives its request. `AuthRequest` handlers are named req
// everywhere in this codebase; the other two are what a helper might call it.
const REQUEST_NAMES = new Set(['req', 'request', '_req']);
const DATABASE_KEYS = new Set(['data', 'update', 'create']);

function isTestFile(relativePath) {
  return relativePath.split('/').includes('__tests__') || /\.test\.ts$/.test(relativePath);
}

function sourceFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.ts$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** True for `req.body` itself, not for `req.body.field` or `req.body['field']`. */
function isRawBody(node) {
  return (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === 'body' &&
    ts.isIdentifier(node.expression) &&
    REQUEST_NAMES.has(node.expression.text)
  );
}

/** Every raw use of the request body in one file's source, as { line, kind }. */
function findRawBodyUses(fileName, text) {
  const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const hits = [];
  const note = (node, kind) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    hits.push({ line: line + 1, kind });
  };

  const visit = (node) => {
    // `{ ...req.body }`
    if (ts.isSpreadAssignment(node) && isRawBody(node.expression)) {
      note(node, 'spread of req.body into an object');
    }
    // `data: req.body`, `update: req.body`, `create: req.body`
    else if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      DATABASE_KEYS.has(node.name.text) &&
      isRawBody(node.initializer)
    ) {
      note(node, `${node.name.text}: req.body`);
    }
    // `Object.assign(target, req.body)`
    else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Object' &&
      node.expression.name.text === 'assign' &&
      node.arguments.slice(1).some(isRawBody)
    ) {
      note(node, 'Object.assign with req.body');
    }
    // `const { ...rest } = req.body`
    else if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      isRawBody(node.initializer) &&
      ts.isObjectBindingPattern(node.name) &&
      node.name.elements.some((element) => element.dotDotDotToken)
    ) {
      note(node, 'rest destructuring of req.body');
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return hits;
}

function main() {
  const failures = [];
  for (const root of SCANNED) {
    for (const file of sourceFiles(root)) {
      const relative = path.relative(SERVER_ROOT, file).split(path.sep).join('/');
      if (isTestFile(relative)) continue;
      for (const hit of findRawBodyUses(file, fs.readFileSync(file, 'utf8'))) {
        failures.push(`${relative}:${hit.line}  ${hit.kind}`);
      }
    }
  }

  if (failures.length === 0) {
    console.log('No request body reaches a database call unparsed.');
    return;
  }

  console.error(`${failures.length} place(s) hand the request body on as it arrived:`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    '\nParse the body with a zod schema that ends in .strict() (parseStrict in utils/request-schema.ts)' +
      ' or pick the fields by name, then build the write from the result with the owner set last.' +
      ' Prisma reads a nested object as a write on a relation, so an unparsed body can reach columns' +
      ' that are not on the form (a role, a verification status, another member’s id).'
  );
  process.exit(1);
}

if (require.main === module) main();

module.exports = { findRawBodyUses, isTestFile };
