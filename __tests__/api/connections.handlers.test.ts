import ConnectionsController from '../../src/lib/controllers/Http/Controllers/Api/V1/ConnectionsController';
import { prisma } from '../../src/lib/prisma';
import * as tokens from '../../src/lib/tokens';

jest.mock('../../src/lib/prisma', () => ({ prisma: { connection: { findMany: jest.fn(), create: jest.fn(), delete: jest.fn() } } }));
jest.mock('../../src/lib/tokens');

describe('ConnectionsController', () => {
  beforeEach(() => jest.resetAllMocks());

  test('list: requires auth', async () => {
    (tokens.getUserFromRequest as jest.Mock).mockResolvedValue('u1');
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.connection.findMany.mockResolvedValue([{ id: 'c1' }]);
    const req = new Request('http://localhost/api/connections', { headers: { authorization: 'Bearer 1|a' } });
    const res = await ConnectionsController.list(req as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
  });

  test('connect: creates connection', async () => {
    (tokens.getUserFromRequest as jest.Mock).mockResolvedValue('u1');
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.connection.create.mockResolvedValue({ id: 'c2', status: 'pending' });
    const req = new Request('http://localhost/api/connections', { method: 'POST', body: JSON.stringify({ targetUserId: 'u2' }), headers: { authorization: 'Bearer 1|a' } });
    const res = await ConnectionsController.connect(req as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(201);
  });
});
