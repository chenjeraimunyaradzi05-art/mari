'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Send,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Image,
  Check,
  CheckCheck,
  ArrowLeft,
} from 'lucide-react';
import { useConversations, useMessages, useSendMessage, useAuth } from '@/lib/hooks';
import { formatRelativeTime, getFullName, getInitials, cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/loading';

export default function MessagesPage() {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversationsData, isLoading: loadingConversations } = useConversations();
  const { data: messagesData, isLoading: loadingMessages } = useMessages(
    selectedConversation?.id
  );
  const sendMessage = useSendMessage();

  const conversations = conversationsData?.conversations || [];
  const messages = messagesData?.messages || [];

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedConversation) return;

    sendMessage.mutate(
      {
        receiverId: getOtherParticipant(selectedConversation).id,
        content: messageText,
      },
      {
        onSuccess: () => {
          setMessageText('');
        },
      }
    );
  };

  const getOtherParticipant = (conversation: any) => {
    return conversation.participants?.find((p: any) => p.id !== user?.id) || {};
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
      {/* Conversations List */}
      <div
        className={cn(
          'w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-gray-800 flex flex-col',
          selectedConversation && 'hidden md:flex'
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Messages
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 py-2 text-sm w-full"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length > 0 ? (
            conversations
              .filter((conv: any) => {
                if (!searchQuery) return true;
                const other = getOtherParticipant(conv);
                const name = getFullName(other.firstName || '', other.lastName || '');
                return name.toLowerCase().includes(searchQuery.toLowerCase());
              })
              .map((conversation: any) => {
                const other = getOtherParticipant(conversation);
                const isSelected = selectedConversation?.id === conversation.id;
                const hasUnread = conversation.unreadCount > 0;

                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    className={cn(
                      'w-full p-4 flex items-start space-x-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-left',
                      isSelected && 'bg-primary-50 dark:bg-primary-900/20'
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      {other.profile?.avatarUrl ? (
                        <img
                          src={other.profile.avatarUrl}
                          alt={getFullName(other.firstName || '', other.lastName || '')}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 font-semibold">
                          {getInitials(other.firstName || '', other.lastName || '')}
                        </div>
                      )}
                      {other.isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={cn(
                            'font-medium truncate',
                            hasUnread
                              ? 'text-gray-900 dark:text-white'
                              : 'text-gray-700 dark:text-gray-300'
                          )}
                        >
                          {getFullName(other.firstName || '', other.lastName || '')}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {formatRelativeTime(conversation.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p
                          className={cn(
                            'text-sm truncate',
                            hasUnread
                              ? 'text-gray-900 dark:text-white font-medium'
                              : 'text-gray-500 dark:text-gray-400'
                          )}
                        >
                          {conversation.lastMessage?.content || 'Start a conversation'}
                        </p>
                        {hasUnread && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-primary-600 text-white rounded-full flex-shrink-0">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Send className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                No conversations yet
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Start connecting with other members
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div
        className={cn(
          'flex-1 flex flex-col',
          !selectedConversation && 'hidden md:flex'
        )}
      >
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="relative">
                  {getOtherParticipant(selectedConversation).profile?.avatarUrl ? (
                    <img
                      src={getOtherParticipant(selectedConversation).profile.avatarUrl}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 font-semibold">
                      {getInitials(
                        getOtherParticipant(selectedConversation).firstName || '',
                        getOtherParticipant(selectedConversation).lastName || ''
                      )}
                    </div>
                  )}
                  {getOtherParticipant(selectedConversation).isOnline && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {getFullName(
                      getOtherParticipant(selectedConversation).firstName || '',
                      getOtherParticipant(selectedConversation).lastName || ''
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {getOtherParticipant(selectedConversation).isOnline
                      ? 'Online'
                      : 'Last seen recently'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition">
                  <Video className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}
                    >
                      <Skeleton
                        className={cn('h-10 rounded-2xl', i % 2 === 0 ? 'w-48' : 'w-32')}
                      />
                    </div>
                  ))}
                </div>
              ) : messages.length > 0 ? (
                messages.map((message: any, index: number) => {
                  const isMine = message.senderId === user?.id;
                  const showAvatar =
                    !isMine &&
                    (index === 0 || messages[index - 1]?.senderId !== message.senderId);

                  return (
                    <div
                      key={message.id}
                      className={cn('flex items-end space-x-2', isMine && 'justify-end')}
                    >
                      {!isMine && showAvatar && (
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 text-xs font-semibold flex-shrink-0">
                          {getInitials(
                            message.sender?.firstName || '',
                            message.sender?.lastName || ''
                          )}
                        </div>
                      )}
                      {!isMine && !showAvatar && <div className="w-8" />}
                      <div
                        className={cn(
                          'max-w-[70%] rounded-2xl px-4 py-2',
                          isMine
                            ? 'bg-primary-600 text-white rounded-br-sm'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm'
                        )}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div
                          className={cn(
                            'flex items-center justify-end space-x-1 mt-1',
                            isMine ? 'text-white/70' : 'text-gray-400'
                          )}
                        >
                          <span className="text-xs">
                            {new Date(message.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isMine && (
                            message.read ? (
                              <CheckCheck className="w-3.5 h-3.5" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Send className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">
                      No messages yet. Say hello! 👋
                    </p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <button
                  type="button"
                  className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  <Image className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type a message..."
                    className="input py-2.5 pr-10 w-full"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!messageText.trim() || sendMessage.isPending}
                  className="p-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Send className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Your Messages
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                Select a conversation to start messaging or find new connections in the
                community.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
