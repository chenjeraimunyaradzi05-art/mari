import PostsController from '../../src/lib/controllers/Http/Controllers/Api/V1/PostsController';
import { prisma } from '../../src/lib/prisma';
import * as tokens from '../../src/lib/tokens';

jest.mock('../../src/lib/prisma', () => ({ prisma: { post: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() } } }));
jest.mock('../../src/lib/tokens');

describe('PostsController', () => {
  beforeEach(() => jest.resetAllMocks());

  test('list: returns posts', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.post.findMany.mockResolvedValue([{ id: 'p1' }]);
    const req = new Request('http://localhost/api/posts');
    const res = await PostsController.list(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.data.length).toBe(1);
  });

  test('create: requires auth', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    (tokens.getUserFromRequest as jest.Mock).mockResolvedValue('u1');
    mocked.post.create.mockResolvedValue({ id: 'p2', authorId: 'u1', content: 'hi' });
    const req = new Request('http://localhost/api/posts', { method: 'POST', body: JSON.stringify({ content: 'hi' }), headers: { authorization: 'Bearer 1|a' } });
    const res = await PostsController.create(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(201);
    expect(body.data.authorId).toBe('u1');
  });

  test('delete: requires owner', async () => {
    const mocked = require('../../src/lib/prisma').prisma;
    (tokens.getUserFromRequest as jest.Mock).mockResolvedValue('u1');
    mocked.post.findUnique.mockResolvedValue({ id: 'p2', authorId: 'u1' });
    mocked.post.delete.mockResolvedValue({});
    const req = new Request('http://localhost/api/posts/p2', { method: 'DELETE', headers: { authorization: 'Bearer 1|a' } });
    const res = await PostsController.remove(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.message).toBe('Deleted');
  });
});
