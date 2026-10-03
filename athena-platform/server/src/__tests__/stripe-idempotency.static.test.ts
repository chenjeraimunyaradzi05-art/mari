/**
 * Every outbound Stripe call that makes a money object carries an idempotency key.
 *
 * A create sent to Stripe twice — a double tap, a retry after a timeout, two
 * tabs — makes two objects unless both requests carry the same key, and for a
 * payout, a transfer or a refund two objects is money moved twice. The keys the
 * code carries are listed nowhere, so a new call could be added without one and
 * nothing would say so until a member paid twice. This reads every non-test
 * source file under src, finds each create on a money resource (and each call
 * to createEscrowPayment, which wraps one), and fails on any whose arguments
 * carry no `idempotencyKey`.
 *
 * Captures and cancels are not keyed, on purpose. Stripe keeps the first answer
 * it gave under a key for a day, errors included, so a capture that failed once
 * for a passing reason would be replayed as that failure for a day after the
 * cause was fixed. Those calls read the object's state back from Stripe first,
 * and Stripe itself refuses a second capture of a captured intent, which is the
 * protection a key cannot safely add. Updates, retrieves and lists make no money
 * object. Each of these is outside the scan rather than allow-listed, so the
 * list below holds only what is keyless by design.
 */

import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');

/** The resources on which `.create` makes something that moves, or can move, money. */
const MONEY_RESOURCES = ['paymentIntents', 'checkout.sessions', 'customers', 'accounts', 'transfers', 'payouts', 'refunds', 'subscriptions'];

/**
 * The two creates allowed no key: each is the branch a wrapper takes for a
 * caller that passed none, and the second test below is what makes sure every
 * caller in src passes one. Named by the line's text so a move within the file
 * does not loosen the check.
 */
const KEYLESS_BY_DESIGN: Array<{ file: string; line: string }> = [
  { file: 'services/stripe-connect.service.ts', line: ': await getStripe().paymentIntents.create(intentParams);' },
  { file: 'services/payments-orchestration.service.ts', line: ': await getStripe().paymentIntents.create(intentParams);' },
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

function skipString(source: string, from: number, quote: string): number {
  let i = from + 1;
  while (i < source.length && source[i] !== quote) {
    if (source[i] === '\\') i += 1;
    i += 1;
  }
  return i + 1;
}

/** Past a template literal, including the code inside its `${}` holes. */
function skipTemplate(source: string, from: number): number {
  let i = from + 1;
  while (i < source.length) {
    if (source[i] === '\\') { i += 2; continue; }
    if (source[i] === '`') return i + 1;
    if (source[i] === '$' && source[i + 1] === '{') {
      let depth = 1;
      i += 2;
      while (i < source.length && depth > 0) {
        if (source[i] === '`') { i = skipTemplate(source, i); continue; }
        if (source[i] === "'" || source[i] === '"') { i = skipString(source, i, source[i]); continue; }
        if (source[i] === '{') depth += 1;
        if (source[i] === '}') depth -= 1;
        i += 1;
      }
      continue;
    }
    i += 1;
  }
  return i;
}

/**
 * The text between the parenthesis at `open` and the one that closes it,
 * stepping over strings, template literals and comments so a bracket inside a
 * message does not end the scan early.
 */
function argumentsOf(source: string, open: number): string {
  let depth = 0;
  let i = open;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') { i = source.indexOf('\n', i); if (i < 0) break; continue; }
    if (ch === '/' && next === '*') { i = source.indexOf('*/', i + 2); if (i < 0) break; i += 2; continue; }
    if (ch === "'" || ch === '"') { i = skipString(source, i, ch); continue; }
    if (ch === '`') { i = skipTemplate(source, i); continue; }
    if (ch === '(') depth += 1;
    if (ch === ')') { depth -= 1; if (depth === 0) return source.slice(open + 1, i); }
    i += 1;
  }
  throw new Error(`Unbalanced call at offset ${open}`);
}

type Call = { file: string; line: number; text: string; args: string };

/** Every call in `source` that `pattern` finds, with its arguments. The pattern must end on the opening parenthesis. */
function callsIn(file: string, source: string, pattern: RegExp): Call[] {
  const calls: Call[] = [];
  const lines = source.split('\n');
  for (const match of source.matchAll(pattern)) {
    const at = match.index!;
    const line = source.slice(0, at).split('\n').length;
    calls.push({ file, line, text: lines[line - 1].trim(), args: argumentsOf(source, at + match[0].length - 1) });
  }
  return calls;
}

const resourcePattern = MONEY_RESOURCES.map((r) => r.replace('.', String.raw`\s*\.\s*`)).join('|');
// The shared client asked for at each use, or a local `stripe` it was assigned to.
const MONEY_CREATE = new RegExp(String.raw`\b(?:getStripe\(\)|stripe)\s*\.\s*(?:${resourcePattern})\s*\.\s*create\s*\(`, 'g');
// A hold made through the wrapper, however it is imported; not the wrapper's own definition.
const HOLD_CREATE = /(?<!function )(?<![\w.])(?:stripeConnectService\s*\.\s*)?createEscrowPayment\s*\(/g;

const keyless = (calls: Call[]) => calls.filter((c) => !/\bidempotencyKey\b/.test(c.args));
const describeCall = (c: Call) => `${c.file}:${c.line} ${c.text}`;

describe('Stripe idempotency keys', () => {
  const files = sourceFiles(SRC);
  const rel = (file: string) => path.relative(SRC, file).split(path.sep).join('/');
  const scan = (pattern: RegExp): Call[] => files.flatMap((file) => callsIn(rel(file), fs.readFileSync(file, 'utf8'), pattern));

  it('every create on a money resource carries a key, except the keyless branches listed by design', () => {
    const calls = scan(MONEY_CREATE);
    // A pattern that matched nothing would pass a scan of nothing.
    expect(calls.length).toBeGreaterThanOrEqual(12);

    const allowed = (c: Call) => KEYLESS_BY_DESIGN.some((k) => k.file === c.file && c.text.includes(k.line));
    expect(keyless(calls).filter((c) => !allowed(c)).map(describeCall)).toEqual([]);

    // And each allowance is still needed, so the list cannot outlive its reason.
    for (const k of KEYLESS_BY_DESIGN) {
      expect(keyless(calls).some((c) => c.file === k.file && c.text.includes(k.line))).toBe(true);
    }
  });

  it('every hold made through createEscrowPayment carries one too', () => {
    const calls = scan(HOLD_CREATE);
    expect(calls.length).toBeGreaterThanOrEqual(9);
    expect(keyless(calls).map(describeCall)).toEqual([]);
  });
});
