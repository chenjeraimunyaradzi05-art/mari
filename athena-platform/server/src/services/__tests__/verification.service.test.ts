import { hashOpaqueToken } from '../../utils/opaqueToken';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    verificationBadge: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    follow: {
      count: jest.fn(),
    },
    post: {
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../socket.service', () => ({
  sendNotification: jest.fn(async () => undefined),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { prisma } from '../../utils/prisma';
import { sendNotification } from '../socket.service';
import { submitVerification, verifyEmailCode } from '../verification.service';

const prismaAny: any = prisma;
const sendNotificationMock = sendNotification as jest.Mock;

describe('verification service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores employer email verification challenges in badge metadata', async () => {
    prismaAny.verificationBadge.findFirst.mockResolvedValue(null);
    prismaAny.verificationBadge.create.mockResolvedValue({
      id: 'verification-1',
      createdAt: new Date('2026-03-23T00:00:00.000Z'),
      metadata: {
        documents: [{ id: 'doc-1', type: 'work_email', email: 'team@athena.com' }],
      },
    });
    prismaAny.verificationBadge.findUnique.mockResolvedValue({
      id: 'verification-1',
      metadata: {
        documents: [{ id: 'doc-1', type: 'work_email', email: 'team@athena.com' }],
      },
    });
    prismaAny.verificationBadge.update.mockResolvedValue({
      id: 'verification-1',
    });

    await submitVerification('user-1', 'EMPLOYER', [
      { type: 'work_email', email: 'team@athena.com' },
    ]);

    expect(prismaAny.verificationBadge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'verification-1' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            documents: expect.any(Array),
            emailVerification: expect.objectContaining({
              codeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
              email: 'team@athena.com',
              type: 'EMPLOYER',
            }),
          }),
        }),
      })
    );
    expect(sendNotificationMock).toHaveBeenCalled();
  });

  it('verifies email codes from persisted badge metadata', async () => {
    prismaAny.verificationBadge.findUnique.mockResolvedValue({
      id: 'verification-2',
      metadata: {
        documents: [{ id: 'doc-1', type: 'work_email', email: 'team@athena.com' }],
        emailVerification: {
          codeHash: hashOpaqueToken('ABC123'),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          email: 'team@athena.com',
          type: 'EMPLOYER',
        },
      },
    });
    prismaAny.verificationBadge.update.mockResolvedValue({
      id: 'verification-2',
      status: 'APPROVED',
    });

    const result = await verifyEmailCode('verification-2', 'abc123');

    expect(result).toEqual({
      success: true,
      message: 'Email verified successfully!',
    });
    expect(prismaAny.verificationBadge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'verification-2' },
        data: expect.objectContaining({
          status: 'APPROVED',
          metadata: expect.objectContaining({
            documents: expect.any(Array),
          }),
        }),
      })
    );
    expect(
      prismaAny.verificationBadge.update.mock.calls[0][0].data.metadata.emailVerification
    ).toBeUndefined();
  });
});
