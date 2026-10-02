/**
 * Noticing the account that messages women who do not want it.
 *
 * The request gate limits what a stranger can do to one woman: three lines,
 * then silence, and a decline closes the thread. Nothing counted those answers
 * against the person on the other end, so an account could open a request to a
 * new woman every day, be declined by all of them, and never reach a moderator.
 * The count is a signal for a person to look at, not a penalty: a number of
 * other people's clicks must not be something anyone can arrange to silence a
 * woman, so nothing here restricts the account.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    conversation: { findMany: jest.fn() },
    userSafetySettings: { findMany: jest.fn() },
    contentReport: { findMany: jest.fn() },
    adminFlag: { findFirst: jest.fn(), create: jest.fn() },
  },
}));

const notifyAdmins = jest.fn(async (..._args: unknown[]) => 1);
jest.mock('../admin-notify.service', () => ({ notifyAdmins: (...args: unknown[]) => notifyAdmins(...args) }));

jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { prisma } from '../../utils/prisma';
import {
  UNWANTED_CONTACT_FLAG,
  UNWANTED_CONTACT_THRESHOLD,
  UNWANTED_CONTACT_WINDOW_DAYS,
  reviewUnwantedContact,
  unwantedContactSignal,
} from '../unwanted-contact.service';

const db: any = prisma;
const NOW = new Date('2026-10-01T03:00:00Z');
const SENDER = 'sender-1';

/** A thread the sender opened, with the woman she opened it to. */
const request = (other: string, declined = false) => ({
  requestDeclinedAt: declined ? new Date('2026-09-30T00:00:00Z') : null,
  participants: [{ userId: SENDER }, { userId: other }],
});

function given({
  threads = [] as ReturnType<typeof request>[],
  blockers = [] as string[],
  reporters = [] as string[],
} = {}) {
  db.conversation.findMany.mockResolvedValue(threads);
  db.userSafetySettings.findMany.mockResolvedValue(blockers.map((userId) => ({ userId })));
  db.contentReport.findMany.mockResolvedValue(reporters.map((reporterId) => ({ reporterId })));
}

beforeEach(() => {
  jest.clearAllMocks();
  db.adminFlag.findFirst.mockResolvedValue(null);
  db.adminFlag.create.mockResolvedValue({ id: 'flag-1' });
  given();
});

describe('counting who said no', () => {
  it('counts different women across declines, blocks and reports, and counts one woman once', async () => {
    given({
      threads: [request('a', true), request('b', true), request('c')],
      blockers: ['b', 'c'], // b declined and then blocked: still one woman
      reporters: ['d'],
    });

    const signal = await unwantedContactSignal(SENDER, NOW);

    expect(signal).toMatchObject({ declined: 2, blockedAfterRequest: 2, reported: 1 });
    expect(signal.members).toBe(4); // a, b, c, d
  });

  it('reads only the window, only requests this account opened, only reports of messages or of her', async () => {
    await unwantedContactSignal(SENDER, NOW);

    const since = new Date(NOW.getTime() - UNWANTED_CONTACT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    expect(db.conversation.findMany.mock.calls[0][0].where).toEqual({ requestedById: SENDER, createdAt: { gte: since } });
    expect(db.contentReport.findMany.mock.calls[0][0].where).toEqual({
      reportedUserId: SENDER,
      createdAt: { gte: since },
      contentType: { in: ['MESSAGE', 'USER'] },
    });
  });

  it('asks about blocks only among the women she opened a thread with', async () => {
    given({ threads: [request('a'), request('b')] });

    await unwantedContactSignal(SENDER, NOW);

    expect(db.userSafetySettings.findMany.mock.calls[0][0].where).toEqual({
      userId: { in: ['a', 'b'] },
      blockedUsers: { has: SENDER },
    });
  });

  it('does not ask about blocks at all when she opened no threads', async () => {
    await unwantedContactSignal(SENDER, NOW);
    expect(db.userSafetySettings.findMany).not.toHaveBeenCalled();
  });
});

describe('putting her in front of a moderator', () => {
  const several = () =>
    given({ threads: [request('a', true), request('b', true)], reporters: ['c'] });

  it(`does nothing below ${UNWANTED_CONTACT_THRESHOLD} different women`, async () => {
    given({ threads: [request('a', true), request('b', true)] });

    await expect(reviewUnwantedContact(SENDER, NOW)).resolves.toBe(false);

    expect(db.adminFlag.create).not.toHaveBeenCalled();
    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it('one woman who declined, blocked and reported is still one woman', async () => {
    given({ threads: [request('a', true)], blockers: ['a'], reporters: ['a'] });

    await expect(reviewUnwantedContact(SENDER, NOW)).resolves.toBe(false);
    expect(db.adminFlag.create).not.toHaveBeenCalled();
  });

  it('raises one safety concern, raised by the platform, saying how many and where to look', async () => {
    several();

    await expect(reviewUnwantedContact(SENDER, NOW)).resolves.toBe(true);

    const flag = db.adminFlag.create.mock.calls[0][0].data;
    expect(flag).toMatchObject({
      userId: SENDER,
      type: UNWANTED_CONTACT_FLAG,
      severity: 'MEDIUM',
      flaggedById: 'system',
    });
    expect(flag.reason).toContain('3 members');
    expect(flag.notes).toContain('Requests declined: 2');
    expect(flag.notes).toContain('Reported (messages or the member): 1');
    // It counts women, it does not name them: the reports hold their own detail.
    expect(flag.notes).not.toMatch(/\ba\b.*\bb\b/);
  });

  it('tells the admins without naming the member', async () => {
    several();

    await reviewUnwantedContact(SENDER, NOW);

    expect(notifyAdmins).toHaveBeenCalledTimes(1);
    const notice = notifyAdmins.mock.calls[0][0] as { title: string; message: string; link: string; data: Record<string, unknown> };
    expect(notice.link).toBe('/admin/moderation#safety-concerns');
    expect(notice.data).toMatchObject({ flagId: 'flag-1', flagType: UNWANTED_CONTACT_FLAG });
    expect(JSON.stringify(notice)).not.toContain(SENDER);
  });

  it('raises nothing new while a moderator has not closed the last one', async () => {
    several();
    db.adminFlag.findFirst.mockResolvedValue({ id: 'flag-0' });

    await expect(reviewUnwantedContact(SENDER, NOW)).resolves.toBe(false);

    expect(db.adminFlag.findFirst.mock.calls[0][0].where).toEqual({ userId: SENDER, type: UNWANTED_CONTACT_FLAG, resolvedAt: null });
    expect(db.adminFlag.create).not.toHaveBeenCalled();
    expect(notifyAdmins).not.toHaveBeenCalled();
  });

  it('restricts nothing: no suspension, no block, no change to her account', async () => {
    several();

    // The mocked client has no user, session or settings writers at all, so any
    // attempt to act on the account would throw inside the review, which would
    // then answer false and raise no flag. It raising one is the proof.
    await expect(reviewUnwantedContact(SENDER, NOW)).resolves.toBe(true);
    expect(Object.keys(db)).toEqual(['conversation', 'userSafetySettings', 'contentReport', 'adminFlag']);
    expect(db.adminFlag.create).toHaveBeenCalledTimes(1);
  });

  it('never throws into the decline, block or report that called it', async () => {
    db.conversation.findMany.mockRejectedValue(new Error('database refused'));
    await expect(reviewUnwantedContact(SENDER, NOW)).resolves.toBe(false);

    several();
    db.adminFlag.create.mockRejectedValue(new Error('write refused'));
    await expect(reviewUnwantedContact(SENDER, NOW)).resolves.toBe(false);
  });
});
