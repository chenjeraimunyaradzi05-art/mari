/**
 * What happens when a moderator decides a report.
 *
 * This is the code that hides content and suspends accounts, and nothing tested
 * it. The hole it was hiding: the reporter was never told anything. The outcome
 * notification sat behind `if (ticketId && evidence?.contactEmail)`, and both of
 * those keys were only ever written by submitContentReport, the legacy path with
 * no production callers — so for every report that actually exists in the
 * database the branch never ran. A woman reported harassment, a moderator
 * suspended the account, and she heard nothing, while the member she reported
 * got a notification.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    contentReport: { findUnique: jest.fn(), update: jest.fn() },
    moderationLog: { create: jest.fn() },
    notification: { create: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    post: { update: jest.fn() },
    event: { updateMany: jest.fn(async () => ({ count: 1 })) },
    housingListing: { findUnique: jest.fn(async () => ({ features: ['Garden'] })), updateMany: jest.fn(async () => ({ count: 1 })) },
    wellnessPost: { updateMany: jest.fn(async () => ({ count: 1 })) },
    wellnessReply: { updateMany: jest.fn(async () => ({ count: 1 })) },
    // A review of a practitioner, and the average its practitioner carries.
    healthReview: {
      findUnique: jest.fn(async ({ where }: any) => (where.id === 'review-1' ? { id: 'review-1', practitionerId: 'pr-1' } : null)),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, isHidden: data.isHidden })),
      aggregate: jest.fn(async () => ({ _avg: { rating: 4 }, _count: { rating: 2 } })),
    },
    healthPractitioner: { update: jest.fn(async () => ({})) },
    bannedIdentity: { upsert: jest.fn(), deleteMany: jest.fn() },
  },
}));

process.env.BANNED_IDENTITY_HASH_KEY = 'test-ban-key';

jest.mock('../../utils/email', () => ({
  sendEmail: jest.fn(async () => true),
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../utils/ops-metrics', () => ({
  recordFailure: jest.fn(),
}));

import { prisma } from '../../utils/prisma';
import { sendEmail } from '../../utils/email';
import { processReportById, reverseEnforcement } from '../content-report.service';

const prismaAny: any = prisma;
const sendEmailMock = sendEmail as jest.Mock;

const REPORT = {
  id: 'report-1',
  reporterId: 'reporter-1',
  reportedUserId: 'reported-1',
  contentType: 'POST',
  contentId: 'post-1',
  reason: 'HARASSMENT',
  description: 'She posted my address',
  status: 'PENDING',
  evidence: null as unknown,
};

describe('Deciding a report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT });
    prismaAny.contentReport.update.mockResolvedValue({ ...REPORT });
    prismaAny.moderationLog.create.mockResolvedValue({ id: 'log-1' });
    prismaAny.notification.create.mockResolvedValue({ id: 'notification-1' });
    prismaAny.user.findUnique.mockResolvedValue({ id: 'reporter-1' });
    prismaAny.user.update.mockResolvedValue({ id: 'reported-1', email: 'reported@example.org' });
    prismaAny.post.update.mockResolvedValue({ id: 'post-1' });
    prismaAny.bannedIdentity.upsert.mockResolvedValue({ id: 'ban-1' });
  });

  it('records why, when and by whom an account was suspended', async () => {
    await processReportById('report-1', 'suspend', 'moderator-1', 'Repeated abuse');

    const data = prismaAny.user.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ isSuspended: true, suspensionReason: 'Repeated abuse', suspendedById: 'moderator-1' });
    expect(data.suspendedAt).toBeInstanceOf(Date);
    // A suspension is not a ban, and does not bar the address.
    expect(data.bannedAt).toBeUndefined();
    expect(prismaAny.bannedIdentity.upsert).not.toHaveBeenCalled();
  });

  // The decision told the reporter and nobody else. The member whose post came
  // down heard nothing, so the appeal the platform offers was one she could not
  // know she had cause to make, and could not name.
  it('tells the member whose post was removed, with the reference to quote and the way to appeal', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({
      ...REPORT,
      evidence: { ticketId: 'RPT-ABC-1234' },
    });

    await processReportById('report-1', 'remove', 'moderator-1');

    const notified = prismaAny.notification.create.mock.calls.map((call: any[]) => call[0].data);
    const toAuthor = notified.find((data: any) => data.userId === 'reported-1');
    expect(toAuthor).toMatchObject({
      type: 'SYSTEM',
      title: 'Something you shared was removed',
      link: '/help/appeal?type=content_removal',
      data: { reportId: 'report-1', reference: 'RPT-ABC-1234', contentType: 'POST' },
    });
    expect(toAuthor.message).toContain('your post');
    expect(toAuthor.message).toContain('RPT-ABC-1234');
    // Nothing of who reported, or what she said: the notice is for the author.
    expect(JSON.stringify(toAuthor)).not.toContain('reporter-1');
    expect(JSON.stringify(toAuthor)).not.toContain('She posted my address');
  });

  it('names a reel, an event or a listing as what it is, and says nothing where nothing was removed', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'VIDEO', contentId: 'reel-1' });
    prismaAny.video = { update: jest.fn(async () => ({})) };
    await processReportById('report-1', 'remove', 'moderator-1');
    const reel = prismaAny.notification.create.mock.calls.map((c: any[]) => c[0].data).find((d: any) => d.userId === 'reported-1');
    expect(reel.message).toContain('your reel');

    // A profile is not taken down by "remove" (the account is suspended
    // instead), so telling its owner that something was removed would be untrue.
    prismaAny.notification.create.mockClear();
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'PROFILE', contentId: 'reported-1' });
    await processReportById('report-1', 'remove', 'moderator-1');
    const afterProfile = prismaAny.notification.create.mock.calls.map((c: any[]) => c[0].data);
    expect(afterProfile.some((d: any) => d.userId === 'reported-1')).toBe(false);
  });

  it('does not send the removal notice for a dismissal or a warning, which have their own words or none', async () => {
    await processReportById('report-1', 'dismiss', 'moderator-1');
    await processReportById('report-1', 'warn', 'moderator-1');

    const titles = prismaAny.notification.create.mock.calls.map((c: any[]) => c[0].data.title);
    expect(titles).not.toContain('Something you shared was removed');
    expect(titles).toContain('Content Policy Warning');
  });

  it('still records the decision when the notice cannot be written', async () => {
    prismaAny.notification.create.mockImplementation(async ({ data }: any) => {
      if (data.userId === 'reported-1') throw new Error('no such member');
      return { id: 'n' };
    });

    const outcome = await processReportById('report-1', 'remove', 'moderator-1');

    expect(outcome.status).toBe('RESOLVED');
    expect(prismaAny.moderationLog.create).toHaveBeenCalled();
  });

  // A report of an event could be filed, in the app and on the public form, and
  // a moderator could choose "remove", and nothing happened to the event: the
  // switch that carries removal out had no branch for it.
  it('takes a reported event off the list when a moderator removes it, hiding it rather than deleting it', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'EVENT', contentId: 'event-1' });

    await processReportById('report-1', 'remove', 'moderator-1');

    expect(prismaAny.event.updateMany).toHaveBeenCalledWith({ where: { id: 'event-1' }, data: { isHidden: true } });
  });

  // A report of a mental health forum post or reply reached the queue, a
  // moderator chose "remove", and the only thing that happened was a log line
  // saying the type was unknown: the post stayed up.
  it.each([
    ['WELLNESS_POST', 'wellnessPost', { isHidden: true, hiddenReason: 'Removed by a moderator' }, 'forum post'],
    ['WELLNESS_REPLY', 'wellnessReply', { isHidden: true }, 'forum reply'],
  ])('hides a reported %s when a moderator removes it, and tells its author what it was', async (contentType, model, data, noun) => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType, contentId: 'thing-1', reason: 'self_harm' });

    await processReportById('report-1', 'remove', 'moderator-1');

    expect(prismaAny[model].updateMany).toHaveBeenCalledWith({ where: { id: 'thing-1' }, data });
    const toAuthor = prismaAny.notification.create.mock.calls.map((c: any[]) => c[0].data).find((d: any) => d.userId === 'reported-1');
    expect(toAuthor.message).toContain(`your ${noun}`);
  });

  it('does not hide a forum post when the report is dismissed', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'WELLNESS_POST', contentId: 'thing-1' });
    await processReportById('report-1', 'dismiss', 'moderator-1');
    expect(prismaAny.wellnessPost.updateMany).not.toHaveBeenCalled();
  });

  // A review of a practitioner can now be reported from the practitioner's page.
  // Removing it hides it and brings the practitioner's average level with what
  // still shows, the same two writes a moderator's Hide makes; the directory
  // sorts on that average, so a hidden review left in it would still rank her.
  it('hides a reported review when a moderator removes it, brings the average level, and tells its author', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'HEALTH_REVIEW', contentId: 'review-1' });

    await processReportById('report-1', 'remove', 'moderator-1');

    expect(prismaAny.healthReview.update).toHaveBeenCalledWith({ where: { id: 'review-1' }, data: { isHidden: true } });
    expect(prismaAny.healthReview.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { practitionerId: 'pr-1', isHidden: false } }));
    expect(prismaAny.healthPractitioner.update).toHaveBeenCalledWith({ where: { id: 'pr-1' }, data: { ratingAvg: 4, ratingCount: 2 } });
    const toAuthor = prismaAny.notification.create.mock.calls.map((c: any[]) => c[0].data).find((d: any) => d.userId === 'reported-1');
    expect(toAuthor.message).toContain('your review of a practitioner');
  });

  it('records the decision on a review that has since gone, rather than failing it', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'HEALTH_REVIEW', contentId: 'review-gone' });

    const outcome = await processReportById('report-1', 'remove', 'moderator-1');

    expect(outcome.status).toBe('RESOLVED');
    expect(prismaAny.healthReview.update).not.toHaveBeenCalled();
  });

  it('gives a suspension without notes the report it was decided on as its reason', async () => {
    await processReportById('report-1', 'suspend', 'moderator-1');

    expect(prismaAny.user.update.mock.calls[0][0].data.suspensionReason).toBe(
      'Decided on a post report for harassment, with no notes'
    );
  });

  it('tells the reporter the outcome even though her report carries no ticket and no email', async () => {
    const outcome = await processReportById('report-1', 'suspend', 'moderator-1', 'Repeated abuse');

    expect(outcome.status).toBe('RESOLVED');
    const notified = prismaAny.notification.create.mock.calls.map((call: any[]) => call[0].data);
    const toReporter = notified.find((data: any) => data.userId === 'reporter-1');
    expect(toReporter).toBeDefined();
    expect(toReporter.message).toContain('suspended');
    expect(toReporter.data.reference).toBe('report-1');
  });

  it('emails the reporter as well when she left an address, because she may have no account', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({
      ...REPORT,
      evidence: { ticketId: 'RPT-ABC-1234', contactEmail: 'reporter@example.test' },
    });

    await processReportById('report-1', 'remove', 'moderator-1');

    const recipients = sendEmailMock.mock.calls.map((call: any[]) => call[0].to);
    expect(recipients).toContain('reporter@example.test');
    const subjects = sendEmailMock.mock.calls.map((call: any[]) => call[0].subject);
    expect(subjects.some((subject: string) => subject.includes('RPT-ABC-1234'))).toBe(true);
  });

  it('does not invent a reporter when the legacy path wrote a placeholder id', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({
      ...REPORT,
      reporterId: 'system-anonymous',
    });
    prismaAny.user.findUnique.mockResolvedValue(null);

    await processReportById('report-1', 'dismiss', 'moderator-1');

    const notified = prismaAny.notification.create.mock.calls.map((call: any[]) => call[0].data);
    expect(notified.some((data: any) => data.userId === 'system-anonymous')).toBe(false);
  });

  it('still applies the enforcement when the reporter cannot be told', async () => {
    prismaAny.notification.create.mockRejectedValue(new Error('notification table is down'));

    const outcome = await processReportById('report-1', 'remove', 'moderator-1');

    expect(prismaAny.post.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { isHidden: true },
    });
    expect(outcome.action).toBe('remove');
  });

  // A listing a moderator takes down for a report comes off the list and loses
  // its safety check with it. Left checked, its lister could put it live again
  // with "Checked by ATHENA staff" still on it: the take-down would last until
  // the next edit of the status.
  it('takes a reported housing listing down and ends its safety check', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'HOUSING_LISTING', contentId: 'listing-1' });

    await processReportById('report-1', 'remove', 'moderator-1');

    expect(prismaAny.housingListing.updateMany).toHaveBeenCalledWith({
      where: { id: 'listing-1' },
      data: { status: 'WITHDRAWN', safetyVerified: false, features: ['Garden', expect.stringMatching(/^staff-takedown:/)] },
    });
    expect(prismaAny.post.update).not.toHaveBeenCalled();
  });

  // The listing's status is a switch its lister can press, so a removal that
  // only set the status was undone by one request for an ordinary listing, which
  // has no check to go back through. The mark is what stops that.
  it('marks the removed listing as taken down by staff, so its lister cannot put it back herself', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, contentType: 'HOUSING_LISTING', contentId: 'listing-1' });
    prismaAny.housingListing.findUnique.mockResolvedValueOnce({ features: ['Garden', 'dv-safe-note:quiet street'] });

    await processReportById('report-1', 'remove', 'moderator-1');

    const data = prismaAny.housingListing.updateMany.mock.calls.at(-1)[0].data;
    expect(data.features).toEqual(['Garden', 'dv-safe-note:quiet street', expect.stringMatching(/^staff-takedown:[0-9]{4}-/)]);
  });

  // A ban locks the account, marks it banned, and bars the address from
  // registering again. It still does not remove the account, and an upheld
  // appeal can lift it, so the reporter is told no more than that. It used to
  // tell her the account had been "removed" and "permanently banned".
  it('bans the account and the address, records it as a ban, and tells the reporter no more than that', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({
      ...REPORT,
      evidence: { ticketId: 'RPT-X-1', contactEmail: 'reporter@example.org' },
    });

    const outcome = await processReportById('report-1', 'ban', 'moderator-1', 'Stalking across accounts');

    const lock = prismaAny.user.update.mock.calls[0][0];
    expect(lock.where).toEqual({ id: 'reported-1' });
    expect(lock.data).toMatchObject({
      isSuspended: true,
      banReason: 'Stalking across accounts',
      bannedById: 'moderator-1',
      suspensionReason: 'Stalking across accounts',
    });
    expect(lock.data.bannedAt).toBeInstanceOf(Date);

    const identity = prismaAny.bannedIdentity.upsert.mock.calls[0][0];
    expect(identity.create).toMatchObject({ userId: 'reported-1', reportId: 'report-1', createdById: 'moderator-1' });
    // Kept as a keyed hash of the address, never the address itself.
    expect(JSON.stringify(identity)).not.toContain('example.org');
    expect(outcome.banIdentityRecorded).toBe(true);

    expect(prismaAny.contentReport.update.mock.calls[0][0].data).toMatchObject({ status: 'RESOLVED', action: 'BAN' });
    expect(prismaAny.moderationLog.create.mock.calls[0][0].data).toMatchObject({ action: 'ban', ticketId: 'RPT-X-1' });
    expect(outcome.action).toBe('ban');

    const inApp = prismaAny.notification.create.mock.calls
      .map((call: any[]) => call[0].data)
      .find((data: any) => data.userId === 'reporter-1');
    expect(inApp.message).toContain('banned');
    expect(inApp.message).not.toMatch(/removed the account|permanent/i);

    const email = sendEmailMock.mock.calls.map((call: any[]) => call[0]).find((mail: any) => mail.to === 'reporter@example.org');
    expect(email.html).toContain('banned the account');
    expect(email.html).not.toMatch(/permanent/i);
  });

  it('keeps the ban on the account and tells the moderator when the address could not be barred', async () => {
    prismaAny.bannedIdentity.upsert.mockRejectedValue(new Error('database refused'));

    const outcome = await processReportById('report-1', 'ban', 'moderator-1', 'Stalking across accounts');

    expect(prismaAny.user.update.mock.calls[0][0].data.bannedAt).toBeInstanceOf(Date);
    expect(outcome.banIdentityRecorded).toBe(false);
  });
});

/**
 * Appeal reversal. appeal.routes.test.ts approves an appeal that is not a
 * reversible type, so the undo path itself had no test: what it lifts, what it
 * restores, and what it admits it cannot bring back.
 */
describe('Reversing enforcement on a successful appeal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaAny.post.updateMany = jest.fn(async () => ({ count: 1 }));
    prismaAny.contentReport.update.mockResolvedValue({ ...REPORT });
  });

  it('lifts the suspension, restores hidden content and clears the report', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, status: 'RESOLVED', action: 'BAN' });
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: true });

    const result = await reverseEnforcement({ userId: 'reported-1', reportId: 'report-1' });

    expect(result).toEqual({
      suspensionLifted: true,
      banLifted: false,
      banKept: false,
      contentRestored: true,
      reportCleared: true,
    });
    expect(prismaAny.user.update).toHaveBeenCalledWith({
      where: { id: 'reported-1' },
      data: { isSuspended: false, suspensionReason: null, suspendedAt: null, suspendedById: null },
    });
    expect(prismaAny.post.updateMany).toHaveBeenCalledWith({ where: { id: 'post-1' }, data: { isHidden: false } });
    expect(prismaAny.contentReport.update.mock.calls[0][0].data).toMatchObject({
      status: 'DISMISSED',
      action: 'NO_ACTION',
    });
  });

  it('puts a hidden event back, as it does a hidden post', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue(null);
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: false });

    const result = await reverseEnforcement({ userId: 'host-1', contentType: 'EVENT', contentId: 'event-1' });

    expect(result.contentRestored).toBe(true);
    expect(prismaAny.event.updateMany).toHaveBeenCalledWith({ where: { id: 'event-1' }, data: { isHidden: false } });
  });

  it.each([
    ['WELLNESS_POST', 'wellnessPost', { isHidden: false, hiddenReason: null }],
    ['WELLNESS_REPLY', 'wellnessReply', { isHidden: false }],
  ])('puts a hidden %s back on an upheld appeal', async (contentType, model, data) => {
    prismaAny.contentReport.findUnique.mockResolvedValue(null);
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: false });

    const result = await reverseEnforcement({ userId: 'author-1', contentType, contentId: 'thing-1' });

    expect(result.contentRestored).toBe(true);
    expect(prismaAny[model].updateMany).toHaveBeenCalledWith({ where: { id: 'thing-1' }, data });
  });

  it('puts a hidden review back on an upheld appeal, and says nothing came back when the review is gone', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue(null);
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: false });

    const result = await reverseEnforcement({ userId: 'author-1', contentType: 'HEALTH_REVIEW', contentId: 'review-1' });
    expect(result.contentRestored).toBe(true);
    expect(prismaAny.healthReview.update).toHaveBeenCalledWith({ where: { id: 'review-1' }, data: { isHidden: false } });
    expect(prismaAny.healthPractitioner.update).toHaveBeenCalledWith({ where: { id: 'pr-1' }, data: { ratingAvg: 4, ratingCount: 2 } });

    const gone = await reverseEnforcement({ userId: 'author-1', contentType: 'HEALTH_REVIEW', contentId: 'review-gone' });
    expect(gone.contentRestored).toBe(false);
  });

  it('does not claim to have lifted a suspension that was not there', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue(null);
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: false });

    const result = await reverseEnforcement({ userId: 'reported-1', contentType: 'POST', contentId: 'post-1' });

    expect(result.suspensionLifted).toBe(false);
    expect(prismaAny.user.update).not.toHaveBeenCalled();
    expect(result.contentRestored).toBe(true);
    expect(result.reportCleared).toBe(false);
  });

  it('lifts a ban, and the bar on the address, only when the appeal was about the ban', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue(null);
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: true, bannedAt: new Date() });
    prismaAny.bannedIdentity.deleteMany.mockResolvedValue({ count: 1 });

    const kept = await reverseEnforcement({ userId: 'reported-1' });
    expect(kept).toMatchObject({ suspensionLifted: false, banLifted: false, banKept: true });
    expect(prismaAny.user.update).not.toHaveBeenCalled();

    const lifted = await reverseEnforcement({ userId: 'reported-1', liftBan: true });
    expect(lifted).toMatchObject({ suspensionLifted: true, banLifted: true, banKept: false });
    expect(prismaAny.user.update.mock.calls[0][0].data).toMatchObject({ isSuspended: false, bannedAt: null, banReason: null });
    expect(prismaAny.bannedIdentity.deleteMany).toHaveBeenCalledWith({ where: { userId: 'reported-1' } });
  });

  it('leaves the report that recorded a ban alone while the ban stands', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue({ ...REPORT, status: 'RESOLVED', action: 'BAN' });
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: true, bannedAt: new Date() });

    const result = await reverseEnforcement({ userId: 'reported-1', reportId: 'report-1' });

    expect(result.reportCleared).toBe(false);
    expect(prismaAny.contentReport.update).not.toHaveBeenCalled();
  });

  it('does not put a taken-down housing listing back on appeal, because its check ended with it', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue(null);
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: false });

    const result = await reverseEnforcement({ userId: 'reported-1', contentType: 'HOUSING_LISTING', contentId: 'listing-1' });

    expect(result.contentRestored).toBe(false);
    // Nothing to undo on a listing that carries no mark.
    expect(prismaAny.housingListing.updateMany).not.toHaveBeenCalled();
  });

  it('lets the lister put the listing back after an upheld appeal, without putting it back for her', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue(null);
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: false });
    prismaAny.housingListing.findUnique.mockResolvedValueOnce({ features: ['Garden', 'staff-takedown:2026-10-01T00:00:00.000Z'] });

    const result = await reverseEnforcement({ userId: 'reported-1', contentType: 'HOUSING_LISTING', contentId: 'listing-1' });

    expect(result.contentRestored).toBe(false);
    expect(prismaAny.housingListing.updateMany).toHaveBeenCalledWith({ where: { id: 'listing-1' }, data: { features: ['Garden'] } });
  });

  it('says a deleted message could not be restored rather than pretending it was', async () => {
    prismaAny.contentReport.findUnique.mockResolvedValue(null);
    prismaAny.user.findUnique.mockResolvedValue({ isSuspended: false });

    const result = await reverseEnforcement({ userId: 'reported-1', contentType: 'MESSAGE', contentId: 'msg-1' });

    expect(result.contentRestored).toBe(false);
  });
});
