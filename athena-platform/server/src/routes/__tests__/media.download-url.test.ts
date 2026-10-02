import request from 'supertest';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

jest.mock('../../utils/prisma', () => ({
  prisma: {
    jobApplication: { findMany: jest.fn() },
    apprenticeshipApplication: { findMany: jest.fn() },
    organizationMember: { findUnique: jest.fn(), findFirst: jest.fn() },
    // A chat file is read by whoever is in its conversation or its group room
    // now, unless a block stands between her and the sender (both lists).
    conversationParticipant: { findUnique: jest.fn() },
    groupMember: { findUnique: jest.fn() },
    userSafetySettings: { findMany: jest.fn() },
    dvSafetyProfile: { findFirst: jest.fn() },
    // The people in the conversation open a file only while a message on the
    // thread carries it. The file behind a reported message is kept, and opened
    // by staff through the report's copy of the message. Nothing under the chat
    // folder is deleted by its key.
    contentReport: { findFirst: jest.fn() },
    message: { findFirst: jest.fn() },
  },
}));

let currentUser: { id: string; role: string; email: string; twoFactorEnabled?: boolean } = {
  id: 'owner-1',
  role: 'USER',
  email: 'owner@example.com',
};
jest.mock('../../middleware/auth', () => {
  const actual: any = jest.requireActual('../../middleware/auth');
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { ...currentUser };
      next();
    },
  };
});

// Signing is local, but the URL it produces depends on the bucket and the
// credentials in the environment; a fixed one keeps the assertions honest.
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://s3.example/signed'),
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

import { app } from '../../index';
import { prisma as prismaTyped } from '../../utils/prisma';

const prisma: any = prismaTyped;
const RESUME_KEY = 'resumes/owner-1/7f3a.pdf';
const ACCEPTED = new Date('2026-01-01T00:00:00.000Z');

describe('POST /api/media/download-url for a résumé', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.jobApplication.findMany.mockResolvedValue([]);
    prisma.apprenticeshipApplication.findMany.mockResolvedValue([]);
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    prisma.organizationMember.findFirst.mockResolvedValue(null);
  });

  it('the owner gets a URL without any application being consulted', async () => {
    currentUser = { id: 'owner-1', role: 'USER', email: 'owner@example.com' };

    const res = await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(200);

    expect(res.body.data.downloadUrl).toBe('https://s3.example/signed');
    expect(res.body.data.fileName).toBe('7f3a.pdf');
    // Five minutes, not the hour a link copied out of the page used to keep working for.
    expect(res.body.data.expiresIn).toBe(300);
    expect(prisma.jobApplication.findMany).not.toHaveBeenCalled();
  });

  it('a recruiter on the hiring team of the organisation the application went to gets a URL', async () => {
    currentUser = { id: 'recruiter-1', role: 'EMPLOYER', email: 'r@example.com' };
    prisma.jobApplication.findMany.mockResolvedValue([{ job: { organizationId: 'org-1', postedById: 'poster-1' } }]);
    prisma.organizationMember.findUnique.mockResolvedValue({ role: 'RECRUITER', canPostJobs: false, acceptedAt: ACCEPTED });

    const res = await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(200);

    expect(res.body.data.downloadUrl).toBe('https://s3.example/signed');
    // Only her own applications carrying this very file are consulted.
    expect(prisma.jobApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'owner-1', resumeUrl: { endsWith: `/${RESUME_KEY}` } },
      })
    );
    expect(prisma.organizationMember.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId_userId: { organizationId: 'org-1', userId: 'recruiter-1' } } })
    );
  });

  it('a VIEWER of that organisation is told the file does not exist', async () => {
    currentUser = { id: 'viewer-1', role: 'USER', email: 'v@example.com' };
    prisma.jobApplication.findMany.mockResolvedValue([{ job: { organizationId: 'org-1', postedById: 'poster-1' } }]);
    prisma.organizationMember.findUnique.mockResolvedValue({ role: 'VIEWER', canPostJobs: false, acceptedAt: ACCEPTED });

    const res = await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(404);

    expect(res.body.message).toBe('File not found');
  });

  it('an invitation she never accepted grants nothing', async () => {
    currentUser = { id: 'invitee-1', role: 'USER', email: 'i@example.com' };
    prisma.jobApplication.findMany.mockResolvedValue([{ job: { organizationId: 'org-1', postedById: 'poster-1' } }]);
    prisma.organizationMember.findUnique.mockResolvedValue({ role: 'RECRUITER', canPostJobs: false, acceptedAt: null });

    await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(404);
  });

  it('the poster of a job with no organisation may read what was sent to it', async () => {
    currentUser = { id: 'poster-1', role: 'USER', email: 'p@example.com' };
    prisma.jobApplication.findMany.mockResolvedValue([{ job: { organizationId: null, postedById: 'poster-1' } }]);

    await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(200);
  });

  it('hiring staff of the RTO or host employer may read one sent with an apprenticeship application', async () => {
    currentUser = { id: 'rto-staff-1', role: 'USER', email: 'rto@example.com' };
    prisma.apprenticeshipApplication.findMany.mockResolvedValue([
      { apprenticeship: { rtoId: 'rto-1', hostEmployerId: null } },
    ]);
    prisma.organizationMember.findFirst.mockResolvedValue({ id: 'membership-1' });

    await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(200);

    const where = prisma.organizationMember.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: 'rto-staff-1', organizationId: { in: ['rto-1'] }, acceptedAt: { not: null } });
  });

  it('a stranger is told the file does not exist', async () => {
    currentUser = { id: 'stranger-1', role: 'USER', email: 's@example.com' };

    const res = await request(app).post('/api/media/download-url').send({ key: RESUME_KEY }).expect(404);

    expect(res.body.message).toBe('File not found');
    expect(prisma.jobApplication.findMany).toHaveBeenCalledTimes(1);
  });

  it('only résumés travel with applications: another private folder stays owner-only', async () => {
    currentUser = { id: 'recruiter-1', role: 'EMPLOYER', email: 'r@example.com' };

    await request(app).post('/api/media/download-url').send({ key: 'documents/owner-1/deed.pdf' }).expect(404);

    expect(prisma.jobApplication.findMany).not.toHaveBeenCalled();
  });

  it('the byte server applies the same rule', async () => {
    currentUser = { id: 'stranger-1', role: 'USER', email: 's@example.com' };

    await request(app).get(`/api/media/local/${RESUME_KEY}`).expect(404);
    expect(prisma.jobApplication.findMany).toHaveBeenCalledTimes(1);
  });
});

/**
 * A file sent in a conversation. The key names the conversation and the sender
 * (utils/chat-attachments), so who may open it is answered from the key and the
 * tables that already say who is in the thread: the people in it now, unless a
 * block stands between the reader and the sender, and only while a message on
 * the thread carries the file. Every refusal is "not found".
 */
describe('POST /api/media/download-url for a file sent in a conversation', () => {
  const CHAT_KEY = 'chat/conv-1/sender-1_0b0a1c2e-3f4a-4b5c-8d6e-7f8091a2b3c4.webp';
  const ROOM_KEY = 'chat/group-1/sender-1_0b0a1c2e-3f4a-4b5c-8d6e-7f8091a2b3c4.m4a';
  const { getSignedUrl } = jest.requireMock('@aws-sdk/s3-request-presigner') as { getSignedUrl: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.conversationParticipant.findUnique.mockResolvedValue(null);
    prisma.groupMember.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findFirst.mockResolvedValue(null);
    // The message that carries the file is still on the thread.
    prisma.message.findFirst.mockResolvedValue({ id: 'msg-1' });
    prisma.contentReport.findFirst.mockResolvedValue(null);
  });

  const inConversation = () => prisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1' });

  it('asks that a message still on the thread carries the file: this conversation, this sender, not unsent, not expired', async () => {
    currentUser = { id: 'reader-1', role: 'USER', email: 'reader@example.com' };
    inConversation();

    await request(app).post('/api/media/download-url').send({ key: CHAT_KEY }).expect(200);

    const where = prisma.message.findFirst.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({
      conversationId: 'conv-1',
      senderId: 'sender-1',
      deletedAt: null,
      metadata: { path: ['attachments'], array_contains: [{ key: CHAT_KEY }] },
    });
    expect(JSON.stringify(where.AND[1])).toContain('expiresAt');
  });

  it('a file whose message is gone is not found, for the sender too, and the reports are never consulted', async () => {
    // Unsent, swept or erased: the file went with the message, unless somebody
    // reported it, in which case it is kept for staff. The sender must get the
    // same answer either way, or asking would tell her she had been reported.
    currentUser = { id: 'sender-1', role: 'USER', email: 'sender@example.com' };
    inConversation();
    prisma.message.findFirst.mockResolvedValue(null);
    prisma.contentReport.findFirst.mockResolvedValue({ id: 'rep-1' });

    const res = await request(app).post('/api/media/download-url').send({ key: CHAT_KEY }).expect(404);

    expect(res.body.message).toBe('File not found');
    expect(prisma.contentReport.findFirst).not.toHaveBeenCalled();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('the other person in the conversation gets a link that lives five minutes', async () => {
    currentUser = { id: 'reader-1', role: 'USER', email: 'reader@example.com' };
    inConversation();

    const res = await request(app).post('/api/media/download-url').send({ key: CHAT_KEY }).expect(200);

    expect(res.body.data.downloadUrl).toBe('https://s3.example/signed');
    expect(res.body.data.expiresIn).toBe(300);
    expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 300 });
    expect(prisma.conversationParticipant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { conversationId_userId: { conversationId: 'conv-1', userId: 'reader-1' } } })
    );
    // Nothing about applications is asked: the key says whose conversation it is.
    expect(prisma.jobApplication.findMany).not.toHaveBeenCalled();
  });

  it('the sender may open her own file without the block lists being read', async () => {
    currentUser = { id: 'sender-1', role: 'USER', email: 'sender@example.com' };
    inConversation();

    await request(app).post('/api/media/download-url').send({ key: CHAT_KEY }).expect(200);

    expect(prisma.userSafetySettings.findMany).not.toHaveBeenCalled();
    expect(prisma.dvSafetyProfile.findFirst).not.toHaveBeenCalled();
  });

  it('someone who is not in the conversation is told the file does not exist', async () => {
    currentUser = { id: 'stranger-1', role: 'USER', email: 's@example.com' };

    const res = await request(app).post('/api/media/download-url').send({ key: CHAT_KEY }).expect(404);

    expect(res.body.message).toBe('File not found');
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('a participant who has blocked the sender cannot open what the sender sent', async () => {
    currentUser = { id: 'reader-1', role: 'USER', email: 'reader@example.com' };
    inConversation();
    prisma.userSafetySettings.findMany.mockResolvedValue([{ userId: 'reader-1' }]);

    const res = await request(app).post('/api/media/download-url').send({ key: CHAT_KEY }).expect(404);

    expect(res.body.message).toBe('File not found');
  });

  it('a block written only to the DV safety profile closes the door too', async () => {
    currentUser = { id: 'reader-1', role: 'USER', email: 'reader@example.com' };
    inConversation();
    prisma.dvSafetyProfile.findFirst.mockResolvedValue({ userId: 'sender-1' });

    await request(app).post('/api/media/download-url').send({ key: CHAT_KEY }).expect(404);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('refuses rather than guesses when the block lists cannot be read', async () => {
    currentUser = { id: 'reader-1', role: 'USER', email: 'reader@example.com' };
    inConversation();
    prisma.userSafetySettings.findMany.mockRejectedValue(new Error('database unavailable'));

    const res = await request(app).post('/api/media/download-url').send({ key: CHAT_KEY });

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.data).toBeUndefined();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('a member of the group room gets a link; one who was banned, or was never a member, does not', async () => {
    currentUser = { id: 'member-1', role: 'USER', email: 'm@example.com' };
    prisma.groupMember.findUnique.mockResolvedValue({ isBanned: false });
    await request(app).post('/api/media/download-url').send({ key: ROOM_KEY }).expect(200);
    expect(prisma.groupMember.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { groupId_userId: { groupId: 'group-1', userId: 'member-1' } } })
    );

    prisma.groupMember.findUnique.mockResolvedValue({ isBanned: true });
    await request(app).post('/api/media/download-url').send({ key: ROOM_KEY }).expect(404);

    prisma.groupMember.findUnique.mockResolvedValue(null);
    await request(app).post('/api/media/download-url').send({ key: ROOM_KEY }).expect(404);
  });

  it('a key that is not one this server writes is not looked up at all', async () => {
    currentUser = { id: 'reader-1', role: 'USER', email: 'reader@example.com' };
    inConversation();

    await request(app).post('/api/media/download-url').send({ key: 'chat/conv-1/sender-1_not-a-uuid.webp' }).expect(404);

    expect(prisma.conversationParticipant.findUnique).not.toHaveBeenCalled();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('the byte server applies the same rule', async () => {
    currentUser = { id: 'stranger-1', role: 'USER', email: 's@example.com' };

    await request(app).get(`/api/media/local/${CHAT_KEY}`).expect(404);
    expect(prisma.conversationParticipant.findUnique).toHaveBeenCalledTimes(1);
  });
});

/**
 * The file behind a reported message is kept when the message goes, for the
 * people deciding the report (services/chat-attachment-cleanup). This is how
 * they reach it: a member of staff with a second factor may open a key the
 * report's copy of the reported message names, and nothing else under the chat
 * folder. Nobody who is not staff learns anything from a report existing.
 */
describe('POST /api/media/download-url for the file behind a reported message', () => {
  const CHAT_KEY = 'chat/conv-1/sender-1_0b0a1c2e-3f4a-4b5c-8d6e-7f8091a2b3c4.webp';
  const { getSignedUrl } = jest.requireMock('@aws-sdk/s3-request-presigner') as { getSignedUrl: jest.Mock };
  const moderator = { id: 'mod-1', role: 'MODERATOR', email: 'mod@example.com', twoFactorEnabled: true };
  const twoFactorSetting = process.env.STAFF_TWO_FACTOR_REQUIRED;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.conversationParticipant.findUnique.mockResolvedValue(null);
    prisma.groupMember.findUnique.mockResolvedValue(null);
    prisma.userSafetySettings.findMany.mockResolvedValue([]);
    prisma.dvSafetyProfile.findFirst.mockResolvedValue(null);
    prisma.contentReport.findFirst.mockResolvedValue(null);
    // The reported message is usually gone by the time staff look.
    prisma.message.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    if (twoFactorSetting === undefined) delete process.env.STAFF_TWO_FACTOR_REQUIRED;
    else process.env.STAFF_TWO_FACTOR_REQUIRED = twoFactorSetting;
  });

  it('a moderator with a second factor opens a file a report names, though she is not in the conversation and the message is gone', async () => {
    currentUser = { ...moderator };
    prisma.contentReport.findFirst.mockResolvedValue({ id: 'rep-1' });

    const res = await request(app).post('/api/media/download-url').send({ key: CHAT_KEY }).expect(200);

    expect(res.body.data.downloadUrl).toBe('https://s3.example/signed');
    expect(res.body.data.expiresIn).toBe(300);
    // Only the reported message's own files, as the report copied them, and only on a report about a message.
    expect(prisma.contentReport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          contentType: { equals: 'message', mode: 'insensitive' },
          evidence: { path: ['messageContext', 'reported', 'attachments'], array_contains: [{ key: CHAT_KEY }] },
        },
      })
    );
  });

  it('gives staff nothing under the chat folder that no report names', async () => {
    currentUser = { ...moderator };

    const res = await request(app).post('/api/media/download-url').send({ key: CHAT_KEY }).expect(404);

    expect(res.body.message).toBe('File not found');
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('a member who is not staff gets nothing from a report, and the reports are not even read', async () => {
    currentUser = { id: 'stranger-1', role: 'USER', email: 's@example.com', twoFactorEnabled: true };
    prisma.contentReport.findFirst.mockResolvedValue({ id: 'rep-1' });

    await request(app).post('/api/media/download-url').send({ key: CHAT_KEY }).expect(404);

    expect(prisma.contentReport.findFirst).not.toHaveBeenCalled();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('a staff account without the second factor every staff power is behind is refused like anyone else', async () => {
    process.env.STAFF_TWO_FACTOR_REQUIRED = 'true';
    currentUser = { ...moderator, twoFactorEnabled: false };
    prisma.contentReport.findFirst.mockResolvedValue({ id: 'rep-1' });

    await request(app).post('/api/media/download-url').send({ key: CHAT_KEY }).expect(404);

    expect(prisma.contentReport.findFirst).not.toHaveBeenCalled();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});

/**
 * A file sent in a conversation goes with its message: unsending it, the
 * disappearing sweep and an erasure remove the file, and all of them keep the
 * file behind a reported message. Nothing under the chat folder is deleted by
 * its key, and the answer is the same whatever has become of the message: one
 * that differed once the message was gone, by whether the file was still kept,
 * would tell the sender she had been reported.
 */
describe('DELETE /api/media/delete for a file sent in a conversation', () => {
  const CHAT_KEY = 'chat/conv-1/sender-1_0b0a1c2e-3f4a-4b5c-8d6e-7f8091a2b3c4.webp';
  let send: jest.SpiedFunction<typeof S3Client.prototype.send>;

  beforeEach(() => {
    jest.clearAllMocks();
    send = jest.spyOn(S3Client.prototype, 'send').mockImplementation(async () => ({}) as never);
    prisma.message.findFirst.mockResolvedValue(null);
    prisma.contentReport.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    send.mockRestore();
  });

  it('never removes a chat file by its key, with or without a message carrying it: the file goes with the message', async () => {
    currentUser = { id: 'sender-1', role: 'USER', email: 'sender@example.com' };

    for (const carried of [{ id: 'msg-1' }, null]) {
      prisma.message.findFirst.mockResolvedValue(carried);

      const res = await request(app).delete('/api/media/delete').send({ key: CHAT_KEY }).expect(409);

      expect(res.body.message).toMatch(/removed with its message/);
      expect(send).not.toHaveBeenCalled();
    }
  });

  it('answers the same when a report names the file, and reads neither the reports nor the messages to say so', async () => {
    currentUser = { id: 'sender-1', role: 'USER', email: 'sender@example.com' };
    prisma.contentReport.findFirst.mockResolvedValue({ id: 'rep-1' });

    const res = await request(app).delete('/api/media/delete').send({ key: CHAT_KEY }).expect(409);

    expect(res.body.message).toMatch(/removed with its message/);
    expect(res.body.message).not.toMatch(/report/i);
    expect(prisma.contentReport.findFirst).not.toHaveBeenCalled();
    expect(prisma.message.findFirst).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('nobody but the sender is even told that much', async () => {
    currentUser = { id: 'reader-1', role: 'USER', email: 'reader@example.com' };

    await request(app).delete('/api/media/delete').send({ key: CHAT_KEY }).expect(403);

    expect(prisma.message.findFirst).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('a file in a member’s own folder is still hers to delete by its key', async () => {
    currentUser = { id: 'owner-1', role: 'USER', email: 'owner@example.com' };

    await request(app).delete('/api/media/delete').send({ key: RESUME_KEY }).expect(200);

    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0][0] as DeleteObjectCommand).input).toMatchObject({ Key: RESUME_KEY });
  });
});

describe('POST /api/media/presigned-url', () => {
  it('is gone: every upload goes through the server, where its size and bytes are checked', async () => {
    currentUser = { id: 'owner-1', role: 'USER', email: 'owner@example.com' };

    await request(app)
      .post('/api/media/presigned-url')
      .send({ fileType: 'video', fileName: 'clip.mp4', contentType: 'video/mp4' })
      .expect(404);
  });
});
