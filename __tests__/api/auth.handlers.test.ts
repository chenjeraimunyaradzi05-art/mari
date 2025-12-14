import { register, login, user, logout, logoutAll, refresh } from '../../src/lib/controllers/Http/Controllers/Api/V1/AuthController';
import { prisma } from '../../src/lib/prisma';
import * as tokens from '../../src/lib/tokens';
import { hash } from 'bcryptjs';

jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn() },
    member: { create: jest.fn() },
    company: { create: jest.fn() },
  },
}));
jest.mock('../../src/lib/tokens');

const mockedPrisma = require('../../src/lib/prisma').prisma;
const mockedTokens = tokens as any;

describe('AuthController', () => {
  beforeEach(() => jest.resetAllMocks());

  test('register: success', async () => {
    mockedPrisma.user = { findUnique: jest.fn(), create: jest.fn() };
    mockedPrisma.member = { create: jest.fn() };
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.com', firstName: 'A', role: 'candidate' });
    mockedPrisma.member.create.mockResolvedValue({ id: 'm1', userId: 'u1' });
    mockedTokens.createPersonalAccessToken.mockResolvedValue('1|plain');

    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ name: 'A', email: 'a@b.com', password: 'secret', role: 'candidate' }) });
    const res = await register(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.token).toBe('1|plain');
  });

  test('login: success', async () => {
    const hashed = await hash('secret', 10);
    mockedPrisma.user = { findUnique: jest.fn() };
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 'u2', email: 'b@c.com', password: hashed, role: 'candidate' });
    mockedTokens.createPersonalAccessToken.mockResolvedValue('2|plain');

    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ email: 'b@c.com', password: 'secret' }) });
    const res = await login(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.data.token).toBe('2|plain');
  });

  test('user: returns user when token present', async () => {
    mockedTokens.getUserFromRequest.mockResolvedValue('u3');
    mockedPrisma.user = { findUnique: jest.fn() };
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 'u3', email: 'u3@x', member: null, company: null });

    const req = new Request('http://localhost', { method: 'GET', headers: { authorization: 'Bearer 1|abc' } });
    const res = await user(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.data.user.id).toBe('u3');
  });

  test('logout: revokes token', async () => {
    mockedTokens.revokePersonalAccessToken.mockResolvedValue(true);
    const req = new Request('http://localhost', { method: 'POST', headers: { authorization: 'Bearer 1|abc' } });
    const res = await logout(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockedTokens.revokePersonalAccessToken).toHaveBeenCalledWith('1|abc');
  });

  test('logoutAll: revokes all for user', async () => {
    mockedTokens.getUserFromRequest.mockResolvedValue('u4');
    mockedTokens.revokeAllPersonalAccessTokensForUser.mockResolvedValue(undefined);
    const req = new Request('http://localhost', { method: 'POST', headers: { authorization: 'Bearer 1|abc' } });
    const res = await logoutAll(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  test('refresh: replaces token', async () => {
    mockedTokens.verifyPersonalAccessToken.mockResolvedValue({ id: 10, tokenable_id: 'u5' });
    mockedTokens.createPersonalAccessToken.mockResolvedValue('3|new');
    mockedTokens.revokePersonalAccessToken.mockResolvedValue(true);

    const req = new Request('http://localhost', { method: 'POST', headers: { authorization: 'Bearer 10|old' } });
    const res = await refresh(req as any, null as any);
    const body = JSON.parse(await res.text());
    expect(res.status).toBe(200);
    expect(body.data.token).toBe('3|new');
  });
});
