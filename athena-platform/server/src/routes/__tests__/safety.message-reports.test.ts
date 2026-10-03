/**
 * Reporting what was said to her: a direct message, a line in a group chat, a
 * line of a host's live chat, a whole stream, a whole group.
 *
 * A report on a message used to carry a message id and nothing else, so the
 * moderator who opened it saw a bare identifier, and every way a message can
 * disappear (the sender unsends it, a disappearing thread sweeps it, a host
 * deletes the line, the upheld report's own "remove" deletes the row) took the
 * only evidence with it. And any signed-in member could report any message id,
 * which let ids be probed. These pin the two halves of the fix: the report
 * checks the reporter is entitled to report it, and it keeps a copy of the
 * words, with the lines before them, inside the report.
 */

import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findMany: jest.fn(async () => []), update: jest.fn() },
    post: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    contentReport: { create: jest.fn(), findMany: jest.fn(async () => []) },
    message: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    conversationParticipant: { findUnique: jest.fn() },
    groupMember: { findUnique: jest.fn() },
    group: { findUnique: jest.fn() },
    liveStream: { findUnique: jest.fn() },
    liveStreamMessage: { findUnique: jest.fn(), findMany: jest.fn(async () => []) },
    auditLog: { create: jest.fn(async () => ({})) },
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    const id = req.headers['x-test-user'];
    if (!id) return res.status(401).json({ success: false, message: 'Authentication required' });
    req.user = { id, role: 'USER', email: `${id}@athena.test`, twoFactorEnabled: true };
    next();
  },
  optionalAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requirePremium: (_req: any, _res: any, next: any) => next(),
}));

const scoring = {
  handleUserReport: jest.fn(async (..._args: unknown[]) => undefined),
  handleUserBlock: jest.fn(async (..._args: unknown[]) => undefined),
  verifyReport: jest.fn(async (..._args: unknown[]) => undefined),
};
jest.mock('../../services/safety-score.service', () => scoring);

jest.mock('../../services/trust.service', () => ({
  recordSafetyReport: jest.fn(async () => undefined),
  recordUserBlock: jest.fn(async () => undefined),
}));

jest.mock('../../services/moderation-threshold.service', () => ({
  reviewReportedContent: jest.fn(async () => false),
}));

const runReportIntakeConsequences = jest.fn(async (_record: unknown) => undefined);
jest.mock('../../services/content-report.service', () => ({
  ...(jest.requireActual('../../services/content-report.service') as object),
  runReportIntakeConsequences: (record: unknown) => runReportIntakeConsequences(record),
}));

const reviewUnwantedContact = jest.fn(async (_senderId: string) => false);
jest.mock('../../services/unwanted-contact.service', () => ({
  reviewUnwantedContact: (senderId: string) => reviewUnwantedContact(senderId),
}));

const store = {
  blockUser: jest.fn(async () => ({ created: true })),
  listBlockedUsers: jest.fn(async () => [] as any[]),
  unblockUser: jest.fn(async () => undefined),
  isBlockedRelationship: jest.fn(async (_a: string, _b: string) => false),
};
jest.mock('../../utils/safety-store', () => store);

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  redactSensitive: (value: unknown) => value,
}));

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';
import { reportContextFrom } from '../../services/report-context.service';

const prisma: any = prismaTyped;
const as = (id: string) => ({ 'x-test-user': id });

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1, 3, 0, 0) + minutes * 60_000);

const sender = { id: 'him', displayName: 'Dan', firstName: 'Dan', lastName: 'R' };

const messageRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'm3',
  conversationId: 'conv-1',
  senderId: 'him',
  content: 'I know where you work',
  type: 'TEXT',
  metadata: null,
  createdAt: at(3),
  editedAt: null,
  deletedAt: null,
  expiresAt: null,
  sender,
  ...overrides,
});

const earlier = (id: string, minutes: number, content: string, senderId = 'him') => ({
  ...messageRow({ id, content, createdAt: at(minutes), senderId, sender: senderId === 'him' ? sender : { id: 'her', displayName: 'Ana', firstName: 'Ana', lastName: 'K' } }),
});

const filedEvidence = () => prisma.contentReport.create.mock.calls[0][0].data.evidence;

beforeEach(() => {
  jest.clearAllMocks();
  store.isBlockedRelationship.mockResolvedValue(false);
  prisma.contentReport.create.mockImplementation(async ({ data }: any) => ({
    id: 'rep-1',
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  prisma.message.findMany.mockResolvedValue([]);
  prisma.conversationParticipant.findUnique.mockResolvedValue(null);
  prisma.groupMember.findUnique.mockResolvedValue(null);
});

describe('reporting a direct message', () => {
  beforeEach(() => {
    prisma.message.findUnique.mockResolvedValue(messageRow());
    prisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'cp-her' });
    // Newest first, as the query returns them; the copy reads oldest first.
    prisma.message.findMany.mockResolvedValue([
      earlier('m2', 2, 'Why are you ignoring me'),
      earlier('m1', 1, 'Hello again', 'her'),
    ]);
  });

  it('keeps the words, who said them and the lines before them inside the report', async () => {
    const res = await request(app)
      .post('/api/safety/reports')
      .set(as('her'))
      .send({ targetType: 'message', targetId: 'm3', reason: 'harassment', details: 'He will not stop' })
      .expect(201);

    const data = prisma.contentReport.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ reporterId: 'her', reportedUserId: 'him', contentType: 'MESSAGE', contentId: 'm3' });

    const context = data.evidence.messageContext;
    expect(context).toMatchObject({
      version: 1,
      surface: 'direct',
      conversationId: 'conv-1',
      groupId: null,
      reported: { id: 'm3', senderId: 'him', senderName: 'Dan', content: 'I know where you work', edited: false },
    });
    expect(context.before.map((line: any) => line.content)).toEqual(['Hello again', 'Why are you ignoring me']);
    expect(context.before.map((line: any) => line.senderName)).toEqual(['Ana', 'Dan']);

    // It is a copy: nothing in the report points back at the message row, so
    // unsending, sweeping or removing the message cannot take the words with it.
    expect(typeof context.reported.content).toBe('string');
    // The ticket and the clock the queue sorts by are still stamped beside it.
    expect(data.evidence).toMatchObject({ source: 'IN_APP_REPORT', priority: expect.any(String) });
    expect(res.body.data.targetType).toBe('message');
  });

  it('copies the attachments as names and links, and leaves the rest of the metadata behind', async () => {
    prisma.message.findUnique.mockResolvedValue(
      messageRow({
        content: '',
        type: 'IMAGE',
        metadata: { attachments: [{ name: 'photo.jpg', type: 'image', url: '/uploads/photo.jpg', contentType: 'image/jpeg', size: 4821 }], pinned: true },
      })
    );

    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'message', targetId: 'm3', reason: 'sexual' }).expect(201);

    expect(filedEvidence().messageContext.reported.attachments).toEqual([
      { name: 'photo.jpg', type: 'image', url: '/uploads/photo.jpg' },
    ]);
    expect(JSON.stringify(filedEvidence())).not.toContain('4821');
  });

  it('keeps the key of a file in the chat folder, which is how the people deciding the report open it', async () => {
    const key = 'chat/conv-1/him_0b0a1c2e-3f4a-4b5c-8d6e-7f8091a2b3c4.webp';
    prisma.message.findUnique.mockResolvedValue(
      messageRow({
        content: '',
        type: 'IMAGE',
        metadata: { attachments: [{ key, name: 'kitchen.webp', contentType: 'image/webp', size: 4821 }] },
      })
    );

    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'message', targetId: 'm3', reason: 'sexual' }).expect(201);

    expect(filedEvidence().messageContext.reported.attachments).toEqual([{ name: 'kitchen.webp', key }]);
  });

  it('asks only the lines still on the thread: not unsent ones, not expired ones', async () => {
    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'message', targetId: 'm3', reason: 'harassment' }).expect(201);

    const query = prisma.message.findMany.mock.calls[0][0];
    expect(query.take).toBe(10);
    expect(query.orderBy).toEqual({ createdAt: 'desc' });
    expect(JSON.stringify(query.where)).toContain('"deletedAt":null');
    expect(JSON.stringify(query.where)).toContain('expiresAt');
    expect(query.where.AND[0]).toMatchObject({ conversationId: 'conv-1' });
  });

  it('counts toward the account being watched for unwanted contact', async () => {
    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'message', targetId: 'm3', reason: 'harassment' }).expect(201);
    expect(reviewUnwantedContact).toHaveBeenCalledWith('him');
  });

  it('is not found for someone who is not in the conversation, and says what a missing message says', async () => {
    prisma.conversationParticipant.findUnique.mockResolvedValue(null);
    prisma.groupMember.findUnique.mockResolvedValue(null);

    const stranger = await request(app).post('/api/safety/reports').set(as('nosy')).send({ targetType: 'message', targetId: 'm3', reason: 'spam' }).expect(404);

    prisma.message.findUnique.mockResolvedValue(null);
    const missing = await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'message', targetId: 'nope', reason: 'spam' }).expect(404);

    // Different answers would tell a stranger which message ids exist.
    expect(stranger.body.message).toBe(missing.body.message);
    expect(prisma.contentReport.create).not.toHaveBeenCalled();
    expect(reviewUnwantedContact).not.toHaveBeenCalled();
  });

  it('is not found once the message was unsent or has disappeared', async () => {
    prisma.message.findUnique.mockResolvedValue(messageRow({ deletedAt: at(10) }));
    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'message', targetId: 'm3', reason: 'harassment' }).expect(404);

    prisma.message.findUnique.mockResolvedValue(messageRow({ expiresAt: new Date(Date.now() - 60_000) }));
    const res = await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'message', targetId: 'm3', reason: 'harassment' }).expect(404);

    // She is told she can still report the person, which is the way out.
    expect(res.body.message).toMatch(/report the person/);
    expect(prisma.contentReport.create).not.toHaveBeenCalled();
  });

  it('will not take a report of her own message or of a notice ATHENA wrote', async () => {
    prisma.message.findUnique.mockResolvedValue(messageRow({ senderId: 'her' }));
    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'message', targetId: 'm3', reason: 'spam' }).expect(400);

    prisma.message.findUnique.mockResolvedValue(messageRow({ type: 'SYSTEM' }));
    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'message', targetId: 'm3', reason: 'spam' }).expect(400);

    expect(prisma.contentReport.create).not.toHaveBeenCalled();
  });

  it('lets her report what he said even though she has blocked him', async () => {
    store.isBlockedRelationship.mockResolvedValue(true);

    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'message', targetId: 'm3', reason: 'harassment' }).expect(201);

    expect(prisma.contentReport.create).toHaveBeenCalled();
  });
});

describe('reporting a message in a group chat', () => {
  beforeEach(() => {
    prisma.message.findUnique.mockResolvedValue(messageRow({ conversationId: 'group-1', content: 'Spam spam' }));
    prisma.conversationParticipant.findUnique.mockResolvedValue(null);
    prisma.groupMember.findUnique.mockResolvedValue({ isBanned: false, group: { id: 'group-1', name: 'Brisbane founders' } });
  });

  it('is accepted from an active member and names the group', async () => {
    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'message', targetId: 'm3', reason: 'spam' }).expect(201);

    expect(filedEvidence().messageContext).toMatchObject({
      surface: 'group',
      conversationId: 'group-1',
      groupId: 'group-1',
      groupName: 'Brisbane founders',
      reported: { content: 'Spam spam' },
    });
    expect(prisma.groupMember.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { groupId_userId: { groupId: 'group-1', userId: 'her' } } })
    );
  });

  it('takes the name group_message too, and files it as a message', async () => {
    const res = await request(app)
      .post('/api/safety/reports')
      .set(as('her'))
      .send({ targetType: 'group_message', targetId: 'm3', reason: 'spam' })
      .expect(201);

    expect(prisma.contentReport.create.mock.calls[0][0].data.contentType).toBe('MESSAGE');
    expect(filedEvidence().messageContext.surface).toBe('group');
    expect(res.body.data.targetType).toBe('message');
  });

  it('is not found for someone who is not a member, or was banned from the group', async () => {
    prisma.groupMember.findUnique.mockResolvedValue(null);
    await request(app).post('/api/safety/reports').set(as('nosy')).send({ targetType: 'message', targetId: 'm3', reason: 'spam' }).expect(404);

    prisma.groupMember.findUnique.mockResolvedValue({ isBanned: true, group: { id: 'group-1', name: 'x' } });
    await request(app).post('/api/safety/reports').set(as('banned')).send({ targetType: 'message', targetId: 'm3', reason: 'spam' }).expect(404);

    expect(prisma.contentReport.create).not.toHaveBeenCalled();
  });
});

describe('reporting live chat and live streams', () => {
  const chatLine = (id: string, userId: string, content: string, minutes: number) => ({
    id,
    streamId: 's1',
    userId,
    content,
    createdAt: at(minutes),
    user: { id: userId, displayName: userId === 'troll' ? 'Troll' : 'Fan' },
    stream: { id: 's1', title: 'Salary negotiation, live', hostId: 'host', host: { displayName: 'Mei C.' } },
  });

  it('copies a chat line and the ones before it, because the host can delete the row', async () => {
    prisma.liveStreamMessage.findUnique.mockResolvedValue(chatLine('l3', 'troll', 'show us your address', 3));
    prisma.liveStreamMessage.findMany.mockResolvedValue([
      chatLine('l2', 'fan', 'lol', 2),
      chatLine('l1', 'troll', 'hey girl', 1),
    ]);

    await request(app).post('/api/safety/reports').set(as('viewer')).send({ targetType: 'live_message', targetId: 'l3', reason: 'harassment' }).expect(201);

    const data = prisma.contentReport.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ contentType: 'LIVE_MESSAGE', contentId: 'l3', reportedUserId: 'troll' });
    expect(data.evidence.liveContext).toMatchObject({
      streamId: 's1',
      streamTitle: 'Salary negotiation, live',
      hostId: 'host',
      hostName: 'Mei C.',
      reported: { id: 'l3', userId: 'troll', userName: 'Troll', content: 'show us your address' },
    });
    expect(data.evidence.liveContext.before.map((line: any) => line.content)).toEqual(['hey girl', 'lol']);
  });

  it('is not found across a block with the host or with the author, and refuses her own line', async () => {
    prisma.liveStreamMessage.findUnique.mockResolvedValue(chatLine('l3', 'troll', 'x', 3));

    store.isBlockedRelationship.mockImplementation(async (_me: string, other: string) => other === 'host');
    await request(app).post('/api/safety/reports').set(as('viewer')).send({ targetType: 'live_message', targetId: 'l3', reason: 'spam' }).expect(404);

    store.isBlockedRelationship.mockImplementation(async (_me: string, other: string) => other === 'troll');
    await request(app).post('/api/safety/reports').set(as('viewer')).send({ targetType: 'live_message', targetId: 'l3', reason: 'spam' }).expect(404);

    store.isBlockedRelationship.mockResolvedValue(false);
    await request(app).post('/api/safety/reports').set(as('troll')).send({ targetType: 'live_message', targetId: 'l3', reason: 'spam' }).expect(400);

    prisma.liveStreamMessage.findUnique.mockResolvedValue(null);
    await request(app).post('/api/safety/reports').set(as('viewer')).send({ targetType: 'live_message', targetId: 'gone', reason: 'spam' }).expect(404);

    expect(prisma.contentReport.create).not.toHaveBeenCalled();
  });

  it('reports a whole stream against its host, without copying the stream key or playback URL', async () => {
    prisma.liveStream.findUnique.mockResolvedValue({
      id: 's1',
      title: 'Salary negotiation, live',
      description: 'Come along',
      category: 'career',
      status: 'LIVE',
      startedAt: at(0),
      hostId: 'host',
      host: { displayName: 'Mei C.' },
      streamKey: 'secret-key',
      playbackUrl: 'https://cdn.example.com/hls/secret-key/index.m3u8',
    });

    await request(app).post('/api/safety/reports').set(as('viewer')).send({ targetType: 'livestream', targetId: 's1', reason: 'violence' }).expect(201);

    const query = prisma.liveStream.findUnique.mock.calls[0][0];
    expect(query.select.streamKey).toBeUndefined();
    expect(query.select.playbackUrl).toBeUndefined();
    const data = prisma.contentReport.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ contentType: 'LIVESTREAM', contentId: 's1', reportedUserId: 'host' });
    expect(data.evidence.liveContext).toMatchObject({
      streamId: 's1',
      hostId: 'host',
      stream: { description: 'Come along', category: 'career', status: 'LIVE' },
    });
  });

  it('will not take a report of her own stream, or of one she is blocked from', async () => {
    const row = {
      id: 's1', title: 't', description: null, category: null, status: 'LIVE', startedAt: null, hostId: 'host', host: { displayName: 'Mei C.' },
    };
    prisma.liveStream.findUnique.mockResolvedValue(row);

    await request(app).post('/api/safety/reports').set(as('host')).send({ targetType: 'livestream', targetId: 's1', reason: 'spam' }).expect(400);

    store.isBlockedRelationship.mockResolvedValue(true);
    await request(app).post('/api/safety/reports').set(as('viewer')).send({ targetType: 'livestream', targetId: 's1', reason: 'spam' }).expect(404);

    prisma.liveStream.findUnique.mockResolvedValue(null);
    store.isBlockedRelationship.mockResolvedValue(false);
    await request(app).post('/api/safety/reports').set(as('viewer')).send({ targetType: 'livestream', targetId: 'gone', reason: 'spam' }).expect(404);

    expect(prisma.contentReport.create).not.toHaveBeenCalled();
  });
});

describe('reporting a group', () => {
  it('goes to the person who created it, with a copy of what it said it was', async () => {
    prisma.group.findUnique.mockResolvedValue({
      id: 'g1', name: 'Quick money', description: 'DM me for a deal', privacy: 'PUBLIC', createdById: 'owner',
    });

    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'group', targetId: 'g1', reason: 'spam' }).expect(201);

    const data = prisma.contentReport.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ contentType: 'GROUP', contentId: 'g1', reportedUserId: 'owner' });
    expect(data.evidence.groupContext).toMatchObject({ groupId: 'g1', name: 'Quick money', description: 'DM me for a deal', createdById: 'owner' });
  });

  it('is not found when there is no such group, and refuses the creator reporting her own', async () => {
    prisma.group.findUnique.mockResolvedValue(null);
    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'group', targetId: 'gone', reason: 'spam' }).expect(404);

    prisma.group.findUnique.mockResolvedValue({ id: 'g1', name: 'n', description: 'd', privacy: 'PUBLIC', createdById: 'her' });
    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'group', targetId: 'g1', reason: 'spam' }).expect(400);
    expect(prisma.contentReport.create).not.toHaveBeenCalled();
  });
});

describe('the other two things that, with a report, put an account in front of a moderator', () => {
  it('a block is counted against the account that was blocked, but only the first time', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'him' });
    store.blockUser.mockResolvedValueOnce({ created: true });
    await request(app).post('/api/safety/blocks').set(as('her')).send({ blockedUserId: 'him' }).expect(201);
    expect(reviewUnwantedContact).toHaveBeenCalledWith('him');

    reviewUnwantedContact.mockClear();
    store.blockUser.mockResolvedValueOnce({ created: false });
    await request(app).post('/api/safety/blocks').set(as('her')).send({ blockedUserId: 'him' }).expect(200);
    expect(reviewUnwantedContact).not.toHaveBeenCalled();
  });

  it('a report of the member herself is counted, and a report of a post is not', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'him' });
    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'user', targetId: 'him', reason: 'harassment' }).expect(201);
    expect(reviewUnwantedContact).toHaveBeenCalledWith('him');

    reviewUnwantedContact.mockClear();
    prisma.post.findUnique.mockResolvedValue({ authorId: 'him' });
    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'post', targetId: 'p1', reason: 'spam' }).expect(201);
    expect(reviewUnwantedContact).not.toHaveBeenCalled();
  });
});

describe('what a moderator is sent of a report', () => {
  it('is only the copies, never the rest of the evidence', () => {
    const evidence = {
      ticketId: 'ATH-1',
      contactEmail: 'reporter@example.com',
      reviewDeadline: '2026-10-02T00:00:00Z',
      messageContext: { reported: { content: 'x' } },
      liveContext: { streamId: 's1' },
      groupContext: { groupId: 'g1' },
      somethingAddedLater: 'private until someone decides otherwise',
    };

    const shown = reportContextFrom(evidence);

    expect(shown).toEqual({
      messageContext: { reported: { content: 'x' } },
      liveContext: { streamId: 's1' },
      groupContext: { groupId: 'g1' },
    });
    expect(JSON.stringify(shown)).not.toContain('reporter@example.com');
  });

  it('is null when a report kept nothing, or its evidence is not an object', () => {
    expect(reportContextFrom({ ticketId: 'ATH-1' })).toBeNull();
    expect(reportContextFrom(null)).toBeNull();
    expect(reportContextFrom('text')).toBeNull();
    expect(reportContextFrom([{ messageContext: {} }])).toBeNull();
    expect(reportContextFrom({ messageContext: 'not an object' })).toBeNull();
  });
});

describe('the report form itself', () => {
  it('still refuses a target it does not know', async () => {
    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'nonsense', targetId: 'x', reason: 'spam' }).expect(400);
    expect(prisma.contentReport.create).not.toHaveBeenCalled();
  });

  it('still refuses a message report with no message named', async () => {
    await request(app).post('/api/safety/reports').set(as('her')).send({ targetType: 'message', reason: 'spam' }).expect(400);
    expect(prisma.contentReport.create).not.toHaveBeenCalled();
  });
});
