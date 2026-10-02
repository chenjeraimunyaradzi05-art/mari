/**
 * Safe-chat messages, health entries, medications, health notes and booking
 * reasons are kept sealed. A data export that copied those rows as they stand
 * would hand a member back ciphertext: a file that satisfies the request in
 * name and tells her nothing, which is what the export did until each of those
 * tables was given a way to open its sealed column. The export has to read them
 * the way her own pages do, and never put a sealed string in the bundle.
 */

jest.mock('../../utils/prisma', () => {
  const dedicated: Record<string, any> = {
    dSARRequest: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn() },
    privacyAuditLog: { create: jest.fn(), findMany: jest.fn(async () => []) },
    dvSafeMessage: { findMany: jest.fn() },
    healthEntry: { findMany: jest.fn() },
    medication: { findMany: jest.fn() },
    healthNote: { findMany: jest.fn() },
    healthBooking: { findMany: jest.fn() },
  };
  // Every other table in the register reads as empty.
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

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { gdprService, PERSONAL_DATA_MODELS } from '../gdpr.service';
import { prisma as prismaTyped } from '../../utils/prisma';
import { encryptMessage } from '../dv-safe.service';
import { encryptJson } from '../wellness/health-crypto';

const prisma: any = prismaTyped;
const KEY = '21c983cb1baec38efae62af1e84dc644fdc9306f8b190a8e76dd98eed44be44b';
const OTHER_KEY = '1e7668712a2dfacf98da6906a9b348287f7013dbba1cd6f6421e36f7273132e1';

describe('The data export and what is kept sealed', () => {
  const env = { ...process.env };
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env, NODE_ENV: 'test', DV_ENCRYPTION_KEY: KEY };
    delete process.env.HEALTH_ENCRYPTION_KEY;
    prisma.dSARRequest.findUnique.mockResolvedValue({ id: 'dsar-1', userId: 'her' });
    prisma.dSARRequest.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({ id: 'her', email: 'her@athena.test' });
    prisma.privacyAuditLog.create.mockResolvedValue({});
    for (const model of ['dvSafeMessage', 'healthEntry', 'medication', 'healthNote', 'healthBooking']) {
      prisma[model].findMany.mockResolvedValue([]);
    }
  });
  afterEach(() => {
    process.env = env;
  });

  it('hands her the safe-chat messages she wrote as text, not as ciphertext', async () => {
    prisma.dvSafeMessage.findMany.mockResolvedValue([
      { id: 'm1', chatId: 'c1', senderId: 'her', content: encryptMessage('Leave Tuesday, keys with Mum'), createdAt: new Date('2026-09-01') },
    ]);

    const { data } = await gdprService.processExportRequest('dsar-1');

    const [message]: any[] = data.records.dvSafeMessagesSent;
    expect(message.content).toBe('Leave Tuesday, keys with Mum');
    expect(message.senderId).toBe('her');
    expect(JSON.stringify(data)).not.toContain('enc:v1:');
    expect(prisma.dvSafeMessage.findMany).toHaveBeenCalledWith({ where: { senderId: 'her' } });
  });

  it('opens a message written before sealed values carried a version mark', async () => {
    const withoutMark = encryptMessage('An older message').slice('enc:v1:'.length);
    prisma.dvSafeMessage.findMany.mockResolvedValue([{ id: 'm1', chatId: 'c1', senderId: 'her', content: withoutMark }]);

    const { data } = await gdprService.processExportRequest('dsar-1');

    expect((data.records.dvSafeMessagesSent[0] as any).content).toBe('An older message');
  });

  it('hands her each health record opened: entries, medications, notes and the reason for a booking', async () => {
    prisma.healthEntry.findMany.mockResolvedValue([
      { id: 'e1', userId: 'her', kind: 'CHECKIN', day: new Date('2026-09-10'), payload: encryptJson({ mood: 2, note: 'a hard week' }) },
    ]);
    prisma.medication.findMany.mockResolvedValue([
      { id: 'd1', userId: 'her', details: encryptJson({ name: 'Iron', dose: '50 mg' }), times: ['08:00'] },
    ]);
    prisma.healthNote.findMany.mockResolvedValue([
      { id: 'n1', userId: 'her', content: encryptJson({ title: 'GP visit', body: 'Ask about the blood test' }) },
    ]);
    prisma.healthBooking.findMany.mockResolvedValue([
      { id: 'b1', userId: 'her', reason: encryptJson({ text: 'Trouble sleeping since March' }), status: 'CONFIRMED' },
      { id: 'b2', userId: 'her', reason: null, status: 'CONFIRMED' },
    ]);

    const { data } = await gdprService.processExportRequest('dsar-1');

    const records: any = data.records;
    expect(records.healthEntries[0].payload).toEqual({ mood: 2, note: 'a hard week' });
    expect(records.healthEntries[0].kind).toBe('CHECKIN');
    expect(records.medications[0].details).toEqual({ name: 'Iron', dose: '50 mg' });
    expect(records.medications[0].times).toEqual(['08:00']);
    expect(records.healthNotes[0].content).toEqual({ title: 'GP visit', body: 'Ask about the blood test' });
    expect(records.healthBookings[0].reason).toBe('Trouble sleeping since March');
    expect(records.healthBookings[1].reason).toBeNull();
    expect(records.healthBookings[1].unreadable).toBeUndefined();

    const bundle = JSON.stringify(data);
    expect(bundle).not.toContain('enc:v1:');
    // Nothing in it is base64 of a sealed value either: the readable text is all there is.
    expect(bundle).toContain('Trouble sleeping since March');
  });

  it('says so, rather than showing bytes, when a record was sealed under a key this host no longer has', async () => {
    process.env.DV_ENCRYPTION_KEY = OTHER_KEY;
    const sealedElsewhere = encryptJson({ mood: 1 });
    const messageElsewhere = encryptMessage('Lost');
    process.env.DV_ENCRYPTION_KEY = KEY;
    prisma.healthEntry.findMany.mockResolvedValue([{ id: 'e1', userId: 'her', kind: 'CHECKIN', payload: sealedElsewhere }]);
    prisma.dvSafeMessage.findMany.mockResolvedValue([{ id: 'm1', senderId: 'her', content: messageElsewhere }]);

    const { data } = await gdprService.processExportRequest('dsar-1');

    const records: any = data.records;
    expect(records.healthEntries[0].payload).toBeNull();
    expect(records.healthEntries[0].unreadable).toEqual(['payload']);
    expect(records.dvSafeMessagesSent[0].content).toBeNull();
    expect(records.dvSafeMessagesSent[0].unreadable).toEqual(['content']);
    expect(JSON.stringify(data)).not.toContain('enc:v1:');
    expect(JSON.stringify(data)).not.toContain(sealedElsewhere.slice('enc:v1:'.length, 40));
  });

  it('opens what a retired key sealed while a rotation is under way', async () => {
    const underOldKey = encryptJson({ mood: 3 });
    process.env.DV_ENCRYPTION_KEY = OTHER_KEY;
    process.env.DV_ENCRYPTION_KEY_PREVIOUS = KEY;
    prisma.healthEntry.findMany.mockResolvedValue([{ id: 'e1', userId: 'her', kind: 'CHECKIN', payload: underOldKey }]);

    const { data } = await gdprService.processExportRequest('dsar-1');

    expect((data.records.healthEntries[0] as any).payload).toEqual({ mood: 3 });
  });

  it('does not describe other people in a safe chat, because there are none', () => {
    const reasons = PERSONAL_DATA_MODELS.filter((entry) => entry.section.startsWith('dvSafe'))
      .map((entry) => entry.reason ?? '')
      .join(' ');

    expect(reasons).not.toMatch(/other people in it|belonging to another member|names the other people/);
    expect(reasons).toMatch(/one member/);
  });
});
