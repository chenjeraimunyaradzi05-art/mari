import { create } from 'zustand';

export interface ChatMessageReply {
  id: string;
  senderId: string;
  content: string;
  // The quoted message was unsent after being replied to.
  deletedAt?: string;
}

export interface ChatMessageAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  name?: string;
  size?: number;
  mimeType?: string;
  thumbnailUrl?: string; // For video/image previews
}

// One chip per emoji, already collapsed by the API — the client never sees the
// individual reaction rows.
export interface ChatMessageReaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

export type ChatMessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'error';

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'system';
  // Disappearing messages: when this passes the row is gone on both sides.
  expiresAt?: string;
  // Unsent by the sender: the words are gone and a marker stands in their place.
  deletedAt?: string;
  // The sender changed the words after sending.
  editedAt?: string;
  mediaUrl?: string;
  status?: ChatMessageStatus;
  replyTo?: ChatMessageReply;
  attachments?: ChatMessageAttachment[];
  reactions?: ChatMessageReaction[];
  // Optimistic update tracking
  isOptimistic?: boolean;
  retryCount?: number;
  errorMessage?: string;
}

// Receipts can arrive out of order (a read receipt can overtake the delivery
// one), so status only ever moves forward.
const STATUS_RANK: Record<ChatMessageStatus, number> = {
  error: -1,
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

function isStatusUpgrade(current: ChatMessageStatus | undefined, next: ChatMessageStatus): boolean {
  if (!current) return true;
  if (current === 'error') return false; // a failed send is terminal until retried
  return STATUS_RANK[next] > STATUS_RANK[current];
}

/**
 * Maps an API/socket message row onto the shape the chat UI reads. Both the
 * REST fetch and the socket push go through here so a live message and a
 * refetched one are indistinguishable.
 */
export function toChatMessage(raw: any, viewerId?: string): ChatMessage {
  const attachments = Array.isArray(raw?.metadata?.attachments) ? raw.metadata.attachments : [];
  const isMine = !!viewerId && raw?.senderId === viewerId;

  return {
    id: raw.id,
    senderId: raw.senderId,
    content: raw.content ?? '',
    createdAt: raw.createdAt,
    type: mapMessageType(raw?.type),
    expiresAt: isoOf(raw?.expiresAt),
    deletedAt: isoOf(raw?.deletedAt),
    editedAt: isoOf(raw?.editedAt),
    // Only the sender has a receipt to show; an inbound message is simply here.
    status: isMine ? (raw?.isRead ? 'read' : 'sent') : undefined,
    replyTo: raw?.replyTo
      ? {
          id: raw.replyTo.id,
          senderId: raw.replyTo.senderId,
          content: raw.replyTo.content,
          deletedAt: isoOf(raw.replyTo.deletedAt),
        }
      : undefined,
    attachments: attachments.length
      ? attachments.map((attachment: any, index: number) => ({
          id: attachment.key || attachment.url || `${raw.id}-${index}`,
          type: attachmentType(attachment?.contentType),
          url: attachment.url,
          name: attachment.name,
          size: attachment.size,
          mimeType: attachment.contentType,
        }))
      : undefined,
    reactions: Array.isArray(raw?.reactions) ? raw.reactions : undefined,
  };
}

// Dates arrive as ISO strings over the wire and as Date objects from a few
// in-process callers; the store keeps strings.
function isoOf(value: unknown): string | undefined {
  if (typeof value === 'string' && value) return value;
  if (value instanceof Date) return value.toISOString();
  return undefined;
}

function mapMessageType(type: unknown): ChatMessage['type'] {
  switch (String(type || '').toUpperCase()) {
    case 'IMAGE':
      return 'image';
    case 'VIDEO':
      return 'video';
    case 'AUDIO':
      return 'audio';
    case 'FILE':
      return 'file';
    case 'SYSTEM':
      return 'system';
    default:
      return 'text';
  }
}

function attachmentType(contentType: unknown): ChatMessageAttachment['type'] {
  const value = String(contentType || '');
  if (value.startsWith('image/')) return 'image';
  if (value.startsWith('video/')) return 'video';
  if (value.startsWith('audio/')) return 'audio';
  return 'file';
}

export interface Conversation {
  id: string;
  participants: { id: string; name: string; avatar?: string; isVerified?: boolean }[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  updatedAt: string;
  isTyping?: boolean; // UI only
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  // Message requests: isRequest means this person is asking you; requestPending
  // means you asked and are waiting; requestDeclined means they said no.
  isRequest?: boolean;
  requestPending?: boolean;
  requestDeclined?: boolean;
  // Disappearing messages timer in seconds; null or undefined is off.
  disappearingTtlSeconds?: number | null;
}

// The badge counts what the reader would want to be told about: not threads
// they muted or archived, and not requests they have not accepted.
export function countUnread(conversations: Conversation[]): number {
  return conversations.reduce(
    (acc, c) => (c.isMuted || c.isArchived || c.isRequest ? acc : acc + (c.unreadCount || 0)),
    0
  );
}

interface ChatState {
  activeConversationId: string | null;
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  totalUnread: number;
  // Draft messages per conversation
  drafts: Record<string, string>;
  // Pending optimistic messages
  pendingMessages: Record<string, ChatMessage[]>;

  // Actions
  setActiveConversation: (id: string | null) => void;
  setConversations: (conversations: Conversation[]) => void;
  patchConversation: (conversationId: string, patch: Partial<Conversation>) => void;
  addMessage: (conversationId: string, message: ChatMessage, options?: { countAsUnread?: boolean }) => void;
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: ChatMessage['status']) => void;
  updateMessagesStatus: (conversationId: string, messageIds: string[], status: ChatMessageStatus) => void;
  applyReaction: (
    conversationId: string,
    messageId: string,
    emoji: string,
    action: 'added' | 'removed',
    isOwn: boolean
  ) => void;
  markConversationAsRead: (conversationId: string) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  getUnreadCount: () => number;
  
  // Optimistic update actions
  addOptimisticMessage: (conversationId: string, message: ChatMessage) => void;
  confirmMessage: (conversationId: string, tempId: string, confirmedMessage: ChatMessage) => void;
  failMessage: (conversationId: string, messageId: string, error: string) => void;
  retryMessage: (conversationId: string, messageId: string) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  // Several at once, for the expiry sweep.
  removeMessages: (conversationId: string, messageIds: string[]) => void;
  // The sender took a message back: the words, attachments and reactions go,
  // a marker stays so the gap is explained.
  markMessageUnsent: (conversationId: string, messageId: string, deletedAt: string) => void;
  // The sender changed the words.
  applyMessageEdit: (conversationId: string, messageId: string, content: string, editedAt: string) => void;
  setDisappearingTtl: (conversationId: string, ttl: number | null) => void;

  // Draft actions
  setDraft: (conversationId: string, content: string) => void;
  clearDraft: (conversationId: string) => void;
  
  // Conversation management
  pinConversation: (conversationId: string, pinned: boolean) => void;
  muteConversation: (conversationId: string, muted: boolean) => void;
  archiveConversation: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeConversationId: null,
  conversations: [],
  messages: {},
  isLoadingConversations: false,
  isLoadingMessages: false,
  totalUnread: 0,

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setConversations: (conversations) => set((state) => {
    // isTyping is live UI state the API knows nothing about, so a refetch must
    // not wipe an indicator that is still true.
    const typing = new Set(state.conversations.filter((c) => c.isTyping).map((c) => c.id));

    return {
      conversations: conversations.map((c) => (typing.has(c.id) ? { ...c, isTyping: true } : c)),
      totalUnread: countUnread(conversations),
    };
  }),

  patchConversation: (conversationId, patch) => set((state) => {
    const conversations = state.conversations.map((c) => (c.id === conversationId ? { ...c, ...patch } : c));
    return { conversations, totalUnread: countUnread(conversations) };
  }),

  // `countAsUnread` is false for messages the viewer sent themselves — those
  // arrive here too (own send, or an echo to a second tab) and must not inflate
  // the badge.
  addMessage: (conversationId, message, options) => {
    const countAsUnread = options?.countAsUnread ?? true;

    set((state) => {
      const currentMessages = state.messages[conversationId] || [];
      // Prevent duplicates
      if (currentMessages.some(m => m.id === message.id)) return state;

      const isUnread = countAsUnread && state.activeConversationId !== conversationId;

      // Update conversations list (last message)
      const conversationIndex = state.conversations.findIndex(c => c.id === conversationId);
      const updatedConversations = [...state.conversations];

      if (conversationIndex > -1) {
        const conv = updatedConversations[conversationIndex];
        updatedConversations[conversationIndex] = {
            ...conv,
            lastMessage: message,
            updatedAt: message.createdAt,
            unreadCount: isUnread ? conv.unreadCount + 1 : conv.unreadCount,
        };
        // Move to top
        updatedConversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      }

      return {
        messages: {
          ...state.messages,
          [conversationId]: [...currentMessages, message],
        },
        conversations: updatedConversations,
        totalUnread: isUnread ? state.totalUnread + 1 : state.totalUnread,
      };
    });
  },

  setMessages: (conversationId, messages) => {
    set((state) => {
      const previousStatuses = new Map(
        (state.messages[conversationId] || []).map((msg) => [msg.id, msg.status])
      );

      // A history refetch carries whatever the row says, which can be behind the
      // receipts we already got over the socket — never walk a status backwards.
      const merged = messages.map((msg) => {
        const previous = previousStatuses.get(msg.id);
        return previous && !isStatusUpgrade(previous, msg.status ?? 'sent') && msg.status
          ? { ...msg, status: previous }
          : msg;
      });

      return {
        messages: {
          ...state.messages,
          [conversationId]: merged,
        },
      };
    });
  },

  updateMessageStatus: (conversationId, messageId, status) => {
    set((state) => {
      const conversationMessages = state.messages[conversationId];
      if (!conversationMessages) return state;

      const updatedMessages = conversationMessages.map((msg) =>
        msg.id === messageId ? { ...msg, status } : msg
      );

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
      };
    });
  },

  updateMessagesStatus: (conversationId, messageIds, status) => {
    set((state) => {
      const conversationMessages = state.messages[conversationId];
      if (!conversationMessages || messageIds.length === 0) return state;

      const targets = new Set(messageIds);
      let changed = false;

      const updatedMessages = conversationMessages.map((msg) => {
        if (!targets.has(msg.id) || !isStatusUpgrade(msg.status, status)) return msg;
        changed = true;
        return { ...msg, status };
      });

      if (!changed) return state;

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
      };
    });
  },

  applyReaction: (conversationId, messageId, emoji, action, isOwn) => {
    set((state) => {
      const conversationMessages = state.messages[conversationId];
      if (!conversationMessages) return state;

      const updatedMessages = conversationMessages.map((msg) => {
        if (msg.id !== messageId) return msg;

        const reactions = msg.reactions || [];
        const existing = reactions.find((reaction) => reaction.emoji === emoji);

        if (action === 'added') {
          // The API is idempotent, so a repeat of one's own reaction must not
          // double the count.
          if (existing?.hasReacted && isOwn) return msg;
          const next = existing
            ? reactions.map((reaction) =>
                reaction.emoji === emoji
                  ? { ...reaction, count: reaction.count + 1, hasReacted: reaction.hasReacted || isOwn }
                  : reaction
              )
            : [...reactions, { emoji, count: 1, hasReacted: isOwn }];
          return { ...msg, reactions: next };
        }

        if (!existing) return msg;
        const next = reactions
          .map((reaction) =>
            reaction.emoji === emoji
              ? {
                  ...reaction,
                  count: reaction.count - 1,
                  hasReacted: isOwn ? false : reaction.hasReacted,
                }
              : reaction
          )
          .filter((reaction) => reaction.count > 0);
        return { ...msg, reactions: next };
      });

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
      };
    });
  },

  markConversationAsRead: (conversationId) => {
      set((state) => {
          const conversationIndex = state.conversations.findIndex(c => c.id === conversationId);
          if (conversationIndex === -1) return state;

          const oldUnread = state.conversations[conversationIndex].unreadCount;
          const updatedConversations = [...state.conversations];
          updatedConversations[conversationIndex] = {
              ...updatedConversations[conversationIndex],
              unreadCount: 0
          };

          return {
              conversations: updatedConversations,
              totalUnread: Math.max(0, state.totalUnread - oldUnread)
          };
      });
  },

  setTyping: (conversationId, isTyping) => {
      set((state) => {
          const conversationIndex = state.conversations.findIndex(c => c.id === conversationId);
          if (conversationIndex === -1) return state;
          
          const updatedConversations = [...state.conversations];
          updatedConversations[conversationIndex] = {
              ...updatedConversations[conversationIndex],
              isTyping
          };
          
          return { conversations: updatedConversations };
      });
  },

  getUnreadCount: () => {
      return get().totalUnread;
  },

  // Initialize missing state
  drafts: {},
  pendingMessages: {},

  // Optimistic update: Add message with 'sending' status
  addOptimisticMessage: (conversationId, message) => {
    const optimisticMessage: ChatMessage = {
      ...message,
      status: 'sending',
      isOptimistic: true,
      retryCount: 0,
    };

    set((state) => {
      const currentMessages = state.messages[conversationId] || [];
      const pending = state.pendingMessages[conversationId] || [];
      
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...currentMessages, optimisticMessage],
        },
        pendingMessages: {
          ...state.pendingMessages,
          [conversationId]: [...pending, optimisticMessage],
        },
      };
    });
  },

  // Confirm optimistic message with server-returned message
  confirmMessage: (conversationId, tempId, confirmedMessage) => {
    set((state) => {
      const currentMessages = state.messages[conversationId] || [];
      const pending = state.pendingMessages[conversationId] || [];

      // Replace optimistic message with confirmed one
      const updatedMessages = currentMessages.map((msg) =>
        msg.id === tempId
          ? { ...confirmedMessage, isOptimistic: false, status: 'sent' as const }
          : msg
      );

      // Remove from pending
      const updatedPending = pending.filter((msg) => msg.id !== tempId);

      // Update conversation's last message
      const conversationIndex = state.conversations.findIndex(c => c.id === conversationId);
      const updatedConversations = [...state.conversations];
      
      if (conversationIndex > -1) {
        updatedConversations[conversationIndex] = {
          ...updatedConversations[conversationIndex],
          lastMessage: confirmedMessage,
          updatedAt: confirmedMessage.createdAt,
        };
      }

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
        pendingMessages: {
          ...state.pendingMessages,
          [conversationId]: updatedPending,
        },
        conversations: updatedConversations,
      };
    });
  },

  // Mark message as failed with error
  failMessage: (conversationId, messageId, error) => {
    set((state) => {
      const currentMessages = state.messages[conversationId] || [];

      const updatedMessages = currentMessages.map((msg) =>
        msg.id === messageId
          ? { ...msg, status: 'error' as const, errorMessage: error }
          : msg
      );

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
      };
    });
  },

  // Retry sending failed message
  retryMessage: (conversationId, messageId) => {
    set((state) => {
      const currentMessages = state.messages[conversationId] || [];

      const updatedMessages = currentMessages.map((msg) =>
        msg.id === messageId
          ? { 
              ...msg, 
              status: 'sending' as const, 
              errorMessage: undefined,
              retryCount: (msg.retryCount || 0) + 1,
            }
          : msg
      );

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
      };
    });
  },

  // Remove message (for delete or permanent failure)
  removeMessage: (conversationId, messageId) => {
    set((state) => {
      const currentMessages = state.messages[conversationId] || [];
      const pending = state.pendingMessages[conversationId] || [];

      return {
        messages: {
          ...state.messages,
          [conversationId]: currentMessages.filter((msg) => msg.id !== messageId),
        },
        pendingMessages: {
          ...state.pendingMessages,
          [conversationId]: pending.filter((msg) => msg.id !== messageId),
        },
      };
    });
  },

  removeMessages: (conversationId, messageIds) => {
    if (messageIds.length === 0) return;
    const gone = new Set(messageIds);
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).filter((msg) => !gone.has(msg.id)),
      },
    }));
  },

  markMessageUnsent: (conversationId, messageId, deletedAt) => {
    set((state) => {
      const current = state.messages[conversationId];
      if (!current) return state;
      const unsent = (msg: ChatMessage): ChatMessage => ({
        ...msg,
        content: '',
        deletedAt,
        editedAt: undefined,
        attachments: undefined,
        reactions: undefined,
        mediaUrl: undefined,
      });
      return {
        messages: {
          ...state.messages,
          [conversationId]: current.map((msg) => {
            if (msg.id === messageId) return unsent(msg);
            // A reply quoting the unsent message shows the marker too.
            if (msg.replyTo?.id === messageId) return { ...msg, replyTo: { ...msg.replyTo, content: '', deletedAt } };
            return msg;
          }),
        },
        conversations: state.conversations.map((c) =>
          c.id === conversationId && c.lastMessage?.id === messageId ? { ...c, lastMessage: unsent(c.lastMessage) } : c
        ),
      };
    });
  },

  applyMessageEdit: (conversationId, messageId, content, editedAt) => {
    set((state) => {
      const current = state.messages[conversationId];
      if (!current) return state;
      return {
        messages: {
          ...state.messages,
          [conversationId]: current.map((msg) => {
            if (msg.id === messageId) return { ...msg, content, editedAt };
            if (msg.replyTo?.id === messageId) return { ...msg, replyTo: { ...msg.replyTo, content } };
            return msg;
          }),
        },
        conversations: state.conversations.map((c) =>
          c.id === conversationId && c.lastMessage?.id === messageId
            ? { ...c, lastMessage: { ...c.lastMessage, content, editedAt } }
            : c
        ),
      };
    });
  },

  setDisappearingTtl: (conversationId, ttl) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, disappearingTtlSeconds: ttl } : c
      ),
    }));
  },

  // Draft management
  setDraft: (conversationId, content) => {
    set((state) => ({
      drafts: {
        ...state.drafts,
        [conversationId]: content,
      },
    }));
  },

  clearDraft: (conversationId) => {
    set((state) => {
      const { [conversationId]: _, ...rest } = state.drafts;
      return { drafts: rest };
    });
  },

  // Conversation management
  pinConversation: (conversationId, pinned) => {
    set((state) => {
      const idx = state.conversations.findIndex(c => c.id === conversationId);
      if (idx === -1) return state;

      const updatedConversations = [...state.conversations];
      updatedConversations[idx] = { ...updatedConversations[idx], isPinned: pinned };
      
      // Sort: pinned first, then by updatedAt
      updatedConversations.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      return { conversations: updatedConversations };
    });
  },

  muteConversation: (conversationId, muted) => {
    set((state) => {
      const idx = state.conversations.findIndex(c => c.id === conversationId);
      if (idx === -1) return state;

      const updatedConversations = [...state.conversations];
      updatedConversations[idx] = { ...updatedConversations[idx], isMuted: muted };

      return { conversations: updatedConversations };
    });
  },

  archiveConversation: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
    }));
  },
}));
