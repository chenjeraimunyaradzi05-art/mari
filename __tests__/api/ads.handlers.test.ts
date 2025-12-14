import AdsController from '../../src/lib/controllers/Http/Controllers/Api/V1/AdsController';
import { prisma } from '../../src/lib/prisma';

jest.mock('../../src/lib/prisma', () => ({ prisma: { adCampaign: { findMany: jest.fn(), create: jest.fn() } } }));

describe('AdsController', () => {
  beforeEach(() => jest.resetAllMocks());

  test('listCampaigns: returns campaigns', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.adCampaign.findMany.mockResolvedValue([{ id: 'c1' }]);
    const req = new Request('http://localhost/api/ads');
    const res = await AdsController.listCampaigns(req as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
  });

  test('createCampaign: creates', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.adCampaign.create.mockResolvedValue({ id: 'c2', name: 'Camp' });
    const req = new Request('http://localhost/api/ads', { method: 'POST', body: JSON.stringify({ name: 'Camp', organizationId: 'org1' }) });
    const res = await AdsController.createCampaign(req as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(201);
  });
});
