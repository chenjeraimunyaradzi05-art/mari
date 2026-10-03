/**
 * Files sent in a conversation.
 *
 * A picture, a voice note or a clip sent in a direct message or a group chat
 * used to be uploaded as a post picture or a reel: into a public folder, to a
 * link anyone who had ever seen it could open, for as long as the bucket kept
 * it. The link did not stop working when the message expired, was unsent, or the
 * member who sent it was erased. For a woman who has left somebody, a photograph
 * sent to a friend is one of the more sensitive things she keeps here.
 *
 * They now live under their own private folder, and the folder is the audience:
 *
 *     chat/<conversation or group id>/<sender id>_<random id><extension>
 *
 * A reader is allowed when she is in that conversation, which the key itself
 * says, so no table has to remember who may read which file and none needs a
 * migration. The sender is in the name so a member can only attach what she
 * uploaded, and so a file a blocked member sent can be refused to the member
 * who blocked her. A group chat is a conversation whose id is the group's id
 * (routes/group-chat.routes), so one shape covers both.
 *
 * Nothing in this file reads a database. The checks that need one are in
 * services/chat-attachment.service.
 */

import { randomUUID } from 'crypto';
import { ApiError } from '../middleware/errorHandler';
import type { SanitizedAttachment } from './contentSafety';

export const CHAT_FOLDER = 'chat';

/**
 * The longest a signed link to a chat file lives, in seconds. Long enough for a
 * page to load a picture or a voice note and for her to press play; short enough
 * that a link copied out of the page stops working before it can be passed
 * round. The web client asks again for each file it shows.
 */
export const CHAT_LINK_SECONDS = 300;

/** The id of a conversation, a group or a member: what every key segment is made of. */
const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * `chat/<scope>/<sender>_<random id>.<ext>`. The sender is everything before the
 * random id, which is a UUID and so cannot be mistaken for part of a sender id.
 */
const CHAT_KEY = /^chat\/([A-Za-z0-9_-]{1,64})\/([A-Za-z0-9_-]{1,64})_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\.[A-Za-z0-9]{1,8})$/;

/** Whether a value is usable as the id of a conversation, group or member in a key. */
export function isChatSegment(value: unknown): value is string {
  return typeof value === 'string' && SEGMENT.test(value);
}

/** The key a file sent by `senderId` in `scopeId` is stored under. */
export function chatObjectKey(scopeId: string, senderId: string, extension: string): string {
  if (!isChatSegment(scopeId) || !isChatSegment(senderId)) {
    throw new Error('A chat file key is made of plain ids');
  }
  return `${CHAT_FOLDER}/${scopeId}/${senderId}_${randomUUID()}${extension}`;
}

export interface ParsedChatKey {
  /** The conversation, or the group. */
  scopeId: string;
  /** Who uploaded it. */
  senderId: string;
}

/** What a chat key says, or null when the key is not one this server could have written. */
export function parseChatKey(key: unknown): ParsedChatKey | null {
  if (typeof key !== 'string') return null;
  const match = CHAT_KEY.exec(key);
  return match ? { scopeId: match[1], senderId: match[2] } : null;
}

export function isChatKey(key: unknown): key is string {
  return parseChatKey(key) !== null;
}

/** What is stored on a message for each file: where it is, never a link to it. */
export type StoredChatAttachment = {
  key: string;
  name?: string;
  contentType?: string;
  size?: number;
};

const NOT_UPLOADED_HERE = 'That file was not sent from this conversation. Attach it again from here and send.';

/**
 * Holds what a member attached to the files she uploaded to this conversation.
 *
 * Anything else is refused: a link to somewhere else (which would put a picture
 * from outside, or a member's public avatar, into somebody's thread as though it
 * were hers), a key under another conversation (which would show one thread's
 * file in another), and a key another member uploaded. What comes out carries the
 * key and what the member said about the file, and no link at all, so nothing
 * stored on the message can be opened without asking the API.
 */
export function requireChatAttachments(
  attachments: ReadonlyArray<SanitizedAttachment>,
  scopeId: string,
  senderId: string
): StoredChatAttachment[] {
  return attachments.map((attachment) => {
    const parsed = parseChatKey(attachment.key);
    if (!attachment.key || !parsed || parsed.scopeId !== scopeId || parsed.senderId !== senderId) {
      throw new ApiError(400, NOT_UPLOADED_HERE);
    }
    return {
      key: attachment.key,
      ...(attachment.name ? { name: attachment.name } : {}),
      ...(attachment.contentType ? { contentType: attachment.contentType } : {}),
      ...(attachment.size !== undefined ? { size: attachment.size } : {}),
    };
  });
}

/**
 * The keys of the files a stored message carries, in the order they were sent.
 * Only keys of this folder: a message from before chat files were private
 * carries a link, which is somebody's public post or reel and not this
 * module's to remove.
 */
export function chatAttachmentKeys(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  const raw = (metadata as { attachments?: unknown }).attachments;
  if (!Array.isArray(raw)) return [];
  const keys: string[] = [];
  for (const item of raw) {
    const key = item && typeof item === 'object' ? (item as { key?: unknown }).key : undefined;
    if (isChatKey(key)) keys.push(key);
  }
  return keys;
}
