/**
 * DELETE /admin/users/:id, both branches, neither of which had a test.
 *
 * The hard branch used to be a seven-table transaction — comments, likes,
 * posts, notifications, job applications, saved jobs, then the user row —
 * against a personal-data register naming more than sixty tables, and it never
 * consulted LegalHold. The member's own right-to-be-forgotten refuses under an
 * active hold and says why; the admin console destroyed the data anyway. No UI
 * reached it, so it was a trap rather than an incident, but any administrator
 * with curl could spring it.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { update: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-123', role: 'ADMIN', email: 'admin@athena.test' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import app from '../../index';
import { prisma } from '../../utils/prisma';
import { gdprService } from '../../services/gdpr.service';

const prismaAny: any = prisma;

describe('DELETE /api/admin/users/:id', () => {
  let erase: jest.SpiedFunction<typeof gdprService.eraseAccountByAdmin>;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    prismaAny.user.update.mockResolvedValue({ id: 'member-1' });
    prismaAny.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    erase = jest.spyOn(gdprService, 'eraseAccountByAdmin');
  });

  it('refuses a hard delete of an account under an active legal hold', async () => {
    erase.mockResolvedValue({
      requestId: 'ADMIN-ERASURE-member-1',
      status: 'REJECTED',
      accountRemoved: false,
      retainedSections: [],
      rowsRemoved: 0,
      reason: 'Cannot delete: active legal hold (hold-1)',
    });

    const res = await request(app).delete('/api/admin/users/member-1?hard=true');

    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toContain('legal hold');
    // Nothing is destroyed and nothing is recorded as destroyed.
    expect(prismaAny.auditLog.create).not.toHaveBeenCalled();
  });

  it('runs the full personal-data erasure rather than the old seven tables', async () => {
    erase.mockResolvedValue({
      requestId: 'ADMIN-ERASURE-member-1',
      status: 'COMPLETED',
      accountRemoved: true,
      retainedSections: [],
      rowsRemoved: 412,
    });

    const res = await request(app).delete('/api/admin/users/member-1?hard=true');

    expect(res.status).toBe(200);
    expect(erase).toHaveBeenCalledWith('member-1', expect.objectContaining({ adminId: 'admin-123' }));
    expect(res.body.data.rowsRemoved).toBe(412);
    expect(prismaAny.auditLog.create).toHaveBeenCalled();
  });

  it('parks a soft-deleted account on an undeliverable address that does not carry her id', async () => {
    const res = await request(app).delete('/api/admin/users/member-1');

    expect(res.status).toBe(200);
    const email = prismaAny.user.update.mock.calls[0][0].data.email;
    expect(email).toMatch(/@erased\.invalid$/);
    expect(email).not.toContain('member-1');
    expect(email).not.toContain('athena.local');
    expect(erase).not.toHaveBeenCalled();
  });
});
