'use client';

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';
import { 
  Send, 
  Paperclip, 
  Smile, 
  AtSign, 
  MoreHorizontal,
  Reply,
  Edit2,
  Trash2,
  Pin,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';

export interface Message {
  id: string;
  content: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  createdAt: string;
  editedAt?: string;
  isPinned?: boolean;
  reactions?: Array<{
    emoji: string;
    count: number;
    hasReacted: boolean;
  }>;
  replyTo?: {
    id: string;
    content: string;
    authorName: string;
  };
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
}

interface ChatAreaProps {
  channelName: string;
  channelType: 'public' | 'private' | 'direct';
  messages: Message[];
  currentUserId: string;
  onSendMessage: (content: string, attachments?: File[]) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onPinMessage: (messageId: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isTyping?: boolean;
  typingUsers?: string[];
}

export function ChatArea({
  channelName,
  channelType,
  messages,
  currentUserId,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onReaction,
  onPinMessage,
  onLoadMore,
  hasMore,
  isLoading,
  typingUsers = [],
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Infinite scroll for loading more
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || !hasMore || isLoading) return;

    if (container.scrollTop === 0) {
      onLoadMore?.();
    }
  }, [hasMore, isLoading, onLoadMore]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
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

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [date: string]: Message[] } = {};
    messages.forEach((msg) => {
      const date = new Date(msg.createdAt).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 h-full" data-testid="chat-area">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">
            {channelType === 'public' ? '#' : channelType === 'private' ? '🔒' : ''}
          </span>
          <h2 className="font-semibold text-gray-900 dark:text-white">{channelName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Pin className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {Object.entries(messageGroups).map(([date, msgs]) => (
          <div key={date}>
            {/* Date divider */}
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {formatDate(date)}
              </span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            </div>

            {/* Messages */}
            {msgs.map((message, index) => {
              const isOwn = message.author.id === currentUserId;
              const showAvatar =
                index === 0 || msgs[index - 1].author.id !== message.author.id;

              return (
                <div
                  key={message.id}
                  className={cn(
                    'group relative flex gap-3 py-1 px-2 -mx-2 rounded-lg transition-colors',
                    hoveredMessageId === message.id && 'bg-gray-50 dark:bg-gray-900'
                  )}
                  onMouseEnter={() => setHoveredMessageId(message.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                >
                  {/* Avatar */}
                  <div className="w-10 flex-shrink-0">
                    {showAvatar && (
                      <Avatar
                        src={message.author.avatarUrl}
                        fallback={`${message.author.firstName[0]}${message.author.lastName[0]}`}
                        size="sm"
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {showAvatar && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {message.author.firstName} {message.author.lastName}
                        </span>
                        <span className="text-xs text-gray-500">{formatTime(message.createdAt)}</span>
                        {message.editedAt && (
                          <span className="text-xs text-gray-400">(edited)</span>
                        )}
                      </div>
                    )}

                    {/* Reply reference */}
                    {message.replyTo && (
                      <div className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 mb-1 border-l-2 border-primary-500">
                        <span className="font-medium">{message.replyTo.authorName}:</span>{' '}
                        {message.replyTo.content.slice(0, 50)}...
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
                          className="flex-1 px-3 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                          autoFocus
                        />
                        <Button size="sm" onClick={() => handleEditSubmit(message.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditing}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    )}

                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.attachments.map((att) => (
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
                        ))}
                      </div>
                    )}

                    {/* Reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {message.reactions.map((reaction) => (
                          <button
                            key={reaction.emoji}
                            onClick={() => onReaction(message.id, reaction.emoji)}
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                              reaction.hasReacted
                                ? 'bg-primary-100 dark:bg-primary-900 border border-primary-300 dark:border-primary-700'
                                : 'bg-gray-100 dark:bg-gray-800 border border-transparent'
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
                  {hoveredMessageId === message.id && editingMessageId !== message.id && (
                    <div className="absolute top-0 right-2 -translate-y-1/2 flex items-center gap-0.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                      {quickReactions.slice(0, 3).map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => onReaction(message.id, emoji)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                        >
                          {emoji}
                        </button>
                      ))}
                      <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                        <Reply className="w-4 h-4 text-gray-500" />
                      </button>
                      {isOwn && (
                        <>
                          <button
                            onClick={() => startEditing(message)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                          >
                            <Edit2 className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => onDeleteMessage(message.id)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => onPinMessage(message.id)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                      >
                        <Pin className={cn('w-4 h-4', message.isPinned ? 'text-amber-500' : 'text-gray-500')} />
                      </button>
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
        <div className="px-4 py-2 text-sm text-gray-500">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 rounded-lg px-3 py-2">
          <button type="button" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Message #${channelName}`}
            className="flex-1 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-500"
            data-testid="message-input"
          />
          <button type="button" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <AtSign className="w-5 h-5" />
          </button>
          <button type="button" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <Smile className="w-5 h-5" />
          </button>
          <Button type="submit" size="icon" disabled={!inputValue.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

export default ChatArea;
