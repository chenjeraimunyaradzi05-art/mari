'use client';

/**
 * What a report kept of the thing it is about.
 *
 * A report on a message used to show a moderator a bare identifier. Messages are
 * unsent, swept by a disappearing timer, deleted by a host, and removed by the
 * very decision the moderator is about to make, so the report now carries a copy
 * of the words taken when it was filed, with the few lines before them. This
 * shows that copy. It is a copy: the message may be gone, and that is the point.
 */

import Link from 'next/link';
import { safeHref } from '@/lib/safe-href';
import { isChatAttachmentKey, useChatAttachmentUrl } from '@/lib/chat-attachments';

/**
 * A file on a copied message: a link, for one sent before chat files were
 * private, or the key of a file in the chat folder. The file behind the
 * reported message is kept when the message goes, and the API opens it to a
 * member of staff with a second factor because the report names it; the files
 * on the lines before it go with their own messages, so only their names are
 * shown.
 */
type SnapshotAttachment = { name?: string; type?: string; url?: string; key?: string };

type SnapshotMessage = {
  id: string;
  senderId: string;
  senderName: string | null;
  content: string;
  type?: string | null;
  attachments?: SnapshotAttachment[];
  createdAt: string;
  edited?: boolean;
};

type MessageContext = {
  surface: 'direct' | 'group';
  conversationId: string;
  groupId: string | null;
  groupName: string | null;
  capturedAt: string;
  reported: SnapshotMessage;
  before: SnapshotMessage[];
};

type ChatLine = { id: string; userId: string; userName: string | null; content: string; createdAt: string };

type LiveContext = {
  capturedAt: string;
  streamId: string;
  streamTitle: string;
  hostId: string;
  hostName: string | null;
  reported?: ChatLine;
  before?: ChatLine[];
  stream?: { description: string | null; category: string | null; status: string; startedAt: string | null };
};

type GroupContext = {
  capturedAt: string;
  groupId: string;
  name: string;
  description: string;
  privacy: string;
  createdById: string;
};

export type ReportContextData = {
  messageContext?: MessageContext;
  liveContext?: LiveContext;
  groupContext?: GroupContext;
};

const when = (iso: string) => new Date(iso).toLocaleString('en-AU');

function Line({
  name,
  at,
  content,
  attachments,
  edited,
  highlighted,
}: {
  name: string | null;
  at: string;
  content: string;
  attachments?: SnapshotAttachment[];
  edited?: boolean;
  highlighted?: boolean;
}) {
  return (
    <li
      className={
        highlighted
          ? 'rounded-lg border border-rose-300 bg-rose-50 p-2 dark:border-rose-900/60 dark:bg-rose-950/30'
          : 'rounded-lg bg-slate-50 p-2 dark:bg-slate-800'
      }
    >
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-500">
        <span className="font-medium text-slate-700 dark:text-slate-200">{name || 'Member'}</span>
        <span>{when(at)}</span>
        {edited && <span>edited</span>}
        {highlighted && <span className="font-semibold text-rose-700 dark:text-rose-300">reported</span>}
      </p>
      {content ? (
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-100">{content}</p>
      ) : null}
      {attachments && attachments.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs">
          {attachments.map((attachment, index) => (
            <li key={`${attachment.key ?? attachment.url ?? attachment.name ?? 'file'}-${index}`}>
              {attachment.url ? (
                <a href={safeHref(attachment.url)} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                  {attachment.name || 'Attachment'}
                </a>
              ) : highlighted && isChatAttachmentKey(attachment.key) ? (
                <KeptFileLink fileKey={attachment.key} name={attachment.name} />
              ) : (
                <span>{attachment.name || 'Attachment'}</span>
              )}
              {attachment.type ? <span className="text-slate-500"> ({attachment.type})</span> : null}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * The file behind the reported message, opened through the link the API mints
 * for the member of staff looking (lib/chat-attachments). Said plainly when it
 * cannot be opened: the file was never kept, or this account may not open it.
 */
function KeptFileLink({ fileKey, name }: { fileKey: string; name?: string }) {
  const link = useChatAttachmentUrl(fileKey);
  const label = name || 'Attachment';
  // The link was minted by the API for this member of staff and handed over by
  // lib/chat-attachments: a signed address, or, where the API serves the bytes
  // itself (a developer's machine), an object URL for what it fetched. It is not
  // something a member typed, so it is used as it came; safeHref is for links
  // members write, and would drop the object URL and call a file that had just
  // been fetched one that could not be opened.
  const href = link.status === 'ready' ? link.url : undefined;

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
        {label}
      </a>
    );
  }
  if (link.status === 'loading') {
    return <span aria-busy="true">{label}</span>;
  }
  return (
    <span>
      {label} <span className="text-slate-500">(the file could not be opened)</span>
    </span>
  );
}

export function ReportContext({ context }: { context: ReportContextData | null | undefined }) {
  if (!context) return null;

  if (context.messageContext) {
    const message = context.messageContext;
    return (
      <section aria-label="The reported message" className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {message.surface === 'group'
            ? `Group chat${message.groupName ? `: ${message.groupName}` : ''}`
            : 'Direct message'}
        </p>
        <p className="text-xs text-slate-500">
          A copy taken when it was reported, on {when(message.capturedAt)}. The message may have been unsent, deleted or
          expired since; this stays.
        </p>
        <ul className="space-y-1.5">
          {message.before.map((line) => (
            <Line key={line.id} name={line.senderName} at={line.createdAt} content={line.content} attachments={line.attachments} edited={line.edited} />
          ))}
          <Line
            name={message.reported.senderName}
            at={message.reported.createdAt}
            content={message.reported.content}
            attachments={message.reported.attachments}
            edited={message.reported.edited}
            highlighted
          />
        </ul>
        {message.before.length === 0 && <p className="text-xs text-slate-500">Nothing came before it in this conversation.</p>}
      </section>
    );
  }

  if (context.liveContext) {
    const live = context.liveContext;
    return (
      <section aria-label="The reported live stream" className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Live stream: {live.streamTitle}
          {live.hostName ? ` · host ${live.hostName}` : ''}
        </p>
        <p className="text-xs text-slate-500">A copy taken when it was reported, on {when(live.capturedAt)}.</p>
        {live.reported ? (
          <ul className="space-y-1.5">
            {(live.before ?? []).map((line) => (
              <Line key={line.id} name={line.userName} at={line.createdAt} content={line.content} />
            ))}
            <Line name={live.reported.userName} at={live.reported.createdAt} content={live.reported.content} highlighted />
          </ul>
        ) : live.stream ? (
          <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {live.stream.category && <p>Category: {live.stream.category}</p>}
            {live.stream.description && <p className="whitespace-pre-wrap">{live.stream.description}</p>}
            <p className="text-xs text-slate-500">
              {live.stream.status === 'LIVE' ? 'Live when reported.' : `Status when reported: ${live.stream.status.toLowerCase()}.`}
              {live.stream.status === 'LIVE' && (
                <>
                  {' '}
                  <Link href={`/live/${live.streamId}`} target="_blank" className="text-primary-600 hover:underline">
                    Watch it
                  </Link>
                </>
              )}
            </p>
          </div>
        ) : null}
      </section>
    );
  }

  if (context.groupContext) {
    const group = context.groupContext;
    return (
      <section aria-label="The reported group" className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Group: {group.name}</p>
        <p className="text-xs text-slate-500">
          {group.privacy.toLowerCase()} group, as it was described when reported on {when(group.capturedAt)}.
        </p>
        {group.description && <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{group.description}</p>}
      </section>
    );
  }

  return null;
}

export default ReportContext;
