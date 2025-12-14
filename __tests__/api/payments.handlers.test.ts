import PaymentsController from '../../src/lib/controllers/Http/Controllers/Api/V1/PaymentsController';
import { prisma } from '../../src/lib/prisma';

jest.mock('../../src/lib/prisma', () => ({ prisma: { payment: { findMany: jest.fn(), create: jest.fn() } } }));

describe('PaymentsController', () => {
  beforeEach(() => jest.resetAllMocks());

  test('list: returns payments', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.payment.findMany.mockResolvedValue([{ id: 'pay1' }]);
    const req = new Request('http://localhost/api/payments');
    const res = await PaymentsController.list(req as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
  });

  test('create: creates payment', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.payment.create.mockResolvedValue({ id: 'pay2', amount: 100 });
    const req = new Request('http://localhost/api/payments', { method: 'POST', body: JSON.stringify({ userId: 'u1', amount: 100 }) });
    const res = await PaymentsController.create(req as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(201);
    expect(body.data.amount).toBe(100);
  });
});
