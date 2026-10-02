import express, { Request, Response } from 'express';
import request from 'supertest';
import { z } from 'zod';

jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { errorHandler } from '../errorHandler';
import { describeZodError, parseWith, zodBody, zodParams, zodQuery } from '../validate';
import {
  audMoney,
  audMoneyOrZero,
  auState,
  email,
  idParams,
  isoDay,
  limitQuery,
  numeric,
  optionalText,
  paginationQuery,
  positiveInt,
  queryFlag,
  text,
  uuid,
} from '../../utils/schemas';

/**
 * The one validation layer: what a request must look like before a handler
 * runs, and what the handler is then handed.
 */

const ID = '3f2b1c0e-8a4d-4c55-9e0b-6a1d2c3b4a5f';

function build() {
  const app = express();
  app.use(express.json());

  const gift = z.object({ receiverId: z.string().uuid(), amount: audMoney(1000), message: z.string().trim().max(10).optional() }).strict();
  app.post('/gifts', zodBody(gift), (req: Request, res: Response) => res.json({ got: req.body }));

  const loose = z.object({ name: z.string().trim().min(1) });
  app.post('/loose', zodBody(loose), (req: Request, res: Response) => res.json({ got: req.body }));

  app.get(
    '/list',
    zodQuery(paginationQuery(20, 100).extend({ sortBy: z.enum(['new', 'old']).optional(), active: queryFlag.optional() })),
    (req: Request, res: Response) => res.json({ query: req.query })
  );
  app.get('/items/:id', zodParams(idParams), (req: Request, res: Response) => res.json({ id: req.params.id }));
  app.use(errorHandler);
  return app;
}

describe('zodBody', () => {
  const app = build();

  it('lets a valid body through, as the schema produced it', async () => {
    const res = await request(app).post('/gifts').send({ receiverId: ID, amount: '12.50', message: '  hi  ' });

    expect(res.status).toBe(200);
    expect(res.body.got).toEqual({ receiverId: ID, amount: 12.5, message: 'hi' });
  });

  it('answers 400 naming the field that is wrong', async () => {
    const res = await request(app).post('/gifts').send({ receiverId: 'not-an-id', amount: 5 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/^receiverId: /);
  });

  it('refuses a key the schema does not take, and names it, when the schema is strict', async () => {
    const res = await request(app).post('/gifts').send({ receiverId: ID, amount: 5, role: 'ADMIN' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Unknown field: role');
  });

  it('names every overposted key', async () => {
    const res = await request(app).post('/gifts').send({ receiverId: ID, amount: 5, role: 'ADMIN', isAdmin: true });

    expect(res.body.message).toBe('Unknown fields: role, isAdmin');
  });

  it('drops a key the schema does not take when it is not strict, so the handler never sees it', async () => {
    const res = await request(app).post('/loose').send({ name: ' Ada ', role: 'ADMIN' });

    expect(res.status).toBe(200);
    expect(res.body.got).toEqual({ name: 'Ada' });
  });

  it('reads a request with no body as an empty object and names the first thing missing', async () => {
    const res = await request(app).post('/gifts');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/^receiverId: /);
  });

  it.each([
    ['a boolean', true],
    ['null', null],
    ['an empty string', ''],
    ['an array', []],
    ['text', 'five'],
    ['zero', 0],
    ['a negative', -5],
    ['a fraction of a cent', 1.005],
    ['more than the ceiling', 1001],
  ])('does not take %s for an amount of money', async (_label, amount) => {
    const res = await request(app).post('/gifts').send({ receiverId: ID, amount });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/^amount: /);
  });

  it('answers a malformed body with 400, not a 500', async () => {
    const res = await request(app).post('/gifts').set('Content-Type', 'application/json').send('{"amount":');

    expect(res.status).toBe(400);
  });
});

describe('zodQuery', () => {
  const app = build();

  it('clamps a page size to the ceiling instead of passing a million to the database', async () => {
    const res = await request(app).get('/list?limit=1000000&page=2');

    expect(res.body.query).toMatchObject({ limit: 100, page: 2 });
  });

  it.each([['abc'], [''], ['0'], ['1.5x']])('falls back to the default for limit=%s', async (value) => {
    const res = await request(app).get(`/list?limit=${value}`);

    expect(res.status).toBe(200);
    expect(res.body.query.limit).toBe(value === '1.5x' ? 1 : 20);
  });

  it('never lets a negative page size through (Prisma reads a negative take as "from the end")', async () => {
    const res = await request(app).get('/list?limit=-5&page=-3');

    expect(res.body.query).toMatchObject({ limit: 1, page: 1 });
  });

  it('uses the defaults when nothing is asked for', async () => {
    const res = await request(app).get('/list');

    expect(res.body.query).toMatchObject({ limit: 20, page: 1 });
  });

  it('refuses a value outside an enum, and names the key', async () => {
    const res = await request(app).get('/list?sortBy=sideways');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/^sortBy: /);
  });

  it('reads a flag as a boolean and refuses one that is neither true nor false', async () => {
    const ok = await request(app).get('/list?active=true');
    const bad = await request(app).get('/list?active=yes');

    expect(ok.body.query.active).toBe(true);
    expect(bad.status).toBe(400);
  });

  it('leaves keys the schema does not mention as they arrived', async () => {
    const res = await request(app).get('/list?_=1700000000&city=Cairns');

    expect(res.body.query).toMatchObject({ _: '1700000000', city: 'Cairns' });
  });
});

describe('zodParams', () => {
  const app = build();

  it('lets an id through', async () => {
    const res = await request(app).get(`/items/${ID}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ID);
  });

  it('answers 400 for a path segment that is not an id, before any query is built from it', async () => {
    const res = await request(app).get('/items/not-an-id');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/^id: /);
  });
});

describe('parseWith and describeZodError', () => {
  it('throws a 400 an error handler will answer, with the first problem only', () => {
    let thrown: { statusCode?: number; message?: string } = {};
    try {
      parseWith(z.object({ a: z.string(), b: z.number() }), {});
    } catch (error) {
      thrown = error as typeof thrown;
    }

    expect(thrown.statusCode).toBe(400);
    expect(thrown.message).toMatch(/^a: /);
  });

  it('writes a problem with no field as the bare message', () => {
    const result = z.string().min(3).safeParse('a');
    expect(result.success).toBe(false);
    if (!result.success) expect(describeZodError(result.error)).toMatch(/at least 3/);
  });

  it('names a nested field with its whole path', () => {
    const result = z.object({ loan: z.object({ amount: z.number() }) }).safeParse({ loan: { amount: 'x' } });
    expect(result.success).toBe(false);
    if (!result.success) expect(describeZodError(result.error)).toMatch(/^loan\.amount: /);
  });
});

describe('the shared pieces', () => {
  it('numeric takes a number or a numeric string and nothing else', () => {
    expect(numeric.safeParse('42').success).toBe(true);
    expect(numeric.safeParse(42.5).success).toBe(true);
    for (const bad of ['', '  ', 'x', true, null, undefined, [], {}, Infinity, NaN]) {
      expect(numeric.safeParse(bad).success).toBe(false);
    }
  });

  it('audMoney is dollars to the cent, positive, and capped', () => {
    const money = audMoney(100);
    expect(money.parse('0.10')).toBe(0.1);
    expect(money.parse(100)).toBe(100);
    expect(money.safeParse(100.01).success).toBe(false);
    expect(money.safeParse(0).success).toBe(false);
    expect(money.safeParse(1.234).success).toBe(false);
  });

  it('auState takes the eight codes and names them when it refuses', () => {
    expect(auState.parse('QLD')).toBe('QLD');
    const bad = auState.safeParse('XX');
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0].message).toMatch(/QLD/);
  });

  it('limitQuery has the ceiling a route gives it', () => {
    expect(limitQuery(10, 50).parse('500')).toBe(50);
    expect(limitQuery(10, 50).parse(undefined)).toBe(10);
  });
});

describe('the rest of the shared pieces', () => {
  it('uuid takes an id and nothing else', () => {
    expect(uuid.safeParse(ID).success).toBe(true);
    for (const bad of ['', 'not-an-id', 123, null, "' OR 1=1 --"]) expect(uuid.safeParse(bad).success).toBe(false);
  });

  it('audMoneyOrZero allows a free price and refuses a negative one', () => {
    expect(audMoneyOrZero(100).parse(0)).toBe(0);
    expect(audMoneyOrZero(100).parse('0.00')).toBe(0);
    expect(audMoneyOrZero(100).safeParse(-0.01).success).toBe(false);
    expect(audMoneyOrZero(100).safeParse(100.5).success).toBe(false);
  });

  it('positiveInt is a whole number of at least 1', () => {
    expect(positiveInt(10).parse('7')).toBe(7);
    for (const bad of [0, -1, 1.5, 11, 'x', '', true]) expect(positiveInt(10).safeParse(bad).success).toBe(false);
  });

  it('email is trimmed, lower-cased and measured', () => {
    expect(email.parse('  Ada@Example.COM ')).toBe('ada@example.com');
    expect(email.safeParse('ada@').success).toBe(false);
    expect(email.safeParse(`${'a'.repeat(250)}@example.com`).success).toBe(false);
  });

  it('text is trimmed, must have something in it and has a ceiling; optionalText may be empty', () => {
    expect(text(5).parse('  hi ')).toBe('hi');
    expect(text(5).safeParse('   ').success).toBe(false);
    expect(text(5).safeParse('toolong').success).toBe(false);
    expect(text(5).safeParse(5).success).toBe(false);
    expect(optionalText(5).parse('')).toBe('');
    expect(optionalText(5).safeParse('toolong').success).toBe(false);
  });

  it('isoDay is a day that exists', () => {
    expect(isoDay.parse('2026-02-28')).toBe('2026-02-28');
    for (const bad of ['2026-02-30', '2026-13-01', '26-02-28', '2026-2-8', 'tomorrow', '2026-02-28T00:00:00Z']) {
      expect(isoDay.safeParse(bad).success).toBe(false);
    }
    expect(isoDay.parse('2028-02-29')).toBe('2028-02-29');
    expect(isoDay.safeParse('2027-02-29').success).toBe(false);
  });
});
