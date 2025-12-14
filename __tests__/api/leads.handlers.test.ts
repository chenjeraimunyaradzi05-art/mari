import LeadsController from '../../src/lib/controllers/Http/Controllers/Api/V1/LeadsController';
import { prisma } from '../../src/lib/prisma';

jest.mock('../../src/lib/prisma', () => ({ prisma: { lead: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() } } }));

describe('LeadsController', () => {
  beforeEach(() => jest.resetAllMocks());

  test('list: returns leads', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.lead.findMany.mockResolvedValue([{ id: 'l1' }]);
    const req = new Request('http://localhost/api/leads');
    const res = await LeadsController.list(req as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.data.length).toBe(1);
  });

  test('create: creates lead', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.lead.create.mockResolvedValue({ id: 'l2', name: 'A' });
    const req = new Request('http://localhost/api/leads', { method: 'POST', body: JSON.stringify({ name: 'A', email: 'a@b' }) });
    const res = await LeadsController.create(req as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(201);
    expect(body.data.id).toBe('l2');
  });
});
