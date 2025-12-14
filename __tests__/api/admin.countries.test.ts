import AdminCountryController from '../../src/lib/controllers/Http/Controllers/Api/V1/AdminCountryController';
import { prisma } from '../../src/lib/prisma';

jest.mock('../../src/lib/prisma', () => ({ prisma: { country: { findMany: jest.fn(), update: jest.fn() } } }));

describe('AdminCountryController', () => {
  beforeEach(() => jest.resetAllMocks());

  test('listCountries returns list', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.country.findMany.mockResolvedValue([{ id: 'ct1', name: 'AU' }]);
    const req = new Request('http://localhost/api/admin/countries');
    const res = await AdminCountryController.listCountries(req as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.data.length).toBe(1);
  });
});
