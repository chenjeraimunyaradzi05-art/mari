import AdminAnalyticsController from '../../src/lib/controllers/Http/Controllers/Api/V1/AdminAnalyticsController';
import { prisma } from '../../src/lib/prisma';

jest.mock('../../src/lib/prisma', () => ({ prisma: { post: { findMany: jest.fn() }, user: { findMany: jest.fn() } } }));

describe('AdminAnalyticsController', () => {
  beforeEach(() => jest.resetAllMocks());

  test('recentActivity returns posts and users', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.post.findMany.mockResolvedValue([{ id: 'p1' }]);
    mocked.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    const req = new Request('http://localhost/api/admin/analytics/recent');
    const res = await AdminAnalyticsController.recentActivity(req as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.data.recentPosts.length).toBe(1);
  });
});
