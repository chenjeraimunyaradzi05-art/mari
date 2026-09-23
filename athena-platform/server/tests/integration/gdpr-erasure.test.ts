/**
 * The right to erasure, against rows that actually exist.
 *
 * `GDPRService.eraseUser` is a single `prisma.$transaction` that walks a
 * register of 123 delegates and then issues two raw `array_remove` statements.
 * Nothing in the repository has ever executed it. A mocked test cannot: the
 * register is walked by name, `delegateFor` looks each model up on the client
 * at runtime, and a `jest.fn()` reports whatever count the test handed it — so
 * a register entry naming a column the table does not have, an entry whose
 * `where` matches nothing, and a table missing from the register altogether all
 * look identical to a mock, and all three mean a member's data survives a
 * request to delete it.
 *
 * The tables singled out below are the ones that were missing from the register
 * until recently and the ones where being wrong is worst: her covert safe
 * chats, her panic-alert history, her health record (Article 9 special
 * category, APP 3 sensitive information) and her bank feed. For a member who
 * left because she is being looked for, "we deleted your account" has to be
 * true about the safe chats too.
 */

import { HealthEntryKind } from '@prisma/client';
import { describeIntegration, createMember, resetDatabase } from './setup/harness';
import { prisma } from '../../src/utils/prisma';
import { gdprService } from '../../src/services/gdpr.service';

async function openDeletionRequest(userId: string) {
  return prisma.dSARRequest.create({
    data: {
      userId,
      type: 'DELETION',
      identityVerified: true,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
}

/**
 * A member with something in every area the erasure has to reach. Kept in one
 * place so a test can say which table it is about without re-seeding the world.
 */
async function seedMemberWithEverything() {
  const member = await createMember({ firstName: 'Nadia', lastName: 'Okonkwo' });

  const safety = await prisma.dvSafetyProfile.create({
    data: {
      userId: member.id,
      panicButtonEnabled: true,
      emergencyContacts: [{ id: '1', name: 'Sister', phone: '0400000000', notifyOnPanic: true }],
    },
  });

  const safeChat = await prisma.dvSafeChat.create({
    data: { profileId: safety.id, name: 'Sister', disguisedName: 'Shopping List', participants: [member.id] },
  });

  await prisma.dvSafeMessage.create({
    data: { chatId: safeChat.id, senderId: member.id, content: 'encrypted-blob' },
  });

  await prisma.dvPanicAlert.create({
    data: { profileId: safety.id, notifiedContacts: ['Sister'] },
  });

  await prisma.healthSettings.create({
    data: { userId: member.id, trackers: { period: true, symptoms: true } },
  });

  await prisma.healthEntry.create({
    data: {
      userId: member.id,
      kind: HealthEntryKind.SYMPTOM,
      day: new Date('2026-09-01'),
      payload: 'encrypted-blob',
    },
  });

  await prisma.healthNote.create({
    data: { userId: member.id, content: 'encrypted-blob' },
  });

  const connection = await prisma.bankConnection.create({
    data: { userId: member.id, provider: 'CSV', institution: 'Bank of Queensland' },
  });

  const account = await prisma.bankAccount.create({
    data: { connectionId: connection.id, providerAccountId: 'acc-1', name: 'Everyday', bsb: '124001' },
  });

  await prisma.bankTransaction.create({
    data: {
      bankAccountId: account.id,
      fingerprint: 'fp-1',
      postedAt: new Date('2026-09-02'),
      description: 'Rent',
      amountCents: -195000,
    },
  });

  await prisma.notification.create({
    data: { userId: member.id, type: 'SYSTEM', title: 'Welcome', message: 'Welcome to ATHENA' },
  });

  return { member, safety, safeChat, connection, account };
}

describeIntegration('erasing a member', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('removes the DV-safe, health and banking rows, not only the account', async () => {
    const { member, safeChat, connection, account } = await seedMemberWithEverything();
    const dsar = await openDeletionRequest(member.id);

    const outcome = await gdprService.processDeletionRequest(dsar.id);

    expect(outcome.status).toBe('COMPLETED');
    expect(outcome.accountRemoved).toBe(true);
    expect(outcome.rowsRemoved).toBeGreaterThan(0);

    expect(await prisma.user.findUnique({ where: { id: member.id } })).toBeNull();

    // The domestic-violence tables. These hang off DvSafetyProfile rather than
    // off the account, which is how they came to be missing from the register:
    // an erasure used to leave a member's safe chats, her panic history and her
    // emergency contacts on the platform.
    expect(await prisma.dvSafetyProfile.count({ where: { userId: member.id } })).toBe(0);
    expect(await prisma.dvSafeChat.count({ where: { id: safeChat.id } })).toBe(0);
    expect(await prisma.dvSafeMessage.count({ where: { chatId: safeChat.id } })).toBe(0);
    expect(await prisma.dvPanicAlert.count()).toBe(0);

    // Health: Article 9 special category data, and the reason a gap here
    // matters more than a gap in saved jobs.
    expect(await prisma.healthSettings.count({ where: { userId: member.id } })).toBe(0);
    expect(await prisma.healthEntry.count({ where: { userId: member.id } })).toBe(0);
    expect(await prisma.healthNote.count({ where: { userId: member.id } })).toBe(0);

    // Banking, reached only through two levels of parent row.
    expect(await prisma.bankConnection.count({ where: { id: connection.id } })).toBe(0);
    expect(await prisma.bankAccount.count({ where: { id: account.id } })).toBe(0);
    expect(await prisma.bankTransaction.count({ where: { bankAccountId: account.id } })).toBe(0);

    expect(await prisma.notification.count({ where: { userId: member.id } })).toBe(0);
  });

  it('leaves the record that the request was honoured, since the DSAR row goes too', async () => {
    const { member } = await seedMemberWithEverything();
    const dsar = await openDeletionRequest(member.id);

    await gdprService.processDeletionRequest(dsar.id);

    // The DSAR row is itself personal data and is erased with the rest, so
    // PrivacyAuditLog — which has no foreign key to User — is the only
    // surviving proof the right was honoured.
    expect(await prisma.dSARRequest.count({ where: { id: dsar.id } })).toBe(0);

    const proof = await prisma.privacyAuditLog.findFirst({
      where: { action: 'DSAR_ERASURE_COMPLETED', resourceId: dsar.id },
    });
    expect(proof).not.toBeNull();
    expect(proof?.details).toMatchObject({ accountRemoved: true });
  });

  it('takes her out of another member\'s safe chat and of feature-flag lists', async () => {
    const { member } = await seedMemberWithEverything();
    const other = await createMember({ firstName: 'Priya' });
    const otherSafety = await prisma.dvSafetyProfile.create({ data: { userId: other.id } });
    const sharedChat = await prisma.dvSafeChat.create({
      data: { profileId: otherSafety.id, name: 'Friends', participants: [other.id, member.id] },
    });
    const herMessageInHerFriendsChat = await prisma.dvSafeMessage.create({
      data: { chatId: sharedChat.id, senderId: member.id, content: 'encrypted-blob' },
    });

    const flag = await prisma.featureFlag.create({
      data: { key: 'wellness-beta', name: 'Wellness beta', allowList: [member.id, other.id], denyList: [member.id], tags: [] },
    });

    const dsar = await openDeletionRequest(member.id);
    await gdprService.processDeletionRequest(dsar.id);

    // Participant lists are bare id arrays, which Prisma cannot filter inside;
    // the erasure reaches them with a raw `array_remove`. Nothing else in the
    // repository executes raw SQL under test.
    const chatAfter = await prisma.dvSafeChat.findUniqueOrThrow({ where: { id: sharedChat.id } });
    expect(chatAfter.participants).toEqual([other.id]);

    const flagAfter = await prisma.featureFlag.findUniqueOrThrow({ where: { id: flag.id } });
    expect(flagAfter.allowList).toEqual([other.id]);
    expect(flagAfter.denyList).toEqual([]);

    // Her message in someone else's chat survives — the other women's
    // conversation is not hers to delete — but it no longer names her. The
    // register pseudonymises rather than detaches because senderId is not
    // nullable and carries no foreign key.
    const messageAfter = await prisma.dvSafeMessage.findUniqueOrThrow({
      where: { id: herMessageInHerFriendsChat.id },
    });
    expect(messageAfter.senderId).not.toBe(member.id);
    expect(messageAfter.senderId).toMatch(/^[0-9a-f]{64}$/);
  });

  it('leaves a shell rather than a hole when a tax record still points at her', async () => {
    const { member } = await seedMemberWithEverything();

    // Seven-year retention. While a row like this exists the account row cannot
    // be dropped, only stripped back.
    await prisma.payment.create({
      data: { userId: member.id, amount: '49.00', currency: 'AUD', status: 'COMPLETED', type: 'subscription' },
    });

    const dsar = await openDeletionRequest(member.id);
    const outcome = await gdprService.processDeletionRequest(dsar.id);

    expect(outcome.accountRemoved).toBe(false);
    expect(outcome.retainedSections).toContain('payments');

    const shell = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(shell.firstName).toBe('Erased');
    expect(shell.lastName).toBe('account');
    // The reserved .invalid domain, so nothing can ever be delivered to it.
    expect(shell.email).toMatch(/^erased-[0-9a-f]{32}@erased\.invalid$/);
    expect(shell.isActive).toBe(false);
    expect(shell.passwordHash).toBeNull();

    // A shell is not an excuse to keep the sensitive tables.
    expect(await prisma.dvSafetyProfile.count({ where: { userId: member.id } })).toBe(0);
    expect(await prisma.healthEntry.count({ where: { userId: member.id } })).toBe(0);
    expect(await prisma.bankConnection.count({ where: { userId: member.id } })).toBe(0);
  });

  it('reports rather than repeats when the same request is processed twice', async () => {
    const { member } = await seedMemberWithEverything();
    const dsar = await openDeletionRequest(member.id);

    const first = await gdprService.processDeletionRequest(dsar.id);
    const second = await gdprService.processDeletionRequest(dsar.id);

    expect(first.status).toBe('COMPLETED');
    expect(second.status).toBe('ALREADY_COMPLETED');
    expect(second.accountRemoved).toBe(true);

    // One erasure, one audit entry. A scheduler that retries a request must not
    // be able to write a second "we did this" record for work it did not do.
    expect(
      await prisma.privacyAuditLog.count({
        where: { action: 'DSAR_ERASURE_COMPLETED', resourceId: dsar.id },
      })
    ).toBe(1);
  });

  it('refuses while a legal hold names her, and says why', async () => {
    const { member } = await seedMemberWithEverything();
    const hold = await prisma.legalHold.create({
      data: {
        name: 'QPS preservation notice',
        caseReference: 'QPS-2026-0001',
        reason: 'Preservation notice',
        affectedUserIds: [member.id],
        affectedDataTypes: ['messages'],
        isActive: true,
        authorizedBy: 'legal@athena.test',
      },
    });

    const dsar = await openDeletionRequest(member.id);
    const outcome = await gdprService.processDeletionRequest(dsar.id);

    expect(outcome.status).toBe('REJECTED');
    expect(outcome.reason).toContain(hold.id);
    expect(await prisma.user.count({ where: { id: member.id } })).toBe(1);
    expect(await prisma.healthEntry.count({ where: { userId: member.id } })).toBe(1);

    // Article 12(4): a refusal is part of handling the request, and we have to
    // be able to say why.
    expect(
      await prisma.privacyAuditLog.count({ where: { action: 'DSAR_ERASURE_REJECTED', resourceId: dsar.id } })
    ).toBe(1);
  });
});
