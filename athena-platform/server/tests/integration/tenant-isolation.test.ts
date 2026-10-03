/**
 * One organisation against another, against rows that really exist.
 *
 * ATHENA keeps a good deal per organisation: its books (the chart of accounts and
 * the journal, the BAS and the returns behind it), its stock, its money records,
 * its jobs and apprenticeships and the women who applied to them, and its team.
 * The code that keeps one organisation out of another's rows is the filter on
 * accepted membership in utils/org-scope and hiring-access.service, and until
 * this suite every test of it was written against a mocked database, which
 * answers whatever the test says it should. A mock cannot be wrong about a join.
 * Postgres can.
 *
 * The database does not help. The API connects with one role, so a row-level
 * security policy would see the same user for every tenant and decide nothing
 * (docs/security/authorisation-matrix.md says so, and says why that is the
 * decision). The isolation is therefore the accepted-member filter in the code,
 * and this suite is what holds it to its word.
 *
 * ## What is run
 *
 * Two organisations, X and Y, each with the same set of rows (tests/integration/
 * setup/fixtures.ts), and the people who are not in them:
 *
 *   b   a member of Y, reaching into X;
 *   c   invited to X as an ADMIN and has not answered. The membership row exists
 *       and grants nothing, which is the case that was open for months;
 *   d   a bookkeeper who filed X's journal entries and its draft return and was
 *       then removed. Her id is still stamped on them, which is not a key;
 *   a   the owner of X, reaching into Y by naming its id;
 *   a2  a viewer of X, reaching into Y, and, for what only hiring staff may see,
 *       into X itself.
 *
 * Every probe is a call a real client makes (the same routes, the same bodies)
 * with the organisation's id or one of its rows' ids in it. For each:
 *
 *   1. the control: the organisation's own owner makes the read and is shown the
 *      data, so a refusal below cannot be a path that refuses everybody;
 *   2. each outsider is refused (403 or 404, never the catch-all "Endpoint not
 *      found", which a mistyped path would also answer) and the response holds
 *      none of the organisation's sentinel text and none of its owner's address;
 *   3. each outsider's own lists, with no organisation named, hold nothing of an
 *      organisation she is not in;
 *   4. after every attempt, every row of every table is exactly as it was.
 *
 * Writes that are meant to succeed run last, on the same rows, so that "refused"
 * is not just the fixture being broken.
 */

import fs from 'fs';
import request from 'supertest';
import { describeIntegration, resetDatabase } from './setup/harness';
import {
  SENTINEL,
  TenantWorld,
  OrganisationRows,
  Side,
  removeResumeFiles,
  resumeFilePath,
  seedTenantWorld,
  snapshotTenantRows,
} from './setup/fixtures';

jest.mock('../../src/utils/email', () => ({
  sendEmail: jest.fn(async () => true),
  sendVerificationEmail: jest.fn(async () => true),
  sendPasswordResetEmail: jest.fn(async () => true),
  sendWelcomeEmail: jest.fn(async () => true),
}));

import { app } from '../../src/index';
import { prisma } from '../../src/utils/prisma';
import { hashPassword } from '../../src/utils/password';

const PASSWORD = 'CorrectPassw0rd!26';
const PERIOD = 'from=2026-07-01&to=2026-09-30';

type Who = 'a' | 'a2' | 'b' | 'c' | 'd';
type Method = 'get' | 'post' | 'patch' | 'delete';

interface Call {
  method: Method;
  path: string;
  body?: Record<string, unknown>;
}

/** What an outsider tries, given the rows of the organisation being reached into. */
interface Probe {
  label: string;
  /** 'books': anyone outside the organisation. 'hiring': also a member who is not hiring staff. */
  scope: 'books' | 'hiring';
  build: (r: OrganisationRows) => Call;
}

interface Control {
  label: string;
  build: (r: OrganisationRows) => Call;
  /** Text that must be in the answer, so the control proves the data is reachable by the one it belongs to. */
  shows: ((r: OrganisationRows) => string) | null;
}

interface Row {
  resource: string;
  controls: Control[];
  probes: Probe[];
}

interface Outsider {
  who: Who;
  side: Side;
  description: string;
  /** Probe scopes this person is outside of. */
  scopes: Array<Probe['scope']>;
}

let world: TenantWorld;
let tokens: Record<Who, string>;
let before: string;

async function signIn(email: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return response.body.data.accessToken as string;
}

function send(call: Call, token: string) {
  const pending = request(app)[call.method](call.path).set('Authorization', `Bearer ${token}`);
  return call.body ? pending.send(call.body) : pending;
}

/** Everything a response could show: the parsed body and the raw text. */
const wholeResponse = (res: request.Response) => `${JSON.stringify(res.body)}\n${res.text ?? ''}`;

const rowsOf = (side: Side) => (side === 'x' ? world.x : world.y);

/** The people who are in no way inside an organisation, and the one inside it who is not hiring staff. */
const OUTSIDERS: Outsider[] = [
  { who: 'b', side: 'x', description: 'a member of the other organisation', scopes: ['books', 'hiring'] },
  { who: 'c', side: 'x', description: 'someone invited, with every right, who has not answered', scopes: ['books', 'hiring'] },
  { who: 'd', side: 'x', description: 'a bookkeeper who filed its rows and has been removed', scopes: ['books', 'hiring'] },
  { who: 'a', side: 'y', description: 'the owner of X, naming Y', scopes: ['books', 'hiring'] },
  { who: 'a2', side: 'y', description: 'a viewer of X, naming Y', scopes: ['books', 'hiring'] },
  // Inside X, a member of the books, but not among the people who may see who applied.
  { who: 'a2', side: 'x', description: 'a viewer of the organisation, who is not hiring staff', scopes: ['hiring'] },
];

/** Which organisations each person is an accepted member of: the only ones she may see in her own lists. */
const MEMBER_OF: Record<Who, Side[]> = { a: ['x'], a2: ['x'], b: ['y'], c: [], d: [] };

const ROWS: Row[] = [
  {
    resource: 'the books: chart of accounts, journal and reports',
    controls: [
      {
        label: 'the chart of accounts',
        build: (r) => ({ method: 'get', path: `/api/accounting/accounts?organizationId=${r.organizationId}` }),
        shows: (r) => r.sentinel,
      },
      {
        label: 'the journal',
        build: (r) => ({ method: 'get', path: `/api/accounting/journals?organizationId=${r.organizationId}` }),
        shows: (r) => r.sentinel,
      },
      {
        label: 'one journal entry by its id',
        build: (r) => ({ method: 'get', path: `/api/accounting/journals/${r.postedJournalId}` }),
        shows: (r) => r.sentinel,
      },
      {
        label: 'the trial balance',
        build: (r) => ({ method: 'get', path: `/api/accounting/reports/trial-balance?organizationId=${r.organizationId}` }),
        shows: (r) => r.sentinel,
      },
    ],
    probes: [
      {
        label: 'list its chart of accounts',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/accounting/accounts?organizationId=${r.organizationId}` }),
      },
      {
        label: 'list its journal',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/accounting/journals?organizationId=${r.organizationId}` }),
      },
      {
        label: 'read one of its journal entries by id',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/accounting/journals/${r.postedJournalId}` }),
      },
      {
        label: 'rewrite a draft journal entry by id',
        scope: 'books',
        build: (r) => ({ method: 'patch', path: `/api/accounting/journals/${r.draftJournalId}`, body: { description: 'rewritten' } }),
      },
      {
        label: 'post a draft journal entry by id',
        scope: 'books',
        build: (r) => ({ method: 'post', path: `/api/accounting/journals/${r.draftJournalId}/post` }),
      },
      {
        label: 'void a posted journal entry by id',
        scope: 'books',
        build: (r) => ({ method: 'post', path: `/api/accounting/journals/${r.postedJournalId}/void` }),
      },
      {
        label: 'rename one of its accounts by id',
        scope: 'books',
        build: (r) => ({ method: 'patch', path: `/api/accounting/accounts/${r.cashAccountId}`, body: { name: 'renamed' } }),
      },
      {
        label: 'delete one of its accounts by id',
        scope: 'books',
        build: (r) => ({ method: 'delete', path: `/api/accounting/accounts/${r.salesAccountId}` }),
      },
      {
        label: 'file a new account into it',
        scope: 'books',
        build: (r) => ({
          method: 'post',
          path: '/api/accounting/accounts',
          body: { organizationId: r.organizationId, name: 'Planted', type: 'ASSET' },
        }),
      },
      {
        label: 'file a journal entry into it, citing its accounts',
        scope: 'books',
        build: (r) => ({
          method: 'post',
          path: '/api/accounting/journals',
          body: {
            organizationId: r.organizationId,
            description: 'Planted',
            lines: [
              { accountId: r.cashAccountId, debit: 10 },
              { accountId: r.salesAccountId, credit: 10 },
            ],
          },
        }),
      },
      {
        label: 'read its trial balance',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/accounting/reports/trial-balance?organizationId=${r.organizationId}` }),
      },
      {
        label: 'read its profit and loss',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/accounting/reports/profit-and-loss?organizationId=${r.organizationId}` }),
      },
      {
        label: 'read its balance sheet',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/accounting/reports/balance-sheet?organizationId=${r.organizationId}` }),
      },
    ],
  },
  {
    resource: 'its stock: items, locations, movements and levels',
    controls: [
      {
        label: 'the items',
        build: (r) => ({ method: 'get', path: `/api/inventory/items?organizationId=${r.organizationId}` }),
        shows: (r) => r.sentinel,
      },
      {
        label: 'the stock levels',
        build: (r) => ({ method: 'get', path: `/api/inventory/stock-levels?organizationId=${r.organizationId}` }),
        shows: (r) => r.sentinel,
      },
    ],
    probes: [
      {
        label: 'list its items',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/inventory/items?organizationId=${r.organizationId}` }),
      },
      {
        label: 'list its locations',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/inventory/locations?organizationId=${r.organizationId}` }),
      },
      {
        label: 'list its stock movements',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/inventory/transactions?organizationId=${r.organizationId}` }),
      },
      {
        label: 'read its stock levels',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/inventory/stock-levels?organizationId=${r.organizationId}` }),
      },
      {
        label: 'add an item to it',
        scope: 'books',
        build: (r) => ({
          method: 'post',
          path: '/api/inventory/items',
          body: { organizationId: r.organizationId, sku: 'PLANTED', name: 'Planted' },
        }),
      },
      {
        label: 'add a location to it',
        scope: 'books',
        build: (r) => ({
          method: 'post',
          path: '/api/inventory/locations',
          body: { organizationId: r.organizationId, name: 'Planted', code: 'PL' },
        }),
      },
      {
        label: 'rename one of its items by id',
        scope: 'books',
        build: (r) => ({ method: 'patch', path: `/api/inventory/items/${r.itemId}`, body: { name: 'renamed' } }),
      },
      {
        label: 'delete one of its items by id',
        scope: 'books',
        build: (r) => ({ method: 'delete', path: `/api/inventory/items/${r.itemId}` }),
      },
      {
        label: 'rename one of its locations by id',
        scope: 'books',
        build: (r) => ({ method: 'patch', path: `/api/inventory/locations/${r.locationId}`, body: { name: 'renamed' } }),
      },
      {
        label: 'delete one of its locations by id',
        scope: 'books',
        build: (r) => ({ method: 'delete', path: `/api/inventory/locations/${r.locationId}` }),
      },
      {
        label: 'post a movement against one of its items',
        scope: 'books',
        build: (r) => ({
          method: 'post',
          path: '/api/inventory/transactions',
          body: { itemId: r.itemId, type: 'PURCHASE', quantity: 1 },
        }),
      },
      {
        label: 'change one of its movements by id',
        scope: 'books',
        build: (r) => ({ method: 'patch', path: `/api/inventory/transactions/${r.stockMovementId}`, body: { reference: 'changed' } }),
      },
      {
        label: 'delete one of its movements by id',
        scope: 'books',
        build: (r) => ({ method: 'delete', path: `/api/inventory/transactions/${r.stockMovementId}` }),
      },
    ],
  },
  {
    resource: 'its tax: the BAS worksheet and its returns',
    controls: [
      {
        label: 'the BAS worksheet',
        build: (r) => ({ method: 'get', path: `/api/tax/bas?${PERIOD}&organizationId=${r.organizationId}` }),
        shows: (r) => r.sentinel,
      },
      {
        label: 'the returns',
        build: (r) => ({ method: 'get', path: `/api/tax/returns?organizationId=${r.organizationId}` }),
        shows: (r) => r.sentinel,
      },
    ],
    probes: [
      {
        label: 'read its BAS worksheet',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/tax/bas?${PERIOD}&organizationId=${r.organizationId}` }),
      },
      {
        label: 'record a BAS lodgement in its name',
        scope: 'books',
        build: (r) => ({
          method: 'post',
          path: '/api/tax/bas/lodge',
          body: { from: '2026-07-01', to: '2026-09-30', organizationId: r.organizationId },
        }),
      },
      {
        label: 'list its returns',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/tax/returns?organizationId=${r.organizationId}` }),
      },
      {
        label: 'file a return in its name',
        scope: 'books',
        build: (r) => ({
          method: 'post',
          path: '/api/tax/returns',
          body: {
            organizationId: r.organizationId,
            periodStart: '2026-07-01T00:00:00.000Z',
            periodEnd: '2026-09-30T00:00:00.000Z',
            totalSales: 1,
            totalTax: 0,
          },
        }),
      },
      {
        label: 'edit a draft return by id',
        scope: 'books',
        build: (r) => ({ method: 'patch', path: `/api/tax/returns/${r.taxReturnId}`, body: { reference: 'rewritten' } }),
      },
      {
        label: 'submit a draft return by id',
        scope: 'books',
        build: (r) => ({ method: 'post', path: `/api/tax/returns/${r.taxReturnId}/submit` }),
      },
      {
        label: 'delete a draft return by id',
        scope: 'books',
        build: (r) => ({ method: 'delete', path: `/api/tax/returns/${r.taxReturnId}` }),
      },
    ],
  },
  {
    resource: 'its money records',
    controls: [
      {
        label: 'the money records',
        build: (r) => ({ method: 'get', path: `/api/money/transactions?organizationId=${r.organizationId}` }),
        shows: (r) => r.sentinel,
      },
    ],
    probes: [
      {
        label: 'file a record in its name',
        scope: 'books',
        build: (r) => ({
          method: 'post',
          path: '/api/money/transactions',
          body: { organizationId: r.organizationId, amount: 5, type: 'PAYMENT' },
        }),
      },
      {
        label: 'change one of its records by id',
        scope: 'books',
        build: (r) => ({ method: 'patch', path: `/api/money/transactions/${r.moneyTransactionId}`, body: { status: 'COMPLETED' } }),
      },
      {
        label: 'delete one of its records by id',
        scope: 'books',
        build: (r) => ({ method: 'delete', path: `/api/money/transactions/${r.moneyTransactionId}` }),
      },
    ],
  },
  {
    resource: 'its team and its console',
    controls: [
      {
        label: 'the team roster',
        build: (r) => ({ method: 'get', path: `/api/employer/organizations/${r.organizationId}/team` }),
        shows: (r) => r.ownerEmail,
      },
      {
        label: 'the dashboard',
        build: (r) => ({ method: 'get', path: `/api/employer/organizations/${r.organizationId}/dashboard` }),
        shows: null,
      },
      {
        label: 'its jobs',
        build: (r) => ({ method: 'get', path: `/api/employer/organizations/${r.organizationId}/jobs` }),
        shows: (r) => r.sentinel,
      },
    ],
    probes: [
      {
        label: 'read the team roster',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/employer/organizations/${r.organizationId}/team` }),
      },
      {
        label: 'read the dashboard',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/employer/organizations/${r.organizationId}/dashboard` }),
      },
      {
        label: 'list its jobs',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/employer/organizations/${r.organizationId}/jobs` }),
      },
      {
        label: 'read one of its jobs by id',
        scope: 'books',
        build: (r) => ({ method: 'get', path: `/api/employer/jobs/${r.jobId}` }),
      },
      {
        label: 'rewrite one of its jobs by id',
        scope: 'books',
        build: (r) => ({ method: 'patch', path: `/api/employer/jobs/${r.jobId}`, body: { title: 'rewritten' } }),
      },
      {
        label: 'post a job in its name',
        scope: 'books',
        build: (r) => ({
          method: 'post',
          path: `/api/employer/organizations/${r.organizationId}/jobs`,
          body: { title: 'Planted', description: 'Planted', type: 'FULL_TIME' },
        }),
      },
      {
        label: 'remove a member of its team',
        scope: 'books',
        build: (r) => ({ method: 'delete', path: `/api/employer/organizations/${r.organizationId}/team/${r.teamMemberRowId}` }),
      },
    ],
  },
  {
    resource: 'the women who applied to its jobs',
    controls: [
      {
        label: 'the applicant list',
        build: (r) => ({ method: 'get', path: `/api/employer/organizations/${r.organizationId}/applications` }),
        shows: (r) => r.sentinel,
      },
    ],
    probes: [
      {
        label: 'list its applicants',
        scope: 'hiring',
        build: (r) => ({ method: 'get', path: `/api/employer/organizations/${r.organizationId}/applications` }),
      },
      {
        label: 'move an applicant through its pipeline',
        scope: 'hiring',
        build: (r) => ({
          method: 'patch',
          path: `/api/employer/applications/${r.jobApplicationId}/status`,
          body: { status: 'REVIEWED' },
        }),
      },
    ],
  },
  {
    resource: 'the women who applied to its apprenticeships',
    controls: [
      {
        label: 'the applicant list',
        build: (r) => ({ method: 'get', path: `/api/apprenticeships/${r.apprenticeshipId}/applications` }),
        shows: (r) => r.sentinel,
      },
      {
        label: 'one application by id',
        build: (r) => ({ method: 'get', path: `/api/apprenticeships/applications/${r.apprenticeshipApplicationId}` }),
        shows: (r) => r.sentinel,
      },
    ],
    probes: [
      {
        label: 'list its applicants',
        scope: 'hiring',
        build: (r) => ({ method: 'get', path: `/api/apprenticeships/${r.apprenticeshipId}/applications` }),
      },
      {
        label: 'read one application by id',
        scope: 'hiring',
        build: (r) => ({ method: 'get', path: `/api/apprenticeships/applications/${r.apprenticeshipApplicationId}` }),
      },
      {
        label: 'decide one application by id',
        scope: 'hiring',
        build: (r) => ({
          method: 'patch',
          path: `/api/apprenticeships/applications/${r.apprenticeshipApplicationId}`,
          body: { status: 'SCREENING' },
        }),
      },
    ],
  },
  {
    resource: 'an applicant’s résumé',
    // The file is sent as a download, so there is no body text to look for: a
    // 200 for the hiring staff and a refusal for everyone else is the contrast.
    controls: [
      { label: 'open the file', build: (r) => ({ method: 'get', path: `/api/media/local/${r.resumeKey}` }), shows: null },
    ],
    probes: [
      { label: 'open the file', scope: 'hiring', build: (r) => ({ method: 'get', path: `/api/media/local/${r.resumeKey}` }) },
      {
        label: 'ask for a link to the file',
        scope: 'hiring',
        build: (r) => ({ method: 'post', path: '/api/media/download-url', body: { key: r.resumeKey } }),
      },
    ],
  },
];

/** Each person's own lists, with no organisation named. */
const OWN_LISTS = [
  '/api/accounting/accounts',
  '/api/accounting/journals',
  '/api/inventory/items',
  '/api/inventory/locations',
  '/api/inventory/transactions',
  '/api/inventory/stock-levels',
  '/api/tax/returns',
  '/api/money/transactions',
  '/api/employer/organizations',
];

const WHO: Who[] = ['a', 'a2', 'b', 'c', 'd'];

describeIntegration('one organisation against another', () => {
  beforeAll(async () => {
    await resetDatabase();
    world = await seedTenantWorld(await hashPassword(PASSWORD));
    const { a, a2, b, c, d } = world.members;
    tokens = {
      a: await signIn(a.email),
      a2: await signIn(a2.email),
      b: await signIn(b.email),
      c: await signIn(c.email),
      d: await signIn(d.email),
    };
    before = await snapshotTenantRows();
  });

  afterAll(async () => {
    await removeResumeFiles(world);
  });

  describe('the owner of each organisation reaches its own rows, so a refusal below means something', () => {
    for (const side of ['x', 'y'] as const) {
      for (const row of ROWS) {
        for (const control of row.controls) {
          it(`${side.toUpperCase()}: its owner reads ${control.label}`, async () => {
            const owner: Who = side === 'x' ? 'a' : 'b';
            const rows = rowsOf(side);

            const res = await send(control.build(rows), tokens[owner]);

            expect(res.status).toBe(200);
            if (control.shows) expect(wholeResponse(res)).toContain(control.shows(rows));
          });
        }
      }
    }

    it('X: the résumé on disk is the one the application points at', () => {
      expect(fs.existsSync(resumeFilePath(world.x.resumeKey))).toBe(true);
      expect(fs.existsSync(resumeFilePath(world.y.resumeKey))).toBe(true);
    });
  });

  for (const row of ROWS) {
    describe(row.resource, () => {
      for (const outsider of OUTSIDERS) {
        for (const probe of row.probes.filter((p) => outsider.scopes.includes(p.scope))) {
          it(`refuses ${outsider.description} who tries to ${probe.label}`, async () => {
            const rows = rowsOf(outsider.side);

            const res = await send(probe.build(rows), tokens[outsider.who]);

            expect([403, 404]).toContain(res.status);
            // A path that does not exist answers 404 to everybody and would pass.
            expect(res.body?.message ?? '').not.toMatch(/endpoint not found/i);
            expect(wholeResponse(res)).not.toContain(rows.sentinel);
            expect(wholeResponse(res)).not.toContain(rows.ownerEmail);
          });
        }
      }
    });
  }

  describe('each person’s own lists, with no organisation named', () => {
    for (const who of WHO) {
      for (const list of OWN_LISTS) {
        it(`${who}: ${list} holds nothing of an organisation she is not in`, async () => {
          const res = await send({ method: 'get', path: list }, tokens[who]);

          expect(res.status).toBe(200);
          for (const side of ['x', 'y'] as const) {
            if (MEMBER_OF[who].includes(side)) continue;
            const rows = rowsOf(side);
            expect(wholeResponse(res)).not.toContain(rows.sentinel);
            expect(wholeResponse(res)).not.toContain(rows.organizationId);
          }
        });
      }
    }

    it('naming an organisation she is not in on the money list is an empty list, not another tenant’s rows', async () => {
      for (const who of ['b', 'c', 'd'] as const) {
        const res = await send({ method: 'get', path: `/api/money/transactions?organizationId=${world.x.organizationId}` }, tokens[who]);

        expect(res.status).toBe(200);
        expect(wholeResponse(res)).not.toContain(SENTINEL.x);
        expect(res.body.data).toEqual([]);
      }
    });
  });

  describe('what a colleague inside the organisation may and may not see', () => {
    it('a viewer shares the books with the rest of the accepted members', async () => {
      const res = await send({ method: 'get', path: `/api/accounting/journals?organizationId=${world.x.organizationId}` }, tokens.a2);

      expect(res.status).toBe(200);
      expect(wholeResponse(res)).toContain(SENTINEL.x);
    });

    it('a viewer is not hiring staff, so she is shown no applicant, and the résumé is hers alone to hand over', async () => {
      const list = await send({ method: 'get', path: `/api/employer/organizations/${world.x.organizationId}/applications` }, tokens.a2);
      expect(list.status).toBe(403);
      expect(wholeResponse(list)).not.toContain(SENTINEL.x);

      const file = await send({ method: 'get', path: `/api/media/local/${world.x.resumeKey}` }, tokens.a2);
      expect(file.status).toBe(404);
    });

    it('an organisation colleague has no claim on a member’s personal invoice', async () => {
      for (const who of ['a2', 'b', 'c', 'd'] as const) {
        for (const path of [`/api/invoices/${world.invoiceId}`, `/api/invoices/${world.invoiceId}/pdf`]) {
          const res = await send({ method: 'get', path }, tokens[who]);

          expect([403, 404]).toContain(res.status);
          expect(res.body?.message ?? '').not.toMatch(/endpoint not found/i);
          expect(wholeResponse(res)).not.toContain(world.invoiceNumber);
        }

        const list = await send({ method: 'get', path: '/api/invoices' }, tokens[who]);
        expect(list.status).toBe(200);
        expect(wholeResponse(list)).not.toContain(world.invoiceNumber);
      }
    });

    it('a member of Y who names X’s own team row inside Y’s URL is told it does not exist, and the row stays', async () => {
      const res = await send(
        { method: 'delete', path: `/api/employer/organizations/${world.y.organizationId}/team/${world.x.teamMemberRowId}` },
        tokens.b
      );

      expect(res.status).toBe(404);
      expect(await prisma.organizationMember.count({ where: { id: world.x.teamMemberRowId } })).toBe(1);
    });

    it('an invitation she has not answered lists the organisation as an invitation, never as a team she is on', async () => {
      const mine = await send({ method: 'get', path: '/api/employer/organizations' }, tokens.c);
      expect(mine.status).toBe(200);
      expect(wholeResponse(mine)).not.toContain(world.x.organizationId);

      const invitations = await send({ method: 'get', path: '/api/employer/invitations' }, tokens.c);
      expect(invitations.status).toBe(200);
      expect(wholeResponse(invitations)).toContain(world.x.organizationId);
    });
  });

  it('after every attempt above, every row of every table is exactly as it was', async () => {
    expect(await snapshotTenantRows()).toBe(before);
  });

  describe('and the people who are in the organisation can still work in it', () => {
    it('X’s owner posts a draft entry, and the row says so', async () => {
      await send({ method: 'post', path: `/api/accounting/journals/${world.x.draftJournalId}/post` }, tokens.a).expect(200);

      const entry = await prisma.journalEntry.findUniqueOrThrow({ where: { id: world.x.draftJournalId } });
      expect(entry.status).toBe('POSTED');
    });

    it('X’s owner changes an item and files a money record, in X', async () => {
      await send({ method: 'patch', path: `/api/inventory/items/${world.x.itemId}`, body: { name: 'Renamed widget' } }, tokens.a).expect(200);
      expect((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: world.x.itemId } })).name).toBe('Renamed widget');

      const created = await send(
        { method: 'post', path: '/api/money/transactions', body: { organizationId: world.x.organizationId, amount: 5, type: 'PAYMENT' } },
        tokens.a
      ).expect(201);
      const row = await prisma.moneyTransaction.findUniqueOrThrow({ where: { id: created.body.data.id } });
      expect(row.organizationId).toBe(world.x.organizationId);
      expect(row.userId).toBe(world.members.a.id);
    });

    it('a viewer files into X’s books, because the books are shared by its accepted members', async () => {
      const res = await send(
        {
          method: 'post',
          path: '/api/accounting/journals',
          body: {
            organizationId: world.x.organizationId,
            description: 'Filed by a viewer',
            lines: [
              { accountId: world.x.cashAccountId, debit: 10 },
              { accountId: world.x.salesAccountId, credit: 10 },
            ],
          },
        },
        tokens.a2
      );

      expect(res.status).toBe(201);
    });

    it('the invited member is let in by saying yes, and by nothing else', async () => {
      const invitation = await prisma.organizationMember.findFirstOrThrow({
        where: { organizationId: world.x.organizationId, userId: world.members.c.id },
      });
      expect(invitation.acceptedAt).toBeNull();

      await send({ method: 'post', path: `/api/employer/invitations/${invitation.id}/accept` }, tokens.c).expect(200);

      const res = await send({ method: 'get', path: `/api/accounting/accounts?organizationId=${world.x.organizationId}` }, tokens.c);
      expect(res.status).toBe(200);
      expect(wholeResponse(res)).toContain(SENTINEL.x);
    });

    it('the bookkeeper who was removed is let back in only by being added again, and not by the id on her old rows', async () => {
      const refused = await send(
        { method: 'patch', path: `/api/accounting/journals/${world.x.draftJournalId}`, body: { description: 'rewritten' } },
        tokens.d
      );
      expect([403, 404]).toContain(refused.status);

      await prisma.organizationMember.create({
        data: { organizationId: world.x.organizationId, userId: world.members.d.id, role: 'ADMIN', acceptedAt: new Date() },
      });

      const allowed = await send({ method: 'get', path: `/api/accounting/journals/${world.x.postedJournalId}` }, tokens.d);
      expect(allowed.status).toBe(200);
    });
  });
});
