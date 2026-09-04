'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Edit2,
  Loader2,
  LogOut,
  MoreHorizontal,
  Paperclip,
  Pin,
  Send,
  Smile,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Modal } from '@/components/ui/modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { renderSocialText } from '@/lib/social-text';

/**
 * The message pane of a community channel.
 *
 * The author shape is what GET /channels/:id/messages returns (displayName and
 * avatar); the earlier version read firstName, lastName and avatarUrl, none of
 * which are on the wire, so every message rendered without a name.
 */

export interface MessageAuthor {
  id: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;
}

export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'file' | string;
  size?: number;
}

export interface Message {
  id: string;
  content: string;
  author: MessageAuthor;
  createdAt: string;
  editedAt?: string | null;
  isPinned?: boolean;
  reactions?: Array<{
    emoji: string;
    count: number;
    hasReacted: boolean;
  }>;
  attachments?: MessageAttachment[];
}

export interface ChannelMember {
  id: string;
  displayName?: string | null;
  avatar?: string | null;
  headline?: string | null;
  role?: string | null;
}

/** What sits under the thread: a composer, a join button, or a reason there is neither. */
export type ComposerState = 'input' | 'join' | 'read-only' | 'sign-in';

export function authorName(author?: MessageAuthor | null): string {
  if (!author) return 'Member';
  const full = [author.firstName, author.lastName].filter(Boolean).join(' ').trim();
  return author.displayName?.trim() || full || 'Member';
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'M';

const avatarOf = (author?: MessageAuthor | null) => author?.avatar ?? author?.avatarUrl ?? undefined;

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
const EMOJI = ['😀', '😂', '😍', '🥳', '😎', '🤔', '😮', '😢', '👍', '👏', '🙏', '💪', '🔥', '❤️', '✨', '🎉', '🚀', '💡', '✅', '👀'];
const MAX_ATTACHMENTS = 4;
// The media pipeline serves images and video publicly; anything else would
// upload and then 403 for everyone who opened it.
const ATTACHMENT_ACCEPT = 'image/*,video/*';

interface ChatAreaProps {
  channelName: string;
  channelType: 'public' | 'private' | 'direct';
  channelDescription?: string;
  memberCount?: number;
  messages: Message[];
  currentUserId: string;
  composer: ComposerState;
  /** The channel owner: may pin, and may delete anyone's message. */
  canModerate: boolean;
  canLeave: boolean;
  onSendMessage: (content: string, attachments?: File[]) => Promise<void> | void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onPinMessage: (messageId: string) => void;
  onJoin?: () => void;
  onLeave?: () => void;
  onLoadPinned?: () => Promise<Message[]>;
  onLoadMembers?: () => Promise<ChannelMember[]>;
  onTyping?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isJoining?: boolean;
  typingUsers?: string[];
}

export function ChatArea({
  channelName,
  channelType,
  channelDescription,
  memberCount,
  messages,
  currentUserId,
  composer,
  canModerate,
  canLeave,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onReaction,
  onPinMessage,
  onJoin,
  onLeave,
  onLoadPinned,
  onLoadMembers,
  onTyping,
  onLoadMore,
  hasMore,
  isLoading,
  isJoining,
  typingUsers = [],
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [pinned, setPinned] = useState<Message[] | null>(null);
  const [pinnedLoading, setPinnedLoading] = useState(false);

  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState<ChannelMember[] | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // A different channel starts with a clean composer and closed panels.
  useEffect(() => {
    setInputValue('');
    setAttachments([]);
    setShowEmoji(false);
    setEditingMessageId(null);
    setPinnedOpen(false);
    setPinned(null);
    setMembers(null);
  }, [channelName]);

  // Infinite scroll for loading more
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || !hasMore || isLoading) return;

    if (container.scrollTop === 0) {
      onLoadMore?.();
    }
  }, [hasMore, isLoading, onLoadMore]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const content = inputValue.trim();
    if ((!content && attachments.length === 0) || sending) return;

    setSending(true);
    try {
      await onSendMessage(content, attachments.length > 0 ? attachments : undefined);
      setInputValue('');
      setAttachments([]);
      setShowEmoji(false);
    } catch {
      // The page has already said why; the draft stays so it can be retried.
    } finally {
      setSending(false);
    }
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/')
    );
    setAttachments((current) => [...current, ...picked].slice(0, MAX_ATTACHMENTS));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const togglePinned = async () => {
    const next = !pinnedOpen;
    setPinnedOpen(next);
    if (next && onLoadPinned && pinned === null) {
      setPinnedLoading(true);
      try {
        setPinned(await onLoadPinned());
      } catch {
        setPinned([]);
      } finally {
        setPinnedLoading(false);
      }
    }
  };

  // Pinning from the thread should show up in the panel without a reload.
  useEffect(() => {
    if (pinned === null) return;
    setPinned(messages.filter((message) => message.isPinned));
  }, [messages, pinned === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const openMembers = async () => {
    setMembersOpen(true);
    if (onLoadMembers && members === null) {
      setMembersLoading(true);
      try {
        setMembers(await onLoadMembers());
      } catch {
        setMembers([]);
      } finally {
        setMembersLoading(false);
      }
    }
  };

  const handleEditSubmit = (messageId: string) => {
    if (!editingContent.trim()) return;
    onEditMessage(messageId, editingContent.trim());
    setEditingMessageId(null);
    setEditingContent('');
  };

  const startEditing = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const groupMessagesByDate = (list: Message[]) => {
    const groups: { [date: string]: Message[] } = {};
    list.forEach((msg) => {
      const date = new Date(msg.createdAt).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);
  const hasMenu = Boolean(onLoadMembers || (canLeave && onLeave));

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 h-full min-w-0" data-testid="chat-area">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">
              {channelType === 'public' ? '#' : channelType === 'private' ? '🔒' : ''}
            </span>
            <h2 className="font-semibold text-slate-900 dark:text-white truncate">{channelName}</h2>
          </div>
          {(channelDescription || typeof memberCount === 'number') && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {[
                typeof memberCount === 'number'
                  ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`
                  : null,
                channelDescription,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onLoadPinned && (
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePinned}
              aria-pressed={pinnedOpen}
              aria-label={pinnedOpen ? 'Hide pinned messages' : 'Show pinned messages'}
              title="Pinned messages"
            >
              <Pin className={cn('w-4 h-4', pinnedOpen && 'text-amber-500')} />
            </Button>
          )}
          {hasMenu && (
            <DropdownMenu as="div" className="relative">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Channel options">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {onLoadMembers && (
                  <DropdownMenuItem onClick={openMembers}>
                    <Users className="w-4 h-4 mr-2" />
                    Members{typeof memberCount === 'number' ? ` (${memberCount})` : ''}
                  </DropdownMenuItem>
                )}
                {canLeave && onLeave && (
                  <>
                    {onLoadMembers && <DropdownMenuSeparator />}
                    <DropdownMenuItem onClick={onLeave} className="text-red-600 dark:text-red-400">
                      <LogOut className="w-4 h-4 mr-2" />
                      Leave channel
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Pinned messages */}
      {pinnedOpen && (
        <div className="px-4 py-3 border-b border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/40">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Pinned
            </p>
            <button
              type="button"
              onClick={() => setPinnedOpen(false)}
              className="text-amber-700 dark:text-amber-400"
              aria-label="Close pinned messages"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {pinnedLoading ? (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Loading...</p>
          ) : !pinned || pinned.length === 0 ? (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Nothing pinned yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {pinned.map((message) => (
                <li key={message.id} className="text-sm text-slate-800 dark:text-slate-200">
                  <span className="font-medium">{authorName(message.author)}:</span>{' '}
                  <span className="break-words">{message.content}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nothing here yet. Say hello.
          </p>
        )}
        {Object.entries(messageGroups).map(([date, msgs]) => (
          <div key={date}>
            {/* Date divider */}
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {formatDate(date)}
              </span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* Messages */}
            {msgs.map((message, index) => {
              const isOwn = message.author.id === currentUserId;
              const showAvatar =
                index === 0 || msgs[index - 1].author.id !== message.author.id;
              const name = authorName(message.author);

              return (
                <div
                  key={message.id}
                  className={cn(
                    'group relative flex gap-3 py-1 px-2 -mx-2 rounded-lg transition-colors',
                    hoveredMessageId === message.id && 'bg-slate-50 dark:bg-slate-900'
                  )}
                  onMouseEnter={() => setHoveredMessageId(message.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                >
                  {/* Avatar */}
                  <div className="w-10 flex-shrink-0">
                    {showAvatar && (
                      <Link href={`/profile/${message.author.id}`} aria-label={name}>
                        <Avatar src={avatarOf(message.author)} alt={name} fallback={initialsOf(name)} size="sm" />
                      </Link>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {showAvatar && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <Link
                          href={`/profile/${message.author.id}`}
                          className="font-medium text-slate-900 dark:text-white hover:underline"
                        >
                          {name}
                        </Link>
                        <span className="text-xs text-slate-500">{formatTime(message.createdAt)}</span>
                        {message.editedAt && (
                          <span className="text-xs text-slate-400">(edited)</span>
                        )}
                      </div>
                    )}

                    {/* Message content or edit form */}
                    {editingMessageId === message.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEditSubmit(message.id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                          className="flex-1 px-3 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                          autoFocus
                        />
                        <Button size="sm" onClick={() => handleEditSubmit(message.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditing}>
                          Cancel
                        </Button>
                      </div>
                    ) : message.content ? (
                      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                        {renderSocialText(message.content)}
                      </p>
                    ) : null}

                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.attachments.map((att) =>
                          att.type === 'image' ? (
                            <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element -- media CDN, outside the image config */}
                              <img
                                src={att.url}
                                alt={att.name}
                                className="max-h-64 max-w-xs rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
                              />
                            </a>
                          ) : att.type === 'video' ? (
                            <video
                              key={att.id}
                              src={att.url}
                              controls
                              preload="metadata"
                              className="max-h-64 max-w-xs rounded-lg bg-black"
                            />
                          ) : (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary-500 hover:underline flex items-center gap-1"
                            >
                              <Paperclip className="w-3 h-3" />
                              {att.name}
                            </a>
                          )
                        )}
                      </div>
                    )}

                    {/* Reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {message.reactions.map((reaction) => (
                          <button
                            key={reaction.emoji}
                            onClick={() => onReaction(message.id, reaction.emoji)}
                            aria-pressed={reaction.hasReacted}
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                              reaction.hasReacted
                                ? 'bg-primary-100 dark:bg-primary-900 border border-primary-300 dark:border-primary-700'
                                : 'bg-slate-100 dark:bg-slate-800 border border-transparent'
                            )}
                          >
                            <span>{reaction.emoji}</span>
                            <span>{reaction.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Pinned indicator */}
                    {message.isPinned && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
                        <Pin className="w-3 h-3" />
                        <span>Pinned</span>
                      </div>
                    )}
                  </div>

                  {/* Hover actions */}
                  {hoveredMessageId === message.id && editingMessageId !== message.id && composer !== 'sign-in' && (
                    <div className="absolute top-0 right-2 -translate-y-1/2 flex items-center gap-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                      {QUICK_REACTIONS.slice(0, 3).map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => onReaction(message.id, emoji)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          aria-label={`React ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                      {isOwn && (
                        <button
                          onClick={() => startEditing(message)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          aria-label="Edit message"
                        >
                          <Edit2 className="w-4 h-4 text-slate-500" />
                        </button>
                      )}
                      {(isOwn || canModerate) && (
                        <button
                          onClick={() => onDeleteMessage(message.id)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          aria-label="Delete message"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                      {canModerate && (
                        <button
                          onClick={() => onPinMessage(message.id)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          aria-label={message.isPinned ? 'Unpin message' : 'Pin message'}
                        >
                          <Pin className={cn('w-4 h-4', message.isPinned ? 'text-amber-500' : 'text-slate-500')} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2 text-sm text-slate-500">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Composer, or the reason there is none */}
      {composer === 'sign-in' ? (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300 flex items-center justify-between gap-3">
          <span>Sign in to join the conversation.</span>
          <Link href="/login?redirect=%2Fcommunity" className="btn-primary px-4 py-2">
            Sign in
          </Link>
        </div>
      ) : composer === 'join' ? (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300 flex items-center justify-between gap-3">
          <span>You are previewing #{channelName}. Join to post and react.</span>
          <Button onClick={onJoin} disabled={isJoining || !onJoin}>
            {isJoining ? 'Joining...' : 'Join channel'}
          </Button>
        </div>
      ) : composer === 'read-only' ? (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
          Only the channel owner posts here. You can still react to messages.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 dark:border-slate-800">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <span
                  key={`${file.name}-${index}`}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs text-slate-700 dark:text-slate-200"
                >
                  <Paperclip className="w-3 h-3" />
                  <span className="max-w-[10rem] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}
                    aria-label={`Remove ${file.name}`}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative flex items-center gap-2 bg-slate-100 dark:bg-slate-900 rounded-lg px-3 py-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={attachments.length >= MAX_ATTACHMENTS}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-40"
              aria-label="Attach a photo or video"
              title="Attach a photo or video"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                onTyping?.();
              }}
              placeholder={`Message #${channelName}`}
              className="flex-1 bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-500"
              data-testid="message-input"
            />
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              aria-label="Add an emoji"
              aria-expanded={showEmoji}
            >
              <Smile className="w-5 h-5" />
            </button>
            <Button
              type="submit"
              size="icon"
              disabled={(!inputValue.trim() && attachments.length === 0) || sending}
              aria-label="Send"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>

            {showEmoji && (
              <div
                role="listbox"
                aria-label="Emoji"
                className="absolute bottom-full right-0 mb-2 grid grid-cols-10 gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-lg"
              >
                {EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      setInputValue((current) => `${current}${emoji}`);
                      setShowEmoji(false);
                    }}
                    className="h-8 w-8 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>
      )}

      {/* Members */}
      <Modal
        isOpen={membersOpen}
        onClose={() => setMembersOpen(false)}
        title={`Members of #${channelName}`}
        description={typeof memberCount === 'number' ? `${memberCount} in this channel` : undefined}
        size="md"
      >
        <div className="max-h-[60vh] overflow-y-auto p-6 pt-4">
          {membersLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !members || members.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No members to show.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((member) => {
                const name = member.displayName?.trim() || 'Member';
                return (
                  <li key={member.id}>
                    <Link
                      href={`/profile/${member.id}`}
                      className="flex items-center gap-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md px-1"
                    >
                      <Avatar src={member.avatar ?? undefined} alt={name} fallback={initialsOf(name)} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
                          {name}
                        </span>
                        {member.headline && (
                          <span className="block truncate text-xs text-slate-500">{member.headline}</span>
                        )}
                      </span>
                      {member.role && member.role !== 'MEMBER' && (
                        <span className="text-xs uppercase tracking-wider text-slate-500">{member.role}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default ChatArea;
