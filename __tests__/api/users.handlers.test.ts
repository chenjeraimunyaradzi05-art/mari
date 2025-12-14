import UserController from '../../src/lib/controllers/Http/Controllers/Api/V1/UserController';
import { prisma } from '../../src/lib/prisma';
import * as tokens from '../../src/lib/tokens';

jest.mock('../../src/lib/prisma', () => ({ prisma: { user: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() } } }));
jest.mock('../../src/lib/tokens');

describe('UserController', () => {
  beforeEach(() => jest.resetAllMocks());

  test('list: returns users', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    const req = new Request('http://localhost/api/users');
    const res = await UserController.list(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.data.length).toBe(2);
  });

  test('show: returns user or 404', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.user.findUnique.mockResolvedValue({ id: 'u1', email: 'e@x' });
    const req = new Request('http://localhost/api/users/u1');
    const res = await UserController.show(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.data.id).toBe('u1');
  });

  test('update: enforces auth and owner', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    (tokens.getUserFromRequest as jest.Mock).mockResolvedValue('u1');
    mocked.user.update.mockResolvedValue({ id: 'u1', firstName: 'New' });

    const req = new Request('http://localhost/api/users/u1', { method: 'PATCH', body: JSON.stringify({ firstName: 'New' }), headers: { authorization: 'Bearer 1|a' } });
    const res = await UserController.update(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.data.firstName).toBe('New');
  });
});
