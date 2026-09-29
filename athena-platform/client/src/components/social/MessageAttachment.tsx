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
 */

import { FileText, Mic } from 'lucide-react';
import { safeHref } from '@/lib/safe-href';

export type AttachmentKind = 'image' | 'video' | 'audio' | 'file';

export interface MessageAttachmentData {
  type: AttachmentKind;
  url: string;
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
 * has none, from the extension the media service gave it. Anything unknown is
 * a file link, which is always safe to show.
 */
export function attachmentKind(contentType?: string | null, url?: string | null): AttachmentKind {
  const type = (contentType || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type) return 'file';
  const extension = (url || '').split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_KINDS[extension] ?? 'file';
}

/** The attachments on a stored message that can be shown: each needs a URL. */
export function toMessageAttachments(raw: unknown): Array<MessageAttachmentData & { id: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const attachment = item as StoredAttachment;
    if (typeof attachment.url !== 'string' || !attachment.url) return [];
    return [
      {
        id: attachment.key || `${attachment.url}-${index}`,
        type: attachmentKind(attachment.contentType, attachment.url),
        url: attachment.url,
        name: typeof attachment.name === 'string' ? attachment.name : undefined,
      },
    ];
  });
}

export function MessageAttachment({ attachment }: { attachment: MessageAttachmentData }) {
  if (attachment.type === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user uploads come from the media CDN, which is not in the image config
      <img
        src={attachment.url}
        alt={attachment.name || 'Attachment'}
        className="max-h-64 w-full rounded-md object-cover"
      />
    );
  }

  if (attachment.type === 'video') {
    return <video src={attachment.url} controls className="max-h-64 w-full rounded-md" />;
  }

  if (attachment.type === 'audio') {
    return (
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 flex-shrink-0 opacity-70" aria-hidden />
        <audio src={attachment.url} controls preload="metadata" className="h-9 w-56 max-w-full" aria-label="Voice note" />
      </div>
    );
  }

  const href = safeHref(attachment.url);
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
