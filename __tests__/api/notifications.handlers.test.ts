import NotificationsController from '../../src/lib/controllers/Http/Controllers/Api/V1/NotificationsController';
import { prisma } from '../../src/lib/prisma';
import * as tokens from '../../src/lib/tokens';

jest.mock('../../src/lib/prisma', () => ({ prisma: { notification: { findMany: jest.fn(), updateMany: jest.fn() } } }));
jest.mock('../../src/lib/tokens');

describe('NotificationsController', () => {
  beforeEach(() => jest.resetAllMocks());

  test('list: requires auth', async () => {
    (tokens.getUserFromRequest as jest.Mock).mockResolvedValue('u1');
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.notification.findMany.mockResolvedValue([{ id: 'n1' }]);
    const req = new Request('http://localhost/api/notifications', { headers: { authorization: 'Bearer 1|a' } });
    const res = await NotificationsController.list(req as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
  });

  test('markRead: updates notifications', async () => {
    (tokens.getUserFromRequest as jest.Mock).mockResolvedValue('u1');
    const mocked = require('../../src/lib/prisma').prisma;
    mocked.notification.updateMany.mockResolvedValue(undefined);
    const req = new Request('http://localhost/api/notifications', { method: 'POST', body: JSON.stringify({ ids: ['n1'] }), headers: { authorization: 'Bearer 1|a' } });
    const res = await NotificationsController.markRead(req as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
  });
});
