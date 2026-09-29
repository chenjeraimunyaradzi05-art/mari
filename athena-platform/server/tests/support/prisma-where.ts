/**
 * Evaluates a Prisma `where` clause against plain objects, for the mocked
 * suites.
 *
 * Why this exists. The mocked suites can only say what a handler *asked*
 * Prisma for, and a test that asserts the shape of a `where` clause proves the
 * clause was written, not that it keeps the right rows out. For most routes
 * that is enough. For the ones whose whole job is to keep someone out — a
 * blocked account, a member who asked to be hidden, a private post — it is not:
 * the regression that matters is a clause that is present and wrong, like the
 * search filter whose second `OR` key silently replaced its first and returned
 * every image post on the platform. So these suites hold a small set of rows,
 * run the handler's real clause over them, and assert on who came back.
 *
 * Only the operators the covered handlers use are implemented, and anything
 * else throws rather than matching. A filter this helper does not understand
 * must fail the test that reaches it, never quietly admit or drop a row —
 * which is the same failure this file exists to catch in the code under test.
 *
 * Rows carry their relations inline (`author`, `profile`, `dvSafetyProfile`,
 * `skills`), since that is what a relation filter reads.
 */

export type Row = Record<string, unknown>;

const SCALAR_OPERATORS = new Set([
  'equals',
  'not',
  'in',
  'notIn',
  'contains',
  'startsWith',
  'endsWith',
  'mode',
  'has',
  'hasSome',
  'hasEvery',
  'isEmpty',
  'gt',
  'gte',
  'lt',
  'lte',
]);

const LIST_RELATION_OPERATORS = new Set(['some', 'every', 'none']);
const TO_ONE_RELATION_OPERATORS = new Set(['is', 'isNot']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function comparable(value: unknown, insensitive: boolean): unknown {
  if (value instanceof Date) return value.getTime();
  if (insensitive && typeof value === 'string') return value.toLowerCase();
  return value;
}

function equal(a: unknown, b: unknown, insensitive = false): boolean {
  return comparable(a, insensitive) === comparable(b, insensitive);
}

function asList(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`prisma-where: ${where} expects a list, got ${JSON.stringify(value)}`);
  return value;
}

function scalarMatches(value: unknown, filter: Record<string, unknown>): boolean {
  const insensitive = filter.mode === 'insensitive';
  for (const [op, operand] of Object.entries(filter)) {
    switch (op) {
      case 'mode':
        break;
      case 'equals':
        if (!equal(value, operand, insensitive)) return false;
        break;
      case 'not':
        if (isPlainObject(operand)) {
          if (scalarMatches(value, operand)) return false;
        } else if (equal(value, operand, insensitive)) {
          return false;
        }
        break;
      case 'in':
        if (!asList(operand, 'in').some((candidate) => equal(value, candidate, insensitive))) return false;
        break;
      case 'notIn':
        if (asList(operand, 'notIn').some((candidate) => equal(value, candidate, insensitive))) return false;
        break;
      case 'contains':
      case 'startsWith':
      case 'endsWith': {
        if (typeof value !== 'string' || typeof operand !== 'string') return false;
        const haystack = insensitive ? value.toLowerCase() : value;
        const needle = insensitive ? operand.toLowerCase() : operand;
        const hit =
          op === 'contains' ? haystack.includes(needle) : op === 'startsWith' ? haystack.startsWith(needle) : haystack.endsWith(needle);
        if (!hit) return false;
        break;
      }
      case 'has':
        if (!Array.isArray(value) || !value.some((item) => equal(item, operand))) return false;
        break;
      case 'hasSome':
        if (!Array.isArray(value) || !asList(operand, 'hasSome').some((wanted) => value.some((item) => equal(item, wanted)))) return false;
        break;
      case 'hasEvery':
        if (!Array.isArray(value) || !asList(operand, 'hasEvery').every((wanted) => value.some((item) => equal(item, wanted)))) return false;
        break;
      case 'isEmpty':
        if (!Array.isArray(value) || (value.length === 0) !== operand) return false;
        break;
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte': {
        if (value === null || value === undefined) return false;
        const left = comparable(value, false) as number;
        const right = comparable(operand, false) as number;
        const ok = op === 'gt' ? left > right : op === 'gte' ? left >= right : op === 'lt' ? left < right : left <= right;
        if (!ok) return false;
        break;
      }
      default:
        throw new Error(`prisma-where: scalar operator "${op}" is not implemented`);
    }
  }
  return true;
}

function fieldMatches(row: Row, field: string, condition: unknown): boolean {
  const value = row[field];

  if (condition === undefined) return true;
  if (condition === null) return value === null || value === undefined;
  if (!isPlainObject(condition)) return equal(value, condition);

  const keys = Object.keys(condition);
  if (keys.length > 0 && keys.every((key) => SCALAR_OPERATORS.has(key))) {
    return scalarMatches(value, condition);
  }
  const unknown = keys.find((key) => !SCALAR_OPERATORS.has(key));
  if (keys.some((key) => SCALAR_OPERATORS.has(key)) && unknown) {
    throw new Error(`prisma-where: scalar operator "${unknown}" on "${field}" is not implemented`);
  }

  if (keys.some((key) => TO_ONE_RELATION_OPERATORS.has(key))) {
    for (const [op, operand] of Object.entries(condition)) {
      if (!TO_ONE_RELATION_OPERATORS.has(op)) throw new Error(`prisma-where: "${op}" beside is/isNot`);
      const present = value !== null && value !== undefined;
      const matches = operand === null ? !present : present && matchesWhere(value as Row, operand);
      if (op === 'is' ? !matches : matches) return false;
    }
    return true;
  }

  if (keys.some((key) => LIST_RELATION_OPERATORS.has(key))) {
    const items = Array.isArray(value) ? (value as Row[]) : [];
    for (const [op, operand] of Object.entries(condition)) {
      if (op === 'some' && !items.some((item) => matchesWhere(item, operand))) return false;
      if (op === 'every' && !items.every((item) => matchesWhere(item, operand))) return false;
      if (op === 'none' && items.some((item) => matchesWhere(item, operand))) return false;
      if (!LIST_RELATION_OPERATORS.has(op)) throw new Error(`prisma-where: "${op}" beside some/every/none`);
    }
    return true;
  }

  // A to-one relation filtered without `is`, which Prisma also accepts:
  // `author: { dvSafetyProfile: { ... } }`. A missing relation matches nothing.
  if (value === null || value === undefined) return false;
  if (!isPlainObject(value)) {
    throw new Error(`prisma-where: "${field}" is filtered as a relation but the row holds ${JSON.stringify(value)}`);
  }
  return matchesWhere(value, condition);
}

/** Whether `row` satisfies `where`, with Prisma's semantics for the operators above. */
export function matchesWhere(row: Row, where: unknown): boolean {
  if (where === undefined || where === null) return true;
  if (!isPlainObject(where)) throw new Error(`prisma-where: a where clause must be an object, got ${JSON.stringify(where)}`);

  for (const [key, condition] of Object.entries(where)) {
    if (condition === undefined) continue;
    if (key === 'AND') {
      const parts = Array.isArray(condition) ? condition : [condition];
      if (!parts.every((part) => matchesWhere(row, part))) return false;
    } else if (key === 'OR') {
      // Prisma reads an empty OR as matching nothing, not everything.
      if (!asList(condition, 'OR').some((part) => matchesWhere(row, part))) return false;
    } else if (key === 'NOT') {
      const parts = Array.isArray(condition) ? condition : [condition];
      if (parts.some((part) => matchesWhere(row, part))) return false;
    } else if (!fieldMatches(row, key, condition)) {
      return false;
    }
  }
  return true;
}

/**
 * A stand-in for one Prisma model over a fixed set of rows: findMany applies
 * `where` and `take`, findUnique and findFirst return the first match. Order,
 * `select` and `include` are ignored — the rows already carry every field and
 * relation the covered handlers read.
 */
export function modelOver(rows: () => Row[]) {
  const matching = (args?: { where?: unknown }) => rows().filter((row) => matchesWhere(row, args?.where));
  return {
    findMany: async (args?: { where?: unknown; take?: number }) => {
      const found = matching(args);
      return typeof args?.take === 'number' ? found.slice(0, args.take) : found;
    },
    findUnique: async (args: { where: unknown }) => matching(args)[0] ?? null,
    findFirst: async (args?: { where?: unknown }) => matching(args)[0] ?? null,
    count: async (args?: { where?: unknown }) => matching(args).length,
  };
}
