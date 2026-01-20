'use client';

/**
 * Message Bubbles - Real-time chat messages with optimistic updates
 * Phase 3: Web Client - Super App Core
 */

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useChatStore, type ChatMessage as Message } from '@/lib/stores/chat.store';
import { usePresenceStore } from '@/lib/stores/presence.store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileIcon,
  Play,
  Image as ImageIcon,
  Download,
  Reply,
  MoreHorizontal,
  Smile,
  Copy,
  Trash2,
  Forward,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MessageBubblesProps {
  conversationId: string;
  currentUserId: string;
  className?: string;
}

export function MessageBubbles({
  conversationId,
  currentUserId,
  className,
}: MessageBubblesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const { messages, conversations } = useChatStore();
  const conversationMessages = messages[conversationId] || [];
  
  // Get typing status from current conversation
  const currentConversation = conversations.find(c => c.id === conversationId);
  const isTyping = currentConversation?.isTyping ?? false;
  // Convert boolean to array of typing user names for TypingIndicator component
  const typingUsers: string[] = isTyping && currentConversation
    ? currentConversation.participants.filter(p => p.id !== currentUserId).map(p => p.name)
    : [];

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [conversationMessages.length]);

  // Track scroll position for scroll-to-bottom button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = (smooth = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  // Group messages by date
  const groupedMessages = groupMessagesByDate(conversationMessages);

  return (
    <div className={cn('relative flex flex-col h-full', className)}>
      {/* Messages Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            {/* Date Separator */}
            <div className="flex items-center justify-center my-4">
              <span className="px-3 py-1 text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                {date}
              </span>
            </div>

            {/* Messages */}
            <div className="space-y-1">
              {msgs.map((message, index) => {
                const isOwn = message.senderId === currentUserId;
                const showAvatar =
                  !isOwn &&
                  (index === 0 || msgs[index - 1]?.senderId !== message.senderId);
                const isLastInGroup =
                  index === msgs.length - 1 ||
                  msgs[index + 1]?.senderId !== message.senderId;

                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={isOwn}
                    showAvatar={showAvatar}
                    isLastInGroup={isLastInGroup}
                    participants={currentConversation?.participants || []}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <TypingIndicator users={typingUsers} />
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          onClick={() => scrollToBottom(true)}
          size="icon"
          className="absolute bottom-4 right-4 h-10 w-10 rounded-full shadow-lg"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </Button>
      )}
    </div>
  );
}

interface Participant {
  id: string;
  name: string;
  avatar?: string;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  isLastInGroup: boolean;
  participants: Participant[];
}

function MessageBubble({
  message,
  isOwn,
  showAvatar,
  isLastInGroup,
  participants,
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  
  // Look up sender info from participants
  const sender = participants.find(p => p.id === message.senderId);
  const senderName = sender?.name || 'Unknown';
  const senderAvatar = sender?.avatar;

  return (
    <div
      className={cn(
        'flex gap-2 group',
        isOwn ? 'flex-row-reverse' : 'flex-row',
        !showAvatar && !isOwn && 'pl-10'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      {showAvatar && !isOwn && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={senderAvatar} />
          <AvatarFallback className="text-xs">
            {senderName.charAt(0)}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Bubble */}
      <div className={cn('flex flex-col max-w-[70%]', isOwn && 'items-end')}>
        {/* Sender name for group chats */}
        {showAvatar && !isOwn && senderName && (
          <span className="text-xs font-medium text-zinc-500 mb-1 ml-3">
            {senderName}
          </span>
        )}

        {/* Reply preview */}
        {message.replyTo && (
          <div
            className={cn(
              'text-xs px-3 py-1.5 mb-1 rounded-lg border-l-2 bg-zinc-100 dark:bg-zinc-800',
              isOwn ? 'border-emerald-500' : 'border-zinc-400'
            )}
          >
            <p className="font-medium text-zinc-600 dark:text-zinc-400">
              {participants.find(p => p.id === message.replyTo?.senderId)?.name || 'Unknown'}
            </p>
            <p className="text-zinc-500 truncate">{message.replyTo.content}</p>
          </div>
        )}

        <div className="flex items-end gap-1">
          {/* Message content */}
          <div
            className={cn(
              'px-4 py-2 rounded-2xl',
              isOwn
                ? 'bg-emerald-500 text-white rounded-br-md'
                : 'bg-zinc-100 dark:bg-zinc-800 rounded-bl-md',
              isLastInGroup && isOwn && 'rounded-br-2xl',
              isLastInGroup && !isOwn && 'rounded-bl-2xl'
            )}
          >
            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mb-2 space-y-2">
                {message.attachments.map((attachment, i) => (
                  <AttachmentPreview
                    key={i}
                    attachment={attachment}
                    isOwn={isOwn}
                  />
                ))}
              </div>
            )}

            {/* Text content */}
            {message.content && (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}

            {/* Time and status */}
            <div
              className={cn(
                'flex items-center gap-1 mt-1',
                isOwn ? 'justify-end' : 'justify-start'
              )}
            >
              <span
                className={cn(
                  'text-[10px]',
                  isOwn ? 'text-emerald-100' : 'text-zinc-400'
                )}
              >
                {formatMessageTime(message.createdAt)}
              </span>
              {isOwn && <MessageStatus status={message.status} />}
            </div>
          </div>

          {/* Quick actions */}
          {showActions && (
            <div className={cn('flex items-center', isOwn ? 'order-first' : '')}>
              <MessageActions message={message} isOwn={isOwn} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface AttachmentPreviewProps {
  attachment: {
    type: string;
    url: string;
    name?: string;
    size?: number;
    thumbnail?: string;
  };
  isOwn: boolean;
}

function AttachmentPreview({ attachment, isOwn }: AttachmentPreviewProps) {
  if (attachment.type.startsWith('image/')) {
    return (
      <div className="relative rounded-lg overflow-hidden max-w-xs">
        <img
          src={attachment.url}
          alt={attachment.name || 'Image'}
          className="w-full h-auto"
        />
      </div>
    );
  }

  if (attachment.type.startsWith('video/')) {
    return (
      <div className="relative rounded-lg overflow-hidden max-w-xs bg-black">
        {attachment.thumbnail ? (
          <img
            src={attachment.thumbnail}
            alt="Video thumbnail"
            className="w-full h-auto"
          />
        ) : (
          <div className="w-48 h-32 flex items-center justify-center">
            <Play className="h-12 w-12 text-white" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <button className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="h-6 w-6 text-white fill-white" />
          </button>
        </div>
      </div>
    );
  }

  // File attachment
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg',
        isOwn ? 'bg-emerald-600' : 'bg-zinc-200 dark:bg-zinc-700'
      )}
    >
      <FileIcon className="h-8 w-8 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{attachment.name || 'File'}</p>
        {attachment.size && (
          <p className="text-xs opacity-70">
            {formatFileSize(attachment.size)}
          </p>
        )}
      </div>
      <a href={attachment.url} download className="shrink-0">
        <Download className="h-5 w-5" />
      </a>
    </div>
  );
}

function MessageStatus({ status }: { status?: string }) {
  switch (status) {
    case 'sending':
      return <Clock className="h-3 w-3 text-emerald-200" />;
    case 'sent':
      return <Check className="h-3 w-3 text-emerald-200" />;
    case 'delivered':
      return <CheckCheck className="h-3 w-3 text-emerald-200" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-blue-400" />;
    case 'failed':
      return (
        <Tooltip>
          <TooltipTrigger>
            <AlertCircle className="h-3 w-3 text-red-400" />
          </TooltipTrigger>
          <TooltipContent>Failed to send</TooltipContent>
        </Tooltip>
      );
    default:
      return null;
  }
}

function MessageActions({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Smile className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>React</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Reply className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reply</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
          <DropdownMenuItem>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Forward className="h-4 w-4 mr-2" />
            Forward
          </DropdownMenuItem>
          {isOwn && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-500">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TypingIndicator({ users }: { users: string[] }) {
  const text =
    users.length === 1
      ? `${users[0]} is typing...`
      : users.length === 2
      ? `${users[0]} and ${users[1]} are typing...`
      : `${users.length} people are typing...`;

  return (
    <div className="flex items-center gap-2 pl-10">
      <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-bl-md">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
          <span
            className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"
            style={{ animationDelay: '0.1s' }}
          />
          <span
            className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"
            style={{ animationDelay: '0.2s' }}
          />
        </div>
      </div>
      <span className="text-xs text-zinc-500">{text}</span>
    </div>
  );
}

// Utility functions
function groupMessagesByDate(messages: Message[]): Record<string, Message[]> {
  return messages.reduce((groups, message) => {
    const date = formatDateHeader(message.createdAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);
}

function formatDateHeader(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatMessageTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default MessageBubbles;
