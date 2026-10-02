/**
 * Privacy & Data Rights Service
 *
 * DSAR handling, export, erasure, the consent ledger, the processing register,
 * privacy impact assessments and retention, for every member. The home regime
 * is the Privacy Act 1988 (Cth) and the Australian Privacy Principles: access
 * and correction under APP 12 and 13 within a reasonable period (30 days
 * here), destruction or de-identification under APP 11.2 once information is
 * no longer needed, and a record of what is held and why (APP 1.2). UK and EU
 * GDPR rights (Articles 15 to 21, 30 and 35) are served by the same code paths
 * for members there. Where the GDPR is wider than the APPs (restriction,
 * portability) the right is offered to everyone rather than gated by region,
 * since offering more than the law requires harms nobody.
 *
 * The class, file and /api/gdpr mount keep their GDPR names for import and
 * API stability. The APP-by-APP map to this code lives in
 * docs/compliance/AU_PRIVACY_ACT_AND_NDB.md.
 */

import {
  ConsentStatus,
  ConsentType,
  DataCategory,
  DSARStatus,
  DSARType,
  Prisma,
  WomanVerificationStatus,
} from '@prisma/client';
import { prisma } from '../utils/prisma';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { logger } from '../utils/logger';
import { hashOpaqueToken } from '../utils/opaqueToken';
import { sessionEvents } from '../utils/session-events';
import { bestEffort } from '../utils/best-effort';
import { presentSafetyPlan } from '../utils/safety-plan-seal';
import { openText } from '../utils/encryption-key';
import { decryptJson } from './wellness/health-crypto';
import { redactIdentityChecksBeforeErasure } from './identity-verification.service';
import { endBillingBeforeErasure } from './erasure-billing.service';
import { chatFilesOfMember, deleteChatAttachmentFiles } from './chat-attachment-cleanup.service';
import { PRIVACY_CONTACT_ROUTE, resolveContactEmail } from '../config/region.config';
import { emailService } from './email.service';
import {
  consentService,
  parseRestrictedProcessing,
  RestrictableProcessing,
} from './consent.service';

// ============================================
// Register of personal data
// ============================================

/**
 * What erasure does with a table.
 *
 * delete        the rows describe nothing but this member, so they go
 * detach        the link to the member is nullable, so the row survives
 *               without naming anybody
 * pseudonymise  the link is not nullable and carries no foreign key, so it is
 *               replaced with a one-way hash of the member id
 * retain        a legal duty keeps the row exactly as it stands
 * skip          deliberately outside both rights; `reason` says why
 */
type ErasureAction = 'delete' | 'detach' | 'pseudonymise' | 'retain' | 'skip';

interface PersonalDataModel {
  /** Prisma delegate name, e.g. `dSARRequest` for model DSARRequest. */
  model: string;
  /** Key this table appears under in an export bundle; unique across the register. */
  section: string;
  /** Columns tying a row to the data subject. Empty when `where` is used instead. */
  keys: string[];
  /** For tables that only reach the member through a parent row. */
  where?: (userId: string) => Record<string, unknown>;
  erasure: ErasureAction;
  /**
   * Set when the retained rows hold a non-null foreign key to User. While any
   * exist the account row cannot be dropped, only stripped back to a shell.
   */
  holdsAccount?: true;
  /**
   * For a table whose columns are kept sealed: a row as the member should read
   * it back in an export. An export of ciphertext is no export at all.
   */
  readable?: (row: Record<string, unknown>) => object;
  /** Left out of the export bundle; `reason` then explains why. */
  exportable?: false;
  /** Required for retain, skip, and anything not exportable. */
  reason?: string;
}

/**
 * A row with one sealed column opened, for an export. A column this host cannot
 * open (the key it was sealed under is gone) comes back null and is named in
 * `unreadable`, so the member is told a record exists that cannot be read, and
 * is never handed ciphertext as though it were what she wrote.
 */
function withOpenedColumn(
  row: Record<string, unknown>,
  column: string,
  open: (stored: string) => unknown
): object {
  const stored = row[column];
  if (typeof stored !== 'string') return row;
  const opened = open(stored);
  if (opened === null || opened === undefined) return { ...row, [column]: null, unreadable: [column] };
  return { ...row, [column]: opened };
}

/** A health record's sealed JSON, opened. */
const openedJson = (column: string) => (row: Record<string, unknown>) =>
  withOpenedColumn(row, column, (stored) => decryptJson(stored));

/**
 * What a member who was reported is handed of a record about her, and nothing
 * else: the columns are named here, so a column added to the table later is not
 * in her export until somebody has decided that it may be.
 *
 * She is entitled to know that a complaint was made, what it was about and what
 * became of it. She is not handed who made it or anything the complainant wrote
 * or attached, because for a woman who reported a man, or blocked him, an export
 * is the one place he could be told her name: the reporter's account id, the
 * description she typed, the copy a report keeps of the thread it is about
 * (which holds the reporter's own earlier messages), the contact address an
 * anonymous reporter left, and the moderators' working notes, which are written
 * by reading all of that. The moderator who decided it is a colleague's name and
 * not hers to be given, and what an automated screen made of the content is
 * staff's own assessment.
 */
const shownFrom = (columns: readonly string[]) => (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).filter(([column]) => columns.includes(column)));

/** The columns of a content report that its subject is shown. Held to the schema by the register test. */
export const REPORT_COLUMNS_SHOWN_TO_SUBJECT = [
  'id',
  'reportedUserId',
  'contentType',
  'contentId',
  'reason',
  'status',
  'action',
  'actionTakenAt',
  'createdAt',
  'updatedAt',
] as const;

/** The columns of a safety incident that its subject is shown. Held to the schema by the register test. */
export const INCIDENT_COLUMNS_SHOWN_TO_SUBJECT = [
  'id',
  'userId',
  'type',
  'severity',
  'reason',
  'contentType',
  'contentId',
  'verified',
  'resolvedAt',
  'createdAt',
  'updatedAt',
] as const;

/**
 * The columns of a staff flag that its subject is shown: that one was raised, of
 * what kind and how serious, and when it was closed. Not its reason or its notes,
 * which are staff's working words, nor who raised it or who closed it. Held to
 * the schema by the register test.
 */
export const FLAG_COLUMNS_SHOWN_TO_SUBJECT = ['id', 'userId', 'type', 'severity', 'resolvedAt', 'createdAt', 'updatedAt'] as const;

/**
 * The kinds of staff flag that are raised from what other members did to a
 * member, or from the standing measure that is worked out from it, and so are
 * not in her export at all:
 *
 *   SAFETY_CRITICAL   raised when the safety score falls under 25, and its reason
 *                     says "Safety score dropped to N". The export withholds the
 *                     score itself (STAFF_ONLY_ACCOUNT_COLUMNS) because a score
 *                     that fell the day after a block says who blocked; a flag
 *                     that states it, and the day it was raised, would say it
 *                     again.
 *   UNWANTED_CONTACT  raised when several different members have declined,
 *                     blocked or reported her message requests, and its notes
 *                     count each.
 *   PILE_ON           raised on the person being contacted by a crowd, and its
 *                     notes list the accounts that did it.
 *
 * The names are the ones the services that raise them use (safety-score.service,
 * unwanted-contact.service and pile-on.service); the register test reads those
 * files and fails if one of them is renamed without this list being told.
 */
export const STAFF_MEASURE_FLAG_TYPES = ['SAFETY_CRITICAL', 'UNWANTED_CONTACT', 'PILE_ON'] as const;

/**
 * The columns of a member's stored trust record that she is handed. Not the
 * stored score, the community-feedback figure, the count of reports against her
 * or the date of the last incident: each is moved by a report or by a block
 * another member made (trust.service: recordSafetyReport and recordUserBlock,
 * the second of which counts a block as a report against her), so the record
 * would say that one was made, and the date of it. Not its own created and
 * updated dates either, which are the date of the first such event. Held to the
 * schema by the register test.
 *
 * This is not the figure on her Trust page, which is worked out from her
 * profile each time she looks (calculateTrustScore) and is shown to her.
 */
export const TRUST_RECORD_COLUMNS_SHOWN_TO_SUBJECT = [
  'id',
  'userId',
  'identityVerified',
  'identityScore',
  'accountAge',
  'accountAgeScore',
  'engagementScore',
  'professionalScore',
  'badges',
  'warningsCount',
  'suspensionsCount',
  'reportsSubmitted',
  'reportAccuracy',
] as const;

/**
 * Keys of an audit entry's details that hold a member of staff's own working
 * words, or something a reporter supplied. A moderator's note on a report is
 * written by reading the reporter's description and the evidence it kept, and the
 * audit trail keeps a copy of it (admin.routes: the MODERATION_ actions), so withholding
 * the note from the report and handing it back from here would hand it back.
 */
const STAFF_WORDS_IN_AUDIT_DETAILS: readonly string[] = [
  'notes',
  'note',
  'reviewNotes',
  'decisionNote',
  'reporterId',
  'reporterEmail',
  'contactEmail',
  'description',
  'evidence',
];

/**
 * An audit entry about her, as she is handed it. When it was her own act she is
 * handed it as it was. When somebody else did it, she is not given who (a member
 * of staff's account, address and browser belong to them, not to her), nor the
 * words they wrote or a reporter supplied.
 */
const auditEntryAboutHer = (row: Record<string, unknown>): object => {
  if (row.actorUserId && row.actorUserId === row.targetUserId) return row;
  const { actorUserId: _actor, ipAddress: _address, userAgent: _browser, metadata, ...rest } = row;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return {
      ...rest,
      metadata: Object.fromEntries(Object.entries(metadata).filter(([key]) => !STAFF_WORDS_IN_AUDIT_DETAILS.includes(key))),
    };
  }
  return metadata === undefined ? rest : { ...rest, metadata };
};

/**
 * Every table holding personal data about a member. Both data subject rights
 * walk this list in order, so a table missing from it is invisible to export
 * and survives erasure: add an entry whenever you add a table that stores a
 * member id. Erasure deletes top to bottom, which is why rows that a foreign
 * key would otherwise pin come first.
 */
export const PERSONAL_DATA_MODELS: PersonalDataModel[] = [
  // Children whose parent rows cannot be removed while they exist. Several of
  // these would also fall to a database cascade when the parent goes, but the
  // register is what the export reads, and a table only a cascade covers is a
  // table a member can never be shown.
  { model: 'milestoneProgress', section: 'programMilestoneProgress', keys: [], where: (userId) => ({ enrollment: { userId } }), erasure: 'delete' },
  { model: 'savingsContribution', section: 'savingsContributions', keys: [], where: (userId) => ({ goal: { userId } }), erasure: 'delete' },
  { model: 'rfpResponse', section: 'rfpResponsesReceived', keys: [], where: (userId) => ({ rfp: { userId } }), erasure: 'delete' },
  { model: 'habitLog', section: 'habitLogs', keys: [], where: (userId) => ({ habit: { userId } }), erasure: 'delete' },
  { model: 'storyHighlightItem', section: 'storyHighlightItems', keys: [], where: (userId) => ({ highlight: { userId } }), erasure: 'delete' },
  { model: 'vehicleServiceRecord', section: 'vehicleServiceRecords', keys: [], where: (userId) => ({ vehicle: { userId } }), erasure: 'delete' },
  { model: 'bankTransaction', section: 'bankTransactions', keys: [], where: (userId) => ({ bankAccount: { connection: { userId } } }), erasure: 'delete' },
  { model: 'bankAccount', section: 'bankAccounts', keys: [], where: (userId) => ({ connection: { userId } }), erasure: 'delete' },

  // The domestic violence safety tables. These hang off DvSafetyProfile rather
  // than off the account, which is how they came to be missing from the
  // register entirely: an erasure request used to leave a member's covert safe
  // chats, her panic alert history and her emergency contacts on the platform.
  {
    model: 'dvSafeMessage',
    section: 'dvSafeChatMessages',
    keys: [],
    where: (userId) => ({ chat: { profile: { userId } } }),
    erasure: 'delete',
    exportable: false,
    reason:
      'The same messages as dvSafeMessagesSent, reached through the chat they sit in. A safe chat belongs to one member and holds only what she wrote, so they are handed back once, readable, under dvSafeMessagesSent.',
  },
  { model: 'dvPanicAlert', section: 'dvPanicAlerts', keys: [], where: (userId) => ({ profile: { userId } }), erasure: 'delete' },
  // A ban outlives the account it started from, or it is not a ban: erasing the
  // account of someone banned for threatening a member must not let them sign
  // up again the same afternoon. So the row is kept and only its link to the
  // erased account goes — it holds a keyed hash of an address, never the
  // address itself, and with the link gone it identifies nobody.
  {
    model: 'bannedIdentity',
    section: 'bannedIdentity',
    keys: ['userId'],
    erasure: 'detach',
    exportable: false,
    reason:
      'Kept to stop a banned person rejoining under the same address. Access is withheld under APP 12.3(b) and (e): the row links the ban to a report, and disclosing it could identify the member who made that report.',
  },
  {
    model: 'bannedIdentity',
    section: 'bansRecorded',
    keys: ['createdById'],
    erasure: 'pseudonymise',
    exportable: false,
    reason:
      'A ban recorded by a member of staff stays in force when that staff account is erased; only the name of who recorded it is replaced.',
  },
  {
    model: 'dvSafeChat',
    section: 'dvSafeChats',
    keys: [],
    where: (userId) => ({ profile: { userId } }),
    erasure: 'delete',
    exportable: false,
    reason:
      'The disguised name and the PIN hash on a safe chat are there to hide the chat and lock it, not records about her. A safe chat has one member in it, so there is no one else it could name.',
  },

  // Engagement signals.
  { model: 'like', section: 'postLikes', keys: ['userId'], erasure: 'delete' },
  { model: 'postSave', section: 'postSaves', keys: ['userId'], erasure: 'delete' },
  { model: 'videoLike', section: 'videoLikes', keys: ['userId'], erasure: 'delete' },
  { model: 'videoSave', section: 'videoSaves', keys: ['userId'], erasure: 'delete' },
  { model: 'videoView', section: 'videoViews', keys: ['userId'], erasure: 'detach' },
  { model: 'messageReaction', section: 'messageReactions', keys: ['userId'], erasure: 'delete' },
  { model: 'channelMessageReaction', section: 'channelMessageReactions', keys: ['userId'], erasure: 'delete' },
  { model: 'follow', section: 'follows', keys: ['followerId', 'followingId'], erasure: 'delete' },
  { model: 'eventSave', section: 'eventSaves', keys: ['userId'], erasure: 'delete' },
  { model: 'savedJob', section: 'savedJobs', keys: ['userId'], erasure: 'delete' },
  { model: 'serviceFavorite', section: 'serviceFavorites', keys: ['userId'], erasure: 'delete' },
  { model: 'apprenticeshipBookmark', section: 'apprenticeshipBookmarks', keys: ['userId'], erasure: 'delete' },
  { model: 'usageLog', section: 'featureUsage', keys: ['userId'], erasure: 'delete' },
  { model: 'xpTransaction', section: 'xpTransactions', keys: ['userId'], erasure: 'delete' },
  { model: 'userStreak', section: 'streaks', keys: ['userId'], erasure: 'delete' },
  { model: 'userAchievement', section: 'achievements', keys: ['userId'], erasure: 'delete' },
  { model: 'notification', section: 'notifications', keys: ['userId'], erasure: 'delete' },
  { model: 'commentLike', section: 'commentLikes', keys: ['userId'], erasure: 'delete' },
  { model: 'pollVote', section: 'pollVotes', keys: ['userId'], erasure: 'delete' },
  // PostImpression stores the member id twice: once in userId and once as the
  // viewerKey, which for a signed-in reader is the id itself. Detaching would
  // clear one and leave the other, so the rows go.
  { model: 'postImpression', section: 'postImpressions', keys: ['userId'], erasure: 'delete' },
  { model: 'statusView', section: 'storyViews', keys: ['userId'], erasure: 'delete' },
  { model: 'vehicleListingSave', section: 'vehicleListingSaves', keys: ['userId'], erasure: 'delete' },
  { model: 'followRequest', section: 'followRequests', keys: ['requesterId', 'targetId'], erasure: 'delete' },
  { model: 'closeFriend', section: 'closeFriends', keys: ['userId', 'friendId'], erasure: 'delete' },
  { model: 'wellnessSupport', section: 'wellnessSupports', keys: ['userId'], erasure: 'delete' },

  // Conversation and comment content.
  { model: 'comment', section: 'comments', keys: ['authorId'], erasure: 'delete' },
  { model: 'videoComment', section: 'videoComments', keys: ['authorId'], erasure: 'delete' },
  { model: 'message', section: 'messages', keys: ['senderId', 'receiverId'], erasure: 'delete' },
  { model: 'conversationParticipant', section: 'conversations', keys: ['userId'], erasure: 'delete' },
  { model: 'liveStreamMessage', section: 'liveStreamMessages', keys: ['userId'], erasure: 'delete' },
  // A host's silence on a viewer. Both columns are member ids with no foreign
  // key behind them, so the rows go by key, whichever side the member was on.
  { model: 'liveStreamMute', section: 'liveStreamMutes', keys: ['userId', 'mutedById'], erasure: 'delete' },
  { model: 'wellnessReply', section: 'wellnessReplies', keys: ['authorId'], erasure: 'delete' },

  // Memberships, applications and bookings.
  { model: 'groupMember', section: 'groupMemberships', keys: ['userId'], erasure: 'delete' },
  { model: 'groupJoinRequest', section: 'groupJoinRequests', keys: ['userId'], erasure: 'delete' },
  { model: 'groupJoinRequest', section: 'groupJoinRequestsReviewed', keys: ['reviewedById'], erasure: 'detach' },
  { model: 'channelMember', section: 'channelMemberships', keys: ['userId'], erasure: 'delete' },
  { model: 'eventRegistration', section: 'eventRegistrations', keys: ['userId'], erasure: 'delete' },
  { model: 'courseEnrollment', section: 'courseEnrollments', keys: ['userId'], erasure: 'delete' },
  { model: 'educationApplication', section: 'educationApplications', keys: ['userId'], erasure: 'delete' },
  { model: 'apprenticeshipApplication', section: 'apprenticeshipApplications', keys: ['userId'], erasure: 'delete' },
  { model: 'apprenticeshipMilestoneSubmission', section: 'apprenticeshipMilestonesReviewed', keys: ['reviewerId'], erasure: 'detach' },
  { model: 'jobApplication', section: 'jobApplications', keys: ['userId'], erasure: 'delete' },
  { model: 'referenceRequest', section: 'referenceRequests', keys: ['candidateId'], erasure: 'delete' },
  { model: 'organizationMember', section: 'organizationMemberships', keys: ['userId'], erasure: 'delete' },
  { model: 'programEnrollment', section: 'supportProgramEnrollments', keys: ['userId'], erasure: 'delete' },
  { model: 'bridgingEnrollment', section: 'bridgingEnrollments', keys: ['userId'], erasure: 'delete' },
  { model: 'acceleratorEnrollment', section: 'acceleratorEnrollments', keys: ['userId'], erasure: 'delete' },
  { model: 'grantApplication', section: 'grantApplications', keys: ['userId'], erasure: 'delete' },
  { model: 'investorIntroduction', section: 'investorIntroductions', keys: ['userId'], erasure: 'delete' },
  { model: 'vendorReview', section: 'vendorReviews', keys: ['userId'], erasure: 'delete' },
  { model: 'housingInquiry', section: 'housingInquiries', keys: ['userId'], erasure: 'delete' },
  // The places she listed carry her street address and her own note on why each
  // is safe, with no foreign key to her account (HousingListing.agentId is a bare
  // column), so they were in neither her export nor her erasure.
  //
  // The inquiries other women sent about those places go first, because the
  // foreign key refuses to delete a listing that still has one. They are those
  // women's records of asking and are not handed back to her: on a confidential
  // listing she is only ever shown each of them as an alias.
  {
    model: 'housingInquiry',
    section: 'housingInquiriesOnHerListings',
    keys: [],
    where: (userId) => ({ listing: { agentId: userId } }),
    erasure: 'delete',
    exportable: false,
    reason:
      'Inquiries other members sent about a place she listed. They belong to the women who asked, and on a confidential listing the lister is shown each one as an alias so that she cannot tell who asked; they are removed with the listing and are not handed back to her.',
  },
  { model: 'housingListing', section: 'housingListings', keys: ['agentId'], erasure: 'delete' },
  // Her own provider check: what she told ATHENA about herself as a lister, and
  // what staff recorded. Staff's notes about her are hers to read (APP 12).
  { model: 'housingProviderVerification', section: 'housingProviderVerification', keys: ['userId'], erasure: 'delete' },
  {
    model: 'housingProviderVerification',
    section: 'housingProvidersReviewed',
    keys: ['reviewedById'],
    erasure: 'detach',
    exportable: false,
    reason: 'The provider checks a member of staff decided are other members\' records; naming them would hand one member another\'s details.',
  },
  // An attestation is the organisation's record that a host employer was
  // checked before apprentices were placed with it, so it outlives the person
  // who filled it in; only her name goes.
  { model: 'hostEmployerSafetyAttestation', section: 'hostSafetyAttestationsMade', keys: ['attestedById'], erasure: 'detach' },
  {
    model: 'hostEmployerSafetyAttestation',
    section: 'hostSafetyAttestationsReviewed',
    keys: ['reviewedById'],
    erasure: 'detach',
    exportable: false,
    reason: 'An attestation a member of staff reviewed belongs to the organisation that made it, not to the reviewer.',
  },
  { model: 'insuranceApplication', section: 'insuranceApplications', keys: ['userId'], erasure: 'delete' },
  { model: 'indigenousCommunityMember', section: 'indigenousCommunityMemberships', keys: ['userId'], erasure: 'delete' },
  { model: 'internationalCredential', section: 'internationalCredentials', keys: ['userId'], erasure: 'delete' },
  { model: 'impactMetric', section: 'impactMetrics', keys: ['userId'], erasure: 'delete' },
  { model: 'userOutcome', section: 'outcomes', keys: ['userId'], erasure: 'delete' },
  { model: 'serviceBooking', section: 'serviceBookings', keys: ['clientId'], erasure: 'delete' },
  { model: 'serviceOrder', section: 'serviceOrders', keys: ['clientId'], erasure: 'delete' },
  { model: 'serviceProposal', section: 'serviceProposals', keys: ['providerId'], erasure: 'delete' },
  { model: 'serviceReview', section: 'serviceReviews', keys: ['clientId'], erasure: 'delete' },
  { model: 'serviceRequest', section: 'serviceRequests', keys: ['clientId'], erasure: 'delete' },
  { model: 'mentorSession', section: 'mentorSessions', keys: ['menteeId'], erasure: 'delete' },
  { model: 'lessonProgress', section: 'lessonProgress', keys: ['userId'], erasure: 'delete' },
  { model: 'courseCertificate', section: 'courseCertificates', keys: ['userId'], erasure: 'delete' },
  { model: 'wellnessCircleCheckIn', section: 'wellnessCircleCheckIns', keys: ['userId'], erasure: 'delete' },
  { model: 'wellnessCircleMember', section: 'wellnessCircleMemberships', keys: ['userId'], erasure: 'delete' },
  { model: 'wellnessChallengeMember', section: 'wellnessChallengeMemberships', keys: ['userId'], erasure: 'delete' },
  { model: 'healthReview', section: 'healthReviews', keys: ['userId'], erasure: 'delete' },
  {
    model: 'healthBooking',
    section: 'healthBookings',
    keys: ['userId'],
    erasure: 'delete',
    // The reason she gave is sealed as {"text": "..."}; she is handed the text.
    readable: (row) =>
      withOpenedColumn(row, 'reason', (stored) => {
        const opened = decryptJson<{ text?: string }>(stored);
        return opened === null ? null : (opened.text ?? '');
      }),
  },
  { model: 'mechanicReview', section: 'mechanicReviews', keys: ['userId'], erasure: 'delete' },
  { model: 'mechanicBooking', section: 'mechanicBookings', keys: ['userId'], erasure: 'delete' },
  { model: 'carReview', section: 'carReviews', keys: ['userId'], erasure: 'delete' },
  { model: 'testDriveRequest', section: 'testDriveRequests', keys: ['userId'], erasure: 'delete' },
  { model: 'tradeInRequest', section: 'tradeInRequests', keys: ['userId'], erasure: 'delete' },
  { model: 'vehicleInspection', section: 'vehicleInspectionsRequested', keys: ['requestedById'], erasure: 'delete' },
  { model: 'carFinanceApplication', section: 'carFinanceApplications', keys: ['userId'], erasure: 'delete' },

  // Content and listings the member owns. Removing these takes their replies,
  // likes and registrations with them.
  { model: 'groupPost', section: 'groupPosts', keys: ['authorId'], erasure: 'delete' },
  { model: 'post', section: 'posts', keys: ['authorId'], erasure: 'delete' },
  { model: 'status', section: 'statuses', keys: ['userId'], erasure: 'delete' },
  { model: 'video', section: 'videos', keys: ['authorId'], erasure: 'delete' },
  { model: 'channelMessage', section: 'channelMessages', keys: ['authorId'], erasure: 'delete' },
  { model: 'channel', section: 'channelsOwned', keys: ['ownerId'], erasure: 'delete' },
  { model: 'group', section: 'groupsCreated', keys: ['createdById'], erasure: 'delete' },
  { model: 'job', section: 'jobsPosted', keys: ['postedById'], erasure: 'delete' },
  { model: 'skillService', section: 'skillServices', keys: ['providerId'], erasure: 'delete' },
  { model: 'rfp', section: 'rfps', keys: ['userId'], erasure: 'delete' },
  { model: 'referral', section: 'referrals', keys: ['referrerId', 'referredId'], erasure: 'delete' },
  { model: 'liveStream', section: 'liveStreams', keys: ['hostId'], erasure: 'delete' },
  { model: 'storyHighlight', section: 'storyHighlights', keys: ['userId'], erasure: 'delete' },
  { model: 'savedCollection', section: 'savedCollections', keys: ['userId'], erasure: 'delete' },
  { model: 'postDraft', section: 'postDrafts', keys: ['userId'], erasure: 'delete' },
  { model: 'article', section: 'articlesAuthored', keys: ['authorId'], erasure: 'delete' },
  { model: 'wellnessPost', section: 'wellnessPosts', keys: ['authorId'], erasure: 'delete' },
  { model: 'wellnessCircle', section: 'wellnessCirclesFacilitated', keys: ['facilitatorId'], erasure: 'delete' },
  { model: 'wellnessChallenge', section: 'wellnessChallengesCreated', keys: ['createdById'], erasure: 'delete' },
  { model: 'vehicle', section: 'vehicles', keys: ['userId'], erasure: 'delete' },
  // Feedback keeps the sender's email beside the optional account link, so
  // nulling the link alone would leave her addressable in the admin queue.
  { model: 'feedback', section: 'feedbackSubmitted', keys: ['userId'], erasure: 'delete' },

  // A car sale is two members deep. A listing or an offer that never took money
  // is hers to erase; one that settled is the counterparty's record as well,
  // and the listing cascades its purchases, so removing it would erase a buyer
  // the request never mentioned. The filter is what separates the two.
  {
    model: 'vehiclePurchase',
    section: 'vehiclePurchasesUnpaid',
    keys: [],
    where: (userId) => ({
      OR: [{ buyerId: userId }, { sellerId: userId }],
      paidAt: null,
    }),
    erasure: 'delete',
  },
  {
    model: 'vehicleListing',
    section: 'vehicleListings',
    keys: [],
    where: (userId) => ({
      sellerId: userId,
      purchases: { none: { paidAt: { not: null } } },
    }),
    erasure: 'delete',
  },

  // Profiles, settings and derived insight, including special category data.
  { model: 'profile', section: 'profile', keys: ['userId'], erasure: 'delete' },
  {
    model: 'creatorProfile',
    section: 'creatorProfile',
    keys: ['userId'],
    erasure: 'delete',
    // Whether withdrawals are paused is hers to know and stays in what she is
    // handed. Why is a note for ATHENA's team: it names a card dispute by its
    // Stripe id, which is another member's payment, and the profile and wallet
    // routes already leave it out (getCreatorProfile).
    readable: (row) => {
      const { payoutHoldReason: _staffNote, ...hers } = row;
      return hers;
    },
  },
  { model: 'mentorProfile', section: 'mentorProfile', keys: ['userId'], erasure: 'delete' },
  { model: 'creatorAnalytics', section: 'creatorAnalytics', keys: ['userId'], erasure: 'delete' },
  { model: 'userFeedPreferences', section: 'feedPreferences', keys: ['userId'], erasure: 'delete' },
  { model: 'userSafetySettings', section: 'safetySettings', keys: ['userId'], erasure: 'delete' },
  // The stored standing record: moved by reports and blocks other members made, so
  // she is handed only what is not (see TRUST_RECORD_COLUMNS_SHOWN_TO_SUBJECT).
  {
    model: 'userTrustScore',
    section: 'trustScore',
    keys: ['userId'],
    erasure: 'delete',
    readable: shownFrom(TRUST_RECORD_COLUMNS_SHOWN_TO_SUBJECT),
  },
  { model: 'financialHealthScore', section: 'financialHealthScore', keys: ['userId'], erasure: 'delete' },
  { model: 'languageProfile', section: 'languageProfile', keys: ['userId'], erasure: 'delete' },
  { model: 'safetyPlan', section: 'safetyPlan', keys: ['userId'], erasure: 'delete', readable: presentSafetyPlan },
  { model: 'accessibilityProfile', section: 'accessibilityProfile', keys: ['userId'], erasure: 'delete' },
  { model: 'savingsGoal', section: 'savingsGoals', keys: ['userId'], erasure: 'delete' },
  { model: 'superannuationAccount', section: 'superannuationAccounts', keys: ['userId'], erasure: 'delete' },
  { model: 'education', section: 'education', keys: ['userId'], erasure: 'delete' },
  { model: 'workExperience', section: 'workExperience', keys: ['userId'], erasure: 'delete' },
  { model: 'userSkill', section: 'skills', keys: ['userId'], erasure: 'delete' },
  { model: 'careerPrediction', section: 'careerPredictions', keys: ['userId'], erasure: 'delete' },
  { model: 'opportunityMatch', section: 'opportunityMatches', keys: ['userId'], erasure: 'delete' },
  { model: 'salaryAnalysis', section: 'salaryAnalyses', keys: ['userId'], erasure: 'delete' },
  { model: 'mentorMatchScore', section: 'mentorMatchScores', keys: ['menteeId', 'mentorId'], erasure: 'delete' },
  { model: 'businessRegistration', section: 'businessRegistrations', keys: ['userId'], erasure: 'delete' },
  { model: 'dvSafetyProfile', section: 'dvSafetyProfile', keys: ['userId'], erasure: 'delete' },

  // Health and wellbeing. Article 9 special category data under the GDPR and
  // sensitive information under APP 3; the reason a gap here matters more than
  // a gap in, say, saved jobs.
  { model: 'healthSettings', section: 'healthSettings', keys: ['userId'], erasure: 'delete' },
  // What a health record says is sealed in one column. An export of ciphertext
  // is no export, so each of these hands the member the opened record.
  { model: 'healthEntry', section: 'healthEntries', keys: ['userId'], erasure: 'delete', readable: openedJson('payload') },
  { model: 'medication', section: 'medications', keys: ['userId'], erasure: 'delete', readable: openedJson('details') },
  { model: 'healthNote', section: 'healthNotes', keys: ['userId'], erasure: 'delete', readable: openedJson('content') },
  { model: 'healthShare', section: 'healthShares', keys: ['userId'], erasure: 'delete' },
  { model: 'mentalLoadEntry', section: 'mentalLoadEntries', keys: ['userId'], erasure: 'delete' },
  { model: 'habit', section: 'habits', keys: ['userId'], erasure: 'delete' },
  { model: 'wellnessGoal', section: 'wellnessGoals', keys: ['userId'], erasure: 'delete' },

  // Money the member tracks rather than money the platform took: her own
  // ledger, not a record anybody has a duty to keep.
  { model: 'bankConnection', section: 'bankConnections', keys: ['userId'], erasure: 'delete' },
  { model: 'netWorthSnapshot', section: 'netWorthSnapshots', keys: ['userId'], erasure: 'delete' },
  { model: 'portfolioHolding', section: 'portfolioHoldings', keys: ['userId'], erasure: 'delete' },
  { model: 'strategyPlan', section: 'strategyPlans', keys: ['userId'], erasure: 'delete' },

  // Verification, appeals and moderation.
  { model: 'verificationBadge', section: 'verificationBadges', keys: ['userId'], erasure: 'delete' },
  { model: 'verificationBadge', section: 'verificationsReviewed', keys: ['reviewedById'], erasure: 'detach' },
  { model: 'appeal', section: 'appeals', keys: ['userId'], erasure: 'delete' },
  { model: 'appeal', section: 'appealsReviewed', keys: ['reviewedById'], erasure: 'detach' },
  // What moderation recorded about this member, as it concerns her: that a report
  // was made, what it was about and how it ended. Not who made it, and not the
  // reporter's own words: reporterId is the reporter's account, or for a block the
  // blocker's, and metadata holds an anonymous reporter's description and contact
  // address. resolvedById is the moderator who closed it.
  {
    model: 'safetyIncident',
    section: 'safetyIncidents',
    keys: ['userId'],
    where: (userId) => ({ userId, type: { not: 'BLOCK' } }),
    erasure: 'delete',
    readable: shownFrom(INCIDENT_COLUMNS_SHOWN_TO_SUBJECT),
  },
  // A block is the one thing ATHENA never tells the person it is made against:
  // every other surface answers her as though the blocker did not exist, so the
  // closed door does not say why it is closed. A row saying she was blocked, and
  // when, would tell a man whom a woman has blocked that she has, and the date
  // is usually enough to say which one. The export says so plainly (below) and
  // the rows go with the account on erasure like every other.
  {
    model: 'safetyIncident',
    section: 'safetyIncidentsBlocks',
    keys: ['userId'],
    where: (userId) => ({ userId, type: 'BLOCK' }),
    erasure: 'delete',
    exportable: false,
    reason:
      'Blocks other members have made. They are not part of an export because the date of a block, with the member it follows, would tell the person blocked who blocked her. A block is never announced to the person it is made against.',
  },
  {
    model: 'safetyIncident',
    section: 'safetyIncidentsReported',
    keys: ['reporterId'],
    erasure: 'detach',
    exportable: false,
    reason: 'Naming the incidents a member reported would identify the people they reported.',
  },
  // What staff flagged about her, as it concerns her: that a flag was raised, what
  // kind and when. Not the flags that are made of other members' reports, blocks
  // and contact (STAFF_MEASURE_FLAG_TYPES, next), and not staff's reason or notes,
  // which state scores and counts and list accounts.
  {
    model: 'adminFlag',
    section: 'adminFlags',
    keys: ['userId'],
    where: (userId) => ({ userId, type: { notIn: [...STAFF_MEASURE_FLAG_TYPES] } }),
    erasure: 'delete',
    readable: shownFrom(FLAG_COLUMNS_SHOWN_TO_SUBJECT),
  },
  {
    model: 'adminFlag',
    section: 'adminFlagsStaffMeasures',
    keys: ['userId'],
    where: (userId) => ({ userId, type: { in: [...STAFF_MEASURE_FLAG_TYPES] } }),
    erasure: 'delete',
    exportable: false,
    reason:
      'Flags staff raised from the standing measure and from how many other members have declined, blocked, reported or contacted the account. They state scores and counts and list accounts, and a flag with its date would tell the member who reported or blocked her, or who was contacting her, so they are not handed out.',
  },
  {
    model: 'safetyIncident',
    section: 'safetyIncidentsResolved',
    keys: ['resolvedById'],
    erasure: 'detach',
    exportable: false,
    reason: 'Naming the incidents a member closed would identify the people those incidents are about.',
  },
  {
    model: 'adminFlag',
    section: 'adminFlagsResolved',
    keys: ['resolvedById'],
    erasure: 'detach',
    exportable: false,
    reason: 'Moderation decisions belong to the flagged member, not to the moderator who closed them.',
  },
  {
    model: 'dvSafeMessage',
    section: 'dvSafeMessagesSent',
    keys: ['senderId'],
    erasure: 'pseudonymise',
    // Stored sealed under DV_ENCRYPTION_KEY. The export hands back what she
    // wrote, not the ciphertext; one the key can no longer open is marked.
    readable: (row) => withOpenedColumn(row, 'content', (stored) => openText('safe-chat', stored)),
    reason:
      'A safe chat message names its sender without a foreign key to the account, so on erasure the link becomes a one-way hash. The text is sealed in the database and is opened here, so the export is something she can read.',
  },
  {
    model: 'adminFlag',
    section: 'adminFlagsRaised',
    keys: ['flaggedById'],
    erasure: 'pseudonymise',
    exportable: false,
    reason: 'Moderation decisions belong to the flagged member, not to the moderator who recorded them.',
  },
  {
    model: 'moderationLog',
    section: 'moderationDecisions',
    keys: ['moderatorId'],
    erasure: 'pseudonymise',
    exportable: false,
    reason: 'Moderation decisions belong to the reported member, not to the moderator who took them.',
  },
  {
    model: 'contentReport',
    section: 'reportsSubmitted',
    keys: ['reporterId'],
    erasure: 'retain',
    holdsAccount: true,
    reason: 'Online Safety Act record of a complaint and how it was handled.',
  },
  {
    model: 'contentReport',
    section: 'reportsReceived',
    keys: ['reportedUserId'],
    erasure: 'retain',
    holdsAccount: true,
    // She is told that a report was made about her and what became of it, never
    // who made it or what they wrote. The reporter's id, what she typed, the
    // copy a report keeps of the thread it is about (which holds the reporter's
    // own earlier messages), and the moderators' notes written from all of that
    // are the reporter's, and in a case of harassment or violence an export is
    // the way a person finds out who reported them. REPORT_COLUMNS_SHOWN_TO_SUBJECT
    // names what she is given; anything else is left out.
    readable: shownFrom(REPORT_COLUMNS_SHOWN_TO_SUBJECT),
    reason: 'Online Safety Act record of a complaint and how it was handled.',
  },

  // Consent and privacy records. The DSAR row goes with the account because the
  // proof that the request was honoured lives in PrivacyAuditLog, which has no
  // foreign key and therefore outlives the member.
  { model: 'consentRecord', section: 'consents', keys: ['userId'], erasure: 'delete' },
  { model: 'cookieConsent', section: 'cookieConsents', keys: ['userId'], erasure: 'detach' },
  { model: 'dSARRequest', section: 'dataSubjectRequests', keys: ['userId'], erasure: 'delete' },
  {
    model: 'privacyAuditLog',
    section: 'privacyAuditTrail',
    keys: ['userId'],
    erasure: 'pseudonymise',
    reason: 'Seven year accountability record; the member id is replaced with a one-way hash.',
  },
  {
    model: 'auditLog',
    section: 'auditTrailAsActor',
    keys: ['actorUserId'],
    erasure: 'detach',
    reason: 'Seven year accountability record kept without the member link.',
  },
  {
    model: 'auditLog',
    section: 'auditTrailAsTarget',
    keys: ['targetUserId'],
    erasure: 'detach',
    // Without who acted on her, and without the words they wrote (see auditEntryAboutHer).
    readable: auditEntryAboutHer,
    reason: 'Seven year accountability record kept without the member link.',
  },

  // Credentials and devices.
  {
    model: 'session',
    section: 'sessions',
    keys: ['userId'],
    erasure: 'delete',
    exportable: false,
    reason: 'Session rows carry live tokens; handing them back would hand over the account.',
  },
  {
    model: 'verificationToken',
    section: 'verificationTokens',
    keys: ['userId'],
    erasure: 'delete',
    exportable: false,
    reason: 'Verification tokens are credentials, not a record of the member.',
  },
  {
    model: 'pushToken',
    section: 'pushTokens',
    keys: ['userId'],
    erasure: 'delete',
    exportable: false,
    reason: 'Device push tokens can be replayed to address the device directly.',
  },

  // Links kept so other people's records stay usable.
  { model: 'inviteCode', section: 'inviteCodesCreated', keys: ['createdById'], erasure: 'detach' },
  { model: 'featureFlag', section: 'featureFlagsCreated', keys: ['createdById'], erasure: 'detach' },
  { model: 'salaryDataPoint', section: 'salaryDataPoints', keys: ['userId'], erasure: 'detach' },
  { model: 'accountingAccount', section: 'accountingAccounts', keys: ['userId'], erasure: 'detach' },
  { model: 'journalEntry', section: 'journalEntries', keys: ['userId'], erasure: 'detach' },
  { model: 'taxReturn', section: 'taxReturns', keys: ['userId'], erasure: 'detach' },
  { model: 'inventoryTransaction', section: 'inventoryTransactions', keys: ['createdByUserId'], erasure: 'detach' },
  { model: 'moneyTransaction', section: 'moneyTransactions', keys: ['userId'], erasure: 'detach' },
  { model: 'conversation', section: 'conversationRequests', keys: ['requestedById'], erasure: 'detach' },
  { model: 'event', section: 'eventsHosted', keys: ['hostUserId'], erasure: 'detach' },
  { model: 'audioTrack', section: 'audioTracksCreated', keys: ['createdById'], erasure: 'detach' },
  { model: 'carReferral', section: 'carReferrals', keys: ['userId'], erasure: 'detach' },

  // Businesses she runs through the platform. The listing is about the
  // business and other members rely on it, so it survives without naming her.
  { model: 'vendor', section: 'vendorsOwned', keys: ['ownerId'], erasure: 'detach' },
  { model: 'dealership', section: 'dealershipsOwned', keys: ['ownerUserId'], erasure: 'detach' },
  { model: 'mechanic', section: 'mechanicsOwned', keys: ['ownerUserId'], erasure: 'detach' },
  { model: 'healthPractitioner', section: 'practitionerProfilesOwned', keys: ['ownerUserId'], erasure: 'detach' },

  // Staff are members too, so the columns that name the person who ran a
  // campaign or signed off an assessment are personal data about her. The
  // record survives without the name; it is the record that matters, not who
  // is still on the payroll.
  { model: 'lead', section: 'marketingLeadRecord', keys: ['convertedUserId'], erasure: 'detach' },
  {
    model: 'lead',
    section: 'marketingLeadsOwned',
    keys: ['ownerId'],
    erasure: 'detach',
    exportable: false,
    reason: 'A lead assigned to a staff member describes the prospect, not the staff member.',
  },
  {
    model: 'marketingCampaign',
    section: 'marketingCampaignsOpened',
    keys: ['createdById'],
    erasure: 'detach',
    exportable: false,
    reason: 'A campaign record describes the campaign, not the staff member who opened it.',
  },
  {
    model: 'gtmInitiative',
    section: 'gtmInitiativesOwned',
    keys: ['ownerId'],
    erasure: 'detach',
    exportable: false,
    reason: 'An initiative describes a piece of company work, not the staff member carrying it.',
  },
  {
    model: 'processingActivity',
    section: 'processingActivitiesApproved',
    keys: ['approvedBy'],
    erasure: 'detach',
    exportable: false,
    reason: 'The Article 30 record describes the company, not the staff member who signed it off.',
  },
  {
    model: 'dPIA',
    section: 'impactAssessmentsApproved',
    keys: ['approvedBy'],
    erasure: 'detach',
    exportable: false,
    reason: 'An impact assessment describes the company, not the staff member who signed it off.',
  },

  // Stock a sole trader owns personally rather than through an organisation.
  // Only rows with the member link set are hers; an organisation's stock has a
  // null userId and is untouched.
  { model: 'inventoryItem', section: 'inventoryItems', keys: ['userId'], erasure: 'delete' },
  { model: 'inventoryLocation', section: 'inventoryLocations', keys: ['userId'], erasure: 'delete' },

  // Financial records with a seven year retention duty and a non-null link to
  // the account, so they are what forces an anonymised shell over a deletion.
  {
    model: 'payment',
    section: 'payments',
    keys: ['userId'],
    erasure: 'retain',
    holdsAccount: true,
    reason: 'Tax and anti-money-laundering record, retained seven years.',
  },
  {
    model: 'invoice',
    section: 'invoices',
    keys: ['userId'],
    erasure: 'retain',
    holdsAccount: true,
    reason: 'Tax record, retained seven years.',
  },
  {
    model: 'subscription',
    section: 'subscriptions',
    keys: ['userId'],
    erasure: 'retain',
    holdsAccount: true,
    reason: 'Billing history behind the invoices, retained seven years.',
  },
  {
    model: 'escrowPayment',
    section: 'escrowPaymentsAsBuyer',
    keys: ['buyerId'],
    erasure: 'retain',
    holdsAccount: true,
    reason: 'Settlement record for money held on behalf of two parties.',
  },
  {
    model: 'escrowPayment',
    section: 'escrowPaymentsAsSeller',
    keys: ['sellerId'],
    erasure: 'retain',
    holdsAccount: true,
    reason: 'Settlement record for money held on behalf of two parties.',
  },
  {
    model: 'giftBalancePurchase',
    section: 'giftBalancePurchases',
    keys: ['userId'],
    erasure: 'retain',
    holdsAccount: true,
    reason: 'Tax record, retained seven years.',
  },
  {
    model: 'paymentDispute',
    section: 'paymentDisputes',
    keys: ['userId'],
    erasure: 'retain',
    reason:
      'Chargeback record behind the tax records, retained seven years. It holds the member id as plain text with no link to the account, so it does not keep the account row alive.',
    // What is hers: the amount, the reason and how it ended. Not ATHENA's working
    // notes, or the ids of the creators a pause was put on, who are other members.
    readable: (row) => {
      const { effects: _workings, heldCreatorProfileIds: _creators, ...hers } = row;
      return hers;
    },
  },
  {
    model: 'giftTransaction',
    section: 'giftsSent',
    keys: ['senderId'],
    erasure: 'retain',
    holdsAccount: true,
    reason: 'Creator earnings record behind a payout, retained seven years.',
  },
  {
    model: 'giftTransaction',
    section: 'giftsReceived',
    keys: ['receiverId'],
    erasure: 'retain',
    holdsAccount: true,
    reason: 'Creator earnings record behind a payout, retained seven years.',
  },
  {
    model: 'vehiclePurchase',
    section: 'vehiclePurchasesPaid',
    keys: [],
    where: (userId) => ({
      OR: [{ buyerId: userId }, { sellerId: userId }],
      paidAt: { not: null },
    }),
    erasure: 'retain',
    holdsAccount: true,
    reason: 'Settlement record for a vehicle sale between two members, retained seven years.',
  },
  {
    model: 'vehicleListing',
    section: 'vehicleListingsSoldThrough',
    keys: [],
    where: (userId) => ({
      sellerId: userId,
      purchases: { some: { paidAt: { not: null } } },
    }),
    erasure: 'retain',
    holdsAccount: true,
    reason: 'A listing a sale settled through cascades its purchases, so removing it would erase the buyer record too.',
  },

  // Deliberately outside both rights.
  {
    model: 'legalHold',
    section: 'legalHolds',
    keys: [],
    erasure: 'skip',
    exportable: false,
    reason: 'An active hold blocks erasure outright and disclosing one can prejudice the matter behind it.',
  },
];

/**
 * Tables that hold a member id and are deliberately left out of the register,
 * each with the reason it is out.
 *
 * The drift test at src/services/__tests__/gdpr.personal-data-register.test.ts
 * reads the schema and this map together, so a new table carrying a member id
 * fails the suite until somebody either registers it above or writes down here
 * why it does not belong. That is the only thing that keeps the register
 * honest: it fell fifty tables behind the schema once already, and nothing in
 * the build noticed.
 *
 * Empty today. Every model in the schema that carries a member id is reached by
 * an entry above, directly or through a parent row.
 */
export const MODELS_OUTSIDE_PERSONAL_DATA_REGISTER: Record<string, string> = {};

// Fields that must never leave the platform inside an export bundle. These are
// credentials rather than facts about the member: a bundle carrying one would
// hand whoever opens it the ability to act as her.
const SECRET_EXPORT_FIELDS = new Set([
  'passwordHash',
  'twoFactorSecret',
  'twoFactorRecoveryCodes',
  'token',
  'tokenHash',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'secret',
  // A live stream key lets the holder broadcast as her.
  'streamKey',
  // The PIN that opens a disguised safe chat.
  'accessPinHash',
]);

/**
 * Columns of her own account row that are staff's and are not handed out in an
 * export. The safety score is worked out from reports and blocks other members
 * made, to decide which accounts staff look at first, and it is shown to no
 * member on any screen. In an export it would be the one place a man could read
 * it, and a score that fell the day after a woman blocked him says who did.
 */
const STAFF_ONLY_ACCOUNT_COLUMNS = ['safetyScore', 'safetyScoreUpdatedAt', 'trustScore', 'trustScoreUpdatedAt'] as const;

const STAFF_ONLY_ACCOUNT_REASON =
  'An internal account-standing measure that decides the order in which our staff review accounts. It is worked out partly from reports and blocks made by other members, so it is not handed out: that could identify them. It is shown to no member, and it restricts no one automatically.';

const STAFF_ONLY_TRUST_REASON =
  'The stored standing figure on the account and the penalty columns of the trust record (the stored score, the community-feedback figure, the count of reports against the account and the date of the last incident). They are moved by reports and blocks made by other members, so they are not handed out: that could identify them. This is not the trust score on your Trust page, which is worked out from your profile and is shown to you.';

const DOWNLOAD_PATH_PREFIX = '/api/gdpr/download/';
const EXPORT_TOKEN_BYTES = 32;
const EXPORT_WINDOW_HOURS = 72;

/**
 * What a member may correct about herself through the rectification right.
 *
 * Exported because the route validates each one before the request is filed:
 * a correction the service would silently drop should be refused at the door,
 * not accepted and then ignored.
 */
export const RECTIFIABLE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'city',
  'state',
  'country',
  'bio',
  'headline',
] as const;

export type RectifiableField = (typeof RECTIFIABLE_FIELDS)[number];

/**
 * A corrected address does not become the sign-in identity until somebody
 * opens the confirmation link sent to it.
 *
 * This route used to write `email` straight onto the account from the request
 * body. A member could move her account to an address she could not read —
 * locking herself out, since sign-in and password reset both go to that
 * address — and a member sitting at somebody else's open session could move
 * theirs. Neither needed a password.
 *
 * VerificationToken has no column saying what a token is about, so the request
 * id rides in `type` behind this prefix. The existing EMAIL_VERIFICATION and
 * PASSWORD_RESET lookups match `type` exactly, so a prefixed value cannot
 * collide with them, and the request row stays the one record of which address
 * was asked for.
 */
const EMAIL_CHANGE_TOKEN_PREFIX = 'EMAIL_CHANGE:';
const EMAIL_CHANGE_TOKEN_BYTES = 32;
const EMAIL_CHANGE_WINDOW_HOURS = 24;

/** What a rectification actually did, so the route does not have to guess. */
export interface RectificationOutcome {
  requestId: string;
  /** Columns written to the account now. */
  applied: string[];
  /** Fields this right does not cover, named back rather than dropped. */
  ignored: string[];
  /** The address waiting to be confirmed, when one was asked for. */
  pendingEmail: string | null;
}

/** The outcome of opening a confirmation link, in the words the route answers with. */
export type EmailChangeConfirmation =
  | { status: 'CONFIRMED'; email: string; userId: string }
  | { status: 'INVALID' }
  | { status: 'TAKEN' };

/** Where the confirmation link has to come back to. */
function apiBaseUrl(): string {
  return (process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');
}

/** Where to tell a member to go when a change she did not ask for arrives. */
function supportContact(): string {
  const mailbox = resolveContactEmail('support');
  if (mailbox) return mailbox;

  const client = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${client}${PRIVACY_CONTACT_ROUTE}`;
}

// Erasure walks well over a hundred statements, so it needs far longer than the
// five second default Prisma allows an interactive transaction.
const ERASURE_TRANSACTION_TIMEOUT_MS = 120_000;
const ERASURE_TRANSACTION_MAX_WAIT_MS = 15_000;

// ============================================
// DSAR (Data Subject Access Request) Management
// ============================================

interface DSARRequestInput {
  userId: string;
  type: DSARType;
  requestDetails?: string;
}

export interface DSARExportData {
  metadata: {
    exportedAt: string;
    requestId: string;
    format: 'JSON';
    sections: number;
  };
  account: object;
  records: Record<string, object[]>;
  excluded: Array<{ section: string; reason: string }>;
}

export interface DSARExportResult {
  requestId: string;
  downloadToken: string;
  downloadUrl: string;
  expiresAt: Date;
  data: DSARExportData;
}

export type DSARDownloadResult =
  | { status: 'NOT_FOUND' }
  | { status: 'EXPIRED' }
  | { status: 'OK'; requestId: string; data: DSARExportData };

export interface ErasureOutcome {
  requestId: string;
  status: 'COMPLETED' | 'ALREADY_COMPLETED' | 'REJECTED';
  /** True when the account row itself was dropped rather than stripped back. */
  accountRemoved: boolean;
  /** Sections whose retention duty kept the account alive as a shell. */
  retainedSections: string[];
  rowsRemoved: number;
  reason?: string;
}

/**
 * What a member is told once her erasure has been carried out. One wording for
 * both doors (Settings, and the data-rights request) so the two cannot drift
 * into promising different things about the same erasure.
 */
export function describeErasure(outcome: Pick<ErasureOutcome, 'accountRemoved'>): string {
  return outcome.accountRemoved
    ? 'Your account and personal data have been deleted.'
    : 'Your personal data has been erased. Records we are legally required to keep are held without anything that identifies you.';
}

interface MutableDelegate {
  findMany(args: any): Promise<any[]>;
  deleteMany(args: any): Promise<{ count: number }>;
  updateMany(args: any): Promise<{ count: number }>;
  count(args: any): Promise<number>;
}

function delegateFor(client: any, entry: PersonalDataModel): MutableDelegate {
  const delegate = client[entry.model];

  // A typo in the register would otherwise skip a table in silence, which is
  // exactly the failure the register exists to prevent.
  if (!delegate || typeof delegate.findMany !== 'function') {
    throw new Error(`Personal data register names a model Prisma does not have: ${entry.model}`);
  }

  return delegate as MutableDelegate;
}

function subjectFilter(entry: PersonalDataModel, userId: string): Record<string, unknown> {
  if (entry.where) return entry.where(userId);

  // An entry with nothing to match on would quietly cover no rows at all.
  if (entry.keys.length === 0) {
    throw new Error(`Personal data register entry ${entry.section} names no columns and no filter`);
  }

  if (entry.keys.length === 1) return { [entry.keys[0]]: userId };
  return { OR: entry.keys.map((key) => ({ [key]: userId })) };
}

function pseudonym(userId: string): string {
  return createHash('sha256').update(userId).digest('hex');
}

/**
 * The address a rectification request asked for, read back off the request row.
 *
 * The request is what the member submitted and what a regulator would be shown,
 * so it is the only thing the confirmation step trusts for the new address. A
 * request whose details are not the JSON this route writes returns null, and
 * the confirmation refuses rather than inventing an address.
 */
function readRequestedEmail(requestDetails: string | null): string | null {
  if (!requestDetails) return null;

  try {
    const parsed = JSON.parse(requestDetails) as { email?: unknown };
    if (typeof parsed?.email !== 'string') return null;

    const email = parsed.email.trim().toLowerCase();
    return email || null;
  } catch {
    return null;
  }
}

/** The member's own words for why they restricted processing, if they gave any. */
function readRestrictionReason(requestDetails: string | null): string | null {
  if (!requestDetails) return null;

  try {
    const parsed = JSON.parse(requestDetails) as { reason?: unknown };
    return typeof parsed?.reason === 'string' && parsed.reason.trim() ? parsed.reason : null;
  } catch {
    return null;
  }
}

/**
 * One line of the published retention schedule.
 *
 * `trigger` says what starts the clock: 'age' counts retentionDays from when
 * the record was made, 'expiry' removes it once its own expiry has passed (and
 * retentionDays is 0), 'erasure' counts from a completed erasure request, and
 * 'decision' counts from the day a person approved or refused a verification.
 */
export interface PublishedRetentionPolicy {
  dataType: string;
  description: string;
  dataCategory: DataCategory;
  retentionDays: number;
  retentionReason: string;
  legalBasis: 'CONSENT' | 'CONTRACT' | 'LEGAL_OBLIGATION' | 'LEGITIMATE_INTERESTS';
  anonymizeInstead: boolean;
  trigger: 'age' | 'expiry' | 'erasure' | 'decision';
}

/**
 * What the nightly purge in scripts/data-retention.ts actually does, in the
 * words a member is shown. Only what it really removes is listed: the job that
 * asks the analytics pipeline to purge old events enqueues a request and cannot
 * say whether anything was deleted, so it is not published as a promise.
 *
 * Every line here is held to the purge job it describes by
 * gdpr.retention-schedule.test.ts. If a cut-off in data-retention.ts changes,
 * that test fails until this list says the same thing. Anything covered by an
 * active legal hold is kept until the hold is lifted, whatever this says.
 */
export const EXECUTED_RETENTION_SCHEDULE: readonly PublishedRetentionPolicy[] = [
  {
    dataType: 'direct_messages',
    description: 'Direct messages between members are deleted three years after they were sent.',
    dataCategory: DataCategory.UGC,
    retentionDays: 1095,
    retentionReason: 'Long enough to deal with a dispute or a safety report about a conversation.',
    legalBasis: 'LEGITIMATE_INTERESTS',
    anonymizeInstead: false,
    trigger: 'age',
  },
  {
    dataType: 'read_notifications',
    description: 'Notifications you have already read are deleted 90 days after they were sent.',
    dataCategory: DataCategory.UGC,
    retentionDays: 90,
    retentionReason: 'Kept briefly so you can look back at recent activity.',
    legalBasis: 'LEGITIMATE_INTERESTS',
    anonymizeInstead: false,
    trigger: 'age',
  },
  {
    dataType: 'audit_logs',
    description:
      'Records of account and staff actions have the IP address, device and details removed after one year. The anonymised record of what happened is kept.',
    dataCategory: DataCategory.TECHNICAL,
    retentionDays: 365,
    retentionReason: 'Security, and being able to show who did what on the platform.',
    legalBasis: 'LEGAL_OBLIGATION',
    anonymizeInstead: true,
    trigger: 'age',
  },
  {
    dataType: 'erased_accounts',
    description:
      'Whatever remains of an account after its erasure request has completed is permanently deleted 30 days later.',
    dataCategory: DataCategory.PII,
    retentionDays: 30,
    retentionReason: 'A short window in which an erasure made in error can still be caught.',
    legalBasis: 'LEGAL_OBLIGATION',
    anonymizeInstead: false,
    trigger: 'erasure',
  },
  {
    dataType: 'sessions',
    description: 'Sign-in sessions are deleted once they expire.',
    dataCategory: DataCategory.TECHNICAL,
    retentionDays: 0,
    retentionReason: 'Needed only while you are signed in.',
    legalBasis: 'CONTRACT',
    anonymizeInstead: false,
    trigger: 'expiry',
  },
  {
    dataType: 'verification_links',
    description: 'Email verification and password-reset links are deleted once they expire.',
    dataCategory: DataCategory.TECHNICAL,
    retentionDays: 0,
    retentionReason: 'Needed only until they are used or run out.',
    legalBasis: 'CONTRACT',
    anonymizeInstead: false,
    trigger: 'expiry',
  },
  {
    dataType: 'data_export_links',
    description: 'The download link for a copy of your data is removed once it expires.',
    dataCategory: DataCategory.PII,
    retentionDays: 0,
    retentionReason: 'A link to your whole data file should not outlive its use.',
    legalBasis: 'LEGAL_OBLIGATION',
    anonymizeInstead: false,
    trigger: 'expiry',
  },
  {
    dataType: 'identity_verification_details',
    description:
      'Photo ID and selfie checks run on Stripe, not on ATHENA, and Stripe is asked to erase them as soon as a person has decided. The name and document type we kept for the reviewer are removed 90 days after that decision.',
    dataCategory: DataCategory.PII,
    retentionDays: 90,
    retentionReason: 'Long enough for a reviewer to look back at a decision, and no longer.',
    legalBasis: 'CONSENT',
    anonymizeInstead: false,
    trigger: 'decision',
  },
];

export class GDPRService {
  /**
   * Get all DSAR requests for a user
   */
  async getDSARRequests(userId: string): Promise<any[]> {
    return prisma.dSARRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single DSAR request
   */
  async getDSARRequest(requestId: string): Promise<any> {
    return prisma.dSARRequest.findUnique({
      where: { id: requestId },
    });
  }

  /**
   * Create a new DSAR request.
   *
   * Every DSAR route sits behind `authenticate`, so the subject is verified by
   * their session before the row exists: identityVerified is true from the
   * start rather than a step somebody has to remember, and the request is
   * acknowledged on receipt for the same reason. Both are shown to the member
   * and are what a regulator asks to see. The due date is the APP 12
   * reasonable period as the OAIC reads it, 30 days, which also covers the one
   * month Article 12(3) gives UK and EU members.
   */
  async createDSARRequest(input: DSARRequestInput): Promise<any> {
    const receivedAt = new Date();
    const dueDate = new Date(receivedAt);
    dueDate.setDate(dueDate.getDate() + 30);

    const dsar = await prisma.dSARRequest.create({
      data: {
        userId: input.userId,
        type: input.type,
        status: DSARStatus.PENDING,
        requestDetails: input.requestDetails,
        identityVerified: true,
        acknowledgedAt: receivedAt,
        dueDate,
      },
    });

    // Log the request
    await this.logPrivacyAction({
      userId: input.userId,
      action: 'DSAR_REQUEST_CREATED',
      resourceType: 'DSARRequest',
      resourceId: dsar.id,
      details: { type: input.type },
    });

    return dsar;
  }

  /**
   * Process DSAR Export Request - Gather all user data
   *
   * Mints the single-use path that the download route resolves. The bundle is
   * rebuilt on download rather than stored, so an export never leaves a copy of
   * someone's data sitting on disk waiting to leak.
   */
  async processExportRequest(dsarId: string): Promise<DSARExportResult> {
    const dsar = await prisma.dSARRequest.findUnique({
      where: { id: dsarId },
    });

    if (!dsar) throw new Error('DSAR request not found');

    await prisma.dSARRequest.update({
      where: { id: dsarId },
      data: { status: DSARStatus.IN_PROGRESS },
    });

    const data = await this.collectPersonalData(dsar.userId, dsarId);

    const downloadToken = randomBytes(EXPORT_TOKEN_BYTES).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + EXPORT_WINDOW_HOURS);

    await prisma.dSARRequest.update({
      where: { id: dsarId },
      data: {
        status: DSARStatus.COMPLETED,
        exportUrl: `${DOWNLOAD_PATH_PREFIX}${downloadToken}`,
        exportExpiresAt: expiresAt,
        completedAt: new Date(),
      },
    });

    await this.logPrivacyAction({
      userId: dsar.userId,
      action: 'DSAR_EXPORT_COMPLETED',
      resourceType: 'DSARRequest',
      resourceId: dsarId,
      details: { sections: data.metadata.sections, expiresAt: expiresAt.toISOString() },
    });

    return {
      requestId: dsarId,
      downloadToken,
      downloadUrl: `${DOWNLOAD_PATH_PREFIX}${downloadToken}`,
      expiresAt,
      data,
    };
  }

  /**
   * Resolve a download token back to its export.
   *
   * The token is the only key: it is looked up on its own, then checked against
   * the caller and its expiry, so knowing a DSAR id gets nobody anywhere.
   */
  async getExportDownload(token: string, userId: string): Promise<DSARDownloadResult> {
    if (!/^[0-9a-f]{64}$/.test(token)) {
      return { status: 'NOT_FOUND' };
    }

    const dsar = await prisma.dSARRequest.findFirst({
      where: {
        type: DSARType.EXPORT,
        exportUrl: `${DOWNLOAD_PATH_PREFIX}${token}`,
      },
    });

    if (!dsar || !this.matchesSubject(dsar.userId, userId)) {
      return { status: 'NOT_FOUND' };
    }

    if (!dsar.exportExpiresAt || dsar.exportExpiresAt.getTime() <= Date.now()) {
      // Drop the path so an expired link cannot be resurrected by clock skew.
      await prisma.dSARRequest.update({
        where: { id: dsar.id },
        data: { exportUrl: null },
      });
      return { status: 'EXPIRED' };
    }

    const data = await this.collectPersonalData(dsar.userId, dsar.id);

    await this.logPrivacyAction({
      userId: dsar.userId,
      action: 'DSAR_EXPORT_DOWNLOADED',
      resourceType: 'DSARRequest',
      resourceId: dsar.id,
    });

    return { status: 'OK', requestId: dsar.id, data };
  }

  /**
   * Process DSAR Deletion Request - Right to be Forgotten
   *
   * Safe to call more than once: a request already carried out reports what it
   * did the first time instead of running again.
   */
  async processDeletionRequest(dsarId: string): Promise<ErasureOutcome> {
    const dsar = await prisma.dSARRequest.findUnique({
      where: { id: dsarId },
    });

    if (!dsar) {
      // The DSAR row goes with the account, so its absence is either a bad id
      // or an erasure that already finished. Only the audit trail can tell.
      const completed = await this.findCompletedErasure(dsarId);
      if (completed) return completed;
      throw new Error('DSAR request not found');
    }

    if (dsar.type !== DSARType.DELETION) {
      throw new Error('DSAR request is not a deletion request');
    }

    if (dsar.status === DSARStatus.COMPLETED) {
      const completed = await this.findCompletedErasure(dsarId);
      return (
        completed || {
          requestId: dsarId,
          status: 'ALREADY_COMPLETED',
          accountRemoved: false,
          retainedSections: [],
          rowsRemoved: 0,
        }
      );
    }

    const userId = dsar.userId;

    const legalHold = await prisma.legalHold.findFirst({
      where: {
        isActive: true,
        affectedUserIds: { has: userId },
      },
    });

    if (legalHold) {
      const reason = `Cannot delete: active legal hold (${legalHold.id})`;
      await prisma.dSARRequest.update({
        where: { id: dsarId },
        data: { status: DSARStatus.REJECTED, processingNotes: reason },
      });

      // A refusal is as much part of handling the request as carrying it out,
      // and Article 12(4) requires us to be able to say why.
      await this.logPrivacyAction({
        userId,
        action: 'DSAR_ERASURE_REJECTED',
        resourceType: 'DSARRequest',
        resourceId: dsarId,
        details: { reason, legalHoldId: legalHold.id },
      });

      return {
        requestId: dsarId,
        status: 'REJECTED',
        accountRemoved: false,
        retainedSections: [],
        rowsRemoved: 0,
        reason,
      };
    }

    await prisma.dSARRequest.update({
      where: { id: dsarId },
      data: { status: DSARStatus.IN_PROGRESS },
    });

    let outcome: ErasureOutcome;
    try {
      outcome = await this.eraseUser(userId, dsarId);
    } catch (error) {
      // A refusal (billing that could not be ended, for one) leaves the account
      // exactly as it was. The request goes back to waiting rather than staying
      // "in progress" for a job nobody is doing, and says why.
      await bestEffort('return a failed erasure request to pending', () =>
        prisma.dSARRequest.update({
          where: { id: dsarId },
          data: {
            status: DSARStatus.PENDING,
            processingNotes: error instanceof Error ? error.message.slice(0, 500) : 'Erasure failed',
          },
        })
      );
      throw error;
    }
    // The erasure deleted her session rows, so the REST API refuses her from
    // here on; this closes the sockets she still has open, which nothing else
    // would, because a socket only authenticates at the handshake.
    sessionEvents.announceRevoked({ userId, reason: 'account-deleted' });

    // The request row is itself personal data and goes with the rest of it, so
    // the entry below is the only surviving record that the right was honoured.
    await this.logPrivacyAction({
      action: 'DSAR_ERASURE_COMPLETED',
      resourceType: 'DSARRequest',
      resourceId: dsarId,
      details: {
        subject: pseudonym(userId),
        accountRemoved: outcome.accountRemoved,
        retainedSections: outcome.retainedSections,
        rowsRemoved: outcome.rowsRemoved,
      },
    });

    logger.info('[GDPR] Erasure completed', {
      requestId: dsarId,
      accountRemoved: outcome.accountRemoved,
      rowsRemoved: outcome.rowsRemoved,
    });

    return outcome;
  }

  /**
   * Erase an account because an administrator asked for it, rather than because
   * the member did.
   *
   * The admin console had its own deletion: a seven-table transaction —
   * comments, likes, posts, notifications, job applications, saved jobs, then
   * the user row — against a personal-data register of sixty-odd tables. It
   * left the rest of her behind wherever a relation was optional, threw a
   * foreign-key error wherever one was not, and, worst of all, never looked at
   * LegalHold. The DSAR path refuses to delete an account under an active hold
   * and says why; the admin path destroyed the evidence. The two now run the
   * same erasure and obey the same refusal, so which door the request came
   * through cannot change the answer.
   *
   * `reference` is what the outcome and the audit trail are filed under, since
   * there is no DSAR row behind an administrator's decision.
   */
  async eraseAccountByAdmin(
    userId: string,
    context: { adminId: string | null; ipAddress?: string; userAgent?: string }
  ): Promise<ErasureOutcome> {
    const reference = `ADMIN-ERASURE-${userId}`;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw new Error('User not found');
    }

    const legalHold = await prisma.legalHold.findFirst({
      where: { isActive: true, affectedUserIds: { has: userId } },
    });

    if (legalHold) {
      const reason = `Cannot delete: active legal hold (${legalHold.id})`;

      await this.logPrivacyAction({
        userId,
        adminId: context.adminId ?? undefined,
        action: 'ADMIN_ERASURE_REJECTED',
        resourceType: 'User',
        resourceId: userId,
        details: { reason, legalHoldId: legalHold.id },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return {
        requestId: reference,
        status: 'REJECTED',
        accountRemoved: false,
        retainedSections: [],
        rowsRemoved: 0,
        reason,
      };
    }

    const outcome = await this.eraseUser(userId, reference);
    // The erasure deleted her session rows, so the REST API refuses her from
    // here on; this closes the sockets she still has open, which nothing else
    // would, because a socket only authenticates at the handshake.
    sessionEvents.announceRevoked({ userId, reason: 'account-deleted' });

    // The account row is gone by now, so this entry is the only surviving
    // record that an administrator — this one — destroyed it.
    await this.logPrivacyAction({
      adminId: context.adminId ?? undefined,
      action: 'ADMIN_ERASURE_COMPLETED',
      resourceType: 'User',
      resourceId: reference,
      details: {
        subject: pseudonym(userId),
        accountRemoved: outcome.accountRemoved,
        retainedSections: outcome.retainedSections,
        rowsRemoved: outcome.rowsRemoved,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    logger.info('[GDPR] Administrator erasure completed', {
      reference,
      accountRemoved: outcome.accountRemoved,
      rowsRemoved: outcome.rowsRemoved,
    });

    return outcome;
  }

  /**
   * The address a suspended-and-anonymised account is parked on.
   *
   * The admin soft delete wrote `deleted_<id>@athena.local`: a live-looking
   * address that carries the member's id in the clear, on a domain that could
   * one day resolve. The erasure path already had the right answer — a hash on
   * the reserved .invalid domain, which can never be delivered to — and this is
   * the same shape, marked as a suspension rather than an erasure so the two
   * are never confused for one another.
   */
  suspensionTombstoneEmail(userId: string): string {
    return `suspended-${pseudonym(userId).slice(0, 32)}@erased.invalid`;
  }

  /**
   * Carry out every deletion request that has reached its due date.
   *
   * This is the entry point a scheduler calls; nothing about it assumes a
   * request has not been attempted before.
   */
  async processDueDeletionRequests(limit = 25): Promise<{ processed: number; failed: number }> {
    const due = await prisma.dSARRequest.findMany({
      where: {
        type: DSARType.DELETION,
        status: { in: [DSARStatus.PENDING, DSARStatus.IN_PROGRESS] },
        dueDate: { lte: new Date() },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
    });

    let processed = 0;
    let failed = 0;

    for (const request of due) {
      try {
        await this.processDeletionRequest(request.id);
        processed++;
      } catch (error) {
        failed++;
        logger.error('[GDPR] Erasure failed', { requestId: request.id, error });
        await prisma.dSARRequest.update({
          where: { id: request.id },
          data: {
            status: DSARStatus.PENDING,
            processingNotes: error instanceof Error ? error.message : 'Erasure failed',
          },
        });
      }
    }

    return { processed, failed };
  }

  /**
   * Carry out a correction (APP 13, Article 16).
   *
   * Everything but the sign-in address is written on the spot. The address is
   * held back until the inbox it names answers, because it is the credential
   * the whole account recovers through: see EMAIL_CHANGE_TOKEN_PREFIX.
   */
  async processRectificationRequest(
    dsarId: string,
    corrections: Record<string, unknown>
  ): Promise<RectificationOutcome> {
    const dsar = await prisma.dSARRequest.findUnique({
      where: { id: dsarId },
    });

    if (!dsar) throw new Error('DSAR request not found');

    const account = await prisma.user.findUnique({
      where: { id: dsar.userId },
      select: {
        id: true,
        ...(Object.fromEntries(RECTIFIABLE_FIELDS.map((field) => [field, true])) as Record<
          RectifiableField,
          true
        >),
      },
    });

    if (!account) throw new Error('Account behind the request no longer exists');

    const writeNow: Record<string, unknown> = {};
    const ignored: string[] = [];
    let requestedEmail: string | null = null;

    for (const [key, value] of Object.entries(corrections)) {
      if (!(RECTIFIABLE_FIELDS as readonly string[]).includes(key)) {
        ignored.push(key);
        continue;
      }

      if (key === 'email') {
        requestedEmail = String(value).trim().toLowerCase();
        continue;
      }

      writeNow[key] = value;
    }

    // Asking for the address the account already has corrects nothing, and
    // sending a confirmation for it would be a link to nowhere.
    const pendingEmail = requestedEmail && requestedEmail !== account.email ? requestedEmail : null;
    if (requestedEmail && !pendingEmail) ignored.push('email');

    if (Object.keys(writeNow).length > 0) {
      await prisma.user.update({
        where: { id: dsar.userId },
        data: writeNow,
      });
    }

    if (pendingEmail) {
      await this.beginEmailChange(dsar.id, account, pendingEmail);
    }

    await prisma.dSARRequest.update({
      where: { id: dsarId },
      data: pendingEmail
        ? {
            // Not COMPLETED: the request is only half honoured until the new
            // address answers, and a row that says otherwise would tell a
            // regulator the wrong thing.
            status: DSARStatus.IN_PROGRESS,
            processingNotes: 'Waiting for the new sign-in address to be confirmed from that inbox.',
          }
        : {
            status: DSARStatus.COMPLETED,
            completedAt: new Date(),
          },
    });

    await this.logPrivacyAction({
      userId: dsar.userId,
      action: pendingEmail ? 'DSAR_RECTIFICATION_PENDING_EMAIL' : 'DSAR_RECTIFICATION_COMPLETED',
      resourceType: 'User',
      resourceId: dsar.userId,
      previousValue: account,
      newValue: pendingEmail ? { ...writeNow, pendingEmail } : writeNow,
    });

    return {
      requestId: dsar.id,
      applied: Object.keys(writeNow),
      ignored,
      pendingEmail,
    };
  }

  /**
   * Whether an address is free to become somebody's sign-in identity.
   *
   * Checked when the request is filed and again when the link is opened: an
   * hour can pass between the two, and the unique index would otherwise report
   * the collision as a 500 from the database layer.
   */
  async emailAvailableFor(userId: string, email: string): Promise<boolean> {
    const holder = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), NOT: { id: userId } },
      select: { id: true },
    });

    return holder === null;
  }

  /**
   * Mint the confirmation token and write to both addresses: the new one to
   * ask, the old one to warn. The warning matters most for the member this
   * platform was built for — if somebody else is asking to move her account,
   * the inbox she still controls is the only place she will hear about it.
   */
  private async beginEmailChange(
    dsarId: string,
    account: { id: string; email: string; firstName: string },
    newEmail: string
  ): Promise<void> {
    // One live request at a time, so an address she changed her mind about
    // stops being claimable the moment she asks for a different one.
    await prisma.verificationToken.deleteMany({
      where: { userId: account.id, type: { startsWith: EMAIL_CHANGE_TOKEN_PREFIX } },
    });

    const token = randomBytes(EMAIL_CHANGE_TOKEN_BYTES).toString('hex');

    await prisma.verificationToken.create({
      data: {
        userId: account.id,
        token: hashOpaqueToken(token),
        type: `${EMAIL_CHANGE_TOKEN_PREFIX}${dsarId}`,
        expiresAt: new Date(Date.now() + EMAIL_CHANGE_WINDOW_HOURS * 60 * 60 * 1000),
      },
    });

    const confirmUrl = `${apiBaseUrl()}/api/gdpr/dsar/rectify/confirm-email?token=${encodeURIComponent(token)}`;

    // Best effort on the send, not on the record: the token is already stored,
    // so a mail outage leaves a request she can make again rather than an
    // account half moved.
    await bestEffort(
      'gdpr email change confirmation',
      emailService.sendEmailChangeConfirmation(
        newEmail,
        account.firstName,
        confirmUrl,
        EMAIL_CHANGE_WINDOW_HOURS
      ),
      false
    );

    await bestEffort(
      'gdpr email change notice to the current address',
      emailService.sendEmailChangeNotice(
        account.email,
        account.firstName,
        newEmail,
        supportContact()
      ),
      false
    );
  }

  /**
   * Finish a correction of the sign-in address.
   *
   * The address is taken from the request row the token names rather than from
   * anything the caller sends, so opening the link can only commit the change
   * that was asked for.
   */
  async confirmRectifiedEmail(token: string): Promise<EmailChangeConfirmation> {
    const record = await prisma.verificationToken.findFirst({
      where: {
        token: hashOpaqueToken(token),
        type: { startsWith: EMAIL_CHANGE_TOKEN_PREFIX },
        expiresAt: { gt: new Date() },
      },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!record) return { status: 'INVALID' };

    const dsarId = record.type.slice(EMAIL_CHANGE_TOKEN_PREFIX.length);
    const dsar = await prisma.dSARRequest.findUnique({ where: { id: dsarId } });

    const requested = readRequestedEmail(dsar?.requestDetails ?? null);
    if (!dsar || dsar.userId !== record.userId || !requested) {
      // The token outlived the request it belongs to, so there is nothing left
      // saying which address it was for. Spent rather than guessed at.
      await prisma.verificationToken.delete({ where: { id: record.id } });
      return { status: 'INVALID' };
    }

    if (!(await this.emailAvailableFor(record.userId, requested))) {
      return { status: 'TAKEN' };
    }

    await prisma.user.update({
      where: { id: record.userId },
      data: {
        email: requested,
        // She has just read a link in that inbox, which is the same proof
        // registration asks for.
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.verificationToken.delete({ where: { id: record.id } });

    await prisma.dSARRequest.update({
      where: { id: dsar.id },
      data: {
        status: DSARStatus.COMPLETED,
        completedAt: new Date(),
        processingNotes: 'New sign-in address confirmed from that inbox.',
      },
    });

    await this.logPrivacyAction({
      userId: record.userId,
      action: 'DSAR_RECTIFICATION_COMPLETED',
      resourceType: 'User',
      resourceId: record.userId,
      previousValue: { email: record.user.email },
      newValue: { email: requested },
    });

    return { status: 'CONFIRMED', email: requested, userId: record.userId };
  }

  // ============================================
  // Processing restriction (Article 18)
  // ============================================

  /**
   * Put a restriction into force.
   *
   * The restriction lives on the request row that asked for it, because there
   * is no separate table for one and the request is what a regulator would be
   * shown anyway. COMPLETED means the freeze is in force — the right has been
   * honoured, not that the freeze is over; EXPIRED is a restriction that was
   * later lifted. `consentService.getRestrictedProcessing` reads it back, and
   * every consent check on the platform goes through that.
   */
  async applyProcessingRestriction(
    dsarId: string,
    processingTypes: RestrictableProcessing[]
  ): Promise<{ requestId: string; processingTypes: RestrictableProcessing[]; appliedAt: Date }> {
    const dsar = await prisma.dSARRequest.findUnique({ where: { id: dsarId } });

    if (!dsar) throw new Error('DSAR request not found');
    if (dsar.type !== DSARType.RESTRICTION) {
      throw new Error('DSAR request is not a restriction request');
    }

    const appliedAt = new Date();

    await prisma.dSARRequest.update({
      where: { id: dsarId },
      data: {
        status: DSARStatus.COMPLETED,
        completedAt: appliedAt,
        processingNotes: `Restriction in force over: ${processingTypes.join(', ')}`,
      },
    });

    await this.logPrivacyAction({
      userId: dsar.userId,
      action: 'DSAR_RESTRICTION_APPLIED',
      resourceType: 'DSARRequest',
      resourceId: dsarId,
      details: { processingTypes },
    });

    // Consent records keep their own state so that lifting the restriction
    // restores what the member actually chose rather than silently leaving
    // everything off. Nothing reads a consent without asking about
    // restrictions first, so the frozen state is what applies meanwhile.
    logger.info('[GDPR] Processing restriction applied', { requestId: dsarId, processingTypes });

    return { requestId: dsarId, processingTypes, appliedAt };
  }

  /**
   * The restrictions a member has in force, with the reason they gave.
   */
  async getActiveRestrictions(userId: string): Promise<
    Array<{
      requestId: string;
      processingTypes: RestrictableProcessing[];
      reason: string | null;
      appliedAt: Date | null;
      requestedAt: Date;
    }>
  > {
    const restrictions = await prisma.dSARRequest.findMany({
      where: { userId, type: DSARType.RESTRICTION, status: DSARStatus.COMPLETED },
      orderBy: { completedAt: 'desc' },
    });

    return restrictions.map((restriction) => ({
      requestId: restriction.id,
      processingTypes: parseRestrictedProcessing(restriction.requestDetails),
      reason: readRestrictionReason(restriction.requestDetails),
      appliedAt: restriction.completedAt,
      requestedAt: restriction.requestedAt,
    }));
  }

  /**
   * Lift a restriction the member themselves asked to end.
   *
   * Article 18(3) requires the data subject to be told before a restriction is
   * lifted; when they are the one asking, that condition is met by the request.
   * Returns null when the id names nothing of theirs, so the caller can answer
   * 404 without confirming somebody else's request exists.
   */
  async liftProcessingRestriction(
    requestId: string,
    userId: string
  ): Promise<{ requestId: string; processingTypes: RestrictableProcessing[]; liftedAt: Date } | null> {
    const restriction = await prisma.dSARRequest.findUnique({ where: { id: requestId } });

    if (
      !restriction ||
      restriction.type !== DSARType.RESTRICTION ||
      restriction.status !== DSARStatus.COMPLETED ||
      !this.matchesSubject(restriction.userId, userId)
    ) {
      return null;
    }

    const liftedAt = new Date();
    const processingTypes = parseRestrictedProcessing(restriction.requestDetails);

    await prisma.dSARRequest.update({
      where: { id: requestId },
      data: {
        status: DSARStatus.EXPIRED,
        processingNotes: `Restriction lifted at the data subject's request on ${liftedAt.toISOString()}`,
      },
    });

    await this.logPrivacyAction({
      userId,
      action: 'DSAR_RESTRICTION_LIFTED',
      resourceType: 'DSARRequest',
      resourceId: requestId,
      details: { processingTypes },
    });

    return { requestId, processingTypes, liftedAt };
  }

  // ============================================
  // Retention
  // ============================================

  /**
   * The retention schedule the platform actually runs, for publication.
   *
   * This read the RetentionPolicy table, which nothing wrote: its only writer
   * was a seeding function with no caller, so the published list was an empty
   * array in every deployment while the privacy statement told members that
   * deletion happens on a schedule. And even a populated table would not have
   * been the truth, because the nightly purge never reads it — it runs on the
   * constants in scripts/data-retention.ts. So the list is now the purge
   * schedule itself: EXECUTED_RETENTION_SCHEDULE, which a test holds to the
   * cut-offs the purge jobs really use, so the published policy and the one
   * carried out cannot drift apart unnoticed.
   *
   * Published for transparency, so it carries the promise and its basis and not
   * the operational detail — which job runs it, when it last ran — that says
   * nothing to a member about her own data.
   */
  async getRetentionPolicies(): Promise<PublishedRetentionPolicy[]> {
    return EXECUTED_RETENTION_SCHEDULE.map((policy) => ({ ...policy }));
  }

  // ============================================
  // Consent Management
  // ============================================

  /**
   * Record user consent
   */
  async recordConsent(
    userId: string,
    consentType: ConsentType,
    granted: boolean,
    context: { ipAddress?: string; userAgent?: string; region?: string }
  ): Promise<any> {
    if (!consentService.isKnownConsentType(consentType)) {
      throw new Error(`Unknown consent type: ${consentType}`);
    }

    // Withdrawing a consent the service cannot run without is not a preference,
    // it is an erasure request, and it has its own route.
    if (!granted && consentService.isRequiredConsent(consentType)) {
      throw new Error(
        `${consentService.describeConsent(consentType).title} cannot be withdrawn while the account is open. Request erasure instead.`
      );
    }

    // Granting again would leave the record saying one thing and the platform
    // doing another. A restriction ends when it is lifted, not when a toggle is
    // flipped. Withdrawal stays open — that only tightens things further.
    if (granted) {
      const frozen = await consentService.getRestrictedConsentTypes(userId);
      if (frozen.has(consentType)) {
        throw new Error(
          `${consentService.describeConsent(consentType).title} is restricted under an Article 18 request. Lift the restriction before granting it again.`
        );
      }
    }

    const status = granted ? ConsentStatus.GRANTED : ConsentStatus.DENIED;

    // Marketing email is the one consent a sender reads from somewhere else —
    // the newsletter switch in notification settings — so the two are moved
    // together. Withdrawal turns the switch off before the ledger is written,
    // so a failure in between leaves her opted out rather than opted in.
    const marketingEmail = consentType === ConsentType.MARKETING_EMAIL;
    if (marketingEmail && !granted) {
      await consentService.syncMarketingEmailPreference(userId, false);
    }

    const consent = await prisma.consentRecord.upsert({
      where: {
        userId_consentType: { userId, consentType },
      },
      update: {
        status,
        grantedAt: granted ? new Date() : null,
        withdrawnAt: granted ? null : new Date(),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        region: context.region,
      },
      create: {
        userId,
        consentType,
        status,
        version: '1.0',
        grantedAt: granted ? new Date() : null,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        region: context.region,
      },
    });

    // A grant opens the switch only once the ledger holds the consent.
    if (marketingEmail && granted) {
      await consentService.syncMarketingEmailPreference(userId, true);
    }

    await this.logPrivacyAction({
      userId,
      action: granted ? 'CONSENT_GRANTED' : 'CONSENT_WITHDRAWN',
      resourceType: 'ConsentRecord',
      resourceId: consent.id,
      details: { consentType, status },
    });

    return consent;
  }

  /**
   * Get all consents for a user
   */
  async getUserConsents(userId: string): Promise<any[]> {
    return prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { consentType: 'asc' },
    });
  }

  /**
   * Bulk update consents (for Privacy Center)
   */
  async bulkUpdateConsents(
    userId: string,
    consents: Array<{ type: ConsentType; granted: boolean }>,
    context: { ipAddress?: string; userAgent?: string; region?: string }
  ): Promise<void> {
    for (const consent of consents) {
      await this.recordConsent(userId, consent.type, consent.granted, context);
    }
  }

  // ============================================
  // Cookie Consent
  // ============================================

  /**
   * Record cookie consent
   *
   * Works for a visitor who has no account yet, and mirrors the choice onto the
   * member's consent record once there is one to mirror it onto, so the banner
   * and the Privacy Centre can never disagree.
   */
  async recordCookieConsent(
    visitorId: string,
    preferences: {
      analytics: boolean;
      marketing: boolean;
      functional: boolean;
    },
    context: { userId?: string; ipAddress?: string; userAgent?: string; region?: string }
  ): Promise<any> {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year expiry

    // Once the browser belongs to a signed-in member, their Article 18
    // restriction outranks the banner click. Storing the click as given would
    // leave the row saying we may do something we have undertaken not to do.
    const permitted = context.userId
      ? await consentService.applyRestrictions(context.userId, preferences)
      : preferences;

    const cookieConsent = await prisma.cookieConsent.upsert({
      where: { visitorId },
      update: {
        userId: context.userId,
        analytics: permitted.analytics,
        marketing: permitted.marketing,
        functional: permitted.functional,
        ipAddress: context.ipAddress,
        region: context.region,
        expiresAt,
      },
      create: {
        visitorId,
        userId: context.userId,
        essential: true, // Always true
        analytics: permitted.analytics,
        marketing: permitted.marketing,
        functional: permitted.functional,
        ipAddress: context.ipAddress,
        region: context.region,
        expiresAt,
      },
    });

    if (context.userId) {
      await consentService.recordCookiePreferences(context.userId, permitted, {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        region: context.region,
      });
    }

    await this.logPrivacyAction({
      userId: context.userId,
      action: 'COOKIE_CONSENT_UPDATED',
      resourceType: 'CookieConsent',
      resourceId: cookieConsent.id,
      details: permitted,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      region: context.region,
    });

    return cookieConsent;
  }

  /**
   * Get cookie consent for visitor
   */
  async getCookieConsent(visitorId: string): Promise<any> {
    return prisma.cookieConsent.findUnique({
      where: { visitorId },
    });
  }

  // ============================================
  // Privacy Audit Logging
  // ============================================

  /**
   * Record a staff change to a compliance document (RoPA entry, DPIA).
   *
   * These are not data-subject actions, so they belong in the privacy audit
   * trail rather than in AuditLog, whose AuditAction enum has no value for
   * them. Public because the routes that edit those documents are the only
   * callers and there is nothing member-specific to hide behind.
   */
  async recordComplianceChange(params: {
    adminId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    previousValue?: object;
    newValue?: object;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.logPrivacyAction(params);
  }

  private async logPrivacyAction(params: {
    userId?: string;
    adminId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    details?: object;
    previousValue?: object;
    newValue?: object;
    ipAddress?: string;
    userAgent?: string;
    region?: string;
  }): Promise<void> {
    await prisma.privacyAuditLog.create({
      data: {
        userId: params.userId,
        adminId: params.adminId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        details: params.details,
        previousValue: params.previousValue,
        newValue: params.newValue,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        region: params.region,
      },
    });
  }

  // ============================================
  // Data Classification & RoPA
  // ============================================

  /**
   * Get data classification for export/audit
   */
  getDataClassification(): Record<string, DataCategory[]> {
    return {
      user_profile: [DataCategory.PII],
      user_email: [DataCategory.PII],
      user_address: [DataCategory.PII],
      user_financial: [DataCategory.FINANCIAL, DataCategory.PII],
      user_verification: [DataCategory.BIOMETRIC, DataCategory.SENSITIVE],
      user_posts: [DataCategory.UGC],
      user_messages: [DataCategory.UGC, DataCategory.PII],
      user_behavior: [DataCategory.BEHAVIORAL],
      technical_logs: [DataCategory.TECHNICAL],
    };
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Read every table in the register that the member appears in.
   */
  private async collectPersonalData(userId: string, dsarId: string): Promise<DSARExportData> {
    const account = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        skills: { include: { skill: true } },
        education: true,
        experience: true,
      },
    });

    const records: Record<string, object[]> = {};
    const excluded: Array<{ section: string; reason: string }> = [];
    // Said every time, whatever her score is: the export's silence about a column
    // must not be an answer about her.
    excluded.push({ section: 'account.safetyScore', reason: STAFF_ONLY_ACCOUNT_REASON });
    excluded.push({ section: 'account.trustScore', reason: STAFF_ONLY_TRUST_REASON });

    for (const entry of PERSONAL_DATA_MODELS) {
      if (entry.exportable === false) {
        excluded.push({ section: entry.section, reason: entry.reason || 'Not part of the data subject record.' });
        continue;
      }

      const rows = await delegateFor(prisma, entry).findMany({
        where: subjectFilter(entry, userId),
      });

      records[entry.section] = rows.map((row) => this.sanitizeForExport(entry.readable ? entry.readable(row) : row));
    }

    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        requestId: dsarId,
        format: 'JSON',
        sections: Object.keys(records).length,
      },
      account: this.sanitizeForExport(
        account && Object.fromEntries(Object.entries(account).filter(([column]) => !(STAFF_ONLY_ACCOUNT_COLUMNS as readonly string[]).includes(column)))
      ),
      records,
      excluded,
    };
  }

  /**
   * Clear the member out of every table in the register, then either drop the
   * account row or, when a retained record still points at it, strip it back to
   * an unidentifiable shell. Either way it happens in one transaction, so a
   * failure part way through leaves nothing half erased.
   */
  private async eraseUser(userId: string, dsarId: string): Promise<ErasureOutcome> {
    const hash = pseudonym(userId);

    // First, and not best effort: a membership that keeps billing after the
    // account is gone is money taken for nothing. If Stripe cannot be asked to
    // stop it this throws (409) and nothing below has run, so she is never left
    // erased and still charged. See erasure-billing.service.ts.
    await endBillingBeforeErasure(userId);

    // Her photo ID checks are held by Stripe, and the session id on her badges
    // is the only handle there is to them; the walk below deletes the badges.
    // So Stripe is asked to erase them first, outside the transaction because it
    // is a call to another service. It never throws and never holds the erasure
    // up: a session Stripe refuses is logged and the erasure goes on.
    await bestEffort('identity check redaction before erasure', () => redactIdentityChecksBeforeErasure(userId));

    // The pictures, recordings and files she sent in conversations, and was sent.
    // Listed now because the walk below deletes the rows that name them, and
    // removed after the erasure has committed: a file taken out of the bucket for
    // an erasure that then rolled back would be gone from a thread that is still
    // there. It never throws, so it never holds the erasure up.
    const chatFiles = await chatFilesOfMember(userId);

    const outcome = await prisma.$transaction(
      async (tx) => {
        let rowsRemoved = 0;

        // Event copies the host's name, title and avatar into plain columns
        // beside the link, so detaching hostUserId on its own would leave her
        // named on the listing. It runs first because the register walk below
        // is what clears the link these rows are found by.
        await tx.event.updateMany({
          where: { hostUserId: userId },
          data: { hostName: 'Former host', hostTitle: '', hostAvatar: '' },
        });

        for (const entry of PERSONAL_DATA_MODELS) {
          if (entry.erasure === 'retain' || entry.erasure === 'skip') continue;

          const delegate = delegateFor(tx, entry);

          switch (entry.erasure) {
            case 'delete': {
              const { count } = await delegate.deleteMany({ where: subjectFilter(entry, userId) });
              rowsRemoved += count;
              break;
            }
            case 'detach':
              // One column at a time: a row matched on one key must not have
              // somebody else's link on another key wiped along with it.
              for (const key of entry.keys) {
                await delegate.updateMany({ where: { [key]: userId }, data: { [key]: null } });
              }
              break;
            case 'pseudonymise':
              for (const key of entry.keys) {
                await delegate.updateMany({ where: { [key]: userId }, data: { [key]: hash } });
              }
              break;
          }
        }

        // Rollout targeting keeps member ids in list columns that Prisma cannot
        // filter inside.
        await tx.$executeRaw`
          UPDATE "FeatureFlag"
          SET "allowList" = array_remove("allowList", ${userId}::text),
              "denyList" = array_remove("denyList", ${userId}::text)
          WHERE ${userId}::text = ANY("allowList") OR ${userId}::text = ANY("denyList")
        `;

        // Her own safe chats went with her safety profile above, but a chat
        // another member owns lists its participants as bare ids in an array,
        // and she has to come out of those too.
        await tx.$executeRaw`
          UPDATE "DvSafeChat"
          SET "participants" = array_remove("participants", ${userId}::text)
          WHERE ${userId}::text = ANY("participants")
        `;

        // DvSafetyProfile.blockedUserIds is knowingly left alone. Her id in
        // another woman's block list is personal data about her, but taking it
        // out would unblock her on the way past, and a block on a safety
        // platform outlives the account it was placed against.

        const retainedSections: string[] = [];
        for (const entry of PERSONAL_DATA_MODELS) {
          if (entry.erasure !== 'retain' || !entry.holdsAccount) continue;
          const remaining = await delegateFor(tx, entry).count({ where: subjectFilter(entry, userId) });
          if (remaining > 0) retainedSections.push(entry.section);
        }

        if (retainedSections.length === 0) {
          await tx.user.delete({ where: { id: userId } });
          return {
            requestId: dsarId,
            status: 'COMPLETED' as const,
            accountRemoved: true,
            retainedSections,
            rowsRemoved,
          };
        }

        await tx.user.update({
          where: { id: userId },
          data: this.tombstoneFields(hash),
        });

        return {
          requestId: dsarId,
          status: 'COMPLETED' as const,
          accountRemoved: false,
          retainedSections,
          rowsRemoved,
        };
      },
      { timeout: ERASURE_TRANSACTION_TIMEOUT_MS, maxWait: ERASURE_TRANSACTION_MAX_WAIT_MS }
    );

    // Committed. Now the files behind the messages that went, except behind a
    // message somebody reported (services/chat-attachment-cleanup).
    await deleteChatAttachmentFiles(chatFiles);

    return outcome;
  }

  /**
   * What is left of an account that a retained record still points at: enough
   * for the foreign key to resolve, nothing that identifies a person. The email
   * uses the reserved .invalid domain so it can never be delivered to.
   */
  private tombstoneFields(hash: string): Record<string, unknown> {
    return {
      email: `erased-${hash.slice(0, 32)}@erased.invalid`,
      googleId: null,
      facebookId: null,
      passwordHash: null,
      emailVerified: false,
      emailVerifiedAt: null,
      firstName: 'Erased',
      lastName: 'account',
      displayName: null,
      avatar: null,
      bio: null,
      headline: null,
      city: null,
      state: null,
      country: 'UNKNOWN',
      currentJobTitle: null,
      currentCompany: null,
      yearsExperience: null,
      referralCode: null,
      inviteCodeId: null,
      stripeConnectAccountId: null,
      stripeConnectStatus: null,
      notificationPreferences: Prisma.DbNull,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
      // Hashed, but still a credential for an account that no longer exists.
      twoFactorRecoveryCodes: { set: [] },
      womanSelfAttested: false,
      womanVerificationStatus: WomanVerificationStatus.UNVERIFIED,
      womanVerifiedAt: null,
      // Her date of birth, and the record that a document check confirmed it.
      // A shell kept so a foreign key resolves must not also keep how old she
      // was, which for an account closed because its holder was under 18 is the
      // one personal fact the closure itself was about.
      dateOfBirth: null,
      ageVerifiedAt: null,
      consentMarketing: false,
      consentDataProcessing: false,
      consentCookies: false,
      consentUpdatedAt: new Date(),
      isPublic: false,
      allowMessages: false,
      isActive: false,
      isSuspended: true,
    };
  }

  /**
   * Recover the outcome of an erasure that has already run, so calling the same
   * request twice reports rather than repeats.
   */
  private async findCompletedErasure(dsarId: string): Promise<ErasureOutcome | null> {
    const record = await prisma.privacyAuditLog.findFirst({
      where: {
        action: 'DSAR_ERASURE_COMPLETED',
        resourceType: 'DSARRequest',
        resourceId: dsarId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) return null;

    const details = (record.details ?? {}) as {
      accountRemoved?: boolean;
      retainedSections?: string[];
      rowsRemoved?: number;
    };

    return {
      requestId: dsarId,
      status: 'ALREADY_COMPLETED',
      accountRemoved: details.accountRemoved === true,
      retainedSections: Array.isArray(details.retainedSections) ? details.retainedSections : [],
      rowsRemoved: typeof details.rowsRemoved === 'number' ? details.rowsRemoved : 0,
    };
  }

  private matchesSubject(ownerId: string, callerId: string): boolean {
    const owner = Buffer.from(ownerId);
    const caller = Buffer.from(callerId);
    return owner.length === caller.length && timingSafeEqual(owner, caller);
  }

  private sanitizeForExport(data: any): object {
    if (!data || typeof data !== 'object') return {};

    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SECRET_EXPORT_FIELDS.has(key)) continue;
      clean[key] = value;
    }
    return clean;
  }
}

export const gdprService = new GDPRService();
