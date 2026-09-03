/**
 * GDPR Compliance Service
 * Handles DSAR requests, data export, deletion, and compliance operations
 * Phase 4: UK/EU Market Launch
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
  /** Left out of the export bundle; `reason` then explains why. */
  exportable?: false;
  /** Required for retain, skip, and anything not exportable. */
  reason?: string;
}

/**
 * Every table holding personal data about a member. Both data subject rights
 * walk this list in order, so a table missing from it is invisible to export
 * and survives erasure: add an entry whenever you add a table that stores a
 * member id. Erasure deletes top to bottom, which is why rows that a foreign
 * key would otherwise pin come first.
 */
export const PERSONAL_DATA_MODELS: PersonalDataModel[] = [
  // Children whose parent rows cannot be removed while they exist.
  { model: 'milestoneProgress', section: 'programMilestoneProgress', keys: [], where: (userId) => ({ enrollment: { userId } }), erasure: 'delete' },
  { model: 'savingsContribution', section: 'savingsContributions', keys: [], where: (userId) => ({ goal: { userId } }), erasure: 'delete' },
  { model: 'rfpResponse', section: 'rfpResponsesReceived', keys: [], where: (userId) => ({ rfp: { userId } }), erasure: 'delete' },

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

  // Conversation and comment content.
  { model: 'comment', section: 'comments', keys: ['authorId'], erasure: 'delete' },
  { model: 'videoComment', section: 'videoComments', keys: ['authorId'], erasure: 'delete' },
  { model: 'message', section: 'messages', keys: ['senderId', 'receiverId'], erasure: 'delete' },
  { model: 'conversationParticipant', section: 'conversations', keys: ['userId'], erasure: 'delete' },

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

  // Profiles, settings and derived insight, including special category data.
  { model: 'profile', section: 'profile', keys: ['userId'], erasure: 'delete' },
  { model: 'creatorProfile', section: 'creatorProfile', keys: ['userId'], erasure: 'delete' },
  { model: 'mentorProfile', section: 'mentorProfile', keys: ['userId'], erasure: 'delete' },
  { model: 'creatorAnalytics', section: 'creatorAnalytics', keys: ['userId'], erasure: 'delete' },
  { model: 'userFeedPreferences', section: 'feedPreferences', keys: ['userId'], erasure: 'delete' },
  { model: 'userSafetySettings', section: 'safetySettings', keys: ['userId'], erasure: 'delete' },
  { model: 'userTrustScore', section: 'trustScore', keys: ['userId'], erasure: 'delete' },
  { model: 'financialHealthScore', section: 'financialHealthScore', keys: ['userId'], erasure: 'delete' },
  { model: 'languageProfile', section: 'languageProfile', keys: ['userId'], erasure: 'delete' },
  { model: 'safetyPlan', section: 'safetyPlan', keys: ['userId'], erasure: 'delete' },
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

  // Verification, appeals and moderation.
  { model: 'verificationBadge', section: 'verificationBadges', keys: ['userId'], erasure: 'delete' },
  { model: 'verificationBadge', section: 'verificationsReviewed', keys: ['reviewedById'], erasure: 'detach' },
  { model: 'appeal', section: 'appeals', keys: ['userId'], erasure: 'delete' },
  { model: 'appeal', section: 'appealsReviewed', keys: ['reviewedById'], erasure: 'detach' },
  { model: 'safetyIncident', section: 'safetyIncidents', keys: ['userId'], erasure: 'delete' },
  {
    model: 'safetyIncident',
    section: 'safetyIncidentsReported',
    keys: ['reporterId'],
    erasure: 'detach',
    exportable: false,
    reason: 'Naming the incidents a member reported would identify the people they reported.',
  },
  { model: 'adminFlag', section: 'adminFlags', keys: ['userId'], erasure: 'delete' },
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

// Fields that must never leave the platform inside an export bundle.
const SECRET_EXPORT_FIELDS = new Set([
  'passwordHash',
  'twoFactorSecret',
  'token',
  'tokenHash',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'secret',
]);

const DOWNLOAD_PATH_PREFIX = '/api/gdpr/download/';
const EXPORT_TOKEN_BYTES = 32;
const EXPORT_WINDOW_HOURS = 72;

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
   * Create a new DSAR request
   */
  async createDSARRequest(input: DSARRequestInput): Promise<any> {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // GDPR 30-day deadline

    const dsar = await prisma.dSARRequest.create({
      data: {
        userId: input.userId,
        type: input.type,
        status: DSARStatus.PENDING,
        requestDetails: input.requestDetails,
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

    const outcome = await this.eraseUser(userId, dsarId);

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
   * Process Rectification Request
   */
  async processRectificationRequest(
    dsarId: string,
    corrections: Record<string, any>
  ): Promise<void> {
    const dsar = await prisma.dSARRequest.findUnique({
      where: { id: dsarId },
    });

    if (!dsar) throw new Error('DSAR request not found');

    const allowedFields = [
      'firstName',
      'lastName',
      'email',
      'city',
      'state',
      'country',
      'bio',
      'headline',
    ];

    const sanitizedCorrections: Record<string, any> = {};
    for (const [key, value] of Object.entries(corrections)) {
      if (allowedFields.includes(key)) {
        sanitizedCorrections[key] = value;
      }
    }

    // Get previous values for audit
    const previousUser = await prisma.user.findUnique({
      where: { id: dsar.userId },
      select: Object.fromEntries(allowedFields.map(f => [f, true])),
    });

    // Update user data
    await prisma.user.update({
      where: { id: dsar.userId },
      data: sanitizedCorrections,
    });

    // Update DSAR
    await prisma.dSARRequest.update({
      where: { id: dsarId },
      data: {
        status: DSARStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    // Log with audit trail
    await this.logPrivacyAction({
      userId: dsar.userId,
      action: 'DSAR_RECTIFICATION_COMPLETED',
      resourceType: 'User',
      resourceId: dsar.userId,
      previousValue: previousUser || undefined,
      newValue: sanitizedCorrections,
    });
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
   * The retention policies actually on record.
   *
   * Published for transparency, so it carries the promise and its basis and not
   * the operational columns — which purge job runs it, when it last ran — that
   * say nothing to a data subject about their own data.
   */
  async getRetentionPolicies(): Promise<
    Array<{
      dataType: string;
      description: string;
      dataCategory: DataCategory;
      retentionDays: number;
      retentionReason: string;
      legalBasis: string;
      anonymizeInstead: boolean;
    }>
  > {
    const policies = await prisma.retentionPolicy.findMany({
      orderBy: { dataType: 'asc' },
    });

    return policies.map((policy) => ({
      dataType: policy.dataType,
      description: policy.description,
      dataCategory: policy.dataCategory,
      retentionDays: policy.retentionDays,
      retentionReason: policy.retentionReason,
      legalBasis: policy.legalBasis,
      anonymizeInstead: policy.anonymizeInstead,
    }));
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

    for (const entry of PERSONAL_DATA_MODELS) {
      if (entry.exportable === false) {
        excluded.push({ section: entry.section, reason: entry.reason || 'Not part of the data subject record.' });
        continue;
      }

      const rows = await delegateFor(prisma, entry).findMany({
        where: subjectFilter(entry, userId),
      });

      records[entry.section] = rows.map((row) => this.sanitizeForExport(row));
    }

    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        requestId: dsarId,
        format: 'JSON',
        sections: Object.keys(records).length,
      },
      account: this.sanitizeForExport(account),
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

    return prisma.$transaction(
      async (tx) => {
        let rowsRemoved = 0;

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
      womanSelfAttested: false,
      womanVerificationStatus: WomanVerificationStatus.UNVERIFIED,
      womanVerifiedAt: null,
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
