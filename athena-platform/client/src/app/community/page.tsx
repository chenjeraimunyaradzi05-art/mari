'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChannelSidebar, ChatArea, CreateChannelModal, Channel, Message } from '@/components/channels';
import { channelApi } from '@/lib/api-extensions';
import { Loader2 } from 'lucide-react';

export default function CommunityPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>(''); // Will be set from auth context

  // Fetch channels
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await channelApi.getMyChannels();
        const channelData = response.data.data?.channels || [];
        setChannels(channelData);
        
        // Auto-select first channel
        if (channelData.length > 0 && !activeChannelId) {
          setActiveChannelId(channelData[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch channels:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, [activeChannelId]);

  // Fetch messages when channel changes
  useEffect(() => {
    if (!activeChannelId) return;

    const fetchMessages = async () => {
      setMessagesLoading(true);
      try {
        const response = await channelApi.getMessages(activeChannelId);
        setMessages(response.data.data?.messages || []);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      } finally {
        setMessagesLoading(false);
      }
    };

    fetchMessages();
  }, [activeChannelId]);

  const handleSendMessage = async (content: string) => {
    if (!activeChannelId) return;
    
    try {
      const response = await channelApi.sendMessage(activeChannelId, { content });
      const newMessage = response.data.data?.message;
      if (newMessage) {
        setMessages((prev) => [...prev, newMessage]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
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
      console.error('Failed to edit message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeChannelId) return;
    
    try {
      await channelApi.deleteMessage(activeChannelId, messageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!activeChannelId) return;
    
    try {
      const message = messages.find((m) => m.id === messageId);
      const existingReaction = message?.reactions?.find((r) => r.emoji === emoji);
      
      if (existingReaction?.hasReacted) {
        await channelApi.removeReaction(activeChannelId, messageId, emoji);
      } else {
        await channelApi.addReaction(activeChannelId, messageId, emoji);
      }

      // Update local state
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          
          const reactions = [...(msg.reactions || [])];
          const reactionIndex = reactions.findIndex((r) => r.emoji === emoji);
          
          if (reactionIndex >= 0) {
            if (reactions[reactionIndex].hasReacted) {
              reactions[reactionIndex] = {
                ...reactions[reactionIndex],
                count: reactions[reactionIndex].count - 1,
                hasReacted: false,
              };
              if (reactions[reactionIndex].count === 0) {
                reactions.splice(reactionIndex, 1);
              }
            } else {
              reactions[reactionIndex] = {
                ...reactions[reactionIndex],
                count: reactions[reactionIndex].count + 1,
                hasReacted: true,
              };
            }
          } else {
            reactions.push({ emoji, count: 1, hasReacted: true });
          }
          
          return { ...msg, reactions };
        })
      );
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  };

  const handlePinMessage = async (messageId: string) => {
    if (!activeChannelId) return;
    
    try {
      const message = messages.find((m) => m.id === messageId);
      if (message?.isPinned) {
        await channelApi.unpinMessage(activeChannelId, messageId);
      } else {
        await channelApi.pinMessage(activeChannelId, messageId);
      }
      
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, isPinned: !msg.isPinned } : msg
        )
      );
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handleCreateChannel = async (data: { name: string; description: string; type: 'public' | 'private' }) => {
    try {
      const response = await channelApi.create(data);
      const newChannel = response.data.data?.channel;
      if (newChannel) {
        setChannels((prev) => [...prev, newChannel]);
        setActiveChannelId(newChannel.id);
      }
    } catch (error) {
      console.error('Failed to create channel:', error);
    }
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  if (loading) {
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
        channels={channels}
        activeChannelId={activeChannelId || undefined}
        onChannelSelect={setActiveChannelId}
        onCreateChannel={() => setShowCreateModal(true)}
      />

      {/* Main chat area */}
      {activeChannel ? (
        <ChatArea
          channelName={activeChannel.name}
          channelType={activeChannel.type}
          messages={messages}
          currentUserId={currentUserId}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onReaction={handleReaction}
          onPinMessage={handlePinMessage}
          isLoading={messagesLoading}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Welcome to Athena Community
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Select a channel to start chatting or create a new one
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Create Channel
            </button>
          </div>
        </div>
      )}

      {/* Create channel modal */}
      <CreateChannelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateChannel}
      />
    </div>
  );
}
