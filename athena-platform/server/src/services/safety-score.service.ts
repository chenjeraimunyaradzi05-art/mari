/**
 * Safety Score Service
 * Calculates and updates user safety scores based on reports, blocks, and behavior
 * Phase 2: Backend Logic & Integrations
 */

import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { bestEffort } from '../utils/best-effort';
import { ApiError } from '../middleware/errorHandler';
import { notifyAdmins } from './admin-notify.service';
import { NotificationService } from './notification.service';

const notificationService = new NotificationService();

// Safety score weights
const WEIGHTS = {
  // Negative factors (reduce score)
  REPORT_RECEIVED: -10,
  REPORT_VERIFIED: -25,
  BLOCK_RECEIVED: -5,
  CONTENT_REMOVED: -15,
  SUSPENSION: -50,

  // What signals no person has checked can add up to, however many arrive.
  // A report nobody has decided and a block are one account's word, and a score
  // that a handful of accounts could move to the critical band, which puts a
  // member in front of staff and emails her an Account Standing Update, is a
  // way for a few people to make a woman look like the risk: the DPIA names
  // "a survivor is wrongly scored as the aggressor". Three different people
  // fill each cap, so a pile-on cannot go further than three, and the two
  // together (-45) cannot take a member from the default of 75 below the
  // critical line of 25. A report a moderator upheld is not capped: a person
  // checked it.
  UNDECIDED_REPORTS_CAP: -30,
  BLOCKS_CAP: -15,

  // Positive factors (increase score)
  ACCOUNT_AGE_DAY: 0.1, // Per day, max 365 days
  VERIFIED_IDENTITY: 20,
  VERIFIED_EMPLOYER: 15,
  COMPLETED_PROFILE: 10,
  POSITIVE_INTERACTION: 1, // Likes, helpful comments
  MENTOR_SESSION_COMPLETED: 5,
  COURSE_COMPLETED: 3,
  
  // Decay - old incidents matter less
  INCIDENT_DECAY_DAYS: 90, // Incidents older than this have 50% weight
  
  // Bounds
  MIN_SCORE: 0,
  MAX_SCORE: 100,
  DEFAULT_SCORE: 75,
};

export interface SafetyIncident {
  id: string;
  userId: string;
  type: 'REPORT' | 'BLOCK' | 'CONTENT_REMOVAL' | 'SUSPENSION' | 'WARNING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
  reporterId?: string;
  contentId?: string;
  contentType?: string;
  verified: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface SafetyScoreBreakdown {
  score: number;
  factors: {
    category: string;
    impact: number;
    details: string;
  }[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  restrictions: string[];
  lastUpdated: Date;
}

/**
 * The score a member stands at: what was last worked out for her, or the
 * baseline when nothing ever has been.
 *
 * The column's own default is 50 and the baseline the scorer starts from is 75,
 * so a member who had never been assessed read as "caution" in her standing, and
 * her first report was measured as a rise from 50 instead of a fall from 75, so
 * the notice that goes with a fall never went. Until safetyScoreUpdatedAt is set
 * the column holds no measurement, only the default.
 */
function scoreStoodAt(user: { safetyScore: number; safetyScoreUpdatedAt: Date | null } | null | undefined): number {
  if (!user || !user.safetyScoreUpdatedAt) return WEIGHTS.DEFAULT_SCORE;
  return user.safetyScore;
}

/**
 * Calculate time decay factor for old incidents
 */
function calculateDecay(incidentDate: Date): number {
  const daysSince = (Date.now() - incidentDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSince <= WEIGHTS.INCIDENT_DECAY_DAYS) {
    return 1;
  }
  
  // Exponential decay after threshold
  const decayFactor = Math.pow(0.5, (daysSince - WEIGHTS.INCIDENT_DECAY_DAYS) / WEIGHTS.INCIDENT_DECAY_DAYS);
  return Math.max(decayFactor, 0.1); // Minimum 10% weight
}

/**
 * Calculate safety score for a user
 */
export async function calculateSafetyScore(userId: string): Promise<SafetyScoreBreakdown> {
  const factors: SafetyScoreBreakdown['factors'] = [];
  let score = WEIGHTS.DEFAULT_SCORE;
  
  // Get user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      verificationBadges: true,
      _count: {
        select: {
          posts: true,
          comments: true,
          likes: true,
        },
      },
    },
  });
  
  if (!user) {
    return {
      score: 0,
      factors: [{ category: 'error', impact: 0, details: 'User not found' }],
      riskLevel: 'CRITICAL',
      restrictions: ['account_suspended'],
      lastUpdated: new Date(),
    };
  }
  
  // 1. Account age bonus
  const accountAgeDays = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const ageBonus = Math.min(accountAgeDays * WEIGHTS.ACCOUNT_AGE_DAY, 36.5); // Max ~1 year
  score += ageBonus;
  factors.push({
    category: 'account_age',
    impact: ageBonus,
    details: `Account is ${accountAgeDays} days old`,
  });
  
  // 2. Verification badges
  // A badge counts when a reviewer has approved it. This read a column the table
  // does not have (isActive), through an `any` that hid it from the compiler, so
  // it was always undefined and neither bonus below was ever applied: a member
  // whose identity staff had checked scored the same as one who had not.
  const verifications = user.verificationBadges || [];
  if (verifications.some((v) => v.type === 'IDENTITY' && v.status === 'APPROVED')) {
    score += WEIGHTS.VERIFIED_IDENTITY;
    factors.push({
      category: 'verification',
      impact: WEIGHTS.VERIFIED_IDENTITY,
      details: 'Identity verified',
    });
  }
  if (verifications.some((v) => v.type === 'EMPLOYER' && v.status === 'APPROVED')) {
    score += WEIGHTS.VERIFIED_EMPLOYER;
    factors.push({
      category: 'verification',
      impact: WEIGHTS.VERIFIED_EMPLOYER,
      details: 'Employer verified',
    });
  }
  
  // 3. Profile completeness
  const profile = user.profile;
  const profileFields = profile
    ? [profile.aboutMe, profile.linkedinUrl, profile.websiteUrl].filter(Boolean).length
    : 0;
  if (profileFields >= 2) {
    score += WEIGHTS.COMPLETED_PROFILE;
    factors.push({
      category: 'profile',
      impact: WEIGHTS.COMPLETED_PROFILE,
      details: 'Profile substantially completed',
    });
  }
  
  // 4. Get safety incidents
  const incidents = await prisma.safetyIncident.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  
  // Each reporter and each blocker is one voice, and the unchecked voices have
  // a ceiling (see UNDECIDED_REPORTS_CAP). Incidents are newest first, so the
  // ones that are counted are the freshest of each.
  const countedReporters = new Set<string>();
  const countedBlockers = new Set<string>();
  let undecidedReportImpact = 0;
  let blockImpact = 0;

  for (const incident of incidents) {
    const decay = calculateDecay(incident.createdAt);
    let impact = 0;
    
    // A report a moderator has looked at and dismissed says nothing about
    // her, so it stops counting. Before reports could be decided at all, an
    // unfounded one weighed on a score for ever. The same holds for a report
    // filed without an account (USER_REPORT), which resolveAnonymousReport
    // decides the same way.
    const isReport = incident.type === 'REPORT' || incident.type === 'USER_REPORT';
    const dismissed = isReport && Boolean(incident.resolvedAt) && !incident.verified;
    if (dismissed) {
      factors.push({ category: 'incident', impact: 0, details: `${incident.type} - ${incident.reason} (dismissed by a moderator)` });
      continue;
    }

    // An anonymous report has no reporter to weigh, and one person signed out
    // could file as many as she liked, so an undecided one counts for nothing.
    // It used to count for nothing even after a moderator upheld it, which
    // left a founded report with no effect at all; once upheld it now weighs
    // what any other verified report does.
    if (incident.type === 'USER_REPORT' && !incident.verified) {
      factors.push({ category: 'incident', impact: 0, details: `USER_REPORT - ${incident.reason} (anonymous, not yet decided)` });
      continue;
    }

    // A block she took back is not a block she still holds.
    if (incident.type === 'BLOCK' && incident.resolvedAt) {
      factors.push({ category: 'incident', impact: 0, details: `BLOCK - ${incident.reason} (lifted)` });
      continue;
    }

    switch (incident.type) {
      case 'REPORT':
        if (incident.verified) {
          impact = WEIGHTS.REPORT_VERIFIED * decay;
        } else {
          // Nobody has decided it. One voice per reporter, and a ceiling on the
          // lot: twenty reports from one account, or from three, move the score
          // no further than three accounts' worth.
          const reporter = incident.reporterId ?? incident.id;
          if (countedReporters.has(reporter)) {
            factors.push({ category: 'incident', impact: 0, details: `REPORT - ${incident.reason} (this reporter is already counted)` });
            continue;
          }
          countedReporters.add(reporter);
          impact = Math.max(WEIGHTS.REPORT_RECEIVED * decay, WEIGHTS.UNDECIDED_REPORTS_CAP - undecidedReportImpact);
          undecidedReportImpact += impact;
        }
        break;
      case 'USER_REPORT':
        impact = incident.verified ? WEIGHTS.REPORT_VERIFIED * decay : 0;
        break;
      case 'BLOCK': {
        const blocker = incident.reporterId ?? incident.id;
        if (countedBlockers.has(blocker)) {
          factors.push({ category: 'incident', impact: 0, details: `BLOCK - ${incident.reason} (this blocker is already counted)` });
          continue;
        }
        countedBlockers.add(blocker);
        impact = Math.max(WEIGHTS.BLOCK_RECEIVED * decay, WEIGHTS.BLOCKS_CAP - blockImpact);
        blockImpact += impact;
        break;
      }
      case 'CONTENT_REMOVAL':
        impact = WEIGHTS.CONTENT_REMOVED * decay;
        break;
      case 'SUSPENSION':
        impact = WEIGHTS.SUSPENSION * decay;
        break;
    }
    
    score += impact;
    factors.push({
      category: 'incident',
      impact,
      details: `${incident.type} - ${incident.reason} (${decay < 1 ? 'decayed' : 'recent'})`,
    });
  }
  
  // 5. Positive interactions
  const positiveCount = user._count.likes + Math.floor(user._count.comments / 2);
  const positiveBonus = Math.min(positiveCount * WEIGHTS.POSITIVE_INTERACTION, 20);
  if (positiveBonus > 0) {
    score += positiveBonus;
    factors.push({
      category: 'engagement',
      impact: positiveBonus,
      details: `${positiveCount} positive interactions`,
    });
  }
  
  // 6. Mentor sessions completed
  const mentorSessions = await prisma.mentorSession.count({
    where: {
      OR: [
        { menteeId: userId, status: 'COMPLETED' },
        { mentorProfile: { userId }, status: 'COMPLETED' },
      ],
    },
  });
  if (mentorSessions > 0) {
    const sessionBonus = Math.min(mentorSessions * WEIGHTS.MENTOR_SESSION_COMPLETED, 25);
    score += sessionBonus;
    factors.push({
      category: 'mentorship',
      impact: sessionBonus,
      details: `${mentorSessions} mentor sessions completed`,
    });
  }
  
  // Clamp score to bounds
  score = Math.max(WEIGHTS.MIN_SCORE, Math.min(WEIGHTS.MAX_SCORE, Math.round(score)));
  
  // Determine risk level
  let riskLevel: SafetyScoreBreakdown['riskLevel'];
  if (score >= 70) riskLevel = 'LOW';
  else if (score >= 50) riskLevel = 'MEDIUM';
  else if (score >= 25) riskLevel = 'HIGH';
  else riskLevel = 'CRITICAL';
  
  // Determine restrictions based on risk level
  const restrictions: string[] = [];
  if (riskLevel === 'CRITICAL') {
    restrictions.push('cannot_message', 'cannot_post', 'cannot_comment', 'review_required');
  } else if (riskLevel === 'HIGH') {
    restrictions.push('limited_messaging', 'posts_require_review');
  } else if (riskLevel === 'MEDIUM') {
    restrictions.push('rate_limited');
  }
  
  return {
    score,
    factors,
    riskLevel,
    restrictions,
    lastUpdated: new Date(),
  };
}

/**
 * Update safety score in database
 */
export async function updateSafetyScore(userId: string): Promise<number> {
  const breakdown = await calculateSafetyScore(userId);
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      safetyScore: breakdown.score,
      safetyScoreUpdatedAt: new Date(),
    },
  });
  
  logger.info('Safety score updated', { userId, score: breakdown.score, riskLevel: breakdown.riskLevel });
  
  return breakdown.score;
}

/**
 * Record a safety incident and trigger score recalculation
 */
export async function recordSafetyIncident(incident: Omit<SafetyIncident, 'id' | 'createdAt'>): Promise<void> {
  /*
   * The score as it stands, read before anything moves it.
   *
   * This read happened *after* updateSafetyScore had already written the new
   * value onto the row, so `oldScore` was the new score under another name.
   * Both comparisons below are between a number and itself: the drop was
   * always 0, so the "Account Standing Update" notification never went to
   * anybody, and `newScore < 25 && oldScore >= 25` was never true, so the
   * SAFETY_CRITICAL AdminFlag — the row that puts an account in front of the
   * staff safety queue — was never raised by a report or a block. Every
   * reported member and every blocked member came through here. The one case
   * that slipped through was a score landing on exactly 0, because `||` read
   * it as absent and substituted the default.
   *
   * `??` rather than `||` for the same reason: a stored 0 is a measurement,
   * not a missing value. A member who has never been scored reads the column
   * default, which is what the rest of the platform reads about her too, so
   * it is the right thing to compare against.
   */
  const before = await prisma.user.findUnique({
    where: { id: incident.userId },
    select: { safetyScore: true, safetyScoreUpdatedAt: true },
  });
  const oldScore = scoreStoodAt(before);

  // One open report, and one block, per person against another. The same
  // account reporting someone twenty times (the report limiter allows fifteen an
  // hour) or blocking, unblocking and blocking again is one voice, not twenty:
  // every report still reaches the moderation queue, but it is a single entry on
  // the score until a moderator has decided it.
  if ((incident.type === 'REPORT' || incident.type === 'BLOCK') && incident.reporterId) {
    const open = await prisma.safetyIncident.findFirst({
      where: { userId: incident.userId, type: incident.type, reporterId: incident.reporterId, resolvedAt: null },
      select: { id: true },
    });
    if (open) {
      logger.info('Safety incident not recorded again: this member already has one open from the same reporter', {
        userId: incident.userId,
        type: incident.type,
      });
      return;
    }
  }

  // Create incident record
  await prisma.safetyIncident.create({
    data: {
      userId: incident.userId,
      type: incident.type,
      severity: incident.severity,
      reason: incident.reason,
      reporterId: incident.reporterId,
      contentId: incident.contentId,
      contentType: incident.contentType,
      verified: incident.verified,
    },
  });

  // Recalculate safety score
  const newScore = await updateSafetyScore(incident.userId);

  if (oldScore - newScore >= 15) {
    // Score dropped significantly - notify user
    await notificationService.notify({
      userId: incident.userId,
      type: 'SYSTEM',
      title: 'Account Standing Update',
      message: 'Your account standing has changed. Please review our community guidelines.',
      // The message sends her to the guidelines, so the link does too. It
      // pointed at /settings/safety, a page that has never existed, and once
      // this notification started firing every one of them opened a 404.
      link: '/help/community-guidelines',
      channels: ['in-app', 'email'],
      priority: 'high',
    });
  }
  
  // Check if critical threshold reached
  if (newScore < 25 && oldScore >= 25) {
    // User crossed into critical territory - flag for review.
    //
    // The flag used to be the whole of it. AdminFlag had no reader anywhere on
    // the platform, so "flag for review" meant writing a row and hoping: no
    // route read the table, no page showed it, nobody was told. It is now a
    // queue staff work (GET /api/safety/moderation/flags, rendered above the
    // report queue at /admin/moderation) and raising one tells them, the same
    // way every other queue here announces that something is waiting.
    const flag = await prisma.adminFlag.create({
      data: {
        userId: incident.userId,
        type: 'SAFETY_CRITICAL',
        reason: `Safety score dropped to ${newScore}`,
        severity: 'HIGH',
        flaggedById: 'system',
      },
    });

    // Best effort, and deliberately after the flag: the row is the record and
    // must not be lost because an admin's notification could not be written.
    // The notification names no member — it travels to every admin's inbox,
    // and the account it is about belongs behind the staff role in the queue.
    await bestEffort(
      'safety-critical admin notification',
      notifyAdmins({
        title: 'A member has crossed the safety threshold',
        message: 'An account’s safety score has fallen into critical territory and is waiting in the safety queue.',
        link: '/admin/moderation#safety-concerns',
        data: { flagId: flag.id, flagType: 'SAFETY_CRITICAL', severity: 'HIGH' },
      })
    );

    logger.warn('User safety score critical', { userId: incident.userId, newScore, flagId: flag.id });
  }
}

/**
 * Reasons a report can be filed for that are about the reported member's
 * wellbeing and not her conduct. Someone who is reported because she wrote that
 * she wants to die needs a person to reach her, which the report queue and its
 * alert do; a safety score that went down because she was at risk would be the
 * platform marking a woman in crisis as a risk to others.
 */
const WELFARE_REASONS: ReadonlySet<string> = new Set(['self_harm']);

/**
 * Handle user report event
 */
export async function handleUserReport(
  reportedUserId: string,
  reporterId: string,
  reason: string,
  contentId?: string,
  contentType?: string
): Promise<void> {
  if (WELFARE_REASONS.has(reason.trim().toLowerCase())) return;

  await recordSafetyIncident({
    userId: reportedUserId,
    type: 'REPORT',
    severity: 'MEDIUM',
    reason,
    reporterId,
    contentId,
    contentType,
    verified: false, // Will be verified by moderation
  });
}

/**
 * Handle user block event
 */
export async function handleUserBlock(blockedUserId: string, blockerId: string): Promise<void> {
  // Get recent block count for this user
  const recentBlocks = await prisma.safetyIncident.count({
    where: {
      userId: blockedUserId,
      type: 'BLOCK',
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    },
  });
  
  // Determine severity based on recent blocks
  const severity = recentBlocks >= 5 ? 'HIGH' : recentBlocks >= 2 ? 'MEDIUM' : 'LOW';
  
  await recordSafetyIncident({
    userId: blockedUserId,
    type: 'BLOCK',
    severity,
    reason: 'Blocked by another user',
    reporterId: blockerId,
    verified: true, // Blocks are automatically verified
  });
}

/**
 * Handle a block being lifted: it stops counting against the person it was
 * made against, and the score is worked out again without it.
 */
export async function handleUserUnblock(blockedUserId: string, blockerId: string): Promise<void> {
  const lifted = await prisma.safetyIncident.updateMany({
    where: { userId: blockedUserId, type: 'BLOCK', reporterId: blockerId, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  if (lifted.count > 0) await updateSafetyScore(blockedUserId);
}

/**
 * Handle content removal event
 */
export async function handleContentRemoval(
  userId: string,
  contentId: string,
  contentType: string,
  reason: string,
  moderatorId?: string
): Promise<void> {
  await recordSafetyIncident({
    userId,
    type: 'CONTENT_REMOVAL',
    severity: 'MEDIUM',
    reason,
    reporterId: moderatorId,
    contentId,
    contentType,
    verified: true,
  });
}

/**
 * Verify a pending report (by moderator)
 */
export async function verifyReport(incidentId: string, verified: boolean, moderatorId: string): Promise<void> {
  const incident = await prisma.safetyIncident.findUnique({
    where: { id: incidentId },
  });
  
  if (!incident) {
    // A 404 with a reason, not a bare Error that reaches the member of staff
    // as a 500.
    throw new ApiError(404, 'Incident not found');
  }
  
  await prisma.safetyIncident.update({
    where: { id: incidentId },
    data: {
      verified,
      resolvedAt: new Date(),
      resolvedById: moderatorId,
    },
  });
  
  // Recalculate score with verified status
  await updateSafetyScore(incident.userId);
}

/**
 * Get user's safety status for profile display
 */
export async function getSafetyStatus(userId: string): Promise<{
  score: number;
  level: 'TRUSTED' | 'GOOD' | 'CAUTION' | 'RESTRICTED';
  badges: string[];
  /**
   * When the score was last calculated, or null if it never has been — in which
   * case `score` is the column default rather than a measurement, and a caller
   * that shows it to anyone has to say "not assessed" instead of printing a
   * number nobody worked out.
   */
  assessedAt: Date | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { verificationBadges: true },
  });

  const score = scoreStoodAt(user);
  
  let level: 'TRUSTED' | 'GOOD' | 'CAUTION' | 'RESTRICTED';
  if (score >= 85) level = 'TRUSTED';
  else if (score >= 60) level = 'GOOD';
  else if (score >= 35) level = 'CAUTION';
  else level = 'RESTRICTED';
  
  const badges = (user?.verificationBadges || [])
    .filter((b) => b.status === 'APPROVED')
    .map((b) => b.type);
  
  return { score, level, badges, assessedAt: user?.safetyScoreUpdatedAt ?? null };
}

export const safetyScoreService = {
  calculateSafetyScore,
  updateSafetyScore,
  recordSafetyIncident,
  handleUserReport,
  handleUserBlock,
  handleUserUnblock,
  handleContentRemoval,
  verifyReport,
  getSafetyStatus,
};
