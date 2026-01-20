'use client';

/**
 * Chat Layout - WhatsApp-style 3-pane layout
 * Responsive sidebar + conversation list + chat window
 * Phase 3: Web Client - Super App Core
 */

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/lib/hooks/use-media-query';
import { useChatStore } from '@/lib/stores/chat.store';
import { usePresenceStore } from '@/lib/stores/presence.store';
import {
  MessageSquare,
  Search,
  Settings,
  Edit,
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Users,
  Archive,
  Star,
  Bell,
  BellOff,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatLayoutProps {
  children?: React.ReactNode;
  className?: string;
}

export function ChatLayout({ children, className }: ChatLayoutProps) {
  const { isMobile, isTablet } = useBreakpoint();
  const [showConversations, setShowConversations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    getUnreadCount,
  } = useChatStore();
  
  const { isOnline } = usePresenceStore();

  // On mobile, show either list or conversation
  const shouldShowList = isMobile ? showConversations : true;
  const shouldShowChat = isMobile ? !showConversations : true;

  // Auto-switch to chat when conversation is selected on mobile
  useEffect(() => {
    if (isMobile && activeConversationId) {
      setShowConversations(false);
    }
  }, [isMobile, activeConversationId]);

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    if (isMobile) {
      setShowConversations(false);
    }
  };

  const handleBackToList = () => {
    setShowConversations(true);
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.participants.some((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  return (
    <div
      className={cn(
        'flex h-full bg-white dark:bg-zinc-950',
        className
      )}
    >
      {/* Conversations List Panel */}
      {shouldShowList && (
        <div
          className={cn(
            'flex flex-col border-r border-zinc-200 dark:border-zinc-800',
            isMobile ? 'w-full' : 'w-80 lg:w-96 shrink-0'
          )}
        >
          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold">Messages</h1>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon">
                  <Edit className="h-5 w-5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Archive className="h-4 w-4 mr-2" />
                      Archived
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Star className="h-4 w-4 mr-2" />
                      Starred
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                <p>No conversations yet</p>
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const isActive = conversation.id === activeConversationId;
                const isParticipantOnline = conversation.participants.some(
                  (p) => isOnline(p.id)
                );
                const unread = conversation.unreadCount;

                return (
                  <button
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation.id)}
                    className={cn(
                      'w-full flex items-start gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors text-left',
                      isActive && 'bg-zinc-100 dark:bg-zinc-800/50'
                    )}
                  >
                    {/* Avatar with online indicator */}
                    <div className="relative shrink-0">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={conversation.participants[0]?.avatar} />
                        <AvatarFallback>
                          {conversation.participants.length > 1 ? (
                            <Users className="h-5 w-5" />
                          ) : (
                            conversation.participants[0]?.name?.charAt(0) || '?'
                          )}
                        </AvatarFallback>
                      </Avatar>
                      {conversation.participants.length === 1 && isParticipantOnline && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-zinc-950" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">
                          {conversation.participants.map(p => p.name).join(', ')}
                        </span>
                        <span className="text-xs text-zinc-500 shrink-0">
                          {formatTime(conversation.updatedAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-sm text-zinc-500 truncate">
                          {conversation.lastMessage?.content || 'No messages yet'}
                        </p>
                        {unread > 0 && (
                          <Badge className="h-5 min-w-[20px] px-1.5 bg-emerald-500 text-white">
                            {unread > 99 ? '99+' : unread}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Chat Window Panel */}
      {shouldShowChat && (
        <div className="flex-1 flex flex-col min-w-0">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3 min-w-0">
                  {isMobile && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleBackToList}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                  )}
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={activeConversation.participants[0]?.avatar} />
                    <AvatarFallback>
                      {activeConversation.participants[0]?.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {activeConversation.participants.map(p => p.name).join(', ')}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {activeConversation.participants.length > 1
                        ? `${activeConversation.participants.length} members`
                        : activeConversation.participants.some((p) =>
                            isOnline(p.id)
                          )
                        ? 'Online'
                        : 'Offline'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon">
                    <Phone className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Video className="h-5 w-5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Bell className="h-4 w-4 mr-2" />
                        Mute
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Star className="h-4 w-4 mr-2" />
                        Star Conversation
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-500">
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Chat Content - passed as children */}
              <div className="flex-1 overflow-hidden">
                {children}
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
              <div className="w-24 h-24 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                <MessageSquare className="h-12 w-12" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                Your Messages
              </h2>
              <p className="text-center max-w-sm">
                Select a conversation to start chatting or create a new message
              </p>
              <Button className="mt-6">
                <Edit className="h-4 w-4 mr-2" />
                New Message
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(date: Date | string | undefined): string {
  if (!date) return '';
  
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  } else {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export default ChatLayout;
