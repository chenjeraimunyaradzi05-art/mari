import AdminDashboardController from '../../src/lib/controllers/Http/Controllers/Api/V1/AdminDashboardController';
import { prisma } from '../../src/lib/prisma';

jest.mock('../../src/lib/prisma', () => ({ prisma: { user: { count: jest.fn() }, post: { count: jest.fn() }, lead: { count: jest.fn() } } }));

describe('AdminDashboardController', () => {
  beforeEach(() => jest.resetAllMocks());

  test('overview returns counts', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.user.count.mockResolvedValue(10);
    mocked.post.count.mockResolvedValue(5);
    mocked.lead.count.mockResolvedValue(2);
    const req = new Request('http://localhost/api/admin/dashboard/overview');
    const res = await AdminDashboardController.overview(req as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.data.users).toBe(10);
  });
});
