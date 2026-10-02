/**
 * What an erased account keeps, and what a data export tells her.
 *
 * Two things the member's own "delete my account" used to settle on its own, in
 * a hand-written tombstone that sat beside the register-driven one. That
 * transaction is gone (DELETE /users/me now runs the data-rights erasure), so
 * the one tombstone that remains has to clear everything the old one did, and
 * the export has to hand back her date of birth, which is personal information
 * held about her like any other.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../utils/prisma', () => {
  const dedicated: Record<string, any> = {
    dSARRequest: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn() },
    privacyAuditLog: { create: jest.fn(), findMany: jest.fn(async () => []) },
  };
  const prisma = new Proxy(dedicated, {
    get: (target, name: string) => {
      if (!(name in target)) target[name] = { findMany: jest.fn(async () => []) };
      return target[name];
    },
  });
  return { prisma };
});

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { gdprService } from '../gdpr.service';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;

describe('the shell an erased account is stripped back to', () => {
  const tombstone = (gdprService as any).tombstoneFields('a'.repeat(64)) as Record<string, any>;

  it('clears the authenticator secret and the recovery codes, so no live second factor outlives the account', () => {
    expect(tombstone).toMatchObject({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorEnabledAt: null });
    expect(tombstone.twoFactorRecoveryCodes).toEqual({ set: [] });
  });

  it('clears both OAuth subject identifiers, which are unique columns', () => {
    // Leaving them meant the same Google or Facebook account could never sign
    // up again: the deleted row still owned them.
    expect(tombstone).toMatchObject({ googleId: null, facebookId: null });
  });

  it('clears the women-only record rather than leaving a finding about her on file', () => {
    expect(tombstone).toMatchObject({
      womanSelfAttested: false,
      womanVerificationStatus: 'UNVERIFIED',
      womanVerifiedAt: null,
    });
  });

  it('clears her date of birth and the record that a document check confirmed it', () => {
    // For an account closed because its holder was under 18, her age is the one
    // personal fact the closure itself was about.
    expect(tombstone).toMatchObject({ dateOfBirth: null, ageVerifiedAt: null });
  });

  it('clears the consent flags and the payout account link', () => {
    expect(tombstone).toMatchObject({
      consentMarketing: false,
      consentDataProcessing: false,
      consentCookies: false,
      stripeConnectAccountId: null,
      stripeConnectStatus: null,
    });
  });

  it('shuts the account and anonymises the identifying columns, on an address that can never be delivered to', () => {
    expect(tombstone).toMatchObject({
      isSuspended: true,
      isActive: false,
      isPublic: false,
      allowMessages: false,
      passwordHash: null,
      firstName: 'Erased',
      displayName: null,
    });
    expect(String(tombstone.email)).toMatch(/^erased-[a-f0-9]{32}@erased\.invalid$/);
  });
});

describe('the data export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.dSARRequest.findUnique.mockResolvedValue({ id: 'dsar-1', userId: 'her' });
    prisma.dSARRequest.update.mockResolvedValue({});
    prisma.privacyAuditLog.create.mockResolvedValue({});
  });

  it('includes her date of birth and when a document check confirmed it', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'her',
      email: 'her@athena.test',
      dateOfBirth: new Date('1991-03-14T00:00:00.000Z'),
      ageVerifiedAt: new Date('2026-09-20T02:00:00.000Z'),
    });

    const { data } = await gdprService.processExportRequest('dsar-1');

    expect(data.account).toMatchObject({
      dateOfBirth: new Date('1991-03-14T00:00:00.000Z'),
      ageVerifiedAt: new Date('2026-09-20T02:00:00.000Z'),
    });
  });

  it('still never carries a credential: not the password hash, the authenticator secret or the recovery codes', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'her',
      email: 'her@athena.test',
      passwordHash: '$2b$12$secret',
      twoFactorSecret: 'sealed-seed',
      twoFactorRecoveryCodes: ['hash-1', 'hash-2'],
      dateOfBirth: new Date('1991-03-14T00:00:00.000Z'),
    });

    const { data } = await gdprService.processExportRequest('dsar-1');

    const account = data.account as Record<string, unknown>;
    expect(account).not.toHaveProperty('passwordHash');
    expect(account).not.toHaveProperty('twoFactorSecret');
    expect(account).not.toHaveProperty('twoFactorRecoveryCodes');
    expect(JSON.stringify(data)).not.toContain('sealed-seed');
  });
});
