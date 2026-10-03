/**
 * Content Moderation Service
 * Uses OpenAI Moderation API for UGC safety
 */

import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { RekognitionClient, DetectModerationLabelsCommand } from "@aws-sdk/client-rekognition";
import sharp from 'sharp';
import { ApiError } from '../middleware/errorHandler';
import { recordFailure } from '../utils/ops-metrics';
import { logger } from '../utils/logger';
import { cacheGet, cacheSet } from '../utils/cache';
import { prisma } from '../utils/prisma';

// Initialize OpenAI client (optional - will skip AI moderation if not configured).
//
// Every other consumer in the server — ai.service, concierge.service and the
// readiness check in health.routes — reads AI_OPENAI_API_KEY first and falls
// back to OPENAI_API_KEY. This file read only the unprefixed name, so a
// deployment that set the prefixed one (the name the readiness check asks for)
// got working AI features, a green health check, and no text moderation at all
// on any surface. Both names are read here so there is no configuration in
// which the gate is off while the rest of the AI is on.
const moderationApiKey = process.env.AI_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

const openai = moderationApiKey ? new OpenAI({ apiKey: moderationApiKey }) : null;

// Initialize Rekognition client.
//
// This was constructed unconditionally with `|| ''` for both credentials, so a
// deployment with no AWS keys held a client that looked configured and failed
// on the first call instead of standing down deliberately. Worse, the only
// guard on the call path tested AWS_ACCESS_KEY_ID alone: set the id and forget
// the secret — the ordinary shape of a half-finished deployment — and every
// image went to Rekognition with an empty secret, failed, and was allowed
// through by the catch as though it had been screened. The client is null
// unless both halves are present, and null is what the call path checks.
const imageModerationCredentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : null;

const rekognition = imageModerationCredentials
  ? new RekognitionClient({
      region: process.env.AWS_REGION || 'ap-southeast-2',
      credentials: imageModerationCredentials,
    })
  : null;

// Moderation categories and thresholds
const MODERATION_THRESHOLDS = {
  hate: 0.5,
  'hate/threatening': 0.5,
  harassment: 0.6,
  'harassment/threatening': 0.5,
  'self-harm': 0.5,
  'self-harm/intent': 0.5,
  'self-harm/instructions': 0.5,
  sexual: 0.7,
  'sexual/minors': 0.1,
  violence: 0.7,
  'violence/graphic': 0.6,
};

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
  scores: Record<string, number>;
  action: 'allow' | 'review' | 'block';
  reason?: string;
  /**
   * True when the provider was configured but did not answer. The verdict is
   * then 'review' with no categories, which is a statement about the provider
   * and not about the text, and each surface decides what an unanswered check
   * means for it: a post goes out and the outage is counted, while a message
   * aimed at another member is held back until it can be checked.
   */
  unavailable?: boolean;
}

export interface SafetyScoreResult {
  score: number;
  action: 'allow' | 'review' | 'block';
  signals: Array<{
    type: 'moderation' | 'spam' | 'profanity' | 'misinformation';
    severity: 'low' | 'medium' | 'high';
    detail: string;
  }>;
}

/**
 * Moderate text content using OpenAI Moderation API
 */
export async function moderateText(content: string): Promise<ModerationResult> {
  if (!openai) {
    logger.warn('OpenAI API key not configured, skipping moderation');
    return { flagged: false, categories: [], scores: {}, action: 'allow' };
  }

  try {
    // Check cache first. The key is a SHA-256 of the text under a versioned
    // prefix; see contentCacheKey for why the old key could not be trusted.
    const cacheKey = contentCacheKey(content);
    const cached = await cacheGet<ModerationResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await openai.moderations.create({
      input: content,
    });

    const result = response.results[0];
    const flaggedCategories: string[] = [];
    const scores: Record<string, number> = {};

    // Check each category against thresholds
    for (const [category, score] of Object.entries(result.category_scores)) {
      scores[category] = score;
      const threshold = MODERATION_THRESHOLDS[category as keyof typeof MODERATION_THRESHOLDS] || 0.5;
      
      if (score >= threshold) {
        flaggedCategories.push(category);
      }
    }

    // Determine action
    let action: 'allow' | 'review' | 'block' = 'allow';
    let reason: string | undefined;

    if (flaggedCategories.includes('sexual/minors')) {
      action = 'block';
      reason = 'Content violates child safety policies';
    } else if (flaggedCategories.some(c => c.includes('threatening'))) {
      action = 'block';
      reason = 'Content contains threatening language';
    } else if (flaggedCategories.length > 2) {
      action = 'block';
      reason = 'Content violates multiple community guidelines';
    } else if (flaggedCategories.length > 0) {
      action = 'review';
      reason = `Content flagged for: ${flaggedCategories.join(', ')}`;
    }

    const moderationResult: ModerationResult = {
      flagged: result.flagged || flaggedCategories.length > 0,
      categories: flaggedCategories,
      scores,
      action,
      reason,
    };

    // Cache result for 1 hour
    await cacheSet(cacheKey, moderationResult, 3600);

    logger.info('Content moderated', {
      flagged: moderationResult.flagged,
      action: moderationResult.action,
      categories: flaggedCategories,
    });

    return moderationResult;
  } catch (error) {
    // The provider did not answer. This used to be a bare log line and a
    // 'review' verdict indistinguishable from a real one, so an outage was
    // recorded nowhere a dashboard could count it and every caller had to guess
    // from an empty category list whether the text had been judged at all. It
    // is counted here, once, at the one place the outage is known, and the
    // verdict says plainly that nothing was checked.
    logger.error('Moderation API error', { error });
    recordFailure('moderation.provider_unavailable', error);
    return {
      flagged: false,
      categories: [],
      scores: {},
      action: 'review',
      reason: 'Moderation API unavailable',
      unavailable: true,
    };
  }
}

/**
 * Moderate multiple pieces of content
 */
export async function moderateBatch(contents: string[]): Promise<ModerationResult[]> {
  return Promise.all(contents.map(content => moderateText(content)));
}

/**
 * Check if content should be auto-hidden
 */
export function shouldAutoHide(result: ModerationResult): boolean {
  return result.action === 'block';
}

/**
 * Check if content needs manual review
 */
export function needsManualReview(result: ModerationResult): boolean {
  return result.action === 'review';
}

/**
 * Moderate user profile content
 */
export async function moderateProfile(data: {
  bio?: string;
  headline?: string;
  aboutMe?: string;
}): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];
  const textsToCheck = [data.bio, data.headline, data.aboutMe].filter(Boolean) as string[];

  if (textsToCheck.length === 0) {
    return { valid: true, issues: [] };
  }

  const results = await moderateBatch(textsToCheck);

  for (const result of results) {
    if (result.action === 'block') {
      issues.push(result.reason || 'Content violates guidelines');
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Moderate post content
 */
export async function moderatePost(content: string): Promise<{
  allowed: boolean;
  shouldHide: boolean;
  needsReview: boolean;
  reason?: string;
  /** What the provider actually flagged; empty when it flagged nothing or never answered. */
  categories: string[];
  scores: Record<string, number>;
  /** The provider was configured and did not answer, so nothing was judged. */
  unavailable: boolean;
}> {
  const result = await moderateText(content);

  return {
    allowed: result.action !== 'block',
    shouldHide: shouldAutoHide(result),
    needsReview: needsManualReview(result),
    reason: result.reason,
    categories: result.categories,
    scores: result.scores,
    unavailable: result.unavailable === true,
  };
}

/** What a member is told when her message could not be checked. */
export const MESSAGE_CHECK_UNAVAILABLE =
  'Messages cannot be checked right now. Please try again in a few minutes.';

/**
 * Moderate message content
 *
 * A message reaches the person it is aimed at before anybody can report it, so
 * when the provider does not answer the message is held rather than sent. It
 * used to go out: a provider outage delivered every direct message and live
 * chat line unscreened, which is exactly the window someone set on reaching a
 * woman who has blocked him elsewhere would wait for. The sender is told to try
 * again shortly, which costs her a few minutes; the other way round cost the
 * recipient the only screening she had.
 */
export async function moderateMessage(content: string): Promise<{
  allowed: boolean;
  reason?: string;
  /** Held because nothing could check it, not because of what it says. */
  unavailable?: boolean;
}> {
  const result = await moderateText(content);

  if (result.unavailable) {
    return { allowed: false, reason: MESSAGE_CHECK_UNAVAILABLE, unavailable: true };
  }

  // Messages are more strictly moderated
  if (result.flagged) {
    return {
      allowed: false,
      reason: result.reason || 'Message contains inappropriate content',
    };
  }

  return { allowed: true };
}

/**
 * Every write surface the gate guards.
 *
 * The surfaces are named individually rather than collapsed onto three words
 * because the name is what a reviewer reads in the log line when something was
 * let through, and because the line each surface is held to differs: see
 * CONVERSATIONAL_SURFACES below. A new surface belongs here rather than
 * borrowing a name that reads wrong in a log.
 */
export type ModeratedSurface =
  | 'post'
  | 'comment'
  | 'caption'
  | 'status'
  | 'profile'
  // An organisation's name and description, which employers and community
  // groups publish. These were screened under 'profile', so a flag on a
  // company page read in the log as though a member's own bio had tripped it.
  | 'organization'
  // The title and description of a housing listing, which every eligible member
  // reads, and the comment on a review of a practitioner, which the directory
  // shows beside the rating. Neither went through the gate; a listing is the
  // one surface where the words reach a woman looking for somewhere safe.
  | 'housing_listing'
  | 'health_review'
  | 'message'
  | 'group_message'
  | 'channel_message'
  | 'live_chat';

// Text in a conversation reaches the person it is aimed at before anybody can
// report it, so these surfaces are held to the stricter message standard, which
// refuses anything the provider flags rather than only what it would block
// outright. Direct messages have always been held to that line; group chat,
// channel replies and live chat were simply never put behind the gate at all,
// which made them the surfaces a harasser would choose.
const CONVERSATIONAL_SURFACES: ReadonlySet<ModeratedSurface> = new Set([
  'message',
  'group_message',
  'channel_message',
  'live_chat',
]);

/**
 * Whether a text moderation provider is configured.
 *
 * The readiness check reads this so a deployment with no moderation is reported
 * as a state of the service rather than discovered later in the logs.
 */
export function isTextModerationConfigured(): boolean {
  return openai !== null;
}

/** Whether an image moderation provider is configured; the operations screen reads it. */
export function isImageModerationConfigured(): boolean {
  return rekognition !== null;
}

/**
 * What happens to member content when nothing is configured to screen it.
 *
 * - 'off': it publishes, and every unscreened write is counted.
 * - 'public': posts, comments, captions, statuses, profiles, organisation pages
 *   and images are refused with a 503 until a provider is configured, while
 *   conversations stay open and are counted.
 * - 'all': conversations are refused too.
 */
export type ModerationRequirement = 'off' | 'public' | 'all';

/**
 * The deployment's answer, from MODERATION_REQUIRED.
 *
 * With no provider configured, everything used to publish unscreened in every
 * environment. That was announced at error level, counted on each write and
 * shown on the readiness check, but it was never a choice anyone had made: a
 * production deployment whose key had lapsed published every post a women's
 * safety platform received, unread by anything. It is now a switch, and in
 * production the default is 'public': the posts, profiles and images the whole
 * community sees are refused until they can be checked, which a member is told
 * in so many words, while conversations stay open. Refusing a message would
 * cut off a woman writing to a support line because an operator forgot a key,
 * and a message is aimed at one person who can block and report its sender.
 * A deployment that decides otherwise says so explicitly: MODERATION_REQUIRED
 * set to 'off' (or 'false') publishes unscreened, 'all' refuses conversations
 * too. Outside production the default stays 'off', so a developer without a
 * key can still post to her own machine.
 *
 * A provider that is configured and does not answer is an outage, not this,
 * and is handled where the call fails: see moderateMessage.
 */
export function moderationRequirement(): ModerationRequirement {
  const raw = process.env.MODERATION_REQUIRED?.trim().toLowerCase();
  if (raw === 'all') return 'all';
  if (raw === 'public' || raw === 'true') return 'public';
  if (raw === 'off' || raw === 'false') return 'off';
  if (raw) announceUnreadableRequirement(raw);
  return process.env.NODE_ENV === 'production' ? 'public' : 'off';
}

let unreadableRequirementAnnounced = false;

function announceUnreadableRequirement(raw: string): void {
  if (unreadableRequirementAnnounced) return;
  unreadableRequirementAnnounced = true;
  logger.error("MODERATION_REQUIRED is not one of 'off', 'public' or 'all'; the environment's default applies", {
    value: raw,
  });
}

/** What a member is told when her post cannot be published because nothing can check it. */
export const PUBLISHING_PAUSED =
  'Posting is paused because new content cannot be checked right now. Please try again later.';

/** What a member is told when her image cannot be uploaded because nothing can check it. */
export const IMAGE_CHECK_UNAVAILABLE =
  'Images cannot be checked right now, so they cannot be uploaded. Please try again later.';

// A warning line per message is not a decision and nobody reads it, so the
// absence of a provider is said once, at error level, where alerting will see
// it. isTextModerationConfigured carries it from there.
let missingProviderAnnounced = false;

function announceMissingProvider(kind: ModeratedSurface): void {
  if (missingProviderAnnounced) return;
  missingProviderAnnounced = true;
  const requirement = moderationRequirement();
  logger.error(
    requirement === 'off'
      ? 'No text moderation provider is configured: member text is being published unscreened. Set AI_OPENAI_API_KEY.'
      : requirement === 'public'
        ? 'No text moderation provider is configured: posts, profiles and comments are being refused and conversations are publishing unscreened. Set AI_OPENAI_API_KEY.'
        : 'No text moderation provider is configured: all member text is being refused. Set AI_OPENAI_API_KEY.',
    { kind, requirement }
  );
}

let missingImageProviderAnnounced = false;

function announceMissingImageProvider(): void {
  if (missingImageProviderAnnounced) return;
  missingImageProviderAnnounced = true;
  logger.error(
    moderationRequirement() === 'off'
      ? 'No image moderation provider is configured: member images are being published unscreened. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.'
      : 'No image moderation provider is configured: member images are being refused. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.'
  );
}

/**
 * Gate for user generated text on the write paths.
 *
 * With no provider configured, what happens is the deployment's
 * MODERATION_REQUIRED decision — see moderationRequirement: refused with a 503
 * where it says so, and otherwise published with the gap counted. With a
 * provider configured but not answering, public surfaces still publish and the
 * outage is counted, while conversational surfaces are refused with a 503 until
 * the check can run — see moderateMessage for why a message is held rather
 * than sent. When a provider blocks the content, the caller gets a 400 and the
 * write never happens.
 */
export async function assertContentAllowed(
  content: string,
  context: { kind: ModeratedSurface; userId?: string }
): Promise<void> {
  if (!openai) {
    announceMissingProvider(context.kind);
    const conversational = CONVERSATIONAL_SURFACES.has(context.kind);
    const requirement = moderationRequirement();

    if (requirement === 'all' || (requirement === 'public' && !conversational)) {
      // Counted like the unscreened publishes are, so the dashboard shows how
      // much the missing key is costing members as well as that it is missing.
      recordFailure('moderation.unscreened_refused', new Error(`no provider for ${context.kind}`));
      throw new ApiError(503, conversational ? MESSAGE_CHECK_UNAVAILABLE : PUBLISHING_PAUSED);
    }

    // Counted on every occurrence, not just the first: the log line announces
    // itself once per process, which is right for a log and useless for
    // answering "how much went out unscreened". /health/detailed reads this,
    // so a deployment publishing member text with no screening says so on a
    // dashboard rather than only in a line nobody re-reads.
    recordFailure('moderation.unscreened_publish', new Error(`no provider for ${context.kind}`));
    return;
  }

  try {
    if (CONVERSATIONAL_SURFACES.has(context.kind)) {
      // Anything the provider flags in a conversation is refused outright, so
      // there is no "review" outcome to queue here.
      const message = await moderateMessage(content);
      if (message.unavailable) {
        // Our outage, not her words: a 503 tells the client to offer a retry
        // rather than telling her she broke the guidelines.
        throw new ApiError(503, message.reason || MESSAGE_CHECK_UNAVAILABLE);
      }
      if (!message.allowed) {
        throw new ApiError(400, message.reason || 'This content violates our community guidelines');
      }
      return;
    }

    const verdict = await moderatePost(content);

    if (!verdict.allowed) {
      throw new ApiError(400, verdict.reason || 'This content violates our community guidelines');
    }

    // An unanswered check is an outage, not a judgement about this post. It has
    // already been counted where it happened, in moderateText, and nothing is
    // filed against a member for it.
    if (verdict.needsReview && !verdict.unavailable && verdict.categories.length > 0) {
      await queueForReview(content, context, verdict);
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    recordFailure('moderation.provider_unavailable', error);

    if (CONVERSATIONAL_SURFACES.has(context.kind)) {
      // The same line as an unanswered provider: a message that could not be
      // checked is held, whatever the reason it could not be.
      logger.warn('Text moderation unavailable, holding message', { kind: context.kind, error });
      throw new ApiError(503, MESSAGE_CHECK_UNAVAILABLE);
    }

    logger.warn('Text moderation unavailable, allowing content', { kind: context.kind, error });
  }
}

/**
 * The flag type a borderline post is queued under. The moderation console reads
 * open AdminFlags into its first section and labels this type.
 */
export const CONTENT_REVIEW_FLAG = 'CONTENT_REVIEW';

/** How much of the text a moderator is shown on the flag. */
const REVIEW_EXCERPT_LENGTH = 500;

/**
 * Put content the provider thought borderline in front of a person.
 *
 * This branch used to write a logger.warn and nothing else. The post was
 * published, the provider's judgement that somebody ought to look at it went
 * into a log line, and no queue, flag or report ever carried it anywhere a
 * moderator would see it: content the screening said was borderline was
 * published and forgotten.
 *
 * It is filed as an AdminFlag rather than a ContentReport because a report must
 * name a member as its reporter and there is none, and because the gate runs
 * before the write, so the content has no id yet. The flag names the author,
 * the surface, what was flagged and an excerpt, which is what a moderator needs
 * to find it; the conversational surfaces never reach here, because anything
 * the provider flags on those is refused outright. MEDIUM rather than HIGH: the
 * safety queue pulls HIGH flags — crisis language, a collapsing safety score —
 * above everything else, and a borderline post must not push one of those down.
 *
 * Filing the flag must not cost the member her post, so a failure is counted
 * and logged rather than thrown.
 */
async function queueForReview(
  content: string,
  context: { kind: ModeratedSurface; userId?: string },
  verdict: { reason?: string; categories: string[]; scores: Record<string, number> }
): Promise<void> {
  if (!context.userId) {
    // Every write surface passes the author; one that does not has nothing a
    // moderator could act on, and that is itself worth seeing on the ops screen.
    recordFailure('moderation.review_unattributed', new Error(`no author for ${context.kind}`));
    logger.error('Content flagged for review with no author to file it against', {
      kind: context.kind,
      categories: verdict.categories,
    });
    return;
  }

  const excerpt = content.length > REVIEW_EXCERPT_LENGTH ? `${content.slice(0, REVIEW_EXCERPT_LENGTH)}…` : content;
  const topScores = Object.entries(verdict.scores)
    .filter(([category]) => verdict.categories.includes(category))
    .map(([category, score]) => `${category} ${score.toFixed(2)}`)
    .join(', ');

  try {
    await prisma.adminFlag.create({
      data: {
        userId: context.userId,
        type: CONTENT_REVIEW_FLAG,
        severity: 'MEDIUM',
        // The safety-score service raises its flags under the same name; the
        // console presents it as the platform itself.
        flaggedById: 'system',
        reason: `Published ${context.kind} flagged by automated screening for ${verdict.categories.join(', ')}`,
        notes: `Surface: ${context.kind}\nScores: ${topScores || 'not reported'}\n\n${excerpt}`,
      },
    });
  } catch (error) {
    recordFailure('moderation.review_queue', error);
    logger.error('Borderline content could not be queued for review', {
      kind: context.kind,
      userId: context.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * The cache key a verdict is stored under.
 *
 * This was a 31-bit string hash, under which 'Aa' and 'BB' — and any number of
 * crafted pairs — shared a key. A cached 'allow' for a harmless sentence could
 * therefore be served for a threat engineered to collide with it, and the
 * threat would go out as screened. SHA-256 cannot be steered that way. The v2
 * prefix means no verdict written under the old keys is ever read again; they
 * age out of the cache on their own one-hour expiry.
 */
function contentCacheKey(content: string): string {
  return `moderation:v2:${createHash('sha256').update(content).digest('hex')}`;
}

/**
 * Profanity filter.
 *
 * The list this reads was left empty with a note to fill it in, so
 * containsProfanity could never return true and the SafetyScore endpoint
 * reported a clean score for text that was nothing but abuse. The terms below
 * are the ones thrown at women on this platform; a deployment adds to them
 * through MODERATION_PROFANITY_LIST (comma separated) rather than waiting for a
 * release, which is also where terms this file should not carry belong.
 *
 * This is a signal and not a gate. Several of these words are used warmly
 * between friends and reclaimed in conversation, so a hit moves a SafetyScore
 * and never by itself refuses a write — assertContentAllowed does not consult
 * it. Refusing a member's own words on a word match would fall hardest on the
 * women this platform exists for.
 */
const BASE_PROFANITY_TERMS = [
  'bitch',
  'bitches',
  'cunt',
  'cunts',
  'slut',
  'sluts',
  'whore',
  'whores',
  'skank',
  'tranny',
  'trannies',
  'retard',
  'retarded',
];

const PROFANITY_LIST: Set<string> = new Set([
  ...BASE_PROFANITY_TERMS,
  ...(process.env.MODERATION_PROFANITY_LIST || '')
    .split(',')
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean),
]);

export function containsProfanity(text: string): boolean {
  // Split on anything that is not a letter or a digit, so "bitch!" and
  // "you're a bitch," match the same way the bare word does.
  const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  return words.some((word) => word.length > 0 && PROFANITY_LIST.has(word));
}

/**
 * Spam detection (basic patterns)
 */
export function detectSpam(text: string): { isSpam: boolean; reason?: string } {
  // Check for excessive caps
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.7 && text.length > 20) {
    return { isSpam: true, reason: 'Excessive capitalization' };
  }

  // Check for repeated characters
  if (/(.)\1{5,}/.test(text)) {
    return { isSpam: true, reason: 'Repeated characters' };
  }

  // Check for too many URLs
  const urlCount = (text.match(/https?:\/\//g) || []).length;
  if (urlCount > 3) {
    return { isSpam: true, reason: 'Too many URLs' };
  }

  // Check for common spam phrases
  const spamPhrases = [
    'click here now',
    'act now',
    'limited time offer',
    'congratulations you won',
    'earn money fast',
  ];
  const lowerText = text.toLowerCase();
  for (const phrase of spamPhrases) {
    if (lowerText.includes(phrase)) {
      return { isSpam: true, reason: 'Spam phrase detected' };
    }
  }

  return { isSpam: false };
}

/**
 * Misinformation detection (heuristic signals)
 */
export function detectMisinformation(text: string): { isLikely: boolean; reason?: string } {
  const lowerText = text.toLowerCase();
  const misinfoSignals = [
    'miracle cure',
    'guaranteed income',
    'secret government',
    'instant wealth',
    'no-risk investment',
    'one weird trick',
  ];

  for (const signal of misinfoSignals) {
    if (lowerText.includes(signal)) {
      return { isLikely: true, reason: `Detected misinformation phrase: ${signal}` };
    }
  }

  return { isLikely: false };
}

/**
 * SafetyScore full evaluation
 */
export async function evaluateSafetyScore(content: string): Promise<SafetyScoreResult> {
  const signals: SafetyScoreResult['signals'] = [];

  const moderation = await moderateText(content);
  if (moderation.flagged) {
    signals.push({
      type: 'moderation',
      severity: moderation.action === 'block' ? 'high' : 'medium',
      detail: moderation.reason || 'Moderation flags detected',
    });
  }

  const spam = detectSpam(content);
  if (spam.isSpam) {
    signals.push({
      type: 'spam',
      severity: 'medium',
      detail: spam.reason || 'Spam pattern detected',
    });
  }

  if (containsProfanity(content)) {
    signals.push({
      type: 'profanity',
      severity: 'low',
      detail: 'Profanity detected',
    });
  }

  const misinfo = detectMisinformation(content);
  if (misinfo.isLikely) {
    signals.push({
      type: 'misinformation',
      severity: 'high',
      detail: misinfo.reason || 'Potential misinformation detected',
    });
  }

  let score = 100;
  signals.forEach((signal) => {
    if (signal.severity === 'high') score -= 30;
    if (signal.severity === 'medium') score -= 20;
    if (signal.severity === 'low') score -= 10;
  });

  score = Math.max(0, Math.min(100, score));

  let action: SafetyScoreResult['action'] = 'allow';
  if (moderation.action === 'block' || score < 50) {
    action = 'block';
  } else if (moderation.action === 'review' || score < 80) {
    action = 'review';
  }

  return { score, action, signals };
}

/**
 * What happens to an image when the provider IS configured and cannot answer.
 *
 * - 'allow' (the default): it goes up, and the outage is counted and logged.
 *   This is what the text gate does for the surfaces everyone sees.
 * - 'refuse': the upload is answered with a 503 the member can retry, the same
 *   answer an image gets when no provider is configured at all.
 *
 * It is the operator's decision, from MODERATION_IMAGE_OUTAGE, because it
 * trades a member being unable to upload for a few minutes against a picture
 * going up unseen, and neither is obviously right for every deployment. A
 * value that is not 'refuse' leaves the default.
 */
export type ImageOutagePolicy = 'allow' | 'refuse';

export function imageOutagePolicy(): ImageOutagePolicy {
  return process.env.MODERATION_IMAGE_OUTAGE?.trim().toLowerCase() === 'refuse' ? 'refuse' : 'allow';
}

/**
 * Rekognition takes an image as bytes only up to 5 MiB, and only as JPEG or
 * PNG. Both limits used to be the provider's problem: the upload routes pass
 * the picture as it arrived (an avatar may be 5 MB, a cover 10 MB, a post
 * picture 20 MB, and a WebP or GIF is allowed everywhere), the provider
 * refused anything over the limit or in another format, and the catch below
 * read a refusal as an outage and let the picture through. So a picture only
 * had to be a few megabytes bigger, or saved as WebP, to go up unseen.
 */
const REKOGNITION_MAX_BYTES = 5 * 1024 * 1024;
/** Held below the limit so a file near it is not a coin toss. */
const SCREENING_TARGET_BYTES = 4 * 1024 * 1024;
/** What a picture is looked at as: large enough to see what is in it, small enough to be quick. */
const SCREENING_MAX_SIDE = 1600;

const isJpeg = (bytes: Buffer) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
const isPng = (bytes: Buffer) =>
  bytes.length > 7 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

export type ScreeningCopy = { ok: true; bytes: Buffer } | { ok: false; reason: 'unreadable' | 'too_large' };

/**
 * The bytes the provider is shown: the picture itself when it is already a
 * JPEG or PNG within the limit, and otherwise a JPEG copy, turned upright and
 * scaled down, made only for the look. The copy is never stored. Whatever the
 * caller holds, no caller can send the provider something it will refuse.
 */
export async function imageForScreening(image: Buffer): Promise<ScreeningCopy> {
  if (image.length <= SCREENING_TARGET_BYTES && (isJpeg(image) || isPng(image))) {
    return { ok: true, bytes: image };
  }

  // A picture the provider would refuse is made smaller until it will not.
  // A GIF is looked at by its first frame, which is what sharp reads.
  let decoded: ReturnType<typeof sharp>;
  try {
    decoded = sharp(image).rotate();
    await decoded.metadata();
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  for (const [side, quality] of [
    [SCREENING_MAX_SIDE, 80],
    [1000, 60],
  ] as const) {
    try {
      const bytes = await decoded
        .clone()
        .resize(side, side, { fit: 'inside', withoutEnlargement: true })
        // A PNG or WebP with transparency would otherwise come out black.
        .flatten({ background: '#ffffff' })
        .jpeg({ quality })
        .toBuffer();
      if (bytes.length <= REKOGNITION_MAX_BYTES) return { ok: true, bytes };
    } catch {
      return { ok: false, reason: 'unreadable' };
    }
  }
  return { ok: false, reason: 'too_large' };
}

/**
 * What an image that could not be screened becomes, by MODERATION_IMAGE_OUTAGE:
 * a 503 the member can retry, or a pass that is counted.
 */
function imageCouldNotBeScreened(error: unknown, detail: string): ModerationResult {
  logger.error('Image moderation could not screen an image', {
    detail,
    error: error instanceof Error ? error.message : String(error),
  });
  recordFailure('moderation.image_provider_unavailable', error);
  if (imageOutagePolicy() === 'refuse') {
    throw new ApiError(503, IMAGE_CHECK_UNAVAILABLE);
  }
  return {
    flagged: false,
    categories: [],
    scores: {},
    action: 'allow',
    reason: 'Image moderation unavailable',
    unavailable: true,
  };
}

/**
 * Moderate image content using AWS Rekognition
 *
 * Throws a 503 when no provider is configured and the deployment requires
 * screening (see moderationRequirement): every image a member uploads is
 * public, an avatar as much as a post, so images follow the 'public' line.
 *
 * The provider is shown a JPEG or PNG of at most 5 MiB whatever was passed in
 * (see imageForScreening), so a large or WebP picture is screened rather than
 * waved through. An image that cannot be decoded at all is a 400, as it is
 * where the route would store it. A provider that is configured and does not
 * answer follows MODERATION_IMAGE_OUTAGE (see imageOutagePolicy).
 */
export async function moderateImage(imageBuffer: Buffer): Promise<ModerationResult> {
  // No provider, no screening — said once at error level and counted every
  // time, the same way the text gate reports itself, because "how many images
  // went up unscreened" is a question a warn line cannot answer.
  if (!rekognition) {
    announceMissingImageProvider();
    if (moderationRequirement() !== 'off') {
      recordFailure('moderation.unscreened_image_refused', new Error('no image moderation provider'));
      throw new ApiError(503, IMAGE_CHECK_UNAVAILABLE);
    }
    recordFailure('moderation.unscreened_image', new Error('no image moderation provider'));
    return { flagged: false, categories: [], scores: {}, action: 'allow' };
  }

  const copy = await imageForScreening(imageBuffer);
  if (!copy.ok) {
    if (copy.reason === 'unreadable') {
      logger.warn('Image refused: it could not be read');
      throw new ApiError(400, 'That image could not be read. Try saving it again, or choose another.');
    }
    return imageCouldNotBeScreened(new Error('image too large to screen'), 'too_large');
  }

  try {
    const command = new DetectModerationLabelsCommand({
      Image: { Bytes: copy.bytes },
      MinConfidence: 60,
    });

    const response = await rekognition.send(command);
    const labels = response.ModerationLabels || [];

    if (labels.length === 0) {
      return { flagged: false, categories: [], scores: {}, action: 'allow' };
    }

    const flaggedCategories: string[] = [];
    const scores: Record<string, number> = {};

    for (const label of labels) {
      if (label.Name && label.Confidence) {
        flaggedCategories.push(label.Name.toLowerCase());
        scores[label.Name.toLowerCase()] = label.Confidence / 100;
      }
    }

    // Determine action based on labels
    let action: 'allow' | 'review' | 'block' = 'allow';
    let reason: string | undefined;

    const hasExplicit = flaggedCategories.some(c => c.includes('explicit') || c.includes('nudity') || c.includes('pornography'));
    const hasViolence = flaggedCategories.some(c => c.includes('violence'));
    const hasDrugs = flaggedCategories.some(c => c.includes('drugs') || c.includes('tobacco') || c.includes('alcohol'));

    if (hasExplicit) {
      action = 'block';
      reason = 'Image contains explicit content';
    } else if (hasViolence) {
      action = 'review';
      reason = 'Image contains violent content';
    } else if (hasDrugs) {
        action = 'review';
        reason = 'Image contains regulated substances';
    } else if (flaggedCategories.length > 0) {
      action = 'review';
      reason = `Flagged for: ${flaggedCategories.join(', ')}`;
    }

    return {
      flagged: true,
      categories: flaggedCategories,
      scores,
      action,
      reason,
    };
  } catch (error) {
    // By default the image goes up, as a post does when the text provider is
    // down, but the outage is counted. It was a log line and nothing else, so a
    // Rekognition outage that let every image through unscreened looked, on
    // every dashboard, exactly like a quiet day. MODERATION_IMAGE_OUTAGE=refuse
    // makes it a 503 instead (imageOutagePolicy).
    return imageCouldNotBeScreened(error, 'provider_error');
  }
}
