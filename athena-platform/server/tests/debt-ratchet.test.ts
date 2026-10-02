/**
 * scripts/check-debt-ratchet.js: what it counts, and when it fails.
 *
 * The script is the only thing between the next `req.user!` and the eleven
 * hundred already there, so what it counts has to be what the audit meant: the
 * syntax, not the text. A comment explaining why `req.user!` is dangerous must
 * not count as one, and a route file that validates with zod must not count as
 * unvalidated just because it has handlers.
 */

type Counts = Record<'req-user-assertions' | 'any-types' | 'unvalidated-route-handlers', number>;
type ByFile = Record<string, Record<string, number>>;
type Change = { metric: string; file: string; was: number; is: number };

// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS script with no type declarations
const ratchet = require('../scripts/check-debt-ratchet') as {
  countDebt: (fileName: string, text: string) => Counts;
  compare: (current: ByFile, baseline: ByFile) => { grew: Change[]; shrank: Change[] };
  isTestFile: (relativePath: string) => boolean;
};

describe('check-debt-ratchet', () => {
  describe('countDebt', () => {
    it('counts req.user! assertions, and nothing that merely mentions one', () => {
      const source = `
        // req.user! is how a missing guard goes unnoticed.
        const note = 'req.user! in a string';
        export function handler(req: AuthRequest) {
          const id = req.user!.id;
          const role = req.user!.role;
          const maybe = req.user?.id;
          const other = request.user!.id;
          return [id, role, maybe, other, note];
        }
      `;
      expect(ratchet.countDebt('src/routes/example.ts', source)['req-user-assertions']).toBe(2);
    });

    it('counts any written as a type, wherever it appears in one', () => {
      const source = `
        const a: any = 1;
        const b = a as any;
        const c: any[] = [];
        const d: Record<string, any> = {};
        const anyone = 'any';
        // any in a comment
      `;
      expect(ratchet.countDebt('src/services/example.ts', source)['any-types']).toBe(4);
    });

    it('counts the handlers of a route file that imports no validator', () => {
      const source = `
        import { Router } from 'express';
        const router = Router();
        router.get('/', list);
        router.post('/:id/payout', pay);
        adminRouter.patch('/:id', update);
        router.use(authenticate);
        cache.get('/a-cache-key-is-not-a-route');
        export default router;
      `;
      expect(ratchet.countDebt('src/routes/payments.routes.ts', source)['unvalidated-route-handlers']).toBe(3);
    });

    it('does not count the handlers of a route file that validates with zod or express-validator', () => {
      const withZod = `
        import { z } from 'zod';
        router.post('/', handler);
      `;
      const withExpressValidator = `
        import { body, validationResult } from 'express-validator';
        router.post('/', body('amount').isFloat({ gt: 0 }), handler);
      `;
      expect(ratchet.countDebt('src/routes/a.routes.ts', withZod)['unvalidated-route-handlers']).toBe(0);
      expect(ratchet.countDebt('src/routes/b.routes.ts', withExpressValidator)['unvalidated-route-handlers']).toBe(0);
    });

    it('counts handlers only in route files', () => {
      const source = `router.get('/', handler);`;
      expect(ratchet.countDebt('src/services/not-a-route.ts', source)['unvalidated-route-handlers']).toBe(0);
    });

    describe('page sizes read with no ceiling', () => {
      const unbounded = (source: string, file = 'src/routes/list.routes.ts') =>
        (ratchet.countDebt(file, source) as unknown as Record<string, number>)['hand-rolled-page-limits'];

      it('counts the reads that took a whole table in one request', () => {
        const source = `
          const a = parseInt(req.query.limit as string) || 20;
          const b = parseInt(req.query.limit as string, 10);
          const c = Number(req.query.limit ?? 50);
          const d = Number.parseInt(String(req.query.limit ?? '50'), 10);
          const e = parseFloat(query.limit);
          const f = parseInt(req.query['limit'] as string);
          const g = parseInt(req.query.pageSize as string);
        `;
        expect(unbounded(source)).toBe(7);
      });

      it('counts a route that destructured its query and parsed the bare name', () => {
        const source = `
          const { q, limit = '20' } = req.query;
          const n = parseInt(limit as string);
        `;
        expect(unbounded(source)).toBe(1);
      });

      it('does not count a read that has a bound around it in the same expression', () => {
        const source = `
          const a = Math.min(parseInt(req.query.limit as string) || 20, 100);
          const b = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 20), 100);
          const c = clampLimit(Number(req.query.limit), 20, 100);
          const d = parseLimit(parseInt(req.query.limit as string), 20, 50);
        `;
        expect(unbounded(source)).toBe(0);
      });

      it('does not count the shared helper, or a limit that is not read from a query', () => {
        const source = `
          const a = clampLimit(req.query.limit, 20, 100);
          const { page, limit } = parsePagination(req.query);
          const total = parseInt(req.body.limit as string);
          const radix = parseInt(req.query.page as string);
        `;
        expect(unbounded(source)).toBe(0);
      });

      it('counts them only in a route file: a service is handed a limit, it does not read a query', () => {
        const source = `const a = parseInt(req.query.limit as string);`;
        expect(unbounded(source, 'src/services/some.service.ts')).toBe(0);
      });

      it('ignores a mention in a comment or a string', () => {
        const source = `
          // parseInt(req.query.limit) || 20 was how it used to be read
          const note = 'parseInt(req.query.limit)';
        `;
        expect(unbounded(source)).toBe(0);
      });
    });
  });

  describe('compare', () => {
    const baseline: ByFile = {
      'req-user-assertions': { 'src/routes/a.routes.ts': 3 },
      'any-types': { 'src/services/b.ts': 2 },
      'unvalidated-route-handlers': {},
    };

    it('fails a file that gained one, and a new file that has any', () => {
      const current: ByFile = {
        'req-user-assertions': { 'src/routes/a.routes.ts': 4 },
        'any-types': { 'src/services/b.ts': 2, 'src/services/new.ts': 1 },
        'unvalidated-route-handlers': {},
      };
      const { grew, shrank } = ratchet.compare(current, baseline);
      expect(grew).toEqual(
        expect.arrayContaining([
          { metric: 'req-user-assertions', file: 'src/routes/a.routes.ts', was: 3, is: 4 },
          { metric: 'any-types', file: 'src/services/new.ts', was: 0, is: 1 },
        ])
      );
      expect(grew).toHaveLength(2);
      expect(shrank).toEqual([]);
    });

    it('reports what went down, including a file that no longer has any, without failing', () => {
      const current: ByFile = {
        'req-user-assertions': { 'src/routes/a.routes.ts': 1 },
        'any-types': {},
        'unvalidated-route-handlers': {},
      };
      const { grew, shrank } = ratchet.compare(current, baseline);
      expect(grew).toEqual([]);
      expect(shrank).toEqual(
        expect.arrayContaining([
          { metric: 'req-user-assertions', file: 'src/routes/a.routes.ts', was: 3, is: 1 },
          { metric: 'any-types', file: 'src/services/b.ts', was: 2, is: 0 },
        ])
      );
    });

    it('does not let debt moved between metrics hide a rise: each metric is compared on its own', () => {
      const current: ByFile = {
        'req-user-assertions': { 'src/routes/a.routes.ts': 2 },
        'any-types': { 'src/services/b.ts': 3 },
        'unvalidated-route-handlers': {},
      };
      const { grew } = ratchet.compare(current, baseline);
      expect(grew).toEqual([{ metric: 'any-types', file: 'src/services/b.ts', was: 2, is: 3 }]);
    });
  });

  it('leaves test files out', () => {
    expect(ratchet.isTestFile('src/routes/__tests__/x.test.ts')).toBe(true);
    expect(ratchet.isTestFile('src/services/y.test.ts')).toBe(true);
    expect(ratchet.isTestFile('src/services/__tests__/helpers.ts')).toBe(true);
    expect(ratchet.isTestFile('src/services/y.ts')).toBe(false);
  });
});
