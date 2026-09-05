import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

jest.mock('../../utils/jwt', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../../services/session.service', () => ({
  sessionService: { findActiveSessionByAccessToken: jest.fn() },
}));

import { prisma as prismaTyped } from '../../utils/prisma';
import { verifyToken } from '../../utils/jwt';
import { sessionService } from '../../services/session.service';
import { authenticateSocketToken, SUSPENDED_ACCOUNT_MESSAGE } from '../auth';

const prisma: any = prismaTyped;
const verify: any = verifyToken;
const sessions: any = sessionService;

const user = (overrides: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'u@athena.com',
  role: 'USER',
  persona: 'PROFESSIONAL',
  isSuspended: false,
  ...overrides,
});

describe('Socket authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verify.mockReturnValue({ userId: 'u1', email: 'u@athena.com', role: 'USER', persona: 'PROFESSIONAL' });
  });

  it('accepts a token whose session is live and whose account is in good standing', async () => {
    sessions.findActiveSessionByAccessToken.mockResolvedValue({ id: 's1', userId: 'u1' });
    prisma.user.findUnique.mockResolvedValue(user());

    await expect(authenticateSocketToken('tok')).resolves.toEqual({
      id: 'u1',
      email: 'u@athena.com',
      role: 'USER',
      persona: 'PROFESSIONAL',
    });
  });

  it('refuses a well-formed token whose session was logged out or revoked', async () => {
    sessions.findActiveSessionByAccessToken.mockResolvedValue(null);
    await expect(authenticateSocketToken('tok')).rejects.toMatchObject({ statusCode: 401 });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('refuses a session that belongs to a different account than the token claims', async () => {
    sessions.findActiveSessionByAccessToken.mockResolvedValue({ id: 's1', userId: 'someone-else' });
    await expect(authenticateSocketToken('tok')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('refuses a suspended account with the same wording as the HTTP middleware', async () => {
    sessions.findActiveSessionByAccessToken.mockResolvedValue({ id: 's1', userId: 'u1' });
    prisma.user.findUnique.mockResolvedValue(user({ isSuspended: true }));
    await expect(authenticateSocketToken('tok')).rejects.toMatchObject({ statusCode: 403, message: SUSPENDED_ACCOUNT_MESSAGE });
  });

  it('refuses a token that does not verify', async () => {
    verify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });
    await expect(authenticateSocketToken('garbage')).rejects.toThrow('jwt malformed');
    expect(sessions.findActiveSessionByAccessToken).not.toHaveBeenCalled();
  });
});
