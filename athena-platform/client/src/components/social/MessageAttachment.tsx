'use client';

/**
 * One file sent in a conversation, shown the way its kind is best read: a
 * picture inline, a clip or a voice note with its own player, anything else
 * as a link that opens it.
 *
 * Group chat stored attachments and typed them (IMAGE, VIDEO, AUDIO, FILE),
 * but the web room had no way to show one: a member who sent a photo from the
 * app saw an empty bubble in the browser, and everyone else saw nothing at
 * all. The direct-message thread already had this renderer; it lives here now
 * so the two rooms show a file the same way.
 *
 * A file sent since chat files became private carries no link at all, only
 * the key it is stored under in the conversation's own folder. A link is
 * minted for the person looking, who the server checks is in the thread, and
 * lives five minutes (lib/chat-attachments). A file from before carries the
 * public link it always had and is shown as it always was.
 */

import { useState } from 'react';
import { FileText, Mic } from 'lucide-react';
import { safeHref } from '@/lib/safe-href';
import { isChatAttachmentKey, useChatAttachmentUrl } from '@/lib/chat-attachments';

export type AttachmentKind = 'image' | 'video' | 'audio' | 'file';

export interface MessageAttachmentData {
  type: AttachmentKind;
  /** A link, for a file sent before chat files were private. */
  url?: string;
  /** Where a file sent since lives; never a link. */
  key?: string;
  name?: string;
}

/** A file as the server stores it on a message: what was uploaded, and what it said it was. */
export interface StoredAttachment {
  url?: string;
  key?: string;
  name?: string;
  contentType?: string;
  size?: number;
}

const EXTENSION_KINDS: Record<string, AttachmentKind> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  gif: 'image',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  mp3: 'audio',
  m4a: 'audio',
  aac: 'audio',
  wav: 'audio',
  ogg: 'audio',
  weba: 'audio',
};

/**
 * The kind of file, from the type the upload declared and, when an older row
 * has none, from the extension the media service gave it (a key ends in one
 * too). Anything unknown is a file link, which is always safe to show.
 */
export function attachmentKind(contentType?: string | null, urlOrKey?: string | null): AttachmentKind {
  const type = (contentType || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type) return 'file';
  const extension = (urlOrKey || '').split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_KINDS[extension] ?? 'file';
}

/**
 * The attachments on a stored message that can be shown: each needs either a
 * key under the chat folder, which a link is minted for, or a link of its own.
 * A key of any other shape is not one this server wrote for a conversation,
 * and nothing is asked about it.
 */
export function toMessageAttachments(raw: unknown): Array<MessageAttachmentData & { id: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const attachment = item as StoredAttachment;
    const key = isChatAttachmentKey(attachment.key) ? attachment.key : undefined;
    const url = typeof attachment.url === 'string' && attachment.url ? attachment.url : undefined;
    if (!key && !url) return [];
    return [
      {
        id: attachment.key || `${url}-${index}`,
        type: attachmentKind(attachment.contentType, key ?? url),
        ...(url ? { url } : {}),
        ...(key ? { key } : {}),
        name: typeof attachment.name === 'string' ? attachment.name : undefined,
      },
    ];
  });
}

export function MessageAttachment({ attachment }: { attachment: MessageAttachmentData }) {
  if (isChatAttachmentKey(attachment.key)) {
    return <ChatFile attachment={attachment} fileKey={attachment.key} />;
  }
  return <AttachmentView attachment={attachment} url={attachment.url} />;
}

/**
 * A file under the chat folder: shown once the API has minted a link for the
 * person looking. A player that finds its link has run out asks for a new one
 * once; a file that still cannot be opened is said to be unavailable, which is
 * what it is to her, whether it was deleted with its message, unsent, or sent
 * by someone she no longer shares a thread with.
 */
function ChatFile({ attachment, fileKey }: { attachment: MessageAttachmentData; fileKey: string }) {
  const link = useChatAttachmentUrl(fileKey);
  const [renewed, setRenewed] = useState(false);
  const [broken, setBroken] = useState(false);

  const onError = () => {
    if (renewed) {
      setBroken(true);
      return;
    }
    setRenewed(true);
    link.refresh();
  };

  if (broken || link.status === 'unavailable') {
    return (
      <span className="flex items-center gap-2 text-sm opacity-80">
        <FileText className="h-4 w-4" aria-hidden />
        {attachment.name ? `${attachment.name} is no longer available` : 'This file is no longer available'}
      </span>
    );
  }

  if (link.status === 'loading') {
    return (
      <span className="flex items-center gap-2 text-sm opacity-70" aria-busy="true">
        <FileText className="h-4 w-4" aria-hidden />
        {attachment.name || 'Loading file…'}
      </span>
    );
  }

  return <AttachmentView attachment={attachment} url={link.url} onError={onError} />;
}

function AttachmentView({
  attachment,
  url,
  onError,
}: {
  attachment: MessageAttachmentData;
  url: string | undefined;
  onError?: () => void;
}) {
  if (attachment.type === 'image' && url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user uploads come from the media CDN or a signed link, neither in the image config
      <img
        src={url}
        alt={attachment.name || 'Attachment'}
        className="max-h-64 w-full rounded-md object-cover"
        onError={onError}
      />
    );
  }

  if (attachment.type === 'video' && url) {
    return <video src={url} controls className="max-h-64 w-full rounded-md" onError={onError} />;
  }

  if (attachment.type === 'audio' && url) {
    return (
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 flex-shrink-0 opacity-70" aria-hidden />
        <audio src={url} controls preload="metadata" className="h-9 w-56 max-w-full" aria-label="Voice note" onError={onError} />
      </div>
    );
  }

  const href = safeHref(url);
  if (!href) {
    // A link the browser should not follow is shown as its name only.
    return (
      <span className="flex items-center gap-2 text-sm">
        <FileText className="h-4 w-4" aria-hidden />
        {attachment.name || 'Attachment'}
      </span>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm underline">
      <FileText className="h-4 w-4" aria-hidden />
      {attachment.name || 'Attachment'}
    </a>
  );
}
