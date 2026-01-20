import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    businessRegistration: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from '../../utils/prisma';
import { submitRegistration } from '../formation.service';

describe('submitRegistration validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws 404 when registration not found', async () => {
    (prisma.businessRegistration.findUnique as any).mockResolvedValue(null);

    await expect(submitRegistration('user-1', 'reg-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws 403 when user does not own registration', async () => {
    (prisma.businessRegistration.findUnique as any).mockResolvedValue({
      id: 'reg-1',
      userId: 'someone-else',
      type: 'SOLE_TRADER',
      status: 'DRAFT',
      businessName: 'Acme',
      data: {},
    });

    await expect(submitRegistration('user-1', 'reg-1')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('throws 400 when status is not submittable', async () => {
    (prisma.businessRegistration.findUnique as any).mockResolvedValue({
      id: 'reg-1',
      userId: 'user-1',
      type: 'SOLE_TRADER',
      status: 'SUBMITTED',
      businessName: 'Acme',
      data: {},
    });

    await expect(submitRegistration('user-1', 'reg-1')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws 400 when business name is missing', async () => {
    (prisma.businessRegistration.findUnique as any).mockResolvedValue({
      id: 'reg-1',
      userId: 'user-1',
      type: 'SOLE_TRADER',
      status: 'DRAFT',
      businessName: null,
      data: {},
    });

    await expect(submitRegistration('user-1', 'reg-1')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws 400 for COMPANY when missing people/address details', async () => {
    (prisma.businessRegistration.findUnique as any).mockResolvedValue({
      id: 'reg-1',
      userId: 'user-1',
      type: 'COMPANY',
      status: 'DRAFT',
      businessName: 'Acme Pty Ltd',
      data: {},
    });

    await expect(submitRegistration('user-1', 'reg-1')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('submits COMPANY when minimum details are present', async () => {
    const reg = {
      id: 'reg-1',
      userId: 'user-1',
      type: 'COMPANY',
      status: 'DRAFT',
      businessName: 'Acme Pty Ltd',
      data: {
        directors: [{ name: 'Director One' }],
        registeredAddress: { line1: '123 Test St', city: 'Sydney' },
      },
    };

    (prisma.businessRegistration.findUnique as any).mockResolvedValue(reg);
    (prisma.businessRegistration.update as any).mockResolvedValue({
      ...reg,
      status: 'SUBMITTED',
      submittedAt: new Date('2026-01-01'),
    });

    const result = await submitRegistration('user-1', 'reg-1');

    expect(prisma.businessRegistration.update).toHaveBeenCalled();
    expect(result.status).toBe('SUBMITTED');
  });
});
