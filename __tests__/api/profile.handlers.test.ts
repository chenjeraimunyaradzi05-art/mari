import ProfileController from '../../src/lib/controllers/Http/Controllers/Api/V1/ProfileController';
import { prisma } from '../../src/lib/prisma';
import * as tokens from '../../src/lib/tokens';

jest.mock('../../src/lib/prisma', () => ({ prisma: { $queryRaw: jest.fn(), $executeRawUnsafe: jest.fn() } }));
jest.mock('../../src/lib/tokens');

describe('ProfileController', () => {
  beforeEach(() => jest.resetAllMocks());

  test('show: returns profile or 404', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.$queryRaw.mockResolvedValue([{ id: 'p1', user_id: 'u1' }]);
    const req = new Request('http://localhost/api/profiles/p1');
    const res = await ProfileController.show(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.data.id).toBe('p1');
  });

  test('update: requires auth and owner', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.$queryRaw.mockResolvedValueOnce([{ id: 'p1', user_id: 'u1' }]);
    (tokens.getUserFromRequest as jest.Mock).mockResolvedValue('u1');
    mocked.$executeRawUnsafe.mockResolvedValue(undefined);
    mocked.$queryRaw.mockResolvedValueOnce([{ id: 'p1', user_id: 'u1', headline: 'Hi' }]);

    const req = new Request('http://localhost/api/profiles/p1', { method: 'PATCH', body: JSON.stringify({ headline: 'Hi' }), headers: { authorization: 'Bearer 1|a' } });
    const res = await ProfileController.update(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.data.headline).toBe('Hi');
  });
});
