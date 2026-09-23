/**
 * Safety for the AI chat.
 *
 * Every other text surface on this platform — posts, comments, reposts, group
 * posts, direct messages, live chat — passes through assertContentAllowed
 * before anything is written. The AI chat passed through nothing: not the
 * member's message, not the model's reply. There was no crisis routing and no
 * disclaimer. So a member who typed that she wanted to die into the box the
 * homepage advertises as "Ask ATHENA AI" received an ordinary career answer
 * from a general-purpose model, while the crisis lines this platform already
 * holds sat in the wellness library two directories away, reachable from the
 * forums and from nowhere else.
 *
 * What this file is: a conservative keyword and phrase check over the member's
 * own words, plus the same moderation provider the rest of the server uses. It
 * is deliberately NOT a clinical risk classifier, it must never be described as
 * one, and no number it produces may be shown to anyone as an assessment. It is
 * tuned to err towards showing the crisis response, because a false positive
 * costs one unnecessary message with a phone number in it and a false negative
 * costs very much more.
 *
 * The crisis reply is written so that a false positive is recoverable: it says
 * plainly that the member can ask her original question again, so a woman
 * asking about a job at a family-violence service is delayed by one message
 * rather than stonewalled.
 */

import { prisma } from '../utils/prisma';
import { bestEffort } from '../utils/best-effort';
import { recordFailure } from '../utils/ops-metrics';
import { logger } from '../utils/logger';
import { isTextModerationConfigured, moderateText } from './moderation.service';
import { detectCrisisLanguage } from './wellness/forum.service';
import { CRISIS_LINES, type CrisisLine } from './wellness/wellness-library';

/**
 * Which lines the chat shows, by key into the wellness library, so that the
 * numbers themselves live in exactly one file on this server rather than being
 * retyped here. Emergency leads both lists: when someone is in danger this
 * minute, 000 is the answer and everything else is a second step.
 *
 * BEFORE LAUNCH: 000, Lifeline (13 11 14) and 1800RESPECT (1800 737 732) are
 * the nationally published Australian numbers as recorded in
 * services/wellness/wellness-library.ts, which carries its own LIBRARY_AS_AT
 * date. Every one of them must be checked against the publisher's own current
 * page before launch, and re-checked whenever that date moves. Nothing in this
 * file may ever carry a number that was not copied from a publisher.
 */
const SELF_HARM_LINE_KEYS = ['lifeline', 'emergency', '1800respect'] as const;
const IMMEDIATE_DANGER_LINE_KEYS = ['emergency', '1800respect', 'lifeline'] as const;

function linesFor(keys: readonly string[]): CrisisLine[] {
  const chosen = keys
    .map((key) => CRISIS_LINES.find((line) => line.key === key))
    .filter((line): line is CrisisLine => Boolean(line));

  if (chosen.length !== keys.length) {
    // A line disappearing from the library would otherwise shorten this list in
    // silence, which is the one failure here nobody would notice: the member in
    // crisis still gets a reply, just with a number missing from it.
    const missing = keys.filter((key) => !CRISIS_LINES.some((line) => line.key === key));
    recordFailure(
      'ai.chat.crisis_lines_missing',
      new Error(`Crisis lines missing from the wellness library: ${missing.join(', ')}`)
    );
  }

  return chosen;
}

export type ChatCrisisKind = 'self_harm' | 'immediate_danger';

export interface ChatCrisisCheck {
  flagged: boolean;
  kind: ChatCrisisKind | null;
  /** Which screen saw it: the phrase list in this file, or the moderation provider. */
  source: 'phrase' | 'provider' | null;
  /** The phrases that matched, lowercased — what a staff member needs to see why. */
  matches: string[];
}

/** A check that flagged, so the crisis path can be written without a non-null assertion. */
export type FlaggedChatCrisis = ChatCrisisCheck & { flagged: true; kind: ChatCrisisKind };

/**
 * Language about being hurt by someone else, right now.
 *
 * The self-harm and suicide patterns are not repeated here: detectCrisisLanguage
 * in the wellness forum service already holds them, it is already tested, and
 * two divergent copies of that list is how one of them ends up a year behind.
 *
 * Every pattern below is anchored on the member herself — "me", "us", "my
 * kids", "I am" — rather than on the topic. "Domestic violence" as a subject is
 * something a member may raise for a dozen ordinary reasons: a job at a refuge,
 * a policy at work, a course she is taking. "He is hitting me" is not.
 */
const IMMEDIATE_DANGER_PATTERNS: RegExp[] = [
  /\b(?:going|about)\s+to\s+(?:kill|bash|hurt)\s+(?:me|us)\b/i,
  /\bthreaten(?:ed|s|ing)?\s+to\s+(?:kill|bash|hurt|hit)\s+(?:me|us|my)\b/i,
  /\b(?:hit|hits|hitting|beat|beats|beating|bash(?:ed|es|ing)?|strangl(?:e|ed|es|ing)|chok(?:e|ed|es|ing)|punch(?:ed|es|ing)?|rap(?:e|ed|es|ing))\s+(?:me|us|my\s+(?:baby|child|children|kid|kids|son|daughter))\b/i,
  /\b(?:he|she|they|my\s+(?:husband|wife|partner|ex|boyfriend|girlfriend|father|mother|son|brother))\s+(?:is|was|are|were|has\s+been|have\s+been|keeps?)\s+(?:hurting|hitting|beating|abusing|stalking|threatening|following)\s+(?:me|us)\b/i,
  /\b(?:i'?m|i\s+am|we'?re|we\s+are)\s+(?:not\s+safe|in\s+danger|being\s+(?:abused|stalked|followed|hurt|beaten))\b/i,
  /\b(?:scared|afraid|terrified|frightened)\s+for\s+(?:my|our)\s+(?:life|lives|safety)\b/i,
  /\b(?:i'?m|i\s+am)\s+(?:scared|afraid|terrified)\s+(?:that\s+)?(?:he|she|they)\s+(?:will|is\s+going\s+to|might)\s+(?:kill|hurt|find)\s+(?:me|us)\b/i,
  /\b(?:i|we)\s+need\s+(?:to\s+)?(?:get\s+out|escape|a\s+refuge|somewhere\s+safe)\b/i,
];

/**
 * The local screen. It runs before anything that costs money or a round trip,
 * and before the free-tier quota, so that a member who has used up her twenty
 * messages and then writes that she cannot go on is still answered.
 */
export function detectChatCrisis(text: string): ChatCrisisCheck {
  const danger: string[] = [];
  for (const pattern of IMMEDIATE_DANGER_PATTERNS) {
    const found = text.match(pattern);
    if (found) danger.push(found[0].toLowerCase().replace(/\s+/g, ' '));
  }

  const selfHarm = detectCrisisLanguage(text);

  if (selfHarm.flagged) {
    // When both read as true she is told about both — the self-harm reply
    // carries 1800RESPECT as well — so the kind only decides which line leads.
    return {
      flagged: true,
      kind: 'self_harm',
      source: 'phrase',
      matches: Array.from(new Set([...selfHarm.matches, ...danger])),
    };
  }

  if (danger.length > 0) {
    return { flagged: true, kind: 'immediate_danger', source: 'phrase', matches: Array.from(new Set(danger)) };
  }

  return { flagged: false, kind: null, source: null, matches: [] };
}

function formatLine(line: CrisisLine): string {
  return `• ${line.name} — ${line.phone} (${line.when}). ${line.who}.`;
}

/**
 * What the assistant says instead of an ordinary answer.
 *
 * It does three things in order, and the order is the point: name that a person
 * is needed and that this is not one, give the numbers, and leave the door open
 * in case the screen misread her. No advice, no questions back, nothing that
 * reads as a counselling session with a machine.
 */
export function crisisReply(kind: ChatCrisisKind): { text: string; lines: CrisisLine[] } {
  const lines = linesFor(kind === 'self_harm' ? SELF_HARM_LINE_KEYS : IMMEDIATE_DANGER_LINE_KEYS);
  const listed = lines.map(formatLine).join('\n');

  const text =
    kind === 'self_harm'
      ? `Thank you for telling me this. I want to be straight with you: I am an AI assistant, not a counsellor, and I am not the right help for what you have just described. These people are, and they are there right now.

${listed}

If you are in immediate danger, call 000.

I will still be here afterwards, for anything about work, study or money. And if I have misread your message, say it to me again in different words and I will answer the question you actually asked.`
      : `It sounds like you may not be safe right now. I am an AI assistant, so I cannot get help to you or call anyone for you — please use one of these instead.

${listed}

If you are in immediate danger, call 000. If it is not safe to speak, you can call 000 and stay on the line, or use 1800RESPECT's online chat.

If I have misread your message, tell me again in different words and I will answer properly.`;

  return { text, lines };
}

/**
 * The disclaimer, returned with every chat reply and with the usage summary so
 * the web app can keep it on screen rather than showing it once and forgetting.
 * A disclaimer a member has to scroll to find is not a disclaimer.
 */
export const AI_CHAT_DISCLAIMER =
  'ATHENA AI is an automated assistant, not a counsellor, doctor, lawyer or financial adviser, and nothing it says is professional advice. It can be wrong. In an emergency call 000. Lifeline 13 11 14. 1800RESPECT 1800 737 732.';

/**
 * Raises the same staff flag a wellness forum post raises when it carries
 * crisis language: a HIGH severity SAFETY_CONCERN AdminFlag on the member's
 * account.
 *
 * flaggedById is 'system' rather than the member's own id — the wellness route
 * records the author there, safety-score.service records 'system' — because
 * nobody reported this: a pattern matched. `notes` carries the phrases that
 * matched and not the message. The chat is not stored anywhere on this server,
 * and copying a woman's words about wanting to die into an admin table to give
 * staff context is not a trade this platform should make without her knowing.
 *
 * bestEffort, because the reply with the phone numbers in it must reach her
 * whatever the database does, and a flag that failed must still be findable in
 * the log rather than vanishing into a bare catch.
 */
export async function raiseChatCrisisFlag(userId: string, check: FlaggedChatCrisis): Promise<void> {
  const seenBy = check.source === 'provider' ? 'the moderation provider' : 'the phrase screen';

  await bestEffort(
    'ai chat crisis flag',
    prisma.adminFlag.create({
      data: {
        userId,
        type: 'SAFETY_CONCERN',
        severity: 'HIGH',
        flaggedById: 'system',
        reason:
          check.kind === 'immediate_danger'
            ? 'Language about being in immediate danger in the AI chat; the crisis lines were shown instead of a model reply'
            : 'Language about suicide or self-harm in the AI chat; the crisis lines were shown instead of a model reply',
        notes:
          check.matches.length > 0
            ? `Seen by ${seenBy}. Matched: ${check.matches.join(', ')}`
            : `Seen by ${seenBy}`,
      },
    })
  );
}

export type ChatScreening =
  | { decision: 'crisis'; check: FlaggedChatCrisis }
  | { decision: 'block'; reason: string }
  | { decision: 'allow' };

const SELF_HARM_CATEGORIES = ['self-harm', 'self-harm/intent', 'self-harm/instructions'];

/**
 * The provider screen over the member's message, run after detectChatCrisis has
 * had its say.
 *
 * This does not call assertContentAllowed, and the reason matters. That helper
 * turns a flagged message into a 400, which is correct for a post and wrong
 * here: the provider's strongest signal on this surface is self-harm, and
 * answering a woman who has just disclosed self-harm with "this content
 * violates our community guidelines" would be the cruellest possible response
 * to the most important message she could send. So a self-harm flag routes to
 * the crisis reply, the same as a keyword match, and only the categories that
 * are about harming other people — threats, hate, sexual content involving
 * minors — refuse the message.
 *
 * With no provider configured the message is allowed through unscreened, as
 * every other surface allows it, and the same ops metric is recorded so a
 * deployment publishing unscreened text says so on the dashboard instead of
 * only in a log line nobody re-reads.
 */
export async function screenMemberMessage(message: string): Promise<ChatScreening> {
  if (!isTextModerationConfigured()) {
    recordFailure('moderation.unscreened_publish', new Error('no provider for ai_chat'));
    return { decision: 'allow' };
  }

  const verdict = await moderateText(message);

  if (verdict.categories.some((category) => SELF_HARM_CATEGORIES.includes(category))) {
    return {
      decision: 'crisis',
      check: { flagged: true, kind: 'self_harm', source: 'provider', matches: verdict.categories },
    };
  }

  if (verdict.action === 'block') {
    return { decision: 'block', reason: verdict.reason || 'This message violates our community guidelines' };
  }

  if (verdict.action === 'review') {
    logger.warn('AI chat message answered pending review', { reason: verdict.reason });
  }

  return { decision: 'allow' };
}

/**
 * What the member sees when the model produced something the provider refuses.
 * It says the answer was withheld rather than pretending the model said
 * nothing, because a blank reply reads as a broken feature and invites her to
 * ask again in the same words.
 */
export const WITHHELD_REPLY =
  'I had an answer for that, but it did not pass ATHENA’s safety check, so I am not going to send it. Please try asking in a different way, and if this keeps happening, tell us through the help centre.';

/**
 * The model's own words, screened the way member text is screened.
 *
 * gpt-3.5-turbo is a general-purpose model with a one-line system prompt; what
 * it says on this platform is published to a member in her own dashboard and
 * nothing was checking it at all.
 *
 * A reply carrying self-harm content routes to the crisis response rather than
 * to the withheld notice. One category alone is only 'review' under the shared
 * thresholds — enough for a post that a moderator will read later, not enough
 * for a machine talking to one woman with nobody else in the room — and on this
 * surface a withheld notice would be the last thing she needed. She gets the
 * numbers instead, which is never the wrong answer to give.
 */
export async function screenAssistantReply(reply: string): Promise<ChatScreening> {
  if (!reply.trim()) return { decision: 'allow' };

  if (!isTextModerationConfigured()) {
    recordFailure('moderation.unscreened_publish', new Error('no provider for ai_chat reply'));
    return { decision: 'allow' };
  }

  const verdict = await moderateText(reply);

  if (verdict.categories.some((category) => SELF_HARM_CATEGORIES.includes(category))) {
    recordFailure('ai.chat.reply_self_harm', new Error(verdict.reason || 'assistant reply carried self-harm content'));
    return {
      decision: 'crisis',
      check: { flagged: true, kind: 'self_harm', source: 'provider', matches: verdict.categories },
    };
  }

  if (verdict.action === 'block') {
    // Counted, not only logged: a model that starts producing blocked text is
    // an incident, and the first sign of it should be a number on a dashboard.
    recordFailure('ai.chat.reply_blocked', new Error(verdict.reason || 'assistant reply blocked'));
    return { decision: 'block', reason: verdict.reason || 'The assistant reply was withheld' };
  }

  return { decision: 'allow' };
}
