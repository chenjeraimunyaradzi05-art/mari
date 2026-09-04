'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ChannelSidebar,
  ChatArea,
  CreateChannelModal,
  DiscoverChannelsModal,
  authorName,
  type Channel,
  type ChannelMember,
  type ComposerState,
  type DiscoverableChannel,
  type Message,
  type MessageAttachment,
} from '@/components/channels';
import { channelApi } from '@/lib/api-extensions';
import { mediaApi } from '@/lib/api';
import { useAuth } from '@/lib/hooks';
import { socketClient } from '@/lib/socket';
import { useSocket } from '@/lib/hooks/use-socket';

/**
 * Community channels.
 *
 * This page read `data.channels`, `data.messages`, `data.message` and
 * `data.channel` from responses whose payload is the array or the object
 * itself, so it never showed a channel, never showed a message, and dropped
 * every message it sent. Channel creation posted `type: "public"` to an API
 * whose type is an enum, so it always answered 400. It now speaks the API's
 * shapes, listens on the channel's socket room with a poll as the safety net,
 * and lets a member browse and join the public channels they are not in.
 */

type ApiChannel = {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  ownerId: string;
  isPublic: boolean;
  allowReplies: boolean;
  memberCount: number;
  messageCount?: number;
  avatarUrl?: string | null;
};

type ApiMessage = {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  mediaUrls?: unknown;
  isPinned?: boolean;
  editedAt?: string | null;
  createdAt: string;
  author?: { id: string; displayName?: string | null; avatar?: string | null } | null;
  reactions?: Array<{ emoji: string; count: number; hasReacted: boolean }>;
};

const POLL_MS = 15000;
const TYPING_TTL_MS = 4000;
const TYPING_EMIT_GAP_MS = 2000;
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'm4v']);

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message;

function attachmentsFrom(mediaUrls: unknown): MessageAttachment[] | undefined {
  if (!Array.isArray(mediaUrls)) return undefined;
  const urls = mediaUrls.filter((url): url is string => typeof url === 'string');
  if (urls.length === 0) return undefined;
  return urls.map((url) => {
    let name = url.split('/').pop() || 'attachment';
    try {
      name = decodeURIComponent(name);
    } catch {
      // A malformed escape is still a usable file name.
    }
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const type = IMAGE_EXT.has(ext) ? 'image' : VIDEO_EXT.has(ext) ? 'video' : 'file';
    return { id: url, name, url, type };
  });
}

function toMessage(raw: ApiMessage): Message {
  return {
    id: raw.id,
    content: raw.content ?? '',
    author: raw.author ?? { id: raw.authorId },
    createdAt: raw.createdAt,
    editedAt: raw.editedAt ?? undefined,
    isPinned: Boolean(raw.isPinned),
    reactions: raw.reactions ?? [],
    attachments: attachmentsFrom(raw.mediaUrls),
  };
}

/** Newest state wins per id; the result is in time order. */
function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const byId = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export default function CommunityPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { socket, connected: socketConnected } = useSocket();
  const currentUserId = user?.id ?? '';

  const [channels, setChannels] = useState<ApiChannel[]>([]);
  // channelId -> unread count, for every channel the viewer belongs to.
  const [membership, setMembership] = useState<Map<string, number>>(new Map());
  const membershipRef = useRef(membership);
  membershipRef.current = membership;

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const lastTypingEmit = useRef(0);
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;
  const isOwner = Boolean(activeChannel && activeChannel.ownerId === currentUserId);
  const isMember = Boolean(activeChannel && (isOwner || membership.has(activeChannel.id)));

  // ---------------------------------------------------------------------
  // Channels
  // ---------------------------------------------------------------------
  const loadChannels = useCallback(async () => {
    const [listResponse, unreadResponse] = await Promise.all([
      channelApi.getMyChannels(),
      isAuthenticated ? channelApi.getUnreadCounts().catch(() => null) : Promise.resolve(null),
    ]);
    const list: ApiChannel[] = Array.isArray(listResponse.data?.data) ? listResponse.data.data : [];
    const rows: Array<{ channelId: string; unreadCount: number }> =
      unreadResponse?.data?.data?.channels ?? [];
    setChannels(list);
    setMembership(new Map(rows.map((row) => [row.channelId, Number(row.unreadCount) || 0])));
    return list;
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setLoading(true);
    loadChannels()
      .then((list) => {
        if (cancelled) return;
        setActiveChannelId((current) => current ?? list[0]?.id ?? null);
      })
      .catch((error) => {
        if (!cancelled) toast.error(errorMessage(error) || 'Could not load channels');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, loadChannels]);

  const sidebarChannels: Channel[] = useMemo(
    () =>
      channels.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? undefined,
        type: c.isPublic ? 'public' : 'private',
        icon: c.avatarUrl ?? undefined,
        unreadCount: membership.get(c.id) ?? 0,
        memberCount: c.memberCount,
        isMuted: false,
        isMember: c.ownerId === currentUserId || membership.has(c.id),
        ownerId: c.ownerId,
        allowReplies: c.allowReplies,
      })),
    [channels, membership, currentUserId]
  );

  // ---------------------------------------------------------------------
  // Messages for the open channel
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!activeChannelId) return;
    let cancelled = false;
    setMessages([]);
    setTyping({});
    setMessagesLoading(true);

    channelApi
      .getMessages(activeChannelId, { limit: 50 })
      .then((response) => {
        if (cancelled) return;
        const rows: ApiMessage[] = Array.isArray(response.data?.data) ? response.data.data : [];
        // The API returns newest first; the thread reads oldest first.
        setMessages(rows.map(toMessage).reverse());
      })
      .catch((error) => {
        if (!cancelled) toast.error(errorMessage(error) || 'Could not load messages');
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });

    // Opening a channel you belong to reads it.
    if (membershipRef.current.has(activeChannelId)) {
      channelApi
        .markRead(activeChannelId)
        .then(() => {
          setMembership((prev) => {
            if (!prev.has(activeChannelId)) return prev;
            const next = new Map(prev);
            next.set(activeChannelId, 0);
            return next;
          });
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [activeChannelId]);

  // Poll as the safety net for a dropped socket or one that never connected.
  useEffect(() => {
    if (!activeChannelId) return;
    const timer = setInterval(() => {
      channelApi
        .getMessages(activeChannelId, { limit: 20 })
        .then((response) => {
          const rows: ApiMessage[] = Array.isArray(response.data?.data) ? response.data.data : [];
          setMessages((prev) => mergeMessages(prev, rows.map(toMessage)));
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [activeChannelId]);

  // Live delivery through the channel room. Keyed on the socket instance and
  // its connection so a replaced or reconnected socket re-joins the room.
  useEffect(() => {
    if (!activeChannelId || authLoading || !socket || !socketConnected) return;

    const onMessage = (payload: { channelId?: string; message?: ApiMessage }) => {
      if (payload?.channelId !== activeChannelId || !payload.message) return;
      setMessages((prev) => mergeMessages(prev, [toMessage(payload.message as ApiMessage)]));
      setTyping((prev) => {
        if (!payload.message?.authorId || !(payload.message.authorId in prev)) return prev;
        const next = { ...prev };
        delete next[payload.message.authorId];
        return next;
      });
    };
    const onTyping = (payload: { channelId?: string; userId?: string }) => {
      if (payload?.channelId !== activeChannelId || !payload.userId || payload.userId === currentUserId) return;
      setTyping((prev) => ({ ...prev, [payload.userId as string]: Date.now() + TYPING_TTL_MS }));
    };
    const onStoppedTyping = (payload: { channelId?: string; userId?: string }) => {
      if (payload?.channelId !== activeChannelId || !payload.userId) return;
      setTyping((prev) => {
        if (!(payload.userId as string in prev)) return prev;
        const next = { ...prev };
        delete next[payload.userId as string];
        return next;
      });
    };

    socket.on('channels:message', onMessage);
    socket.on('channels:user_typing', onTyping);
    socket.on('channels:user_stopped_typing', onStoppedTyping);
    socket.emit('channels:join', activeChannelId);

    return () => {
      socket.off('channels:message', onMessage);
      socket.off('channels:user_typing', onTyping);
      socket.off('channels:user_stopped_typing', onStoppedTyping);
      if (socket.connected) socket.emit('channels:leave', activeChannelId);
    };
  }, [activeChannelId, authLoading, socket, socketConnected, currentUserId]);

  // Typing indicators expire on their own if the stop event never arrives.
  useEffect(() => {
    const ids = Object.keys(typing);
    if (ids.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setTyping((prev) => {
        const next = Object.fromEntries(Object.entries(prev).filter(([, until]) => until > now));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [typing]);

  const typingUsers = useMemo(() => {
    const names = new Map<string, string>();
    for (const message of messages) names.set(message.author.id, authorName(message.author));
    return Object.keys(typing).map((id) => names.get(id) ?? 'Someone');
  }, [typing, messages]);

  const handleTyping = useCallback(() => {
    if (!activeChannelId || !isMember) return;
    const now = Date.now();
    if (now - lastTypingEmit.current > TYPING_EMIT_GAP_MS) {
      socketClient.emit('channels:typing', activeChannelId);
      lastTypingEmit.current = now;
    }
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
    stopTypingTimer.current = setTimeout(() => {
      socketClient.emit('channels:stop_typing', activeChannelId);
      lastTypingEmit.current = 0;
    }, TYPING_TTL_MS - 1000);
  }, [activeChannelId, isMember]);

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------
  const handleSendMessage = async (content: string, files?: File[]) => {
    if (!activeChannelId) return;
    try {
      const mediaUrls: string[] = [];
      for (const file of files ?? []) {
        const kind = file.type.startsWith('video/') ? 'video' : 'post';
        const upload = await mediaApi.upload(kind, file);
        const url = upload.data?.data?.url;
        if (typeof url === 'string') mediaUrls.push(url);
      }
      const response = await channelApi.sendMessage(activeChannelId, {
        content,
        ...(mediaUrls.length > 0 ? { mediaUrls } : {}),
      });
      const sent = response.data?.data;
      if (sent) setMessages((prev) => mergeMessages(prev, [toMessage(sent)]));
      if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
      socketClient.emit('channels:stop_typing', activeChannelId);
      lastTypingEmit.current = 0;
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not send the message');
      throw error;
    }
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    if (!activeChannelId) return;
    try {
      await channelApi.editMessage(activeChannelId, messageId, content);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, content, editedAt: new Date().toISOString() } : msg
        )
      );
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not edit the message');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeChannelId) return;
    if (!window.confirm('Delete this message?')) return;
    try {
      await channelApi.deleteMessage(activeChannelId, messageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not delete the message');
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!activeChannelId) return;
    if (!isMember) {
      toast.error('Join the channel to react');
      return;
    }
    const message = messages.find((m) => m.id === messageId);
    const existing = message?.reactions?.find((r) => r.emoji === emoji);
    const removing = Boolean(existing?.hasReacted);

    const apply = (list: Message[], undo: boolean) =>
      list.map((msg) => {
        if (msg.id !== messageId) return msg;
        const reactions = [...(msg.reactions || [])];
        const index = reactions.findIndex((r) => r.emoji === emoji);
        const shouldRemove = undo ? !removing : removing;
        if (index >= 0) {
          const delta = shouldRemove ? -1 : 1;
          const next = { ...reactions[index], count: reactions[index].count + delta, hasReacted: !shouldRemove };
          if (next.count <= 0) reactions.splice(index, 1);
          else reactions[index] = next;
        } else if (!shouldRemove) {
          reactions.push({ emoji, count: 1, hasReacted: true });
        }
        return { ...msg, reactions };
      });

    setMessages((prev) => apply(prev, false));
    try {
      if (removing) await channelApi.removeReaction(activeChannelId, messageId, emoji);
      else await channelApi.addReaction(activeChannelId, messageId, emoji);
    } catch (error) {
      setMessages((prev) => apply(prev, true));
      toast.error(errorMessage(error) || 'Could not update the reaction');
    }
  };

  const handlePinMessage = async (messageId: string) => {
    if (!activeChannelId) return;
    const message = messages.find((m) => m.id === messageId);
    try {
      if (message?.isPinned) await channelApi.unpinMessage(activeChannelId, messageId);
      else await channelApi.pinMessage(activeChannelId, messageId);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, isPinned: !msg.isPinned } : msg))
      );
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not update the pin');
    }
  };

  const joinChannel = async (channel: { id: string; name: string }) => {
    setJoining(true);
    try {
      await channelApi.join(channel.id);
      setMembership((prev) => new Map(prev).set(channel.id, 0));
      setChannels((prev) => {
        const known = prev.some((c) => c.id === channel.id);
        return known
          ? prev.map((c) => (c.id === channel.id ? { ...c, memberCount: c.memberCount + 1 } : c))
          : prev;
      });
      toast.success(`Joined #${channel.name}`);
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not join the channel');
      throw error;
    } finally {
      setJoining(false);
    }
  };

  const handleJoinActive = async () => {
    if (!activeChannel) return;
    try {
      await joinChannel(activeChannel);
    } catch {
      // Already reported.
    }
  };

  const handleDiscoverJoin = async (channel: DiscoverableChannel) => {
    await joinChannel(channel);
    // Discover only lists channels the viewer is not in, so it is new here.
    setChannels((prev) =>
      prev.some((c) => c.id === channel.id)
        ? prev
        : [
            ...prev,
            {
              id: channel.id,
              name: channel.name,
              description: channel.description ?? null,
              type: channel.type,
              ownerId: channel.owner?.id ?? '',
              isPublic: channel.isPublic,
              allowReplies: true,
              memberCount: channel.memberCount + 1,
            },
          ]
    );
    setActiveChannelId(channel.id);
  };

  const handleLeave = async () => {
    if (!activeChannel) return;
    if (!window.confirm(`Leave #${activeChannel.name}?`)) return;
    try {
      await channelApi.leave(activeChannel.id);
      setMembership((prev) => {
        const next = new Map(prev);
        next.delete(activeChannel.id);
        return next;
      });
      setChannels((prev) =>
        activeChannel.isPublic
          ? prev.map((c) =>
              c.id === activeChannel.id ? { ...c, memberCount: Math.max(0, c.memberCount - 1) } : c
            )
          : prev.filter((c) => c.id !== activeChannel.id)
      );
      if (!activeChannel.isPublic) setActiveChannelId(null);
      toast.success(`Left #${activeChannel.name}`);
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not leave the channel');
    }
  };

  const handleCreateChannel = async (data: {
    name: string;
    description: string;
    type: 'public' | 'private';
  }) => {
    try {
      const response = await channelApi.create({
        name: data.name,
        description: data.description || undefined,
        type: 'COMMUNITY_CHANNEL',
        isPublic: data.type === 'public',
        // A community channel is a conversation, not a broadcast.
        allowReplies: true,
      });
      const created: ApiChannel | undefined = response.data?.data;
      if (created) {
        setChannels((prev) => [...prev, created]);
        setMembership((prev) => new Map(prev).set(created.id, 0));
        setActiveChannelId(created.id);
      }
      setShowCreateModal(false);
      toast.success(`Created #${data.name}`);
    } catch (error) {
      toast.error(errorMessage(error) || 'Could not create the channel');
    }
  };

  const loadPinned = useCallback(async () => {
    if (!activeChannelId) return [];
    const response = await channelApi.getPinnedMessages(activeChannelId);
    const rows: ApiMessage[] = Array.isArray(response.data?.data) ? response.data.data : [];
    return rows.map(toMessage);
  }, [activeChannelId]);

  const loadMembers = useCallback(async (): Promise<ChannelMember[]> => {
    if (!activeChannelId) return [];
    const response = await channelApi.getMembers(activeChannelId);
    const rows: Array<{
      userId?: string;
      role?: string | null;
      user?: { id: string; displayName?: string | null; avatar?: string | null; headline?: string | null } | null;
    }> = Array.isArray(response.data?.data) ? response.data.data : [];
    return rows
      .map((row) => ({
        id: row.user?.id ?? row.userId ?? '',
        displayName: row.user?.displayName,
        avatar: row.user?.avatar,
        headline: row.user?.headline,
        role: row.role,
      }))
      .filter((member) => member.id);
  }, [activeChannelId]);

  const composer: ComposerState = !isAuthenticated
    ? 'sign-in'
    : !isMember
    ? 'join'
    : activeChannel && !activeChannel.allowReplies && !isOwner
    ? 'read-only'
    : 'input';

  if (loading || authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <ChannelSidebar
        channels={sidebarChannels}
        activeChannelId={activeChannelId || undefined}
        onChannelSelect={setActiveChannelId}
        onCreateChannel={() => {
          if (!isAuthenticated) {
            toast.error('Sign in to create a channel');
            return;
          }
          setShowCreateModal(true);
        }}
        onDiscover={isAuthenticated ? () => setShowDiscover(true) : undefined}
      />

      {/* Main chat area */}
      {activeChannel ? (
        <ChatArea
          channelName={activeChannel.name}
          channelType={activeChannel.isPublic ? 'public' : 'private'}
          channelDescription={activeChannel.description ?? undefined}
          memberCount={activeChannel.memberCount}
          messages={messages}
          currentUserId={currentUserId}
          composer={composer}
          canModerate={isOwner}
          canLeave={isMember && !isOwner}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onReaction={handleReaction}
          onPinMessage={handlePinMessage}
          onJoin={handleJoinActive}
          onLeave={handleLeave}
          onLoadPinned={loadPinned}
          onLoadMembers={isMember ? loadMembers : undefined}
          onTyping={handleTyping}
          isLoading={messagesLoading}
          isJoining={joining}
          typingUsers={typingUsers}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="text-center px-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Welcome to the ATHENA community
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              {channels.length === 0
                ? 'No channels yet. Browse the public ones or start your own.'
                : 'Pick a channel to start reading.'}
            </p>
            <div className="flex items-center justify-center gap-2">
              {isAuthenticated && (
                <button
                  onClick={() => setShowDiscover(true)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Browse channels
                </button>
              )}
              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    toast.error('Sign in to create a channel');
                    return;
                  }
                  setShowCreateModal(true);
                }}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Create channel
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateChannelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateChannel}
      />

      <DiscoverChannelsModal
        isOpen={showDiscover}
        onClose={() => setShowDiscover(false)}
        onJoin={handleDiscoverJoin}
      />
    </div>
  );
}
