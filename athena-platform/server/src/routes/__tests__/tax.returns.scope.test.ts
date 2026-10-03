import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Who may change a return filed in an organisation's name.
 *
 * A return carries the id of the member who created it, and that never changes.
 * Edit, submit and delete asked only whether the caller was that member, so a
 * person who had left the business, or been removed from it, could go on
 * rewriting, lodging and deleting its draft BAS returns for as long as they
 * stayed drafts. Membership is asked as well now, and only an accepted
 * membership counts. A personal return is still its owner's alone. The same
 * rows are read from a real database in tests/integration/tenant-isolation.test.ts.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    taxReturn: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    organizationMember: { findFirst: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 'ada', role: 'USER', email: 'ada@athena.com' };
      next();
    },
  };
});

jest.mock('../../middleware/rateLimiter', () => {
  const actual: any = jest.requireActual('../../middleware/rateLimiter');
  return { ...actual, createRateLimiter: () => (_req: any, _res: any, next: any) => next() };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

const ORG = '11111111-1111-4111-8111-111111111111';
const RETURN = '55555555-5555-4555-8555-555555555555';

const draft = (overrides: Record<string, unknown> = {}) => ({
  id: RETURN,
  organizationId: ORG,
  userId: 'ada',
  status: 'DRAFT',
  ...overrides,
});

function onlyAnAcceptedMemberIsFound(accepted: boolean) {
  prisma.organizationMember.findFirst.mockImplementation(async (args: any) =>
    accepted && args.where.acceptedAt?.not === null ? { id: 'm1' } : null
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.taxReturn.update.mockResolvedValue({ id: RETURN });
  prisma.taxReturn.delete.mockResolvedValue({ id: RETURN });
});

describe('a draft return in an organisation’s name', () => {
  it('cannot be edited, submitted or deleted by the member who filed it once she has left', async () => {
    prisma.taxReturn.findUnique.mockResolvedValue(draft());
    onlyAnAcceptedMemberIsFound(false);

    await request(app).patch(`/api/tax/returns/${RETURN}`).send({ reference: 'Rewritten' }).expect(403);
    await request(app).post(`/api/tax/returns/${RETURN}/submit`).expect(403);
    await request(app).delete(`/api/tax/returns/${RETURN}`).expect(403);

    expect(prisma.taxReturn.update).not.toHaveBeenCalled();
    expect(prisma.taxReturn.delete).not.toHaveBeenCalled();
  });

  it('is still the filing member’s to change while she is an accepted member', async () => {
    prisma.taxReturn.findUnique.mockResolvedValue(draft());
    onlyAnAcceptedMemberIsFound(true);

    await request(app).patch(`/api/tax/returns/${RETURN}`).send({ reference: 'Corrected' }).expect(200);
    await request(app).post(`/api/tax/returns/${RETURN}/submit`).expect(200);
    await request(app).delete(`/api/tax/returns/${RETURN}`).expect(204);
  });

  it('is not a colleague’s to change, though she is an accepted member: it is the filer’s', async () => {
    prisma.taxReturn.findUnique.mockResolvedValue(draft({ userId: 'bea' }));
    onlyAnAcceptedMemberIsFound(true);

    await request(app).patch(`/api/tax/returns/${RETURN}`).send({ reference: 'Hers' }).expect(403);
    await request(app).post(`/api/tax/returns/${RETURN}/submit`).expect(403);
    await request(app).delete(`/api/tax/returns/${RETURN}`).expect(403);

    expect(prisma.taxReturn.update).not.toHaveBeenCalled();
    expect(prisma.taxReturn.delete).not.toHaveBeenCalled();
  });
});

describe('a personal return', () => {
  it('is its owner’s to change without any membership, and no one else’s', async () => {
    prisma.taxReturn.findUnique.mockResolvedValue(draft({ organizationId: null }));
    await request(app).patch(`/api/tax/returns/${RETURN}`).send({ reference: 'Mine' }).expect(200);
    expect(prisma.organizationMember.findFirst).not.toHaveBeenCalled();

    prisma.taxReturn.update.mockClear();
    prisma.taxReturn.findUnique.mockResolvedValue(draft({ organizationId: null, userId: 'bea' }));
    await request(app).patch(`/api/tax/returns/${RETURN}`).send({ reference: 'Hers' }).expect(403);
    expect(prisma.taxReturn.update).not.toHaveBeenCalled();
  });
});
