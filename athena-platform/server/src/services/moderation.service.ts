/**
 * Content Moderation Service
 * Uses OpenAI Moderation API for UGC safety
 */

import OpenAI from 'openai';
import { RekognitionClient, DetectModerationLabelsCommand } from "@aws-sdk/client-rekognition";
import { logger } from '../utils/logger';
import { cacheGet, cacheSet } from '../utils/cache';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Rekognition client
const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});

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
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OpenAI API key not configured, skipping moderation');
    return { flagged: false, categories: [], scores: {}, action: 'allow' };
  }

  try {
    // Check cache first (hash of content)
    const cacheKey = `moderation:${hashContent(content)}`;
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
    logger.error('Moderation API error', { error });
    // On error, allow but flag for manual review
    return {
      flagged: false,
      categories: [],
      scores: {},
      action: 'review',
      reason: 'Moderation API unavailable',
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
}> {
  const result = await moderateText(content);

  return {
    allowed: result.action !== 'block',
    shouldHide: shouldAutoHide(result),
    needsReview: needsManualReview(result),
    reason: result.reason,
  };
}

/**
 * Moderate message content
 */
export async function moderateMessage(content: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const result = await moderateText(content);

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
 * Simple hash function for caching
 */
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Profanity filter (basic word list)
 */
const PROFANITY_LIST: Set<string> = new Set([
  // Add profanity words here - keeping empty for code sample
]);

export function containsProfanity(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/);
  return words.some(word => PROFANITY_LIST.has(word));
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
 * Moderate image content using AWS Rekognition
 */
export async function moderateImage(imageBuffer: Buffer): Promise<ModerationResult> {
  // If no credentials, skip (for dev)
  if (!process.env.AWS_ACCESS_KEY_ID) {
    logger.warn('AWS credentials not configured, skipping image moderation');
    return { flagged: false, categories: [], scores: {}, action: 'allow' };
  }

  try {
    const command = new DetectModerationLabelsCommand({
      Image: { Bytes: imageBuffer },
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
    logger.error('AWS Rekognition moderation failed', { error });
    // Fail safe: allow if service is down, but log error
    return { flagged: false, categories: [], scores: {}, action: 'allow' };
  }
}
