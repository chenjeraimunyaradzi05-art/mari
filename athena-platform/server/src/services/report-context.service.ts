/**
 * What a report keeps of the thing it is about.
 *
 * A report on a message used to carry a message id and nothing else. A moderator
 * opening it saw a bare identifier, and everything a person can do to a message
 * makes it worse: the sender can unsend it (which blanks the text), a thread set
 * to disappear sweeps it, a live-chat line can be deleted by the host, and an
 * upheld report's own "remove" deleted the row. The report was the one record of
 * an abusive message, and it held none of the words.
 *
 * So the words are copied into the report at the moment it is filed, together
 * with the few lines before it, because a threat or a come-on is rarely
 * understood from one line alone. The copy lives in ContentReport.evidence, which
 * is a JSON column, so nothing here needs a migration.
 *
 * Each capture also decides who may report. A message is reportable only by
 * somebody who is in the conversation — a participant of a direct thread, an
 * active member of the group — and a stranger asking about a message id gets the
 * same "not found" a missing id gets, so ids cannot be probed for existence.
 */

import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { isBlockedRelationship } from '../utils/safety-store';
import { isChatKey } from '../utils/chat-attachments';
import { unexpiredMessageWhere } from './message-expiry.service';

/** How many messages before the reported one are kept for context. */
export const REPORT_CONTEXT_MESSAGES = 10;

/**
 * One answer for every way a message can be out of reach: absent, unsent,
 * expired, or in a conversation the reporter is not part of. Different answers
 * would tell a stranger which message ids exist.
 */
const MESSAGE_NOT_FOUND =
  'We could not find that message. If it was unsent or has disappeared, you can still report the person.';

export interface SnapshotAttachment {
  name?: string;
  type?: string;
  /** A link, on a message from before chat files were private. */
  url?: string;
  /**
   * Where a file sent since lives (utils/chat-attachments). The file behind a
   * reported message is kept when the message goes, for the people deciding the
   * report, and this is how they ask for it: POST /api/media/download-url opens
   * a key a report's copy names to staff with a second factor
   * (services/chat-attachment).
   */
  key?: string;
}

export interface SnapshotMessage {
  id: string;
  senderId: string;
  senderName: string | null;
  content: string;
  type: string | null;
  attachments: SnapshotAttachment[];
  createdAt: string;
  edited: boolean;
}

export interface MessageReportContext {
  version: 1;
  capturedAt: string;
  /** Direct thread or group chat. */
  surface: 'direct' | 'group';
  conversationId: string;
  groupId: string | null;
  groupName: string | null;
  reported: SnapshotMessage;
  /** Oldest first, so it reads in the order it was said. */
  before: SnapshotMessage[];
}

const SENDER_SELECT = { id: true, displayName: true, firstName: true, lastName: true } as const;

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  senderId: true,
  content: true,
  type: true,
  metadata: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
  expiresAt: true,
  sender: { select: SENDER_SELECT },
} as const;

type SenderRow = { id: string; displayName: string | null; firstName: string | null; lastName: string | null } | null;

function nameOf(sender: SenderRow): string | null {
  if (!sender) return null;
  const display = sender.displayName?.trim();
  if (display) return display;
  const full = [sender.firstName, sender.lastName].filter(Boolean).join(' ').trim();
  return full || null;
}

/**
 * The attachments a message carried: names, links, and the key of a file in
 * the chat folder, which is the only way the file behind the reported message
 * can be opened once the message itself is gone.
 */
function attachmentsOf(metadata: unknown): SnapshotAttachment[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  const raw = (metadata as { attachments?: unknown }).attachments;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      ...(typeof item.name === 'string' ? { name: item.name } : {}),
      ...(typeof item.type === 'string' ? { type: item.type } : {}),
      ...(typeof item.url === 'string' ? { url: item.url } : {}),
      ...(isChatKey(item.key) ? { key: item.key } : {}),
    }));
}

interface MessageRow {
  id: string;
  senderId: string;
  content: string;
  type: string | null;
  metadata: unknown;
  createdAt: Date;
  editedAt: Date | null;
  sender: SenderRow;
}

function snapshotOf(row: MessageRow): SnapshotMessage {
  return {
    id: row.id,
    senderId: row.senderId,
    senderName: nameOf(row.sender),
    content: row.content,
    type: row.type,
    attachments: attachmentsOf(row.metadata),
    createdAt: row.createdAt.toISOString(),
    edited: Boolean(row.editedAt),
  };
}

/**
 * Whether the reporter is in this conversation, and of what kind. A direct
 * thread is a Conversation with participants; a group chat is a Conversation
 * whose id is the group's id and which has none (see group-chat.routes), so
 * membership there is the GroupMember row, and a banned row is not a member.
 */
async function standingIn(conversationId: string, userId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
  if (participant) return { surface: 'direct' as const, groupId: null, groupName: null };

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: conversationId, userId } },
    select: { isBanned: true, group: { select: { id: true, name: true } } },
  });
  if (member && !member.isBanned) {
    return { surface: 'group' as const, groupId: member.group.id, groupName: member.group.name };
  }
  return null;
}

/**
 * Check the reporter may report this message, and copy it with its context.
 * Throws the report's refusal (404 for anything out of reach, 400 for her own
 * message or a notice the platform wrote); returns whom the report is against.
 */
export async function captureMessageReport(
  reporterId: string,
  messageId: string,
  now: Date = new Date()
): Promise<{ reportedUserId: string; context: MessageReportContext }> {
  const message = await prisma.message.findUnique({ where: { id: messageId }, select: MESSAGE_SELECT });

  const gone =
    !message ||
    !message.conversationId ||
    Boolean(message.deletedAt) ||
    Boolean(message.expiresAt && message.expiresAt.getTime() <= now.getTime());
  if (gone) throw new ApiError(404, MESSAGE_NOT_FOUND);

  const standing = await standingIn(message.conversationId!, reporterId);
  if (!standing) throw new ApiError(404, MESSAGE_NOT_FOUND);

  if (message.senderId === reporterId) {
    throw new ApiError(400, 'That message is yours. If you wrote something you regret, you can unsend it.');
  }
  if (message.type === 'SYSTEM') {
    throw new ApiError(400, 'That is a notice from ATHENA, not a message from a member.');
  }

  return {
    reportedUserId: message.senderId,
    context: await contextFor(message, standing, now),
  };
}

/** The copy itself: the message, and the few lines before it. */
async function contextFor(
  message: MessageRow & { conversationId: string | null },
  standing: { surface: 'direct' | 'group'; groupId: string | null; groupName: string | null },
  now: Date
): Promise<MessageReportContext> {
  const earlier = await prisma.message.findMany({
    where: {
      AND: [
        { conversationId: message.conversationId!, deletedAt: null, createdAt: { lt: message.createdAt } },
        unexpiredMessageWhere(now),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: REPORT_CONTEXT_MESSAGES,
    select: MESSAGE_SELECT,
  });

  return {
    version: 1,
    capturedAt: now.toISOString(),
    surface: standing.surface,
    conversationId: message.conversationId!,
    groupId: standing.groupId,
    groupName: standing.groupName,
    reported: snapshotOf(message),
    before: earlier.reverse().map(snapshotOf),
  };
}

/**
 * The same copy, for a report filed before reports kept one, taken at the
 * moment a moderator upholds it and before the message is deleted. Null when
 * there is nothing left to copy.
 */
export async function captureMessageForEvidence(
  messageId: string,
  now: Date = new Date()
): Promise<MessageReportContext | null> {
  const message = await prisma.message.findUnique({ where: { id: messageId }, select: MESSAGE_SELECT });
  if (!message || !message.conversationId || message.deletedAt) return null;

  const group = await prisma.group.findUnique({
    where: { id: message.conversationId },
    select: { id: true, name: true },
  });
  return contextFor(
    message,
    group
      ? { surface: 'group', groupId: group.id, groupName: group.name }
      : { surface: 'direct', groupId: null, groupName: null },
    now
  );
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export interface GroupReportContext {
  version: 1;
  capturedAt: string;
  groupId: string;
  name: string;
  description: string;
  privacy: string;
  createdById: string;
}

/**
 * A whole group, reported as its own thing rather than through one post. The
 * person it is against is whoever created it, because that is who a moderator
 * can act on; the copy of its name and description is what she was looking at.
 */
export async function captureGroupReport(
  reporterId: string,
  groupId: string,
  now: Date = new Date()
): Promise<{ reportedUserId: string; context: GroupReportContext }> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, description: true, privacy: true, createdById: true },
  });
  if (!group) throw new ApiError(404, 'We could not find that group.');
  if (group.createdById === reporterId) {
    throw new ApiError(400, 'That is a group you created. You can change or close it from its settings.');
  }
  return {
    reportedUserId: group.createdById,
    context: {
      version: 1,
      capturedAt: now.toISOString(),
      groupId: group.id,
      name: group.name,
      description: group.description,
      privacy: group.privacy,
      createdById: group.createdById,
    },
  };
}

// ---------------------------------------------------------------------------
// Live streams
// ---------------------------------------------------------------------------

const STREAM_NOT_FOUND = 'We could not find that stream.';

export interface LiveReportContext {
  version: 1;
  capturedAt: string;
  streamId: string;
  streamTitle: string;
  hostId: string;
  hostName: string | null;
  /** Present when the report is about one line of the chat. */
  reported?: { id: string; userId: string; userName: string | null; content: string; createdAt: string };
  /** The lines before it, oldest first. */
  before?: Array<{ id: string; userId: string; userName: string | null; content: string; createdAt: string }>;
  /** Present when the report is about the stream itself. */
  stream?: { description: string | null; category: string | null; status: string; startedAt: string | null };
}

type ChatRow = {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
  user: { id: string; displayName: string | null } | null;
};

const chatLine = (row: ChatRow) => ({
  id: row.id,
  userId: row.userId,
  userName: row.user?.displayName?.trim() || null,
  content: row.content,
  createdAt: row.createdAt.toISOString(),
});

/**
 * A line of live chat. Host-deleted lines are gone from the table, so the words
 * have to be taken now: the host's own tool for dealing with an abuser is to
 * delete what he said, and that must not be the thing that erases the evidence.
 *
 * Any signed-in member who can see the room may report; across a block she could
 * not have seen it, so that is the same "not found".
 */
export async function captureLiveMessageReport(
  reporterId: string,
  messageId: string,
  now: Date = new Date()
): Promise<{ reportedUserId: string; context: LiveReportContext }> {
  const line = await prisma.liveStreamMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      streamId: true,
      userId: true,
      content: true,
      createdAt: true,
      user: { select: { id: true, displayName: true } },
      stream: { select: { id: true, title: true, hostId: true, host: { select: { displayName: true } } } },
    },
  });
  if (!line) throw new ApiError(404, MESSAGE_NOT_FOUND);

  if (
    (await isBlockedRelationship(reporterId, line.stream.hostId)) ||
    (await isBlockedRelationship(reporterId, line.userId))
  ) {
    throw new ApiError(404, MESSAGE_NOT_FOUND);
  }
  if (line.userId === reporterId) {
    throw new ApiError(400, 'That message is yours. The host can take a message out of the chat, but you cannot report your own.');
  }

  const earlier = await prisma.liveStreamMessage.findMany({
    where: { streamId: line.streamId, createdAt: { lt: line.createdAt } },
    orderBy: { createdAt: 'desc' },
    take: REPORT_CONTEXT_MESSAGES,
    select: { id: true, userId: true, content: true, createdAt: true, user: { select: { id: true, displayName: true } } },
  });

  return {
    reportedUserId: line.userId,
    context: {
      version: 1,
      capturedAt: now.toISOString(),
      streamId: line.streamId,
      streamTitle: line.stream.title,
      hostId: line.stream.hostId,
      hostName: line.stream.host.displayName?.trim() || null,
      reported: chatLine(line),
      before: earlier.reverse().map(chatLine),
    },
  };
}

/**
 * The stream itself. The playback URL is deliberately not copied: depending on
 * how the ingest server is set up it can carry the key that authorises pushing
 * video into the stream, and a moderator watches on the stream's own page.
 */
export async function captureLiveStreamReport(
  reporterId: string,
  streamId: string,
  now: Date = new Date()
): Promise<{ reportedUserId: string; context: LiveReportContext }> {
  const stream = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      startedAt: true,
      hostId: true,
      host: { select: { displayName: true } },
    },
  });
  if (!stream) throw new ApiError(404, STREAM_NOT_FOUND);
  if (await isBlockedRelationship(reporterId, stream.hostId)) throw new ApiError(404, STREAM_NOT_FOUND);
  if (stream.hostId === reporterId) throw new ApiError(400, 'That is your own stream. You can end it from your live console.');

  return {
    reportedUserId: stream.hostId,
    context: {
      version: 1,
      capturedAt: now.toISOString(),
      streamId: stream.id,
      streamTitle: stream.title,
      hostId: stream.hostId,
      hostName: stream.host.displayName?.trim() || null,
      stream: {
        description: stream.description,
        category: stream.category,
        status: stream.status,
        startedAt: stream.startedAt ? stream.startedAt.toISOString() : null,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Reading it back
// ---------------------------------------------------------------------------

/**
 * The copies a report holds, and nothing else of its evidence.
 *
 * `evidence` also carries the reporter's ticket and, on reports filed by other
 * doors, the reporter's contact details. A moderator opening a report needs the
 * words and the context; she does not need, and the route must not send, the
 * rest. Whitelisted by key so a field added to the evidence later is private
 * until somebody decides it should not be.
 */
export function reportContextFrom(evidence: unknown): {
  messageContext?: unknown;
  liveContext?: unknown;
  groupContext?: unknown;
} | null {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return null;
  const source = evidence as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const key of ['messageContext', 'liveContext', 'groupContext'] as const) {
    if (source[key] && typeof source[key] === 'object') picked[key] = source[key];
  }
  return Object.keys(picked).length > 0 ? picked : null;
}
