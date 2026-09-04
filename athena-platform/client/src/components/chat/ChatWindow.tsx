'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useMessages,
  useSendMessage,
  useToggleMessageReaction,
  useUploadChatAttachment,
  type OutgoingAttachment,
} from '@/lib/hooks';
import { useAuthStore } from '@/lib/store';
import {
  useChatStore,
  toChatMessage,
  ChatMessage as StoreMessage,
} from '@/lib/stores/chat.store';
import { socketClient } from '@/lib/socket';
import { usePresenceStore } from '@/lib/stores/presence.store';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Paperclip,
  Reply,
  Smile,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatWindowProps {
  conversationId: string;
}

// The media pipeline only serves images and video publicly; anything else would
// upload fine and then 403 for the person we sent it to.
const ATTACHMENT_ACCEPT = 'image/*,video/*';
const MAX_ATTACHMENTS = 4;
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏'];
const TYPING_IDLE_MS = 2500;

export default function ChatWindow({ conversationId }: ChatWindowProps) {
  const { data: apiMessages, isLoading } = useMessages(conversationId);
  const sendMessageMutation = useSendMessage();
  const uploadAttachment = useUploadChatAttachment();
  const toggleReaction = useToggleMessageReaction();
  const { user } = useAuthStore();
  const { isOnline } = usePresenceStore();
  const {
    messages: storeMessages,
    conversations,
    setMessages,
    addMessage,
    applyReaction,
    setActiveConversation,
    markConversationAsRead,
  } = useChatStore();

  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<StoreMessage | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const currentMessages = useMemo(
    () => storeMessages[conversationId] || [],
    [storeMessages, conversationId]
  );

  // The socket API is keyed by the other person, not by the conversation, so
  // every emit needs their id resolved from the conversation first.
  const conversation = conversations.find((c) => c.id === conversationId);
  const counterpart = conversation?.participants.find((p) => p.id !== user?.id)
    ?? conversation?.participants[0];
  const counterpartId = counterpart?.id;
  const isCounterpartTyping = conversation?.isTyping ?? false;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, isCounterpartTyping]);

  useEffect(() => {
    setActiveConversation(conversationId);
    markConversationAsRead(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId, markConversationAsRead, setActiveConversation]);

  // Sync API messages to Store
  useEffect(() => {
    if (apiMessages) {
      setMessages(
        conversationId,
        apiMessages.map((message: unknown) => toChatMessage(message, user?.id))
      );
    }
  }, [apiMessages, conversationId, setMessages, user?.id]);

  // Live delivery: join the room while the thread is open, leave when it closes.
  useEffect(() => {
    if (!counterpartId) return;

    socketClient.joinConversation(conversationId, counterpartId);
    return () => {
      socketClient.leaveConversation(conversationId, counterpartId);
    };
  }, [conversationId, counterpartId]);

  // Anything from them that we can see is read, whether it arrived by socket or
  // by the poll — so re-send the receipt whenever their message count changes.
  const inboundCount = useMemo(
    () => currentMessages.filter((message) => message.senderId !== user?.id).length,
    [currentMessages, user?.id]
  );

  useEffect(() => {
    if (counterpartId && inboundCount > 0) {
      socketClient.markConversationRead(counterpartId);
    }
  }, [counterpartId, inboundCount]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current && counterpartId) {
      isTypingRef.current = false;
      socketClient.setTyping(conversationId, counterpartId, false);
    }
  }, [conversationId, counterpartId]);

  // Leaving mid-sentence must not strand a typing indicator on their screen.
  useEffect(() => stopTyping, [stopTyping]);

  const handleTyping = (value: string) => {
    setNewMessage(value);
    if (!counterpartId) return;

    if (!value.trim()) {
      stopTyping();
      return;
    }

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketClient.setTyping(conversationId, counterpartId, true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const isSending = sendMessageMutation.isPending || uploadAttachment.isPending;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if ((!content && attachments.length === 0) || isSending) return;

    // Upload first. If this fails the composer keeps the files, so nothing the
    // sender picked disappears without them being told.
    let uploaded: OutgoingAttachment[] = [];
    if (attachments.length > 0) {
      try {
        uploaded = await Promise.all(attachments.map((file) => uploadAttachment.mutateAsync(file)));
      } catch {
        return; // the upload hook has already surfaced the failure
      }
    }

    try {
      const response = await sendMessageMutation.mutateAsync({
        conversationId,
        content,
        attachments: uploaded,
        replyToId: replyTo?.id,
      });

      const sent = response.data?.data;
      if (sent) {
        // The socket echo may or may not reach us first; the store dedupes by id.
        addMessage(conversationId, toChatMessage(sent, user?.id), { countAsUnread: false });
      }

      setNewMessage('');
      setAttachments([]);
      setReplyTo(null);
      stopTyping();
    } catch {
      // useSendMessage toasts the reason; keep the draft so it can be retried.
    }
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;

    const picked = Array.from(files);
    const supported = picked.filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/')
    );

    if (supported.length < picked.length) {
      toast.error('Only images and video can be attached to a message');
    }

    const room = MAX_ATTACHMENTS - attachments.length;
    if (supported.length > room) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS} files`);
    }

    if (room > 0) {
      setAttachments((prev) => [...prev, ...supported.slice(0, room)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReaction = (message: StoreMessage, emoji: string) => {
    setReactionPickerFor(null);
    const hasReacted = message.reactions?.some((r) => r.emoji === emoji && r.hasReacted) ?? false;

    // Optimistic, then rolled back if the server disagrees.
    applyReaction(conversationId, message.id, emoji, hasReacted ? 'removed' : 'added', true);
    toggleReaction.mutate(
      { conversationId, messageId: message.id, emoji, hasReacted },
      {
        onError: () =>
          applyReaction(conversationId, message.id, emoji, hasReacted ? 'added' : 'removed', true),
      }
    );
  };

  const senderName = (senderId: string) =>
    senderId === user?.id ? 'You' : counterpart?.name || 'Them';

  if (isLoading && currentMessages.length === 0) {
    return <div className="flex-1 flex items-center justify-center h-full">Loading messages...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Who the thread is with. The details pane only exists from xl up, so
          without this a phone or a laptop showed a thread with no name on it,
          and on a phone there was no way back to the list. */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <Link
          href="/dashboard/messages"
          className="md:hidden -ml-1 p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        {counterpart ? (
          <Link href={`/profile/${counterpart.id}`} className="flex items-center gap-3 min-w-0">
            <Avatar
              src={counterpart.avatar}
              alt={counterpart.name}
              fallback={(counterpart.name || 'U').slice(0, 2).toUpperCase()}
              size="sm"
            />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-900 dark:text-white">
                {counterpart.name}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {isCounterpartTyping ? 'Typing...' : isOnline(counterpart.id) ? 'Active now' : 'Offline'}
              </span>
            </span>
          </Link>
        ) : (
          <span className="font-semibold text-slate-900 dark:text-white">Conversation</span>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentMessages.map((message) => {
          const isMe = message.senderId === user?.id;
          return (
            <div key={message.id} className={`flex group ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-center gap-1 max-w-[80%] ${isMe ? 'flex-row' : 'flex-row-reverse'}`}>
                {/* Per-message actions, revealed on hover/focus */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setReplyTo(message)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={`Reply to ${senderName(message.senderId)}`}
                  >
                    <Reply className="w-4 h-4" />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setReactionPickerFor((current) => (current === message.id ? null : message.id))
                      }
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      aria-label="Add a reaction"
                      aria-expanded={reactionPickerFor === message.id}
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                    {reactionPickerFor === message.id && (
                      <div className="absolute bottom-full z-10 mb-1 flex gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleReaction(message, emoji)}
                            className="px-1 text-lg leading-none hover:scale-110 transition-transform"
                            aria-label={`React with ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className={`px-4 py-2 rounded-lg shadow-sm ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-bl-none'
                  }`}
                >
                  {message.replyTo && (
                    <div
                      className={`mb-2 border-l-2 pl-2 text-xs ${
                        isMe ? 'border-blue-300 text-blue-100' : 'border-slate-300 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <p className="font-medium">{senderName(message.replyTo.senderId)}</p>
                      <p className="line-clamp-2 break-words">{message.replyTo.content}</p>
                    </div>
                  )}

                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mb-2 space-y-2">
                      {message.attachments.map((attachment) => (
                        <MessageAttachment key={attachment.id} attachment={attachment} />
                      ))}
                    </div>
                  )}

                  {message.content && (
                    <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                  )}

                  <div
                    className={`text-xs mt-1 flex items-center gap-2 ${
                      isMe ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    <span>{format(new Date(message.createdAt), 'h:mm a')}</span>
                    {isMe && <DeliveryStatus status={message.status} />}
                  </div>

                  {message.reactions && message.reactions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.reactions.map((reaction) => (
                        <button
                          key={reaction.emoji}
                          type="button"
                          onClick={() => handleReaction(message, reaction.emoji)}
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            reaction.hasReacted
                              ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                              : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                          aria-pressed={reaction.hasReacted}
                        >
                          {reaction.emoji} {reaction.count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {isCounterpartTyping && (
        <div className="px-4 pb-1 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          {counterpart?.name || 'They'} is typing...
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4">
        {replyTo && (
          <div className="mb-3 flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-700 dark:bg-slate-800">
            <div className="min-w-0">
              <p className="font-medium text-slate-600 dark:text-slate-300">
                Replying to {senderName(replyTo.senderId)}
              </p>
              <p className="truncate text-slate-500 dark:text-slate-400">
                {replyTo.content || 'Attachment'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Cancel reply"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mb-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {attachments.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="relative border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-600 dark:text-slate-300"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="absolute -top-2 -right-2 bg-slate-900 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Attach images or video"
            disabled={attachments.length >= MAX_ATTACHMENTS}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <Input
              value={newMessage}
              onChange={(e) => handleTyping(e.target.value)}
              onBlur={stopTyping}
              placeholder="Type a message..."
              aria-label="Message"
            />
          </div>
          <Button type="submit" disabled={(!newMessage.trim() && attachments.length === 0) || isSending}>
            {uploadAttachment.isPending ? 'Uploading...' : 'Send'}
          </Button>
        </form>
      </div>
    </div>
  );
}

function MessageAttachment({ attachment }: { attachment: NonNullable<StoreMessage['attachments']>[number] }) {
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

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm underline"
    >
      <FileText className="w-4 h-4" />
      {attachment.name || 'Attachment'}
    </a>
  );
}

// Only the sender sees these, and each one reflects something the server
// actually told us — never an assumption that a message was read.
function DeliveryStatus({ status }: { status: StoreMessage['status'] }) {
  switch (status) {
    case 'sending':
      return <Clock className="w-3 h-3" aria-label="Sending" />;
    case 'sent':
      return <Check className="w-3 h-3" aria-label="Sent" />;
    case 'delivered':
      return <CheckCheck className="w-3 h-3" aria-label="Delivered" />;
    case 'read':
      return <CheckCheck className="w-3 h-3 text-white" aria-label="Read" />;
    case 'error':
      return <AlertCircle className="w-3 h-3" aria-label="Failed to send" />;
    default:
      return null;
  }
}
