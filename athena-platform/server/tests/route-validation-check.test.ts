/**
 * scripts/check-route-validation.js: what it counts, and when it fails.
 *
 * The script is what stands between the next route that hands `req.body` to a
 * service and the audit's finding that validation was a habit and not a rule.
 * What it has to get right is the three ways a route used to claim to validate
 * and not: no check at all, a hand-written ladder it cannot see, and an
 * express-validator chain declared in the argument list and never read. So the
 * cases below are those, each next to the shape that really does check.
 */

import fs from 'fs';
import path from 'path';

type Route = {
  verb: string;
  path: string;
  mutating: boolean;
  readsInput: boolean;
  validated: boolean;
  readsSize: boolean;
  clamped: boolean;
  marked: boolean;
};
type Counts = Record<'unvalidated-input-routes' | 'unclamped-list-routes', number>;
type ByFile = Record<string, Record<string, number>>;

// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS script with no type declarations
const check = require('../scripts/check-route-validation') as {
  analyseRouteFile: (fileName: string, text: string) => Route[];
  countUnchecked: (fileName: string, text: string) => Counts;
  compare: (current: ByFile, baseline: ByFile) => { grew: Array<{ metric: string; file: string; was: number; is: number }>; shrank: unknown[] };
  measure: () => ByFile;
};

const FILE = 'src/routes/example.routes.ts';
const unvalidated = (source: string) => check.countUnchecked(FILE, source)['unvalidated-input-routes'];
const unclamped = (source: string) => check.countUnchecked(FILE, source)['unclamped-list-routes'];

describe('check-route-validation: a mutating route that reads input', () => {
  it('is counted when it checks nothing', () => {
    const source = `
      router.post('/', authenticate, async (req, res) => {
        await service.create(req.user.id, req.body);
        res.json({ ok: true });
      });
    `;
    expect(unvalidated(source)).toBe(1);
  });

  it('is counted for each of POST, PUT, PATCH and DELETE, and for a body read through a cast', () => {
    const source = `
      router.post('/a', h1);  router.put('/b', async (req) => use(req.body));
      router.patch('/c', async (req) => use((req as AuthRequest).body));
      router.delete('/d', async (req) => use(req.query.reason));
      async function h1(req, res) { use(req.body); }
    `;
    expect(unvalidated(source)).toBe(4);
  });

  it('is not counted when it reads no body or query', () => {
    const source = `
      router.post('/:id/archive', authenticate, async (req, res) => {
        await service.archive(req.params.id, req.user.id);
      });
    `;
    expect(unvalidated(source)).toBe(0);
  });

  it('is not counted for a GET that reads filters, which is the other metric', () => {
    expect(unvalidated(`router.get('/', async (req, res) => res.json(await find(req.query.status)));`)).toBe(0);
  });

  describe('what counts as checking it', () => {
    it.each([
      ['zodBody in front of the handler', `router.post('/', authenticate, zodBody(schema), async (req) => use(req.body));`],
      ['zodQuery', `router.delete('/', zodQuery(schema), async (req) => use(req.query.x));`],
      ['parseWith in the handler', `router.post('/', async (req) => { const data = parseWith(schema, req.body); use(data); });`],
      ['a zod schema parsed in the handler', `router.post('/', async (req) => { const data = schema.parse(req.body); use(data); });`],
      ['safeParse', `router.post('/', async (req) => { const r = schema.safeParse(req.body); use(r); });`],
      ['parseStrict', `router.patch('/', async (req) => use(parseStrict(profileSchema, req.body)));`],
      ['validationResult read after an express-validator chain', `
        router.post('/', [body('x').isInt()], async (req) => {
          const errors = validationResult(req);
          use(req.body, errors);
        });`],
      ['a function this file defines that parses', `
        function parse(schema, value) { return schema.parse(value); }
        router.post('/', async (req) => use(parse(schema, req.body)));`],
      ['a helper that calls a helper that parses', `
        const inner = (v) => schema.parse(v);
        const outer = (v) => inner(v);
        router.post('/', async (req) => use(outer(req.body)));`],
      ['a handler that is a named function', `
        async function create(req, res) { const d = parseWith(schema, req.body); use(d); }
        router.post('/', authenticate, create);`],
    ])('%s', (_label, source) => {
      expect(unvalidated(source)).toBe(0);
    });

    it('a note on the route saying where the checking is', () => {
      const source = `
        // validated: tier is checked against VALID_TIERS before anything is read.
        router.post('/checkout', authenticate, async (req) => use(req.body.tier));
      `;
      expect(unvalidated(source)).toBe(0);
    });

    it('but a note with no reason is not a note', () => {
      expect(unvalidated(`// validated:\nrouter.post('/', async (req) => use(req.body));`)).toBe(1);
      expect(unvalidated(`// validate this later\nrouter.post('/', async (req) => use(req.body));`)).toBe(1);
    });
  });

  describe('what does not count', () => {
    it('an express-validator chain nobody reads', () => {
      // The defect this exists for: declared in the argument list, never turned into a 400.
      const source = `
        router.post('/', authenticate, [body('amount').isFloat({ min: 5 })], async (req, res) => {
          await charge(req.body.amount);
        });
      `;
      expect(unvalidated(source)).toBe(1);
    });

    it('JSON.parse, which reads text and checks nothing about it', () => {
      expect(unvalidated(`router.post('/', async (req) => use(JSON.parse(req.body.raw)));`)).toBe(1);
    });

    it('Date.parse, path.parse and URL.parse, which read text and check nothing about its shape', () => {
      expect(unvalidated(`router.post('/', async (req) => use(Date.parse(req.body.when)));`)).toBe(1);
      expect(unvalidated(`router.post('/', async (req) => use(path.parse(req.body.name)));`)).toBe(1);
      expect(unvalidated(`router.post('/', async (req) => use(URL.parse(req.body.link)));`)).toBe(1);
    });

    it('a comment or a string that mentions validation', () => {
      const source = `
        router.post('/', async (req) => {
          // validate(req.body) happens in the service, honest
          const note = 'schema.parse(req.body)';
          use(req.body, note);
        });
      `;
      expect(unvalidated(source)).toBe(1);
    });

    it('a middleware that reads the query to scope the request, when the handler checks nothing it reads', () => {
      // requireOrgAccess reading req.query is not the route reading its input.
      const source = `
        const requireOrgAccess = (req, res, next) => { use(req.query.orgId); next(); };
        router.delete('/team/:id', authenticate, requireOrgAccess, async (req, res) => { await remove(req.params.id); });
      `;
      expect(unvalidated(source)).toBe(0);
    });

    it('a call to a function this file does not define, however it is named', () => {
      expect(unvalidated(`router.post('/', async (req) => use(validateEverything(req.body)));`)).toBe(1);
    });

    it('anything that is not a router', () => {
      expect(unvalidated(`cache.post('/', (req) => use(req.body)); client.get('/x', (req) => use(req.body));`)).toBe(0);
    });
  });

  it('reports each route with its verb and path', () => {
    const routes = check.analyseRouteFile(
      FILE,
      `router.post('/a/:id', async (req) => use(req.body)); router.get('/b', async () => 1);`
    );
    expect(routes.map((r) => `${r.verb} ${r.path}`)).toEqual(['post /a/:id', 'get /b']);
    expect(routes[0]).toMatchObject({ mutating: true, readsInput: true, validated: false });
    expect(routes[1]).toMatchObject({ mutating: false, readsInput: false });
  });
});

describe('check-route-validation: a list size read from the query', () => {
  it('is counted when nothing bounds it', () => {
    const source = `
      router.get('/', async (req, res) => {
        const limit = parseInt(req.query.limit as string) || 20;
        res.json(await find({ take: limit }));
      });
    `;
    expect(unclamped(source)).toBe(1);
  });

  it('is counted when it is destructured from the query, and for the other names a page size goes by', () => {
    const source = `
      router.get('/a', async (req) => { const { limit = '20' } = req.query; use(limit); });
      router.get('/b', async (req) => use(req.query.pageSize));
      router.get('/c', async (req) => use(req.query['perPage']));
      router.get('/d', async (req) => use(req.query.take));
    `;
    expect(unclamped(source)).toBe(4);
  });

  it.each([
    ['clampLimit', `router.get('/', async (req) => use(clampLimit(req.query.limit, 20, 50)));`],
    ['parsePagination', `router.get('/', async (req) => { const { limit } = parsePagination(req.query); use(limit); });`],
    ['a local parseLimit', `router.get('/', async (req) => use(parseLimit(req.query.limit, 20, 50)));`],
    ['parseBoundedInteger', `router.get('/', async (req) => use(parseBoundedInteger(req.query.limit, 'limit', 50, 1, 100)));`],
    ['a Math.min and a Math.max around it', `router.get('/', async (req) => use(Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50)));`],
    ['zodQuery in front of the handler', `router.get('/', zodQuery(schema), async (req) => use(req.query.limit));`],
    ['a schema parse of the query', `router.get('/', async (req) => use(schema.parse(req.query).limit));`],
    ['a note on the route', `// validated: the service clamps it to 100.\nrouter.get('/', async (req) => use(req.query.limit));`],
  ])('is not counted with %s', (_label, source) => {
    expect(unclamped(source)).toBe(0);
  });

  it('does not take a Math.min alone for a clamp: a negative limit gets past it, and Prisma reads a negative take from the end', () => {
    expect(unclamped(`router.get('/', async (req) => use(Math.min(parseInt(req.query.limit) || 20, 100)));`)).toBe(1);
  });

  it('does not take parseInt for a clamp: it is what the audit found at a dozen routes', () => {
    expect(unclamped(`router.get('/', async (req) => use(parseInt(req.query.limit) || 20));`)).toBe(1);
  });

  it('does not count a route that reads no size', () => {
    expect(unclamped(`router.get('/', async (req) => use(req.query.status, req.query.q));`)).toBe(0);
  });
});

describe('check-route-validation: the ratchet', () => {
  it('names a file whose count rose, and a new file with any', () => {
    const baseline: ByFile = { 'unvalidated-input-routes': { 'src/routes/a.routes.ts': 2 }, 'unclamped-list-routes': {} };
    const current: ByFile = {
      'unvalidated-input-routes': { 'src/routes/a.routes.ts': 3, 'src/routes/b.routes.ts': 1 },
      'unclamped-list-routes': {},
    };

    const { grew } = check.compare(current, baseline);

    expect(grew).toEqual([
      { metric: 'unvalidated-input-routes', file: 'src/routes/a.routes.ts', was: 2, is: 3 },
      { metric: 'unvalidated-input-routes', file: 'src/routes/b.routes.ts', was: 0, is: 1 },
    ]);
  });

  it('reports ground gained without failing', () => {
    const baseline: ByFile = { 'unvalidated-input-routes': { 'src/routes/a.routes.ts': 2 }, 'unclamped-list-routes': {} };
    const current: ByFile = { 'unvalidated-input-routes': { 'src/routes/a.routes.ts': 1 }, 'unclamped-list-routes': {} };

    const { grew, shrank } = check.compare(current, baseline);

    expect(grew).toEqual([]);
    expect(shrank).toHaveLength(1);
  });

  it('holds for the routes in the tree today: nothing has been added that reads input and checks none of it', () => {
    const baselinePath = path.join(__dirname, '..', 'scripts', 'route-validation-baseline.json');
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as ByFile;

    const { grew } = check.compare(check.measure(), baseline);

    expect(grew).toEqual([]);
  });
});
