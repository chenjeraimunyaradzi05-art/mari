import SocialController from '../../src/lib/controllers/Http/Controllers/Api/V1/SocialController';
import { prisma } from '../../src/lib/prisma';
import * as tokens from '../../src/lib/tokens';

jest.mock('../../src/lib/prisma', () => ({ prisma: { $queryRaw: jest.fn(), $executeRaw: jest.fn(), post: { findMany: jest.fn() } } }));
jest.mock('../../src/lib/tokens');

describe('SocialController', () => {
  beforeEach(() => jest.resetAllMocks());

  test('follow: inserts and returns status', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    (tokens.getUserFromRequest as jest.Mock).mockResolvedValue('u1');
    mocked.$queryRaw.mockResolvedValue([]);
    mocked.$executeRaw.mockResolvedValue(undefined);
    const req = new Request('http://localhost/api/social/follow', { method: 'POST', body: JSON.stringify({ followable_type: 'Profile', followable_id: 'p1' }), headers: { authorization: 'Bearer 1|a' } });
    const res = await SocialController.follow(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(201);
    expect(body.message).toBe('Followed');
  });

  test('unfollow: deletes and returns status', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    (tokens.getUserFromRequest as jest.Mock).mockResolvedValue('u1');
    mocked.$executeRaw.mockResolvedValue(undefined);
    const req = new Request('http://localhost/api/social/unfollow', { method: 'POST', body: JSON.stringify({ followable_type: 'Profile', followable_id: 'p1' }), headers: { authorization: 'Bearer 1|a' } });
    const res = await SocialController.unfollow(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.message).toBe('Unfollowed');
  });

  test('feed: returns posts', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.post.findMany.mockResolvedValue([{ id: 'p1' }]);
    const req = new Request('http://localhost/api/social/feed');
    const res = await SocialController.feed(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.data.length).toBe(1);
  });
});
